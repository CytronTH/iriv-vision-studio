import logging
import subprocess
import threading
import time
import socket
from pathlib import Path
from typing import Dict, Any, Optional, Set

logger = logging.getLogger("media_server.camera_manager")

class CameraStreamInstance:
    """Represents an active central ingestion stream for a camera."""
    def __init__(self, camera_id: str, camera_type: str, path: str, rtsp_url: str):
        self.camera_id = camera_id
        self.camera_type = camera_type
        self.path = path
        self.rtsp_url = rtsp_url
        self.proc: Optional[subprocess.Popen] = None
        self.sub_proc: Optional[subprocess.Popen] = None # For pipe if any (e.g. rpicam-vid)
        self.ref_count = 0
        self.grace_timer: Optional[threading.Timer] = None
        self.start_time = 0
        self.restart_count = 0
        self.is_ready = False

class CameraManager:
    """
    Central Camera Broker & Ingestion Service.
    Manages physical cameras (/dev/video*, CSI) and looping video files,
    publishing a single shared RTSP stream to local MediaMTX (127.0.0.1:8554)
    with reference-counted lifecycle and grace period.
    """
    def __init__(self, mediamtx_rtsp_host: str = "127.0.0.1", mediamtx_rtsp_port: int = 8554):
        self.rtsp_host = mediamtx_rtsp_host
        self.rtsp_port = mediamtx_rtsp_port
        self.streams: Dict[str, CameraStreamInstance] = {}
        self.lock = threading.Lock()
        self.grace_period_seconds = 5.0 # Grace period before shutting down stream
        self._monitor_running = True
        self._monitor_thread = threading.Thread(target=self._health_monitor_loop, daemon=True)
        self._monitor_thread.start()

    def is_active(self, camera_id: str) -> bool:
        """Check if camera stream is active and not pending shutdown."""
        with self.lock:
            stream = self.streams.get(camera_id)
            if not stream or not stream.proc:
                return False
            return stream.proc.poll() is None

    def get_rtsp_url(self, camera_id: str) -> Optional[str]:
        """Return the shared RTSP URL if active."""
        with self.lock:
            stream = self.streams.get(camera_id)
            if stream and stream.proc and stream.proc.poll() is None:
                return stream.rtsp_url
            return None

    def acquire(self, camera_id: str, camera_entity: Optional[Dict[str, Any]] = None) -> str:
        """
        Acquires a shared camera stream.
        If already running, increments ref_count and cancels any pending grace shutdown.
        If not running, starts central ingestion and waits for stream ready.
        """
        with self.lock:
            # 1. Validation check
            if camera_entity and not camera_entity.get("is_enabled", True):
                cam_name = camera_entity.get("name", camera_id)
                raise ValueError(f"Camera '{cam_name}' (ID: {camera_id}) is disabled. Enable it in Settings to start.")

            stream = self.streams.get(camera_id)

            # If stream exists and is running
            if stream and stream.proc and stream.proc.poll() is None:
                # Cancel pending grace timer if any
                if stream.grace_timer:
                    stream.grace_timer.cancel()
                    stream.grace_timer = None
                    logger.info(f"Revived camera '{camera_id}' from grace period.")
                
                stream.ref_count += 1
                logger.info(f"Acquired existing camera '{camera_id}' (ref_count={stream.ref_count})")
                return stream.rtsp_url

            # If stream exists but process died, clean up
            if stream:
                self._kill_stream_process(stream)
                del self.streams[camera_id]

            # 2. Extract camera properties
            cam_type = "local"
            cam_path = "/dev/video0"
            if camera_entity:
                cam_type = camera_entity.get("type", "local")
                cam_path = camera_entity.get("path", "/dev/video0")

            rtsp_path = f"shared_{camera_id}"
            rtsp_url = f"rtsp://{self.rtsp_host}:{self.rtsp_port}/{rtsp_path}"

            new_stream = CameraStreamInstance(
                camera_id=camera_id,
                camera_type=cam_type,
                path=cam_path,
                rtsp_url=rtsp_url
            )
            new_stream.ref_count = 1

            # 3. Start Ingestion Process
            self._start_ingestion(new_stream)
            self.streams[camera_id] = new_stream
            logger.info(f"Started central ingestion for camera '{camera_id}' at {rtsp_url} (ref_count=1)")

        # 4. Wait for stream ready (outside lock to avoid blocking other calls)
        self._wait_for_stream_ready(new_stream)
        return rtsp_url

    def release(self, camera_id: str):
        """
        Releases an acquired camera stream.
        Decrements ref_count. When ref_count reaches 0, starts grace timer before stopping.
        """
        with self.lock:
            stream = self.streams.get(camera_id)
            if not stream:
                return

            stream.ref_count = max(0, stream.ref_count - 1)
            logger.info(f"Released camera '{camera_id}' (ref_count={stream.ref_count})")

            if stream.ref_count == 0:
                if stream.grace_timer:
                    stream.grace_timer.cancel()

                logger.info(f"Camera '{camera_id}' reached ref_count=0. Starting {self.grace_period_seconds}s grace timer.")
                stream.grace_timer = threading.Timer(
                    self.grace_period_seconds,
                    self._grace_period_expired,
                    args=[camera_id]
                )
                stream.grace_timer.daemon = True
                stream.grace_timer.start()

    def _grace_period_expired(self, camera_id: str):
        """Called when grace timer expires with ref_count still 0."""
        with self.lock:
            stream = self.streams.get(camera_id)
            if not stream or stream.ref_count > 0:
                return

            logger.info(f"Grace period expired for camera '{camera_id}'. Stopping ingestion process.")
            self._kill_stream_process(stream)
            del self.streams[camera_id]

    def _start_ingestion(self, stream: CameraStreamInstance):
        """Spawns the ingestion subprocess based on camera type."""
        cam_type = stream.camera_type
        path = stream.path
        rtsp_url = stream.rtsp_url

        try:
            if cam_type == "file":
                # Looping video file via FFmpeg
                cmd = [
                    "ffmpeg", "-nostdin", "-re",
                    "-f", "lavfi",
                    "-i", f"movie={path}:loop=0,setpts=N/FRAME_RATE/TB",
                    "-c:v", "libx264", "-profile:v", "baseline",
                    "-tune", "zerolatency", "-preset", "ultrafast",
                    "-b:v", "2M", "-g", "30",
                    "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                    rtsp_url
                ]
                proc = subprocess.Popen(
                    cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    start_new_session=True
                )
                stream.proc = proc
                stream.start_time = time.time()

            elif cam_type == "local":
                if path.startswith("/dev/video"):
                    # USB Camera: Prefer MJPEG to save USB bandwidth and CPU, fallback to standard v4l2
                    cmd = [
                        "ffmpeg", "-nostdin",
                        "-f", "v4l2",
                        "-input_format", "mjpeg",
                        "-framerate", "30",
                        "-video_size", "1280x720",
                        "-i", path,
                        "-c:v", "libx264", "-profile:v", "baseline",
                        "-tune", "zerolatency", "-preset", "ultrafast",
                        "-b:v", "2M", "-g", "30",
                        "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                        rtsp_url
                    ]
                    # Test if MJPEG works, or start with fallback
                    proc = subprocess.Popen(
                        cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                        start_new_session=True
                    )
                    # Brief check if immediate error
                    time.sleep(0.3)
                    if proc.poll() is not None:
                        # Fallback without explicit input_format
                        logger.warning(f"MJPEG failed on {path}. Falling back to default v4l2 negotiation.")
                        cmd = [
                            "ffmpeg", "-nostdin",
                            "-f", "v4l2",
                            "-i", path,
                            "-c:v", "libx264", "-profile:v", "baseline",
                            "-tune", "zerolatency", "-preset", "ultrafast",
                            "-b:v", "2M", "-g", "30",
                            "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                            rtsp_url
                        ]
                        proc = subprocess.Popen(
                            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            start_new_session=True
                        )
                    stream.proc = proc
                    stream.start_time = time.time()
                else:
                    # CSI Camera (e.g. libcamerasrc)
                    # Using rpicam-vid piped to ffmpeg
                    cmd1 = [
                        "rpicam-vid", "-t", "0", "--inline",
                        "--width", "1280", "--height", "720",
                        "--framerate", "30", "-n", "-o", "-"
                    ]
                    cmd2 = [
                        "ffmpeg", "-nostdin",
                        "-f", "h264", "-i", "-",
                        "-c:v", "copy",
                        "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                        rtsp_url
                    ]
                    p1 = subprocess.Popen(cmd1, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
                    p2 = subprocess.Popen(cmd2, stdin=p1.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
                    p1.stdout.close()
                    stream.sub_proc = p1
                    stream.proc = p2
                    stream.start_time = time.time()
            elif cam_type == "rtsp":
                # External RTSP stream: proxy via ffmpeg or direct
                cmd = [
                    "ffmpeg", "-nostdin",
                    "-rtsp_transport", "tcp",
                    "-i", path,
                    "-c:v", "copy",
                    "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                    rtsp_url
                ]
                proc = subprocess.Popen(
                    cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    start_new_session=True
                )
                stream.proc = proc
                stream.start_time = time.time()

        except Exception as e:
            logger.error(f"Failed to start ingestion for {stream.camera_id}: {e}")
            self._kill_stream_process(stream)
            raise

    def _wait_for_stream_ready(self, stream: CameraStreamInstance, timeout: float = 6.0):
        """Polls until the stream is actively transmitting or timeout."""
        start = time.time()
        # Wait a minimum of 1.2s for ffmpeg to complete RTSP handshake with MediaMTX
        time.sleep(1.2)
        while time.time() - start < timeout:
            if stream.proc and stream.proc.poll() is not None:
                logger.error(f"Ingestion process died during startup for {stream.camera_id}")
                return False
            # Check if RTSP port is responding
            try:
                with socket.create_connection((self.rtsp_host, self.rtsp_port), timeout=0.5):
                    stream.is_ready = True
                    return True
            except Exception:
                time.sleep(0.3)
        return True

    def _health_monitor_loop(self):
        """Continuously monitors ingestion processes and attempts recovery if camera dies while in use."""
        while self._monitor_running:
            time.sleep(2.5)
            with self.lock:
                for cam_id, stream in list(self.streams.items()):
                    if stream.ref_count > 0 and stream.proc:
                        if stream.proc.poll() is not None:
                            logger.warning(f"Ingestion process for '{cam_id}' exited unexpectedly (code {stream.proc.returncode}).")
                            if stream.restart_count < 3:
                                stream.restart_count += 1
                                logger.info(f"Auto-restarting ingestion for '{cam_id}' (attempt {stream.restart_count}/3)...")
                                try:
                                    self._kill_stream_process(stream)
                                    self._start_ingestion(stream)
                                except Exception as e:
                                    logger.error(f"Auto-restart failed for '{cam_id}': {e}")
                            else:
                                logger.error(f"Exceeded max restart attempts for '{cam_id}'. Giving up.")

    def _kill_stream_process(self, stream: CameraStreamInstance):
        """Terminates and waits for ingestion processes."""
        if stream.grace_timer:
            stream.grace_timer.cancel()
            stream.grace_timer = None

        for p in [stream.proc, stream.sub_proc]:
            if p:
                try:
                    p.terminate()
                    p.wait(timeout=1.5)
                except Exception:
                    try:
                        p.kill()
                    except Exception:
                        pass
        stream.proc = None
        stream.sub_proc = None

    def stop_all(self):
        """Stops all running ingestion processes on server shutdown."""
        self._monitor_running = False
        with self.lock:
            for cam_id, stream in list(self.streams.items()):
                self._kill_stream_process(stream)
            self.streams.clear()
            logger.info("CameraManager: All camera ingestion streams stopped.")

# Global Singleton instance
camera_mgr = CameraManager()
