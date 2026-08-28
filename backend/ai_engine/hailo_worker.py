import gi
gi.require_version('Gst', '1.0')
gi.require_version('GLib', '2.0')
from gi.repository import Gst, GLib
import threading
import logging
import json
import functools
import subprocess
import time
from typing import Callable
from ai_engine.stream_quality import StreamQualityManager

try:
    import hailo
except ImportError:
    logging.warning("Hailo module not found. AI metadata extraction will fail if run outside the Hailo environment.")
from hardware.gpio_manager import gpio_mgr
from hardware.rs485_manager import rs485_mgr
logger = logging.getLogger(__name__)

class HailoPipelineWorker:
    """
    Hailo GStreamer Pipeline Worker.
    Runs the GStreamer pipeline and GLib MainLoop in a separate background thread
    to decouple AI inference from the FastAPI Web Server (Rule: 01_architecture_rules).
    """
    def __init__(self, config=None, metadata_callback: Callable = None, project_id: str = "default"):
        """
        Initializes the GStreamer worker.
        :param config: ParsedPipelineConfig object containing model and logic rules.
        :param metadata_callback: Function to call with JSON metadata.
        :param project_id: ID of the project for routing RTSP and WebSockets.
        """
        Gst.init(None)
        self.config = config
        self.metadata_callback = metadata_callback
        self.project_id = project_id
        self.pipeline = None
        self.loop = None
        self.thread = None
        self.start_time = None
        self.ffmpeg_procs = []
        self._ffmpeg_launched = {}   # Persists across quality-change restarts (reuses running ffmpeg)
        self._restarting = False     # Guards against concurrent pipeline restarts

        # State tracking for debounce
        self.logic_state_history = {}

        # Adaptive stream quality: selects display W×H based on CPU% + stream count
        self.quality_mgr = StreamQualityManager()

        # We start with the config provided, or build a fallback pipeline later
        self.is_running = False

    def build_pipeline(self):
        """
        Constructs the GStreamer pipeline string dynamically based on self.config.
        """
        import os
        if not self.config:
            logger.error("Cannot build pipeline without a configuration.")
            return

        # Initialize Hardware using Router Nodes
        from hardware.gpio_manager import PIN_MAP
        if self.config and hasattr(self.config, 'router'):
            for node_id, node in self.config.router.nodes.items():
                if hasattr(node, 'hw_type'):
                    pin_str = getattr(node, 'pin', None)
                    if pin_str:
                        pin_num = PIN_MAP.get(pin_str)
                        if pin_num:
                            if node.hw_type == "digital_output":
                                gpio_mgr.setup_output(pin_str, pin_num)
                            elif node.hw_type == "led":
                                gpio_mgr.setup_pwm(pin_str, pin_num)
                    if getattr(node, 'hw_type') == "buzzer":
                        gpio_mgr.setup_buzzer("BUZZER", PIN_MAP.get("BUZZER", 19))
                        
        if self.config and hasattr(self.config, 'digital_inputs'):
            for di in self.config.digital_inputs:
                node_id = di["id"]
                pin_str = di["pin"]
                pin_num = PIN_MAP.get(pin_str)
                if pin_num:
                    gpio_mgr.setup_input(pin_str, pin_num)
                    def make_callback(nid, val):
                        def cb():
                            if hasattr(self.config, 'router') and self.config.router:
                                self.config.router.inject_message(nid, {"payload": val, "metadata": {"source": "gpio"}})
                        return cb
                    
                    device = gpio_mgr.devices.get(pin_str)
                    if device:
                        device.when_activated = make_callback(node_id, True)
                        device.when_deactivated = make_callback(node_id, False)

        # Now build the actual GStreamer pipeline string
        self._build_pipeline_string()

    def _generate_label_config(self, cam_stream, stream_id: str) -> str:
        """
        Generate a JSON config file for hailofilter if the stream has class names defined.
        Returns the GStreamer argument string 'config-path=...' or empty string.
        The .so's init() function reads this file if it exists, using its labels and threshold.
        """
        import json as _json
        classes = getattr(cam_stream, 'classes', [])
        confidence_threshold = getattr(cam_stream, 'confidence_threshold', 0.5)
        
        if not classes:
            return ""  # No class names — .so falls back to COCO default
        
        config = {
            "labels": ["unlabeled"] + classes,   # index 0 = background (TAPPAS/COCO convention)
            "detection_threshold": confidence_threshold,
            "max_boxes": 100
        }
        config_path = f"/tmp/hailo_labels_{self.project_id}_{stream_id}.json"
        try:
            with open(config_path, "w") as f:
                _json.dump(config, f)
            logger.info(f"Generated hailofilter config: {config_path} classes={classes}")
            return f"config-path={config_path}"
        except Exception as e:
            logger.error(f"Failed to write hailofilter config: {e}")
            return ""

    def _build_pipeline_string(self, measure_quality: bool = True):
        """Build the GStreamer pipeline string from config. Called by build_pipeline()."""
        import os

        pipeline_substrings = []
        
        camera_streams = getattr(self.config, 'camera_streams', [])
        
        if not camera_streams:
            logger.warning("No camera streams found in config. Using fallback empty pipeline.")
            return

        # ── Adaptive display resolution ──────────────────────────────────────
        # measure_quality=True (first build): sample CPU now, select best tier
        # measure_quality=False (quality restart): use the tier already confirmed by the monitor
        _num = len(camera_streams)
        if measure_quality:
            W, H, kbps, _qlabel = self.quality_mgr.get_display_resolution(_num)
        else:
            W, H, kbps, _qlabel = self.quality_mgr.current_resolution
            logger.info(f"[StreamQuality] Using confirmed tier {self.quality_mgr.current_tier}: {_qlabel} {W}×{H}")

        # Group streams by their input source (input_node_id or video_source)
        # so that streams from the same InputNode share the same source_bin/ffmpeg
        source_groups = {}  # key -> list of (index, cam_stream)
        for i, cam_stream in enumerate(camera_streams):
            input_key = getattr(cam_stream, 'input_node_id', None) or getattr(cam_stream, 'video_source', f'src_{i}')
            if input_key not in source_groups:
                source_groups[input_key] = []
            source_groups[input_key].append((i, cam_stream))
        
        # Track launched ffmpeg processes to avoid duplicates.
        # Use self._ffmpeg_launched so quality-change restarts can reuse existing procs.
        ffmpeg_launched = self._ffmpeg_launched

        for input_key, group in source_groups.items():
            # Use first stream in group for source properties (they all share the same input)
            first_stream = group[0][1]
            video_src_type = getattr(first_stream, 'video_source_type', 'local')
            video_src = getattr(first_stream, 'video_source', '/dev/video0')
            loop = getattr(first_stream, 'loop', True)
            speed = getattr(first_stream, 'speed', 1.0)
            
            # Build source_bin (shared across all streams in this group)
            if video_src_type == "rtsp":
                source_bin = f"rtspsrc location={video_src} ! rtph264depay ! h264parse ! avdec_h264"
            elif video_src_type == "file":
                if loop:
                    if input_key not in ffmpeg_launched:
                        # Start ONE ffmpeg process per unique input source
                        internal_path = f"loop_{self.project_id}_{input_key}"
                        internal_rtsp = f"rtsp://127.0.0.1:8554/{internal_path}"
                        logger.info(f"Starting ffmpeg loop for {video_src} at {internal_rtsp}")
                        cmd = [
                            "ffmpeg", "-nostdin", "-re", 
                            "-f", "lavfi",
                            "-i", f"movie={video_src}:loop=0, setpts=N/FRAME_RATE/TB",
                            "-c:v", "libx264", "-profile:v", "baseline",
                            "-tune", "zerolatency", "-preset", "ultrafast",
                            "-b:v", "2M", "-g", "30",
                            "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                            internal_rtsp
                        ]
                        proc = subprocess.Popen(
                            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            start_new_session=True
                        )
                        self.ffmpeg_procs.append(proc)
                        time.sleep(2.0)
                        ffmpeg_launched[input_key] = internal_rtsp
                    
                    internal_rtsp = ffmpeg_launched[input_key]
                    source_bin = f"rtspsrc location={internal_rtsp} protocols=tcp latency=100 ! rtph264depay ! h264parse ! avdec_h264"
                else:
                    speed_filter = ""
                    if speed != 1.0:
                        speed_filter = f"! videorate rate={speed} "
                    source_bin = f"filesrc location={video_src} ! decodebin {speed_filter}"
            else:
                if video_src.startswith("/dev/video"):
                    source_bin = f"v4l2src device={video_src}"
                else:
                    source_bin = "libcamerasrc"
            
            if len(group) == 1:
                # Single stream from this source — use original simple pipeline
                i, cam_stream = group[0]
                hef = getattr(cam_stream, 'hef_path', '')
                so = getattr(cam_stream, 'so_path', '')
                has_ai = getattr(cam_stream, 'has_ai_node', False)
                stream_id = getattr(cam_stream, 'stream_id', f"cam_{i}")
                
                if has_ai:
                    if not os.path.exists(hef):
                        logger.error(f"HEF file not found: {hef}. Falling back to default YOLOv8s.")
                        hef = "/home/pi/iriv-vision-studio/backend/models/yolov8s.hef"
                        so = "/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes/libyolo_hailortpp_post.so"
                        if not os.path.exists(hef):
                            logger.error("Default HEF also not found! Disabling AI for this stream.")
                            has_ai = False
                
                if has_ai:
                    config_path_arg = self._generate_label_config(cam_stream, stream_id)
                    # Single-branch pipeline — tee AFTER Hailo so display and bbox share the same frame:
                    #   source → 640×640 (letterbox) → hailonet → hailofilter → tee
                    #   ├─ Display: crop(140,140) → scale {W}×{H} → encode → stream
                    #   └─ Metadata: fakesink probe → correct_y → WebSocket
                    # {W}×{H} is selected by StreamQualityManager (adaptive per CPU / stream count).
                    sub_str = (
                        f"{source_bin} ! "
                        f"videoconvert ! videoscale ! "
                        f"video/x-raw,format=RGB,width=640,height=640,pixel-aspect-ratio=1/1 ! "
                        f"hailonet hef-path={hef} force-writable=true vdevice-group-id=1 ! "
                        f"hailofilter name=filter_{i} so-path={so} {config_path_arg} qos=false ! "
                        f"tee name=ai_tee_{i} "
                        f"ai_tee_{i}. ! queue max-size-buffers=3 leaky=downstream ! "
                        f"videocrop top=140 bottom=140 ! "
                        f"videoconvert ! videoscale ! video/x-raw,width={W},height={H} ! "
                        f"x264enc tune=zerolatency speed-preset=ultrafast bitrate={kbps} key-int-max=30 ! "
                        f"video/x-h264,pixel-aspect-ratio=1/1 ! "
                        f"h264parse config-interval=1 ! "
                        f"rtspclientsink location=rtsp://127.0.0.1:8554/{self.project_id}_{stream_id} protocols=tcp "
                        f"ai_tee_{i}. ! queue max-size-buffers=3 leaky=downstream ! fakesink name=sink_{i} sync=false"
                    )
                else:
                    sub_str = (
                        f"{source_bin} ! "
                        f"videoconvert ! videoscale ! video/x-raw,width={W},height={H} ! "
                        f"x264enc tune=zerolatency speed-preset=ultrafast bitrate={kbps} key-int-max=30 ! "
                        f"video/x-h264,pixel-aspect-ratio=1/1 ! "
                        f"h264parse config-interval=1 ! "
                        f"rtspclientsink location=rtsp://127.0.0.1:8554/{self.project_id}_{stream_id} protocols=tcp"
                    )
                pipeline_substrings.append(sub_str)
            else:
                # Multiple AI streams from same source — build shared source + tee with multiple branches
                tee_name = f"shared_tee_{input_key.replace('-', '_')}"
                # Source → videoconvert → tee
                source_str = f"{source_bin} ! videoconvert ! tee name={tee_name}"
                branches = []
                
                for i, cam_stream in group:
                    hef = getattr(cam_stream, 'hef_path', '')
                    so = getattr(cam_stream, 'so_path', '')
                    has_ai = getattr(cam_stream, 'has_ai_node', False)
                    stream_id = getattr(cam_stream, 'stream_id', f"cam_{i}")
                    
                    if has_ai:
                        if not os.path.exists(hef):
                            logger.error(f"HEF file not found: {hef}. Falling back to default.")
                            hef = "/home/pi/iriv-vision-studio/backend/models/yolov8s.hef"
                            so = "/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes/libyolo_hailortpp_post.so"
                    
                    if has_ai:
                        config_path_arg = self._generate_label_config(cam_stream, stream_id)
                        branches.append(
                            f"{tee_name}. ! queue max-size-buffers=3 leaky=downstream ! videoconvert ! videoscale ! "
                            f"video/x-raw,format=RGB,width=640,height=640,pixel-aspect-ratio=1/1 ! "
                            f"hailonet hef-path={hef} force-writable=true vdevice-group-id=1 ! "
                            f"hailofilter name=filter_{i} so-path={so} {config_path_arg} qos=false ! "
                            f"tee name=ai_tee_{i} "
                            f"ai_tee_{i}. ! queue max-size-buffers=3 leaky=downstream ! "
                            f"videocrop top=140 bottom=140 ! "
                            f"videoconvert ! videoscale ! video/x-raw,width={W},height={H} ! "
                            f"x264enc tune=zerolatency speed-preset=ultrafast bitrate={kbps} key-int-max=30 ! "
                            f"video/x-h264,pixel-aspect-ratio=1/1 ! "
                            f"h264parse config-interval=1 ! "
                            f"rtspclientsink location=rtsp://127.0.0.1:8554/{self.project_id}_{stream_id} protocols=tcp "
                            f"ai_tee_{i}. ! queue max-size-buffers=3 leaky=downstream ! fakesink name=sink_{i} sync=false"
                        )
                    else:
                        branches.append(
                            f"{tee_name}. ! queue max-size-buffers=3 leaky=downstream ! videoconvert ! videoscale ! video/x-raw,width={W},height={H} ! "
                            f"x264enc tune=zerolatency speed-preset=ultrafast bitrate={kbps} key-int-max=30 ! "
                            f"video/x-h264,pixel-aspect-ratio=1/1 ! "
                            f"h264parse config-interval=1 ! "
                            f"rtspclientsink location=rtsp://127.0.0.1:8554/{self.project_id}_{stream_id} protocols=tcp"
                        )
                
                pipeline_substrings.append(source_str + " " + " ".join(branches))
        
        pipeline_str = " ".join(pipeline_substrings)
        logger.info(f"Building pipeline: {pipeline_str}")
        
        try:
            self.pipeline = Gst.parse_launch(pipeline_str)
            
            # Attach probe to extract metadata from each fakesink
            for i, cam_stream in enumerate(camera_streams):
                if getattr(cam_stream, 'has_ai_node', False):
                    sink = self.pipeline.get_by_name(f"sink_{i}")
                    if sink:
                        pad = sink.get_static_pad("sink")
                        pad.add_probe(Gst.PadProbeType.BUFFER, functools.partial(self.on_buffer_probe, camera_id=cam_stream.stream_id))
                    else:
                        logger.warning(f"Could not find sink_{i} to attach metadata probe.")

            # Attach bus watch for EOS and errors
            bus = self.pipeline.get_bus()
            bus.add_signal_watch()
            bus.connect("message::eos", self._on_eos)
            bus.connect("message::error", self._on_bus_error)
        except GLib.Error as e:
            logger.error(f"Failed to parse GStreamer pipeline: {e}")
            self.pipeline = None

    def _on_eos(self, bus, message):
        """Handle End-of-Stream — only fires for non-looping sources (looping uses ffmpeg)."""
        logger.info("EOS reached bus — stopping pipeline")
        if self.loop:
            self.loop.quit()

    def _on_bus_error(self, bus, message):
        err, debug = message.parse_error()
        logger.error(f"GStreamer Bus Error: {err.message} | Debug: {debug}")

    def on_buffer_probe(self, pad, info, camera_id=None):
        """
        Extracts Hailo ROI metadata, applies logic filters, and triggers actions.
        """
        buffer = info.get_buffer()
        if not buffer:
            return Gst.PadProbeReturn.OK

        try:
            import hailo
            roi = hailo.get_roi_from_buffer(buffer)
            
            # Find the ai_task for this stream
            ai_task = "detection"
            if self.config:
                stream_cfg = next((s for s in self.config.camera_streams if s.stream_id == camera_id), None)
                if stream_cfg:
                    ai_task = getattr(stream_cfg, "ai_task", "detection")
                    
            parsed_results = []
            object_count_threshold = 0
            
            # Read filtering settings from stream config (set by pipeline_parser from node data)
            confidence_threshold = getattr(stream_cfg, 'confidence_threshold', 0.5) if stream_cfg else 0.5
            class_confidences = getattr(stream_cfg, 'class_confidences', {}) if stream_cfg else {}
            class_filter = getattr(stream_cfg, 'class_filter', None) if stream_cfg else None  # None = all classes
            
            # ── Letterbox correction ─────────────────────────────────────────
            # AI branch input: 640×640 (hailonet requirement)
            # Source video:    1280×720 (16:9)
            # GStreamer videoscale fits width → content=640×360, pad top+bottom 140px each
            # Hailo bbox y-coords are in [0,1] relative to 640px height (includes padding)
            # We remap to [0,1] relative to the 360px content region only.
            # x-coords are unaffected (no horizontal padding for 16:9→square).
            _lbox_pad  = 140.0 / 640.0   # = 0.21875 (top/bottom padding fraction)
            _lbox_h    = 360.0 / 640.0   # = 0.5625  (content height fraction)

            def correct_y(y_raw):
                """Remap raw Hailo y-coord (with letterbox) to content-relative [0,1]."""
                return max(0.0, min(1.0, (y_raw - _lbox_pad) / _lbox_h))

            # Extract ROI from stream config
            roi_filter = getattr(stream_cfg, 'roi', {"x":0,"y":0,"w":1,"h":1}) if stream_cfg else {"x":0,"y":0,"w":1,"h":1}
            roi_enabled = getattr(stream_cfg, 'roi_enabled', False) if stream_cfg else False
            show_roi = getattr(stream_cfg, 'show_roi', False) if stream_cfg else False
            roi_x, roi_y, roi_w, roi_h = roi_filter.get("x",0), roi_filter.get("y",0), roi_filter.get("w",1), roi_filter.get("h",1)
            
            def is_in_roi(bbox):
                if not roi_enabled:
                    return True
                cx = bbox.xmin() + (bbox.width() / 2)
                cy = correct_y(bbox.ymin() + bbox.height() / 2)
                return (roi_x <= cx <= roi_x + roi_w) and (roi_y <= cy <= roi_y + roi_h)

            def is_class_allowed(label):
                if class_filter is None:
                    return True
                return label in class_filter
            
            if ai_task == "detection":
                detections = roi.get_objects_typed(hailo.HAILO_DETECTION)
                for det in detections:
                    label = det.get_label()
                    confidence = det.get_confidence()
                    req_conf = class_confidences.get(label, confidence_threshold)
                    if confidence >= req_conf:
                        if is_class_allowed(label):
                            bbox = det.get_bbox()
                            if is_in_roi(bbox):
                                parsed_results.append({
                                    "label": det.get_label(),
                                    "confidence": round(confidence, 2),
                                    # Apply letterbox correction to y-coordinates
                                    "bbox": [
                                        bbox.xmin(),
                                        correct_y(bbox.ymin()),
                                        bbox.xmax(),
                                        correct_y(bbox.ymax())
                                    ]
                                })
                            
            elif ai_task == "classification":
                classifications = roi.get_objects_typed(hailo.HAILO_CLASSIFICATION)
                for cls in classifications:
                    label = cls.get_label()
                    confidence = cls.get_confidence()
                    req_conf = class_confidences.get(label, confidence_threshold)
                    if confidence >= req_conf:
                        if is_class_allowed(label):
                            parsed_results.append({
                                "label": cls.get_label(),
                                "confidence": round(confidence, 2)
                            })
                            
            elif ai_task == "pose":
                # Real HAILO_LANDMARKS extraction following official pose_estimation.py pattern.
                # Landmarks are nested inside HAILO_DETECTION objects (not at ROI level directly).
                COCO_KEYPOINTS = [
                    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
                    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
                    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
                    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
                ]
                detections = roi.get_objects_typed(hailo.HAILO_DETECTION)
                for det in detections:
                    confidence = det.get_confidence()
                    label = det.get_label()
                    req_conf = class_confidences.get(label, confidence_threshold)
                    if confidence >= req_conf and label == "person":
                        bbox = det.get_bbox()
                        if not is_in_roi(bbox):
                            continue
                            
                        landmarks = det.get_objects_typed(hailo.HAILO_LANDMARKS)
                        if len(landmarks) == 0:
                            continue
                        points_raw = landmarks[0].get_points()
                        points = []
                        for i, pt in enumerate(points_raw):
                            # Coords are relative to bbox; convert to full-frame normalized coords
                            x_norm = pt.x() * bbox.width() + bbox.xmin()
                            y_norm_raw = pt.y() * bbox.height() + bbox.ymin()
                            points.append({
                                "x": round(x_norm, 4),
                                "y": round(correct_y(y_norm_raw), 4),  # letterbox correction
                                "confidence": round(pt.confidence(), 2),
                                "name": COCO_KEYPOINTS[i] if i < len(COCO_KEYPOINTS) else f"kp_{i}"
                            })
                        parsed_results.append({
                            "type": "skeleton",
                            "label": label,
                            "confidence": round(confidence, 2),
                            "bbox": [bbox.xmin(), correct_y(bbox.ymin()), bbox.xmax(), correct_y(bbox.ymax())],
                            "points": points
                        })
                        
            elif ai_task == "segmentation":
                # Segmentation requires parsing HAILO_CONF_CLASS_MASK or HAILO_MATRIX
                # Simplified mock representation
                pass

                        
            # ── Send to MessageRouter ─────────────────────────────────────────
            import time
            if getattr(self.config, 'router', None):
                labels = list(set([o.get("label") for o in parsed_results if "label" in o]))
                max_conf = max([o.get("confidence", 0) for o in parsed_results], default=0.0)
                payload_obj = {
                    "detections": parsed_results,
                    "count": len(parsed_results),
                    "labels": labels,
                    "max_confidence": max_conf
                }
                msg = {
                    "payload": payload_obj,
                    "metadata": {
                        "camera_id": camera_id,
                        "timestamp": time.time(),
                        "ai_task": ai_task
                    }
                }
                ai_node_id = getattr(stream_cfg, 'ai_node_id', None) if stream_cfg else None
                if ai_node_id:
                    self.config.router.inject_message(ai_node_id, msg)
                                
            if self.metadata_callback:
                # We send the metadata to the frontend
                metadata = {"type": ai_task, "data": parsed_results, "camera_id": camera_id, "msg": msg}
                if stream_cfg and getattr(stream_cfg, 'roi_enabled', False) and getattr(stream_cfg, 'show_roi', False) and getattr(stream_cfg, 'roi', None):
                    metadata["roi"] = stream_cfg.roi
                self.metadata_callback(metadata)
                
        except Exception as e:
            logger.error(f"Error extracting metadata: {e}")
            
        return Gst.PadProbeReturn.OK

    def _run_loop(self):
        self.loop = GLib.MainLoop()
        
        # Attach bus watch for debugging GStreamer issues
        if self.pipeline:
            bus = self.pipeline.get_bus()
            bus.add_signal_watch()
            bus.connect("message", self.on_bus_message)
            
        try:
            self.loop.run()
        except Exception as e:
            logger.error(f"GLib MainLoop error: {e}")

    def on_bus_message(self, bus, message):
        t = message.type
        if t == Gst.MessageType.ERROR:
            err, debug = message.parse_error()
            logger.error(f"GStreamer Error: {err}, {debug}")
        elif t == Gst.MessageType.WARNING:
            err, debug = message.parse_warning()
            logger.warning(f"GStreamer Warning: {err}, {debug}")
        elif t == Gst.MessageType.EOS:
            logger.info("GStreamer EOS")

    def start(self):
        import time
        if not self.pipeline:
            self.build_pipeline()

        if self.pipeline:
            logger.info("Starting Hailo Pipeline...")
            self.pipeline.set_state(Gst.State.PLAYING)

            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            self.is_running = True
            self.start_time = time.time()
            
            if hasattr(self.config, 'router'):
                self.config.router.metadata_callback = self.metadata_callback
                self.config.router.start()

            # Start adaptive quality monitor (fires _on_quality_tier_change on tier shifts)
            self.quality_mgr.start_monitor(
                num_streams_fn=lambda: len(getattr(self.config, 'camera_streams', [])) if self.config else 0,
                on_tier_change=self._on_quality_tier_change,
            )

    def stop(self):
        self.is_running = False

        if hasattr(self, 'config') and self.config and hasattr(self.config, 'router'):
            self.config.router.stop()

        # Stop adaptive quality monitor before tearing down the pipeline
        self.quality_mgr.stop_monitor()

        # Turn off all hardware cleanly before stopping
        try:
            from hardware.gpio_manager import gpio_mgr
            gpio_mgr.turn_off_all()
        except Exception as e:
            logger.error(f"Error closing GPIO: {e}")

        if self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
        if self.loop:
            self.loop.quit()
        if self.thread:
            self.thread.join(timeout=2)
        self.thread = None

        # Clean up ffmpeg loop processes
        for p in self.ffmpeg_procs:
            try:
                p.terminate()
                p.wait(timeout=2)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        self.ffmpeg_procs = []
        self._ffmpeg_launched = {}   # Reset so next start() can launch fresh ffmpeg procs
            
    def restart(self, config):
        """
        Full restart with a new configuration (called by REST API on redeploy).
        Stops everything including ffmpeg, then rebuilds from scratch.
        """
        logger.info("Restarting pipeline with new configuration...")
        self.stop()   # also stops quality monitor and ffmpeg

        self.config = config
        self.build_pipeline()
        self.start()

    # ── Adaptive quality helpers ──────────────────────────────────────────────

    def _on_quality_tier_change(
        self, new_tier: int, resolution: tuple
    ) -> None:
        """
        Fired by StreamQualityManager when the tier has been stable for 30 s.
        Notifies frontend and schedules a pipeline-only restart (ffmpeg kept alive).
        """
        if self._restarting:
            logger.info("[StreamQuality] Quality change skipped — restart already in progress")
            return

        w, h, kbps, label = resolution
        logger.info(
            f"[StreamQuality] Tier → {new_tier} ({label} {w}×{h}), scheduling pipeline restart"
        )

        # Notify frontend before restart so the badge updates immediately
        if self.metadata_callback and self.config:
            for cam in getattr(self.config, 'camera_streams', []):
                self.metadata_callback({
                    "type":       "stream_quality_update",
                    "camera_id": cam.stream_id,
                    "tier":       new_tier,
                    "label":      label,
                    "resolution": f"{w}\u00d7{h}",
                })

        # Restart in a separate thread (we are on the monitor thread)
        threading.Thread(
            target=self._restart_pipeline_only,
            daemon=True,
            name="QualityRestartThread",
        ).start()

    def _restart_pipeline_only(self) -> None:
        """
        Restart ONLY the GStreamer pipeline — ffmpeg loop processes are kept alive.
        This is ~1 s faster than a full restart() which has to relaunch ffmpeg.
        """
        if self._restarting:
            return
        self._restarting = True
        logger.info("Pipeline-only restart (quality change, ffmpeg preserved)...")

        self.is_running = False
        if self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
        if self.loop:
            self.loop.quit()
        if self.thread:
            self.thread.join(timeout=3)
        self.thread = None
        self.loop = None

        # Rebuild with the new quality tier (quality_mgr.current_tier already updated)
        self._build_pipeline_string(measure_quality=False)

        if self.pipeline:
            self.pipeline.set_state(Gst.State.PLAYING)
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            self.is_running = True

        self._restarting = False
        logger.info("Pipeline-only restart complete")
