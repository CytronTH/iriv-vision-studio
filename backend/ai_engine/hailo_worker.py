import gi
gi.require_version('Gst', '1.0')
gi.require_version('GLib', '2.0')
from gi.repository import Gst, GLib
import threading
import logging
import json
import functools
from typing import Callable

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
        
        # We start with the config provided, or build a fallback pipeline later
        self.is_running = False

    def build_pipeline(self):
        """
        Constructs the GStreamer pipeline string dynamically based on self.config.
        """
        if not self.config:
            logger.error("Cannot build pipeline without a configuration.")
            return

        # Initialize Hardware
        from hardware.gpio_manager import PIN_MAP
        for do in getattr(self.config, 'digital_outputs', []):
            pin_num = PIN_MAP.get(do["pin"])
            if pin_num:
                gpio_mgr.setup_output(do["pin"], pin_num)
                
        # LEDs and Buzzers are attached to streams
        for stream in getattr(self.config, 'camera_streams', []):
            for led in getattr(stream, 'led_outputs', []):
                pin_num = PIN_MAP.get(led["pin"])
                if pin_num:
                    gpio_mgr.setup_pwm(led["pin"], pin_num)
            
            if getattr(stream, 'buzzer_actions', []):
                gpio_mgr.setup_buzzer("BUZZER", PIN_MAP.get("BUZZER", 19))

        import os
        pipeline_substrings = []
        
        camera_streams = getattr(self.config, 'camera_streams', [])
        
        if not camera_streams:
            logger.warning("No camera streams found in config. Using fallback empty pipeline.")
            return

        for i, cam_stream in enumerate(camera_streams):
            video_src_type = getattr(cam_stream, 'video_source_type', 'local')
            video_src = getattr(cam_stream, 'video_source', '/dev/video0')
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

            # Construct source based on type
            if video_src_type == "rtsp":
                source_bin = f"rtspsrc location={video_src} ! rtph264depay ! h264parse ! avdec_h264"
            elif video_src_type == "file":
                source_bin = f"filesrc location={video_src} ! decodebin"
            else:
                # Default to local camera
                source_bin = "libcamerasrc"

            if has_ai:
                sub_str = (
                    f"{source_bin} ! "
                    f"videoconvert ! tee name=t_{i} "
                    f"t_{i}. ! queue ! videoconvert ! videoscale ! video/x-raw,width=640,height=360 ! "
                    f"x264enc tune=zerolatency speed-preset=ultrafast bitrate=800 key-int-max=30 ! h264parse config-interval=1 ! rtspclientsink location=rtsp://127.0.0.1:8554/{self.project_id}_{stream_id} protocols=tcp "
                    f"t_{i}. ! queue ! videoconvert ! videoscale ! video/x-raw,format=RGB,width=640,height=640 ! "
                    f"hailonet hef-path={hef} force-writable=true vdevice-group-id=1 ! "
                    f"hailofilter name=filter_{i} so-path={so} qos=false ! "
                    f"fakesink name=sink_{i} sync=false"
                )
            else:
                sub_str = (
                    f"{source_bin} ! "
                    f"videoconvert ! videoscale ! video/x-raw,width=640,height=360 ! "
                    f"x264enc tune=zerolatency speed-preset=ultrafast bitrate=800 key-int-max=30 ! h264parse config-interval=1 ! rtspclientsink location=rtsp://127.0.0.1:8554/{self.project_id}_{stream_id} protocols=tcp"
                )
            pipeline_substrings.append(sub_str)
        
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
        except GLib.Error as e:
            logger.error(f"Failed to parse GStreamer pipeline: {e}")
            self.pipeline = None

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
            
            # Default threshold if no logic rules are set
            confidence_threshold = 0.5 
            label_filter = None
            object_count_threshold = 0
            
            # Extract rules from stream config
            if stream_cfg:
                for rule in getattr(stream_cfg, 'logic_rules', []):
                    if rule["type"] == "confidence_gt":
                        confidence_threshold = rule["threshold"]
                    elif rule["type"] == "label_equals":
                        label_filter = rule["threshold"]
                    elif rule["type"] == "object_count_gt":
                        object_count_threshold = rule["threshold"]
            
            if ai_task == "detection":
                detections = roi.get_objects_typed(hailo.HAILO_DETECTION)
                for det in detections:
                    confidence = det.get_confidence()
                    if confidence > confidence_threshold:
                        if label_filter is None or det.get_label() == label_filter:
                            bbox = det.get_bbox()
                            parsed_results.append({
                                "label": det.get_label(),
                                "confidence": round(confidence, 2),
                                "bbox": [bbox.xmin(), bbox.ymin(), bbox.xmax(), bbox.ymax()]
                            })
                            
            elif ai_task == "classification":
                classifications = roi.get_objects_typed(hailo.HAILO_CLASSIFICATION)
                for cls in classifications:
                    confidence = cls.get_confidence()
                    if confidence > confidence_threshold:
                        if label_filter is None or cls.get_label() == label_filter:
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
                    if confidence > confidence_threshold and label == "person":
                        bbox = det.get_bbox()
                        landmarks = det.get_objects_typed(hailo.HAILO_LANDMARKS)
                        if len(landmarks) == 0:
                            continue
                        points_raw = landmarks[0].get_points()
                        points = []
                        for i, pt in enumerate(points_raw):
                            # Coords are relative to bbox; convert to full-frame normalized coords
                            x_norm = pt.x() * bbox.width() + bbox.xmin()
                            y_norm = pt.y() * bbox.height() + bbox.ymin()
                            points.append({
                                "x": round(x_norm, 4),
                                "y": round(y_norm, 4),
                                "confidence": round(pt.confidence(), 2),
                                "name": COCO_KEYPOINTS[i] if i < len(COCO_KEYPOINTS) else f"kp_{i}"
                            })
                        parsed_results.append({
                            "type": "skeleton",
                            "label": label,
                            "confidence": round(confidence, 2),
                            "bbox": [bbox.xmin(), bbox.ymin(), bbox.xmax(), bbox.ymax()],
                            "points": points
                        })
                        
            elif ai_task == "segmentation":
                # Segmentation requires parsing HAILO_CONF_CLASS_MASK or HAILO_MATRIX
                # Simplified mock representation
                pass

                        
            # Apply object count filter and emit logic states
            object_count_threshold = 0
            logic_states = []
            
            if stream_cfg:
                for rule in getattr(stream_cfg, 'logic_rules', []):
                    if rule["type"] == "object_count_gt":
                        object_count_threshold = rule["threshold"]
                        is_true = len(parsed_results) > object_count_threshold
                        if rule.get("node_id"):
                            logic_states.append({
                                "node_id": rule.get("node_id"),
                                "value": is_true,
                                "count": len(parsed_results)
                            })
                            
                    elif rule["type"] == "confidence_gt":
                        # simplified state, if ANY object > threshold
                        is_true = any(obj["confidence"] > rule["threshold"] for obj in parsed_results)
                        if rule.get("node_id"):
                            logic_states.append({
                                "node_id": rule.get("node_id"),
                                "value": is_true
                            })
                            
                    elif rule["type"] == "label_equals":
                        is_true = any(obj["label"] == str(rule["threshold"]) for obj in parsed_results)
                        if rule.get("node_id"):
                            logic_states.append({
                                "node_id": rule.get("node_id"),
                                "value": is_true
                            })
            
            if logic_states and self.metadata_callback:
                for state in logic_states:
                    self.metadata_callback({
                        "type": "logic_state",
                        "camera_id": camera_id,
                        "node_id": state["node_id"],
                        "value": state["value"],
                        "details": state
                    })
                        
            if len(parsed_results) > object_count_threshold:
                # Trigger actions
                if stream_cfg:
                    for action in getattr(stream_cfg, 'actions', []):
                        if action["type"] == "console_log":
                            logger.info(f"ACTION TRIGGERED: {action.get('name')} (Found {len(parsed_results)} objects)")
                        elif action["type"] == "webhook":
                            target = action.get("target")
                            if target:
                                import threading
                                import urllib.request
                                import urllib.error
                                
                                def send_webhook():
                                    try:
                                        req = urllib.request.Request(target, data=json.dumps({"results": parsed_results}).encode('utf-8'), headers={'Content-Type': 'application/json'})
                                        urllib.request.urlopen(req, timeout=3)
                                        logger.info(f"Webhook sent successfully to {target}")
                                    except urllib.error.URLError as e:
                                        logger.error(f"Webhook failed to {target}: {e}")
                                        
                                threading.Thread(target=send_webhook, daemon=True).start()
                                
                    # Trigger hardware outputs ON
                    # Currently global hardware is left as is, but we could make it stream specific if needed.
                    for do in getattr(self.config, 'digital_outputs', []):
                        gpio_mgr.set_output(do["pin"], do["action"] == "on")
                        
                    for led in getattr(stream_cfg, 'led_outputs', []):
                        gpio_mgr.set_pwm(led["pin"], led["brightness"])
                        
                    for buzzer in getattr(stream_cfg, 'buzzer_actions', []):
                        gpio_mgr.set_output("BUZZER", True)
                        
                    for rs485 in getattr(stream_cfg, 'rs485_actions', []):
                        payload = rs485["payload"]
                        if rs485["hex_mode"]:
                            try:
                                data = bytes.fromhex(payload.replace(" ", ""))
                            except:
                                data = payload.encode('utf-8')
                        else:
                            data = payload.encode('utf-8')
                        rs485_mgr.send_data(data)
                        
            else:
                # Turn OFF hardware if condition not met (basic implementation)
                if stream_cfg:
                    # Generic outputs can stay global
                    if getattr(self, 'config', None):
                        for do in getattr(self.config, 'digital_outputs', []):
                            if do["action"] == "on":  # If it turns on when detected, turn off when not detected
                                gpio_mgr.set_output(do["pin"], False)
                    for led in getattr(stream_cfg, 'led_outputs', []):
                        gpio_mgr.set_pwm(led["pin"], 0.0)
                    for buzzer in getattr(stream_cfg, 'buzzer_actions', []):
                        gpio_mgr.set_output("BUZZER", False)
                                
            if self.metadata_callback:
                # We send the metadata to the frontend
                self.metadata_callback({"type": ai_task, "data": parsed_results, "camera_id": camera_id})
                
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
        if not self.pipeline:
            self.build_pipeline()
            
        if self.pipeline:
            logger.info(f"Starting Hailo Pipeline...")
            self.pipeline.set_state(Gst.State.PLAYING)
            
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            self.is_running = True

    def stop(self):
        self.is_running = False
        
        # Turn off all hardware cleanly before stopping
        try:
            from hardware.gpio_manager import gpio_mgr
            gpio_mgr.close()
        except Exception as e:
            logger.error(f"Error closing GPIO: {e}")
            
        if self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
        if self.loop:
            self.loop.quit()
        if self.thread:
            self.thread.join(timeout=2)
            
    def restart(self, config):
        """
        Dynamically rebuilds and restarts the pipeline with a new configuration.
        """
        logger.info("Restarting pipeline with new configuration...")
        self.stop()
        
        self.config = config
        self.build_pipeline()
        self.start()
