"""
telemetry_manager.py — Fine-Grained CPU & NPU Performance Profiler
Tracks resource usage across Processes -> Pipelines -> Nodes.
"""

import os
import time
import psutil
import logging
import threading
from typing import Dict, Any, List, Optional
from collections import deque

logger = logging.getLogger(__name__)

class NodeMetrics:
    """Tracks running telemetry statistics for a specific node in a pipeline."""
    def __init__(self, node_id: str, node_type: str, name: str = ""):
        self.node_id = node_id
        self.node_type = node_type
        self.name = name or node_id
        self.lock = threading.Lock()

        # Call history in last rolling window
        self.exec_times = deque(maxlen=60)      # seconds per execution or ms
        self.timestamps = deque(maxlen=60)
        
        # Current aggregated metrics (updated per tick)
        self.cpu_percent = 0.0
        self.npu_percent = 0.0
        self.latency_ms = 0.0
        self.npu_latency_ms = 0.0
        self.cpu_postprocess_ms = 0.0
        self.fps = 0.0
        self.freq_hz = 0.0
        self.queue_drop_count = 0
        self.last_seen = time.time()
        self.extra = {}

    def record_execution(self, duration_sec: float):
        now = time.time()
        with self.lock:
            self.exec_times.append(duration_sec)
            self.timestamps.append(now)
            self.last_seen = now

    def record_npu(self, latency_ms: float):
        now = time.time()
        with self.lock:
            self.npu_latency_ms = round(latency_ms, 2)
            self.exec_times.append(latency_ms / 1000.0)
            self.timestamps.append(now)
            self.last_seen = now

    def record_gst_metric(self, latency_ms: Optional[float] = None, fps: Optional[float] = None, extra: Optional[dict] = None):
        with self.lock:
            if latency_ms is not None:
                self.latency_ms = round(latency_ms, 2)
            if fps is not None:
                self.fps = round(fps, 1)
            if extra:
                self.extra.update(extra)
            self.last_seen = time.time()

    def roll_up(self, time_window_sec: float = 1.0, num_cores: int = 4) -> dict:
        now = time.time()
        with self.lock:
            cutoff = now - time_window_sec
            recent = [t for t, ts in zip(self.exec_times, self.timestamps) if ts >= cutoff]
            count = len(recent)

            if count > 0:
                avg_sec = sum(recent) / count
                freq = count / max(time_window_sec, 0.1)
                
                if self.node_type == "aiNode":
                    self.fps = round(freq, 1)
                    # NPU % = min(100, (npu_latency_ms * fps / 10))
                    if self.npu_latency_ms > 0 and self.fps > 0:
                        self.npu_percent = round(min(100.0, (self.npu_latency_ms * self.fps) / 10.0), 1)
                    # CPU post-process and python probe duty cycle
                    cpu_ms = self.extra.get("cpu_postprocess_ms", 0) + self.extra.get("python_probe_ms", 0)
                    self.cpu_percent = round(min(100.0, (cpu_ms * self.fps) / (10.0 * num_cores)), 1)
                elif self.node_type in ("logicNode", "functionNode", "counterNode", "rateLimitNode", "actionNode", "hardwareOutputNode"):
                    self.freq_hz = round(freq, 1)
                    self.latency_ms = round(avg_sec * 1000.0, 3)
                    # Total CPU time in window / window duration / num_cores
                    total_cpu_sec = sum(recent)
                    self.cpu_percent = round(min(100.0, (total_cpu_sec / (time_window_sec * num_cores)) * 100.0), 2)
                elif self.node_type == "inputNode":
                    # Stream decoding CPU duty cycle
                    if self.latency_ms > 0 and self.fps > 0:
                        self.cpu_percent = round(min(100.0, (self.latency_ms * self.fps) / (10.0 * num_cores)), 1)
                elif self.node_type == "dashboardVideoNode":
                    # x264enc and stream sink duty cycle
                    if self.latency_ms > 0 and self.fps > 0:
                        self.cpu_percent = round(min(100.0, (self.latency_ms * self.fps) / (10.0 * num_cores)), 1)
            else:
                # Idle decay if inactive for > 2 seconds
                if now - self.last_seen > 2.0:
                    self.fps = 0.0
                    self.freq_hz = 0.0
                    self.cpu_percent = 0.0
                    self.npu_percent = 0.0

            res = {
                "node_id": self.node_id,
                "node_type": self.node_type,
                "name": self.name,
                "cpu_percent": self.cpu_percent,
                "npu_percent": self.npu_percent,
                "fps": self.fps,
                "latency_ms": self.latency_ms,
                "last_active": round(now - self.last_seen, 1)
            }
            if self.node_type == "aiNode":
                res["npu_latency_ms"] = self.npu_latency_ms
                res["cpu_postprocess_ms"] = self.extra.get("cpu_postprocess_ms", 0.0)
                res["python_probe_ms"] = self.extra.get("python_probe_ms", 0.0)
                res["model"] = self.extra.get("model", "")
            elif self.freq_hz > 0 or self.node_type in ("logicNode", "functionNode", "counterNode"):
                res["freq_hz"] = self.freq_hz
            if self.extra:
                for k, v in self.extra.items():
                    if k not in res:
                        res[k] = v
            return res


