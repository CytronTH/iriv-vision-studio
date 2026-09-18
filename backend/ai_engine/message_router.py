import logging
import time
import queue
import threading
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class PipelineNode:
    def __init__(self, node_id: str, data: dict, router: 'MessageRouter', node_type: str = "customNode"):
        self.node_id = node_id
        self.data = data
        self.router = router
        self.node_type = node_type

    def process(self, msg: dict):
        return msg
class RateLimitNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="rateLimitNode")
        rate_val = float(data.get("rate", 1))
        period_str = data.get("period", "second")
        
        if period_str == "second":
            self.interval = 1.0 / rate_val
        elif period_str == "minute":
            self.interval = 60.0 / rate_val
        elif period_str == "hour":
            self.interval = 3600.0 / rate_val
        else:
            self.interval = 1.0

        self.last_sent_time = 0

    def process(self, msg: dict):
        import time
        current_time = time.time()
        
        if current_time - self.last_sent_time >= self.interval:
            self.last_sent_time = current_time
            # Send state for UI
            if self.router.metadata_callback:
                self.router.metadata_callback({
                    "type": "rate_limit_state",
                    "node_id": self.node_id,
                    "msg": msg,
                    "camera_id": msg.get("metadata", {}).get("camera_id")
                })
            return msg
        else:
            # Drop the message
            return None

class LogicNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="logicNode")
        self.expression = data.get("expression", "count > 0")
        # Handle shorthand logical operators
        self.expression = (self.expression
            .replace(" && ", " and ")
            .replace(" || ", " or ")
            .replace("&&", " and ")
            .replace("||", " or ")
            .replace("!", " not "))
        
        self.debounce_ms = data.get("debounceMs", 0) / 1000.0
        self.first_true = None

    def process(self, msg: dict):
        payload = msg.get("payload", [])
        
        if isinstance(payload, dict) and "detections" in payload:
            parsed_results = payload["detections"]
        elif isinstance(payload, list):
            parsed_results = payload
        else:
            parsed_results = []
            
        if parsed_results is not None:
            # Expecting list of detections
            detected_labels = [obj.get("label", "") for obj in parsed_results]
            label_set = set(detected_labels)
            
            def _has(lbl): return lbl in label_set
            def _label_count(lbl): return sum(1 for l in detected_labels if l == lbl)
            def _label_confidence(lbl): 
                vals = [o.get("confidence", 0) for o in parsed_results if o.get("label") == lbl]
                return max(vals) if vals else 0.0
            def _all_labels(*lbls): return all(l in label_set for l in lbls)
            def _any_label(*lbls): return any(l in label_set for l in lbls)
            
            all_confidences = [obj.get("confidence", 0) for obj in parsed_results]

            eval_ctx = {
                "msg": msg,
                "context": msg.get("context", {}),
                "count": len(parsed_results),
                "labels": label_set,
                "detections": parsed_results,
                "payload": payload,
                "has": _has,
                "label_count": _label_count,
                "label_confidence": _label_confidence,
                "all_labels": _all_labels,
                "any_label": _any_label,
                "confidence": max(all_confidences) if all_confidences else 0.0,
                "min": min, "max": max, "len": len,
                "any": any, "all": all, "abs": abs, "round": round,
                "True": True, "False": False,
                "true": True, "false": False,
            }
            try:
                is_true = bool(eval(self.expression, {"__builtins__": {}}, eval_ctx))
            except Exception as e:
                logger.warning(f"LogicNode eval error: {e}")
                is_true = False
        else:
            # If payload is boolean or other
            is_true = bool(payload)

        # Debounce
        current_time = time.time()
        if is_true:
            if self.first_true is None:
                self.first_true = current_time
            final_val = (current_time - self.first_true) >= self.debounce_ms
        else:
            self.first_true = None
            final_val = False

        msg["payload"] = final_val
        
        # Send state for UI
        if self.router.metadata_callback:
            self.router.metadata_callback({
                "type": "logic_state",
                "node_id": self.node_id,
                "value": final_val,
                "camera_id": msg.get("camera_id")
            })

        return msg

class CounterNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="counterNode")
        self.count = 0
        self.last_payload = False
        self.edge_type = data.get("edgeType", "rising")

    def process(self, msg: dict):
        current_payload = bool(msg.get("payload"))
        
        if self.edge_type == "falling":
            # Edge trigger: True -> False
            if not current_payload and self.last_payload:
                self.count += 1
        else:
            # Edge trigger: False -> True
            if current_payload and not self.last_payload:
                self.count += 1
            
        self.last_payload = current_payload
        msg["payload"] = self.count
        
        # Send state for UI Dashboard (metadata_callback)
        if self.router.metadata_callback:
            self.router.metadata_callback({
                "type": "dashboard_update",
                "node_id": f"dashboard.{self.node_id}.value",
                "value": self.count,
                "camera_id": msg.get("camera_id", msg.get("metadata", {}).get("camera_id"))
            })
            self.router.metadata_callback({
                "type": "counter_update",
                "node_id": self.node_id,
                "value": self.count,
                "camera_id": msg.get("camera_id", msg.get("metadata", {}).get("camera_id"))
            })
            
        return msg

class FlowCounterNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="flowCounterNode")
        from ai_engine.centroid_tracker import CentroidTracker

        self.label = data.get("label", "Flow Counter")
        self.mode = data.get("mode", "roi") # "roi" or "line"
        self.roi = data.get("roi", {"x": 0.2, "y": 0.2, "w": 0.6, "h": 0.6})
        self.line = data.get("line", [0.1, 0.5, 0.9, 0.5])
        self.class_filter = data.get("classFilter")
        
        self.cumulative_totals = {}
        self.interval_deltas = {}
        self.total_count = 0
        
        self.tracker = CentroidTracker(
            max_disappeared=int(data.get("maxDisappeared", 20)),
            max_distance=float(data.get("maxDistance", 0.15))
        )
        
        self.flush_interval_sec = float(data.get("flushIntervalSec", 60.0))
        self.last_flush_time = time.time()
        self.auto_log = data.get("autoLog", True)

    def process(self, msg: dict):
        payload = msg.get("payload", {})
        if isinstance(payload, dict) and "detections" in payload:
            detections = payload.get("detections", [])
        elif isinstance(payload, list):
            detections = payload
        else:
            detections = []

        if self.class_filter and len(self.class_filter) > 0:
            filtered_detections = [d for d in detections if d.get("label") in self.class_filter]
        else:
            filtered_detections = detections

        active_tracks = self.tracker.update(filtered_detections)

        newly_counted = 0
        camera_id = msg.get("camera_id") or msg.get("metadata", {}).get("camera_id") or "default"

        for track in active_tracks:
            if track.counted:
                continue

            hit = False
            if self.mode == "line":
                from ai_engine.centroid_tracker import line_intersects
                lx1, ly1, lx2, ly2 = self.line
                if line_intersects(track.prev_centroid, track.centroid, (lx1, ly1), (lx2, ly2)):
                    hit = True
            else:
                from ai_engine.centroid_tracker import point_in_roi
                if point_in_roi(track.centroid, self.roi):
                    hit = True

            if hit:
                track.counted = True
                lbl = track.label or "unknown"
                self.cumulative_totals[lbl] = self.cumulative_totals.get(lbl, 0) + 1
                self.interval_deltas[lbl] = self.interval_deltas.get(lbl, 0) + 1
                self.total_count += 1
                newly_counted += 1

        now = time.time()
        should_broadcast = (newly_counted > 0) or (now - getattr(self, '_last_broadcast_time', 0) >= 0.5)
        if should_broadcast and self.router.metadata_callback:
            self._last_broadcast_time = now
            self.router.metadata_callback({
                "type": "flow_counter_update",
                "node_id": self.node_id,
                "counts": dict(self.cumulative_totals),
                "total": self.total_count,
                "newly_counted": newly_counted,
                "camera_id": camera_id
            })

        if self.auto_log and (now - self.last_flush_time >= self.flush_interval_sec):
            self.flush_to_db(camera_id)
            self.last_flush_time = now

        msg["payload"] = {
            "counts": dict(self.cumulative_totals),
            "total": self.total_count,
            "newly_counted": newly_counted
        }
        return msg

    def flush_to_db(self, camera_id: str):
        try:
            import sys
            from pathlib import Path
            backend_dir = Path("/home/pi/iriv-vision-studio/backend")
            if str(backend_dir) not in sys.path:
                sys.path.insert(0, str(backend_dir))
            from db.database import db

            db.log_class_count(
                project_id=self.router.project_id,
                camera_id=camera_id,
                node_id=self.node_id,
                class_counts=dict(self.interval_deltas),
                cumulative_totals=dict(self.cumulative_totals)
            )
            self.interval_deltas.clear()
        except Exception as e:
            logger.error(f"FlowCounterNode {self.node_id} flush error: {e}")

    def reset_counts(self):
        self.cumulative_totals.clear()
        self.interval_deltas.clear()
        self.total_count = 0
        if self.router.metadata_callback:
            self.router.metadata_callback({
                "type": "flow_counter_update",
                "node_id": self.node_id,
                "counts": {},
                "total": 0
            })

class FunctionNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="functionNode")
        self.code = data.get("code", "def process(msg):\n    return msg")
        self.local_env = {}
        try:
            # We allow basic python builtins for the function node
            exec(self.code, {"__builtins__": __builtins__}, self.local_env)
        except Exception as e:
            logger.error(f"FunctionNode {self.node_id} syntax error: {e}")

    def process(self, msg: dict):
        if "process" in self.local_env:
            try:
                out = self.local_env["process"](msg)
                return out
            except Exception as e:
                logger.error(f"FunctionNode {self.node_id} runtime error: {e}")
        return msg

class ActionNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="actionNode")

    def process(self, msg: dict):
        val = bool(msg.get("payload"))
        trigger_on = str(self.data.get("triggerOn", "true")).lower() == "true"
        
        if val == trigger_on:
            # Future webhook integration here
            pass
        return msg

class DashboardOutputNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="dashboardOutputNode")
        self.last_sent_time = 0
        self.last_val = None

    def process(self, msg: dict):
        if self.router.metadata_callback:
            source_path = self.data.get("sourcePath", "msg.payload")
            
            def get_nested(d, path):
                keys = path.split('.')
                # allow starting with "msg."
                if keys and keys[0] == "msg":
                    keys = keys[1:]
                
                val = d
                for k in keys:
                    if isinstance(val, dict) and k in val:
                        val = val[k]
                    elif isinstance(val, list) and k == "length":
                        val = len(val)
                    else:
                        return None
                return val

            val = get_nested(msg, source_path)

            import time
            current_time = time.time()
            
            # Send immediately if value changed, otherwise rate limit to 10Hz
            if val == self.last_val and (current_time - self.last_sent_time < 0.1):
                return msg

            if val != self.last_val:
                import logging
                logging.getLogger("ai_engine").info(f"DashboardOutputNode {self.node_id}: value changed from {self.last_val} to {val}")

            self.last_sent_time = current_time
            self.last_val = val
            
            self.router.metadata_callback({
                "type": "dashboard_update",
                "node_id": self.node_id,
                "value": val,
                "camera_id": msg.get("metadata", {}).get("camera_id")
            })
            
        return msg

class HardwareOutputNode(PipelineNode):
    def __init__(self, node_id, data, router, hw_type="digital_output"):
        super().__init__(node_id, data, router, node_type=f"hardwareOutputNode_{hw_type}")
        self.hw_type = hw_type
        self.pin = data.get("pin")
        self._last_is_active = None
        
    def process(self, msg: dict):
        val = bool(msg.get("payload"))
        trigger_on = str(self.data.get("triggerOn", "true")).lower() == "true"
        is_active = (val == trigger_on)
        
        # Only log and set hardware if state changed
        if self._last_is_active != is_active:
            self._last_is_active = is_active
            logger.info(f"HardwareOutputNode {self.node_id} (type: {self.hw_type}) state changed: active={is_active}")
            try:
                from hardware.gpio_manager import gpio_mgr
                if self.hw_type == "led":
                    brightness = float(self.data.get("brightness", 100)) / 100.0 if is_active else 0.0
                    gpio_mgr.set_pwm(self.pin, brightness)
                elif self.hw_type == "buzzer":
                    gpio_mgr.set_output("BUZZER", is_active)
                elif self.hw_type == "digital_output":
                    action = self.data.get("action", "on")
                    final_out = is_active if action == "on" else not is_active
                    gpio_mgr.set_output(self.pin, final_out)
            except Exception as e:
                logger.error(f"Hardware output error: {e}")
            
        return msg

class SnapshotNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="snapshotNode")
        self.label = data.get("label", "Snapshot")
        self.last_payload = False
        self._proc = None

    def process(self, msg: dict):
        current_payload = bool(msg.get("payload"))
        if current_payload and not self.last_payload:
            camera_id = msg.get("camera_id", msg.get("metadata", {}).get("camera_id"))
            if camera_id:
                import subprocess
                from pathlib import Path
                import time
                
                snapshots_dir = Path("/home/pi/iriv-vision-studio/snapshots")
                snapshots_dir.mkdir(parents=True, exist_ok=True)
                
                timestamp = int(time.time() * 1000)
                filename = f"{camera_id}_{timestamp}.jpg"
                filepath = snapshots_dir / filename
                
                rtsp_url = f"rtsp://127.0.0.1:8554/{self.router.project_id}_{camera_id}"
                
                try:
                    # Reap any finished snapshot process
                    if self._proc and self._proc.poll() is None:
                        pass # Previous snapshot still grabbing frame, don't spam
                    else:
                        self._proc = subprocess.Popen([
                            "ffmpeg", "-y", "-rtsp_transport", "tcp", "-i", rtsp_url, 
                            "-vframes", "1", "-q:v", "2", str(filepath)
                        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        try:
                            from ai_engine.telemetry_manager import telemetry_mgr
                            telemetry_mgr.register_process(self.router.project_id, f"ffmpeg snapshot ({self.label})", self._proc.pid)
                        except Exception:
                            pass
                    
                    # Log to DB
                    import sys
                    import os
                    # add backend dir to sys.path if needed
                    backend_dir = Path("/home/pi/iriv-vision-studio/backend")
                    if str(backend_dir) not in sys.path:
                        sys.path.insert(0, str(backend_dir))
                    from db.database import db
                    
                    # Include count if available
                    payload = msg.get("payload")
                    if isinstance(payload, int):
                        pass # It might be the count from CounterNode
                        
                    db.log_event(
                        node_id=self.node_id,
                        project_id=self.router.project_id,
                        event_type=f"SNAPSHOT",
                        payload={"label": self.label, "trigger": payload},
                        camera_id=camera_id,
                        snapshot_path=str(filepath)
                    )
                except Exception as e:
                    import logging
                    logging.getLogger("ai_engine").error(f"Snapshot error: {e}")
                    
        self.last_payload = current_payload
        return msg

class MessageRouter:
    def __init__(self, metadata_callback=None, project_id="default"):
        self.nodes = {}
        self.metadata_callback = metadata_callback
        self.project_id = project_id       
        self.edges = {}       
        self.msg_queue = queue.Queue(maxsize=30)
        self.running = False
        self.thread = None
        self._lock = threading.RLock()

    def add_node(self, node_id: str, node_instance: PipelineNode):
        with self._lock:
            self.nodes[node_id] = node_instance
            if node_id not in self.edges:
                self.edges[node_id] = []

    def add_edge(self, source_id: str, target_id: str, source_handle: str = None):
        with self._lock:
            if source_id not in self.edges:
                self.edges[source_id] = []
            self.edges[source_id].append((target_id, source_handle))

    def hot_reload(self, new_nodes: dict, new_edges: dict):
        """
        Hot-reloads the node graph without stopping the event loop or dropping incoming messages.
        Preserves internal state (e.g. counts, tracking state) from old nodes if their IDs match.
        """
        logger.info(f"Hot-reloading MessageRouter for project {self.project_id}: {len(new_nodes)} nodes")
        with self._lock:
            # Transfer state from existing nodes to new nodes
            for nid, new_node in new_nodes.items():
                if nid in self.nodes:
                    old_node = self.nodes[nid]
                    # Preserve CounterNode state
                    if hasattr(old_node, 'count') and hasattr(new_node, 'count'):
                        new_node.count = old_node.count
                        new_node.last_payload = getattr(old_node, 'last_payload', False)
                    # Preserve FlowCounterNode state
                    if hasattr(old_node, 'total_count') and hasattr(new_node, 'total_count'):
                        new_node.total_count = old_node.total_count
                        new_node.cumulative_totals = getattr(old_node, 'cumulative_totals', {})
                        new_node.interval_deltas = getattr(old_node, 'interval_deltas', {})
                        if hasattr(old_node, 'tracker') and hasattr(new_node, 'tracker'):
                            new_node.tracker = old_node.tracker
                    # Preserve ShelfSlotMonitorNode state
                    if hasattr(old_node, 'slot_states') and hasattr(new_node, 'slot_states'):
                        new_node.slot_states = getattr(old_node, 'slot_states', {})
                        new_node.slot_counts = getattr(old_node, 'slot_counts', {})
                        new_node.first_empty_times = getattr(old_node, 'first_empty_times', {})
                        new_node.last_person_seen_time = getattr(old_node, 'last_person_seen_time', 0.0)
                    # Preserve ForkliftZoneNode state
                    if hasattr(old_node, 'zone_states') and hasattr(new_node, 'zone_states'):
                        new_node.zone_states = getattr(old_node, 'zone_states', {})
                        new_node.zone_counts = getattr(old_node, 'zone_counts', {})
                        new_node.first_occupied_times = getattr(old_node, 'first_occupied_times', {})
                        new_node.near_miss_count = getattr(old_node, 'near_miss_count', 0)
                    # Preserve RateLimitNode last_sent_time
                    if hasattr(old_node, 'last_sent_time') and hasattr(new_node, 'last_sent_time'):
                        new_node.last_sent_time = old_node.last_sent_time

            # Update nodes' router reference
            for node in new_nodes.values():
                node.router = self

            self.nodes = new_nodes
            self.edges = new_edges
        logger.info("MessageRouter hot-reload complete.")

    def inject_message(self, source_id: str, msg: dict):
        """Entry point for new messages (e.g. from Hailo Pad Probe or Digital Input)."""
        try:
            # We use put_nowait to drop messages if the router is too slow,
            # ensuring that the queue doesn't backlog and cause severe delays (realtime logic).
            self.msg_queue.put_nowait((source_id, msg))
        except queue.Full:
            pass

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._route_loop, daemon=True)
            self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.msg_queue.put((None, None))
            self.thread.join(timeout=2)
            self.thread = None

    def _route_loop(self):
        logger.info("MessageRouter event loop started.")
        while self.running:
            try:
                source_id, msg = self.msg_queue.get(timeout=0.5)
                if source_id is None:
                    continue
                
                # IDEA 1: Ensure context exists and save initial payload from source
                if "context" not in msg:
                    msg["context"] = {}
                msg["context"][source_id] = msg.get("payload")
                
                # BFS traversal for this message
                q = [(source_id, msg)]
                while q:
                    curr_source, curr_msg = q.pop(0)
                    with self._lock:
                        targets = list(self.edges.get(curr_source, []))
                    for item in targets:
                        if isinstance(item, tuple):
                            target_id, source_handle = item
                        else:
                            target_id, source_handle = item, None

                        target_node = None
                        with self._lock:
                            target_node = self.nodes.get(target_id)
                        if target_node:
                            try:
                                t_node_start = time.perf_counter()
                                # Route handle-specific payload if applicable
                                if source_handle and isinstance(curr_msg.get("_handle_payloads"), dict) and source_handle in curr_msg["_handle_payloads"]:
                                    routed_msg = curr_msg.copy()
                                    routed_msg["payload"] = curr_msg["_handle_payloads"][source_handle]
                                else:
                                    routed_msg = curr_msg.copy()
                                routed_msg["_source_node_id"] = curr_source

                                out_msg = target_node.process(routed_msg)
                                t_node_dur = time.perf_counter() - t_node_start

                                try:
                                    from ai_engine.telemetry_manager import telemetry_mgr
                                    n_type = getattr(target_node, 'node_type', target_node.__class__.__name__)
                                    telemetry_mgr.record_router_node_execution(
                                        self.project_id,
                                        target_id,
                                        n_type,
                                        t_node_dur
                                    )
                                except Exception:
                                    pass

                                if out_msg is not None:
                                    # IDEA 1: Save target node's payload into context
                                    if "context" not in out_msg:
                                        out_msg["context"] = {}
                                    out_msg["context"][target_id] = out_msg.get("payload")
                                    
                                    q.append((target_id, out_msg))
                            except Exception as e:
                                logger.error(f"Error executing node {target_id}: {e}")
            except queue.Empty:
                pass
        logger.info("MessageRouter event loop stopped.")