class TelemetryManager:
    """Central singleton service for collecting and correlating resource usage."""
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(TelemetryManager, cls).__new__(cls)
                cls._instance._init_manager()
            return cls._instance

    def _init_manager(self):
        self.num_cores = os.cpu_count() or 4
        self.lock = threading.Lock()

        # Registered Pipelines: {project_id: {"name": str, "status": str, "nodes": {node_id: NodeMetrics}}}
        self.pipelines: Dict[str, Dict[str, Any]] = {}

        # Registered Subprocesses: {pid: {"name": str, "pipeline_id": Optional[str], "proc": psutil.Process}}
        self.tracked_processes: Dict[int, Dict[str, Any]] = {}

        # Cache for external daemon pids (e.g. mediamtx)
        self.mediamtx_pid: Optional[int] = None
        self._find_mediamtx_process()

        # Main process
        self.main_proc = psutil.Process(os.getpid())
        # Call once to initialize psutil percent calculation
        self.main_proc.cpu_percent(interval=None)

        self.last_poll_time = time.time()
        logger.info("TelemetryManager initialized successfully.")

    def _find_mediamtx_process(self):
        """Locates the MediaMTX daemon process if running."""
        try:
            for p in psutil.process_iter(['pid', 'name']):
                if 'mediamtx' in p.info['name'].lower():
                    self.mediamtx_pid = p.info['pid']
                    break
        except Exception:
            pass

    def register_pipeline(self, pipeline_id: str, name: str = "Pipeline"):
        with self.lock:
            if pipeline_id not in self.pipelines:
                self.pipelines[pipeline_id] = {
                    "name": name,
                    "status": "running",
                    "nodes": {},
                    "start_time": time.time()
                }
            else:
                self.pipelines[pipeline_id]["status"] = "running"

    def unregister_pipeline(self, pipeline_id: str):
        with self.lock:
            if pipeline_id in self.pipelines:
                self.pipelines[pipeline_id]["status"] = "stopped"

    def register_process(self, pipeline_id: Optional[str], name: str, pid: int):
        with self.lock:
            try:
                proc = psutil.Process(pid)
                proc.cpu_percent(interval=None)
                self.tracked_processes[pid] = {
                    "name": name,
                    "pipeline_id": pipeline_id,
                    "proc": proc
                }
            except Exception as e:
                logger.debug(f"Failed to register process {pid}: {e}")

    def unregister_process(self, pid: int):
        with self.lock:
            self.tracked_processes.pop(pid, None)

    def _get_node(self, pipeline_id: str, node_id: str, node_type: str, name: str = "") -> NodeMetrics:
        if pipeline_id not in self.pipelines:
            self.register_pipeline(pipeline_id)
        pipe = self.pipelines[pipeline_id]
        if node_id not in pipe["nodes"]:
            pipe["nodes"][node_id] = NodeMetrics(node_id, node_type, name)
        return pipe["nodes"][node_id]

    def record_npu_inference(self, pipeline_id: str, node_id: str, latency_ms: float, model: str = ""):
        node = self._get_node(pipeline_id, node_id, "aiNode")
        node.record_npu(latency_ms)
        if model:
            node.extra["model"] = model

    def record_gstreamer_node_metric(self, pipeline_id: str, node_id: str, node_type: str,
                                     latency_ms: Optional[float] = None, fps: Optional[float] = None,
                                     extra: Optional[dict] = None):
        node = self._get_node(pipeline_id, node_id, node_type)
        node.record_gst_metric(latency_ms=latency_ms, fps=fps, extra=extra)

    def record_router_node_execution(self, pipeline_id: str, node_id: str, node_type: str, duration_sec: float):
        node = self._get_node(pipeline_id, node_id, node_type)
        node.record_execution(duration_sec)

    def _read_cpu_temp(self) -> float:
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                return round(float(f.read().strip()) / 1000.0, 1)
        except Exception:
            return 0.0

    def get_full_telemetry(self) -> Dict[str, Any]:
        """
        Compiles the full hierarchical telemetry snapshot:
        System -> Processes -> Pipelines -> Nodes
        """
        now = time.time()
        elapsed = max(now - self.last_poll_time, 0.5)
        self.last_poll_time = now

        # 1. System Level Metrics
        total_cpu = psutil.cpu_percent(interval=None)
        cpu_cores = psutil.cpu_percent(percpu=True, interval=None)
        ram = psutil.virtual_memory()
        temp_c = self._read_cpu_temp()

        # 2. Process Level Metrics
        processes_list = []
        # Main backend process
        try:
            main_cpu = self.main_proc.cpu_percent(interval=None)
            main_mem = round(self.main_proc.memory_info().rss / (1024 * 1024), 1)
            processes_list.append({
                "name": "backend (FastAPI / AI Worker)",
                "pid": self.main_proc.pid,
                "cpu_percent": round(main_cpu, 1),
                "memory_mb": main_mem,
                "role": "core"
            })
        except Exception:
            pass

        # MediaMTX process
        if not self.mediamtx_pid:
            self._find_mediamtx_process()
        if self.mediamtx_pid:
            try:
                m_proc = psutil.Process(self.mediamtx_pid)
                m_cpu = m_proc.cpu_percent(interval=None)
                m_mem = round(m_proc.memory_info().rss / (1024 * 1024), 1)
                processes_list.append({
                    "name": "mediamtx (RTSP/WebRTC)",
                    "pid": self.mediamtx_pid,
                    "cpu_percent": round(m_cpu, 1),
                    "memory_mb": m_mem,
                    "role": "media_server"
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                self.mediamtx_pid = None

        # Child / Subprocesses (FFmpeg video loop, snapshots)
        dead_pids = []
        with self.lock:
            for pid, info in list(self.tracked_processes.items()):
                try:
                    proc = info["proc"]
                    p_cpu = proc.cpu_percent(interval=None)
                    p_mem = round(proc.memory_info().rss / (1024 * 1024), 1)
                    processes_list.append({
                        "name": info["name"],
                        "pid": pid,
                        "pipeline_id": info["pipeline_id"],
                        "cpu_percent": round(p_cpu, 1),
                        "memory_mb": p_mem,
                        "role": "subprocess"
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    dead_pids.append(pid)

            for pid in dead_pids:
                self.tracked_processes.pop(pid, None)

            # 3. Pipelines & Nodes
            pipelines_list = []
            global_npu_util = 0.0

            for pid, pdata in self.pipelines.items():
                if pdata["status"] != "running":
                    continue

                nodes_list = []
                pipe_cpu = 0.0
                pipe_npu = 0.0

                for nid, node_obj in pdata["nodes"].items():
                    n_stat = node_obj.roll_up(time_window_sec=elapsed, num_cores=self.num_cores)
                    nodes_list.append(n_stat)
                    pipe_cpu += n_stat.get("cpu_percent", 0.0)
                    if n_stat.get("npu_percent", 0.0) > 0:
                        pipe_npu = max(pipe_npu, n_stat["npu_percent"])

                # Add subprocess CPU for this pipeline
                for proc_info in processes_list:
                    if proc_info.get("pipeline_id") == pid:
                        pipe_cpu += proc_info.get("cpu_percent", 0.0)

                pipe_cpu = round(min(100.0, pipe_cpu), 1)
                global_npu_util = max(global_npu_util, pipe_npu)

                pipelines_list.append({
                    "pipeline_id": pid,
                    "name": pdata.get("name", pid),
                    "status": pdata["status"],
                    "cpu_percent": pipe_cpu,
                    "npu_percent": round(pipe_npu, 1),
                    "nodes": nodes_list
                })

        # Build final payload
        telemetry = {
            "timestamp": round(now, 2),
            "system": {
                "cpu_percent": round(total_cpu, 1),
                "cpu_cores": [round(c, 1) for c in cpu_cores],
                "ram_percent": round(ram.percent, 1),
                "ram_used_mb": round((ram.total - ram.available) / (1024 * 1024), 1),
                "ram_total_mb": round(ram.total / (1024 * 1024), 1),
                "temp_c": temp_c,
                "npu_percent": round(global_npu_util, 1),
                "npu_device": "Hailo-8L (PCIe 0001:03:00.0)"
            },
            "processes": processes_list,
            "pipelines": pipelines_list,
            # Backwards-compatibility fields for legacy widgets:
            "cpu_percent": round(total_cpu, 1),
            "ram_percent": round(ram.percent, 1),
            "temp_c": temp_c,
            "npu_percent": round(global_npu_util, 1)
        }

        return telemetry

# Global singleton instance
telemetry_mgr = TelemetryManager()
