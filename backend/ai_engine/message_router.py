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
        
        self.debounce_ms = float(data.get("debounceMs", 0)) / 1000.0
        self.output_mode = data.get("outputMode", "on_change")  # "on_change", "rising_edge", "continuous"
        self.cooldown_ms = float(data.get("cooldownMs", 0)) / 1000.0
        
        self.first_true = None
        self.last_final_val = False
        self.last_emit_time = 0.0
        self.last_ws_val = False

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

        # 1. Evaluate trigger condition based on output_mode
        should_emit = False
        if self.output_mode == "continuous":
            should_emit = True
        elif self.output_mode == "rising_edge":
            # Only trigger on transition False -> True
            if final_val and not self.last_final_val:
                should_emit = True
        else:
            # Default: "on_change" - trigger when state flips
            if final_val != self.last_final_val:
                should_emit = True

        # 2. Check cooldown suppression if triggered
        if should_emit:
            if self.cooldown_ms > 0 and (current_time - self.last_emit_time < self.cooldown_ms):
                should_emit = False
            else:
                self.last_emit_time = current_time

        # 3. Deduplicate WebSocket updates: only notify UI when state changes
        if self.router.metadata_callback and (final_val != self.last_ws_val):
            self.last_ws_val = final_val
            self.router.metadata_callback({
                "type": "logic_state",
                "node_id": self.node_id,
                "value": final_val,
                "camera_id": msg.get("camera_id"),
                "msg": msg
            })

        self.last_final_val = final_val

        # 4. Drop message if trigger condition is not satisfied (prevents flooding)
        if not should_emit:
            return None

        msg["payload"] = final_val
        return msg

class CounterNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="counterNode")
        self.count = 0
        self.last_payload = False
        self.edge_type = data.get("edgeType", "rising")
        self.auto_log = data.get("autoLog", True)

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
                "node_id": self.node_id,
                "value": self.count,
                "camera_id": msg.get("camera_id", msg.get("metadata", {}).get("camera_id")),
                "msg": msg
            })
            
            ts = msg.get("metadata", {}).get("timestamp", time.time())
            
            # No longer logging to TSDB directly; use DatabaseWriterNode instead.
            self.router.metadata_callback({
                "type": "counter_update",
                "node_id": self.node_id,
                "value": self.count,
                "camera_id": msg.get("camera_id", msg.get("metadata", {}).get("camera_id")),
                "msg": msg
            })
            
        return msg

    def reset_counts(self):
        self.count = 0
        self.last_payload = False
        self._last_telemetry_count = 0
        if self.router.metadata_callback:
            self.router.metadata_callback({
                "type": "counter_update",
                "node_id": self.node_id,
                "value": 0
            })

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
        self.total_count = 0
        
        self.tracker = CentroidTracker(
            max_disappeared=int(data.get("maxDisappeared", 20)),
            max_distance=float(data.get("maxDistance", 0.15))
        )

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
            
            # Clean up cumulative counts if class filter changed (e.g. via hot-reload)
            keys_to_remove = [k for k in self.cumulative_totals.keys() if k not in self.class_filter]
            for k in keys_to_remove:
                self.total_count -= self.cumulative_totals[k]
                del self.cumulative_totals[k]
        else:
            filtered_detections = detections

        active_tracks = self.tracker.update(filtered_detections)

        newly_counted = 0
        triggering_objects = []
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
                self.total_count += 1
                newly_counted += 1
                
                # Append to triggering objects for snapshot drawing
                triggering_objects.append({
                    "label": lbl,
                    "confidence": getattr(track, 'confidence', 1.0),
                    "bbox": getattr(track, 'bbox', [])
                })

        # --- MONITORING LOGIC FOR LOOP COUNTS ---
        current_loop = msg.get("metadata", {}).get("current_loop")
        if current_loop is not None:
            last_loop = getattr(self, '_monitor_last_loop', None)
            if last_loop is not None and current_loop > last_loop:
                # Loop transitioned! e.g. from 1 to 2
                expected_count = last_loop * 4
                if self.total_count != expected_count:
                    import logging
                    log = logging.getLogger(__name__)
                    log.error(f"[MONITOR] ABNORMAL COUNT! Loop {last_loop} ended with {self.total_count} counts. Expected {expected_count}!")
                else:
                    import logging
                    log = logging.getLogger(__name__)
                    log.info(f"[MONITOR] Loop {last_loop} ended perfectly with {self.total_count} counts.")
            self._monitor_last_loop = current_loop
        # ----------------------------------------

        now = time.time()
        should_broadcast = (newly_counted > 0) or (now - getattr(self, '_last_broadcast_time', 0) >= 0.5)
        if should_broadcast and self.router.metadata_callback:
            self._last_broadcast_time = now
            
            payload_data = {
                "counts": dict(self.cumulative_totals),
                "total": self.total_count,
                "newly_counted": newly_counted,
                "triggering_objects": triggering_objects,
                "flow_mode": self.mode,
                "flow_line": self.line if self.mode == "line" else None,
                "flow_roi": self.roi if self.mode == "roi" else None
            }
            ts = msg.get("metadata", {}).get("timestamp", now)
            # No longer logging to TSDB directly; use DatabaseWriterNode instead.
            self.router.metadata_callback({
                "type": "flow_counter_update",
                "node_id": self.node_id,
                "counts": dict(self.cumulative_totals),
                "total": self.total_count,
                "newly_counted": newly_counted,
                "camera_id": camera_id,
                "msg": msg
            })
        msg["payload"] = {
            "counts": dict(self.cumulative_totals),
            "total": self.total_count,
            "newly_counted": newly_counted,
            "triggering_objects": triggering_objects,
            "flow_mode": self.mode,
            "flow_line": self.line if self.mode == "line" else None,
            "flow_roi": self.roi if self.mode == "roi" else None
        }
        return msg

    def reset_counts(self):
        self.cumulative_totals.clear()
        self.total_count = 0
        if self.router.metadata_callback:
            self.router.metadata_callback({
                "type": "flow_counter_update",
                "node_id": self.node_id,
                "counts": {},
                "total": 0
            })

class TargetTrackerNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="targetTrackerNode")
        import time
        self.target = int(data.get("targetCount", 100))
        self.edge_type = data.get("edgeType", "rising")
        
        self.actual = 0
        self.last_payload = False
        self.start_time = None
        self.is_complete = False
        self.current_rate_per_minute = 0.0
        self.eta_seconds = None
        self._last_update_ts = time.time()

    def process(self, msg: dict):
        import time
        now = time.time()
        
        current_payload = bool(msg.get("payload"))
        
        trigger = False
        if self.edge_type == "falling":
            if not current_payload and self.last_payload:
                trigger = True
        else:
            if current_payload and not self.last_payload:
                trigger = True
                
        self.last_payload = current_payload
        
        updated = False
        if trigger and not self.is_complete:
            if self.actual == 0:
                self.start_time = now
                
            self.actual += 1
            updated = True
            
            if self.actual >= self.target:
                self.is_complete = True
                
        # To keep UI fresh even without trigger
        if self.actual > 0 and self.start_time is not None and not self.is_complete:
            elapsed = now - self.start_time
            if elapsed > 0:
                # Recalculate rate ONLY every 1.0s to prevent rapid flickering on the dashboard
                if now - getattr(self, '_last_rate_calc_ts', 0) > 1.0:
                    rate_per_sec = self.actual / elapsed
                    self.current_rate_per_minute = rate_per_sec * 60.0
                    if rate_per_sec > 0:
                        remaining = self.target - self.actual
                        self.eta_seconds = remaining / rate_per_sec
                    else:
                        self.eta_seconds = None
                    self._last_rate_calc_ts = now
            if now - getattr(self, '_last_update_ts', 0) > 1.0:
                updated = True
        elif self.is_complete:
            self.eta_seconds = 0
            
        progress = (self.actual / self.target) * 100.0 if self.target > 0 else 100.0
        if progress > 100.0:
            progress = 100.0
            
        # Emit telemetry
        if self.router.metadata_callback and (updated or trigger):
            self._last_update_ts = now
            self.router.metadata_callback({
                "type": "target_tracker_update",
                "node_id": self.node_id,
                "target": self.target,
                "actual": self.actual,
                "progress_percent": progress,
                "current_rate_per_minute": self.current_rate_per_minute,
                "eta_seconds": self.eta_seconds,
                "is_complete": self.is_complete
            })
            
        msg["payload"] = self.is_complete
        return msg

    def reset_counts(self):
        self.actual = 0
        self.last_payload = False
        self.start_time = None
        self.is_complete = False
        self.current_rate_per_minute = 0.0
        self.eta_seconds = None
        
        if self.router.metadata_callback:
            self.router.metadata_callback({
                "type": "target_tracker_update",
                "node_id": self.node_id,
                "target": self.target,
                "actual": self.actual,
                "progress_percent": 0.0,
                "current_rate_per_minute": 0.0,
                "eta_seconds": None,
                "is_complete": False
            })

class UnitThroughputNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="unitThroughputNode")
        from ai_engine.centroid_tracker import CentroidTracker

        self.start_trigger = data.get("startTrigger", "first_object")
        self.pause_trigger = data.get("pauseTrigger", "timeout")
        self.pause_timeout_seconds = float(data.get("pauseTimeoutSeconds", 60.0))
        self.rate_unit = data.get("rateUnit", "minute")
        self.decimal_places = int(data.get("decimalPlaces", 2))
        
        self.tracker = CentroidTracker(
            max_disappeared=20,
            max_distance=0.15
        )
        
        self.is_running = False
        self.start_time = None
        self.current_count = 0
        self.last_object_time = None
        self.throughput = 0.0
        
        # Used for manual API toggling
        self.manual_state = False

    def reset_counts(self):
        self.is_running = False
        self.start_time = None
        self.current_count = 0
        self.last_object_time = None
        self.throughput = 0.0
        self.manual_state = False
        self.tracker = __import__('ai_engine.centroid_tracker', fromlist=['CentroidTracker']).CentroidTracker(max_disappeared=20, max_distance=0.15)
        
        self._emit_telemetry()

    def set_manual_state(self, state: bool):
        import time
        self.manual_state = state
        self.is_running = state
        if state and self.start_time is None:
            self.start_time = time.time()
        self._emit_telemetry()

    def process(self, msg: dict):
        import time
        now = time.time()
        
        payload = msg.get("payload", {})
        if isinstance(payload, dict) and "detections" in payload:
            detections = payload.get("detections", [])
        elif isinstance(payload, list):
            detections = payload
        else:
            detections = []
            
        active_tracks = self.tracker.update(detections)
        
        newly_counted = 0
        
        for track in active_tracks:
            if not getattr(track, 'throughput_counted', False):
                track.throughput_counted = True
                newly_counted += 1
                self.last_object_time = now

        # Evaluate Start Trigger
        if not self.is_running:
            if self.start_trigger == "first_object":
                if newly_counted > 0:
                    self.is_running = True
                    self.start_time = now
            elif self.start_trigger == "manual":
                if self.manual_state:
                    self.is_running = True
                    if self.start_time is None:
                        self.start_time = now
            
        # Evaluate Pause Trigger
        if self.is_running:
            if self.pause_trigger == "timeout":
                if self.last_object_time and (now - self.last_object_time) > self.pause_timeout_seconds:
                    self.is_running = False
            elif self.pause_trigger == "manual":
                if not self.manual_state:
                    self.is_running = False

        # Update Counts
        if self.is_running and newly_counted > 0:
            self.current_count += newly_counted
            
        # Calculate Throughput
        if self.is_running and self.start_time:
            elapsed = now - self.start_time
            if elapsed > 0:
                if now - getattr(self, '_last_rate_calc_ts', 0) > 1.0:
                    rate_per_sec = self.current_count / elapsed
                    if self.rate_unit == "minute":
                        self.throughput = round(rate_per_sec * 60, self.decimal_places)
                    elif self.rate_unit == "hour":
                        self.throughput = round(rate_per_sec * 3600, self.decimal_places)
                    else:
                        self.throughput = round(rate_per_sec, self.decimal_places)
                    self._last_rate_calc_ts = now
            
        # Emit telemetry throttled (e.g. 0.5s) to avoid UI blurring and excessive React re-renders
        should_broadcast = False
        if getattr(self, '_last_is_running', None) != self.is_running:
            should_broadcast = True
        elif newly_counted > 0:
            should_broadcast = True
        elif now - getattr(self, '_last_broadcast_time', 0) >= 0.5:
            should_broadcast = True
            
        if should_broadcast:
            self._last_broadcast_time = now
            self._last_is_running = self.is_running
            self._emit_telemetry(msg)
        
        msg["payload"] = {
            "current_unit": self.current_count,
            "throughput": self.throughput,
            "is_running": self.is_running,
            "rate_unit": self.rate_unit
        }
        
        return msg

    def _emit_telemetry(self, msg=None):
        if self.router.metadata_callback:
            camera_id = msg.get("camera_id") if msg else "default"
            if not camera_id and msg:
                camera_id = msg.get("metadata", {}).get("camera_id", "default")
                
            self.router.metadata_callback({
                "type": "unit_throughput_update",
                "node_id": self.node_id,
                "current_unit": self.current_count,
                "throughput": self.throughput,
                "is_running": self.is_running,
                "camera_id": camera_id,
                "msg": msg
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
                import re
                # Convert array notation [0] to dot notation .0
                clean_path = re.sub(r'\[(\d+)\]', r'.\1', path)
                keys = clean_path.split('.')
                # allow starting with "msg."
                if keys and keys[0] == "msg":
                    keys = keys[1:]
                
                val = d
                for k in keys:
                    if isinstance(val, dict) and k in val:
                        val = val[k]
                    elif isinstance(val, list):
                        if k == "length":
                            val = len(val)
                        elif k.isdigit() and int(k) < len(val):
                            val = val[int(k)]
                        else:
                            return None
                    else:
                        # MAGIC FOR UI COMPATIBILITY: 
                        # If the backend payload is a primitive (like bool from LogicNode)
                        # but the UI dropdown shows the websocket envelope fields (type, node_id, value),
                        # we map ".value" directly to the primitive itself so the dashboard works.
                        if k == "value" and isinstance(val, (bool, int, float, str)):
                            return val
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
            
            # No longer logging to TSDB directly; use DatabaseWriterNode instead.
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
        payload = msg.get("payload")
        if isinstance(payload, dict) and "newly_counted" in payload:
            val = payload["newly_counted"] > 0
        elif isinstance(payload, dict) and "detections" in payload:
            val = len(payload["detections"]) > 0
        elif isinstance(payload, list):
            val = len(payload) > 0
        else:
            val = bool(payload)
            
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
        self.zero_latency = data.get("zeroLatency", False)
        
        # Zero-latency state
        self.cap_running = False
        self.cap_thread = None
        self.latest_frame = None
        self.frame_buffer = [] # (timestamp, frame)

    def _capture_loop(self, rtsp_url):
        import cv2, time
        cap = cv2.VideoCapture(rtsp_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        while self.cap_running:
            ret, frame = cap.read()
            if ret:
                self.latest_frame = frame
                self.frame_buffer.append((time.time(), frame))
                if len(self.frame_buffer) > 30: # keep approx 1 sec at 30fps
                    self.frame_buffer.pop(0)
            else:
                time.sleep(0.01)
                
        cap.release()

    def cleanup(self):
        if self.cap_running:
            self.cap_running = False
            if self.cap_thread:
                self.cap_thread.join(timeout=1.0)
                
    def process(self, msg: dict):
        payload = msg.get("payload")
        if isinstance(payload, dict) and "newly_counted" in payload:
            current_payload = payload["newly_counted"] > 0
        elif isinstance(payload, dict) and "detections" in payload:
            current_payload = len(payload["detections"]) > 0
        elif isinstance(payload, list):
            current_payload = len(payload) > 0
        else:
            current_payload = bool(payload)
        
        
        camera_id = msg.get("camera_id", msg.get("metadata", {}).get("camera_id"))
        rtsp_url = f"rtsp://127.0.0.1:8554/{self.router.project_id}_{camera_id}" if camera_id else None
        
        # Lazy start zero-latency thread
        if self.zero_latency and rtsp_url and not self.cap_running:
            self.cap_running = True
            import threading
            self.cap_thread = threading.Thread(target=self._capture_loop, args=(rtsp_url,), daemon=True)
            self.cap_thread.start()

        trigger_edge = self.data.get("triggerEdge", "rising")
        is_triggered = False
        if trigger_edge == "rising":
            is_triggered = current_payload and not self.last_payload
        elif trigger_edge == "falling":
            is_triggered = not current_payload and self.last_payload

        if is_triggered:
            if camera_id:
                import subprocess
                from pathlib import Path
                import time
                
                snapshots_dir = Path("/home/pi/pido-ai/snapshots")
                snapshots_dir.mkdir(parents=True, exist_ok=True)
                
                timestamp = int(time.time() * 1000)
                filename = f"{camera_id}_{timestamp}.jpg"
                filepath = snapshots_dir / filename
                
                try:
                    # Extract detections from context
                    search_payload = msg.get("payload", {})
                    if not isinstance(search_payload, dict):
                        context = msg.get("context", {})
                        for v in context.values():
                            if isinstance(v, dict):
                                search_payload = v
                                break
                    
                    detections = search_payload.get("triggering_objects")
                    if detections is None:
                        detections = search_payload.get("detections", [])

                    def _capture_and_draw(url, path, dets, proj_id, lbl, latest_frame=None):
                        import subprocess, cv2
                        if latest_frame is not None:
                            img = latest_frame.copy()
                            cv2.imwrite(str(path), img) # Save raw frame first
                        else:
                            proc = subprocess.Popen([
                                "ffmpeg", "-y", "-rtsp_transport", "tcp", "-i", url, 
                                "-vframes", "1", "-q:v", "2", str(path)
                            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            try:
                                from ai_engine.telemetry_manager import telemetry_mgr
                                telemetry_mgr.register_process(proj_id, f"ffmpeg snapshot ({lbl})", proc.pid)
                            except Exception:
                                pass
                            proc.wait()
                        
                        # Draw bbox and flow lines
                        should_draw_bbox = dets and self.data.get("drawBbox", True) is not False
                        should_draw_lines = search_payload.get("flow_mode") is not None
                        
                        if (should_draw_bbox or should_draw_lines) and path.exists():
                            try:
                                img = cv2.imread(str(path))
                                if img is not None:
                                    H, W, _ = img.shape
                                    
                                    if should_draw_bbox:
                                        for det in dets:
                                            box = det.get("bbox", [])
                                            if len(box) == 4:
                                                x1 = int(box[0] * W)
                                                y1 = int(box[1] * H)
                                                x2 = int(box[2] * W)
                                                y2 = int(box[3] * H)
                                                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                                                cv2.putText(img, f"{det.get('label', '')} {det.get('confidence', 0):.2f}", (x1, max(y1 - 5, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                                        
                                    if should_draw_lines:
                                        # Draw the Flow Counter Line/Zone if available
                                        flow_mode = search_payload.get("flow_mode")
                                        if flow_mode == "line" and search_payload.get("flow_line"):
                                            lx1, ly1, lx2, ly2 = search_payload.get("flow_line")
                                            cv2.line(img, (int(lx1 * W), int(ly1 * H)), (int(lx2 * W), int(ly2 * H)), (0, 0, 255), 2)
                                        elif flow_mode == "roi" and search_payload.get("flow_roi"):
                                            roi = search_payload.get("flow_roi")
                                            rx, ry, rw, rh = roi["x"], roi["y"], roi["w"], roi["h"]
                                            cv2.rectangle(img, (int(rx * W), int(ry * H)), (int((rx+rw) * W), int((ry+rh) * H)), (0, 0, 255), 2)
                                            
                                    cv2.imwrite(str(path), img)
                            except Exception as e:
                                import logging
                                logging.getLogger("ai_engine").error(f"Draw bbox error: {e}")

                    if self.zero_latency and self.latest_frame is not None:
                        # Synchronize RTSP latency with JSON speed
                        sync_delay_ms = int(self.data.get("syncDelay", 250))
                        
                        import threading
                        def delayed_capture():
                            if sync_delay_ms > 0:
                                time.sleep(sync_delay_ms / 1000.0) # Wait for video frame to catch up
                                target_frame = self.latest_frame
                            elif sync_delay_ms < 0:
                                # Time machine: look back into frame buffer
                                target_time = time.time() + (sync_delay_ms / 1000.0)
                                best_frame = self.latest_frame
                                min_diff = float('inf')
                                for ts, frm in self.frame_buffer:
                                    diff = abs(ts - target_time)
                                    if diff < min_diff:
                                        min_diff = diff
                                        best_frame = frm
                                target_frame = best_frame
                            else:
                                target_frame = self.latest_frame
                                
                            _capture_and_draw(rtsp_url, filepath, detections, self.router.project_id, self.label, target_frame)
                        
                        t = threading.Thread(target=delayed_capture, daemon=True)
                        t.start()
                    else:
                        # Asynchronous ffmpeg snapshot
                        import threading
                        if not hasattr(self, '_threads'):
                            self._threads = []
                        self._threads = [t for t in self._threads if t.is_alive()]
                        
                        if len(self._threads) < 5:
                            t = threading.Thread(target=_capture_and_draw, args=(rtsp_url, filepath, detections, self.router.project_id, self.label))
                            t.daemon = True
                            t.start()
                            self._threads.append(t)

                    
                    # Log to DB
                    import sys
                    import os
                    # add backend dir to sys.path if needed
                    backend_dir = Path("/home/pi/pido-ai/backend")
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
                    msg["snapshot_path"] = f"/api/snapshots/{filepath.name}"
                except Exception as e:
                    import logging
                    logging.getLogger("ai_engine").error(f"Snapshot error: {e}")
                    
        self.last_payload = current_payload
        return msg

class DatabaseWriterNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="databaseWriterNode")
        self.label = data.get("label", "Database Writer")
        self.variable_name = data.get("variableName", "metric")
        self.property_path = data.get("propertyPath", "")
        self.write_strategy = data.get("writeStrategy", "on_change")
        self.deadband = float(data.get("deadband", 0))
        self.heartbeat_interval = float(data.get("heartbeatInterval", 60))
        self.window_size = float(data.get("windowSize", 5))
        self.aggregation_method = data.get("aggregationMethod", "average")
        
        self.last_written_value = None
        self.last_written_time = 0
        self.aggregation_buffer = []
        self.window_start_time = 0
        self.last_payload = None

    def process(self, msg: dict):
        current_payload = msg.get("payload")
        
        # If property_path is specified, extract the value using robust path parsing
        if self.property_path:
            import re
            clean_path = re.sub(r'\[(\d+)\]', r'.\1', self.property_path)
            keys = clean_path.split('.')
            if keys and keys[0] == "msg":
                keys = keys[1:]
            
            target = msg
            for k in keys:
                if isinstance(target, dict) and k in target:
                    target = target[k]
                elif isinstance(target, list):
                    if k == "length":
                        target = len(target)
                    elif k.isdigit() and int(k) < len(target):
                        target = target[int(k)]
                    else:
                        target = None
                        break
                else:
                    target = None
                    break
                    
            if target is not None:
                current_payload = target
        
        # Determine if payload is numeric
        val = 0.0
        try:
            if isinstance(current_payload, (int, float)):
                val = float(current_payload)
            elif isinstance(current_payload, bool):
                val = 1.0 if current_payload else 0.0
            elif isinstance(current_payload, str):
                val = float(current_payload)
            elif isinstance(current_payload, dict):
                # If dict (and no valid property path used), try to find 'total', else fallback to 1.0
                if "total" in current_payload:
                    val = float(current_payload["total"])
                else:
                    val = 1.0 if current_payload else 0.0
            elif isinstance(current_payload, list):
                val = float(len(current_payload))
            else:
                return msg
        except ValueError:
            return msg

        import time
        now = time.time()
        
        should_write = False
        write_value = val

        if self.write_strategy == "raw":
            should_write = True
            
        elif self.write_strategy == "aggregation":
            if not self.window_start_time:
                self.window_start_time = now
                
            self.aggregation_buffer.append(val)
            
            if now - self.window_start_time >= self.window_size:
                should_write = True
                if self.aggregation_buffer:
                    if self.aggregation_method == "average":
                        write_value = sum(self.aggregation_buffer) / len(self.aggregation_buffer)
                    elif self.aggregation_method == "max":
                        write_value = max(self.aggregation_buffer)
                    elif self.aggregation_method == "min":
                        write_value = min(self.aggregation_buffer)
                    elif self.aggregation_method == "latest":
                        write_value = self.aggregation_buffer[-1]
                self.aggregation_buffer = []
                self.window_start_time = now
                
        else: # on_change (default)
            if self.last_written_value is None:
                should_write = True
            else:
                # Deadband check (must be greater than deadband)
                if abs(val - self.last_written_value) > self.deadband:
                    should_write = True
                # Heartbeat check
                elif self.heartbeat_interval > 0 and (now - self.last_written_time) >= self.heartbeat_interval:
                    should_write = True

        if should_write:
            try:
                import sys
                from db.database import db
                
                db.log_custom_metric(
                    project_id=self.router.project_id,
                    node_id=self.node_id,
                    variable_name=self.variable_name,
                    value=write_value
                )
            except Exception as e:
                import logging
                logging.getLogger("ai_engine").error(f"DatabaseWriterNode error: {e}")
            
            self.last_written_value = write_value
            self.last_written_time = now
            self.last_payload = write_value
            
        # Emit real-time value for dashboard, but throttle to prevent React state thrashing
        import time
        now = time.time()
        should_broadcast_dash = False
        last_dash_val = getattr(self, '_last_dash_val', None)
        last_dash_time = getattr(self, '_last_dash_time', 0)
        
        if last_dash_val is None:
            should_broadcast_dash = True
        elif isinstance(self.last_written_value, float):
            # Floats (like throughput rates) jitter continuously. Strictly time-throttle them.
            if now - last_dash_time >= 0.5:
                should_broadcast_dash = True
        else:
            # Ints/Bools (like counters) should update immediately on change for responsiveness
            if self.last_written_value != last_dash_val:
                should_broadcast_dash = True
            elif now - last_dash_time >= 1.0: # periodic heartbeat
                should_broadcast_dash = True
            
        if should_broadcast_dash and self.router.metadata_callback and self.last_written_value is not None:
            self._last_dash_time = now
            self._last_dash_val = self.last_written_value
            self.router.metadata_callback({
                "type": "dashboard_update",
                "node_id": self.node_id,
                "value": self.last_written_value,
                "variable_name": self.variable_name
            })
            
        return msg

class CollectionWriterNode(PipelineNode):
    def __init__(self, node_id, data, router):
        super().__init__(node_id, data, router, node_type="collectionWriterNode")
        self.collection_id = data.get("collectionId")
        self.field_mappings = data.get("fieldMappings", {}) # { "column_key": "propertyPath" }

    def process(self, msg: dict):
        if not self.collection_id:
            return msg
            
        current_payload = msg.get("payload", {})
        
        # If the incoming payload is explicitly a boolean False (e.g. from a LogicNode falling edge),
        # we skip writing to avoid creating empty/null records.
        if isinstance(current_payload, bool) and not current_payload:
            return msg
            
        snapshot_path = msg.get("snapshot_path")
        
        # Try to find a rich dictionary payload if the current one is boolean (e.g. from LogicNode)
        search_payload = current_payload
        if not isinstance(search_payload, dict):
            context = msg.get("context", {})
            for v in context.values():
                if isinstance(v, dict):
                    search_payload = v
                    break

        # Build record data
        record_data = {}
        for col_key, prop_path in self.field_mappings.items():
            if prop_path == "__snapshot__":
                record_data[col_key] = snapshot_path.replace("/api/files/snapshots/", "/api/snapshots/") if snapshot_path else None
            elif prop_path == "__timestamp__":
                record_data[col_key] = msg.get("timestamp")
            elif prop_path == "__raw_payload__":
                record_data[col_key] = str(current_payload)
            elif prop_path in ["score", "label"]:
                # Special handling for AI detections
                val = None
                if isinstance(search_payload, dict) and "detections" in search_payload and len(search_payload["detections"]) > 0:
                    det = search_payload["detections"][0]
                    if prop_path == "score":
                        val = det.get("confidence")
                    elif prop_path == "label":
                        val = det.get("label")
                record_data[col_key] = val
            elif prop_path == "total":
                if isinstance(search_payload, dict):
                    record_data[col_key] = search_payload.get("total")
                else:
                    record_data[col_key] = None
            else:
                # Extract from payload
                keys = prop_path.split('.')
                target = search_payload
                for k in keys:
                    if isinstance(target, dict) and k in target:
                        target = target[k]
                    else:
                        target = None
                        break
                record_data[col_key] = target
        
        # Save to DB
        try:
            import json
            import sys
            from pathlib import Path
            backend_dir = Path("/home/pi/pido-ai/backend")
            if str(backend_dir) not in sys.path:
                sys.path.insert(0, str(backend_dir))
            from db.database import db
            from db.models import CollectionRecord
            from sqlmodel import Session
            
            new_record = CollectionRecord(
                collection_id=self.collection_id,
                project_id=self.router.project_id,
                data_json=json.dumps(record_data)
            )
            with Session(db.engine_telemetry) as session:
                session.add(new_record)
                session.commit()
        except Exception as e:
            import logging
            logging.getLogger("ai_engine").error(f"CollectionWriterNode error: {e}")
            
        return msg

class MessageRouter:
    def __init__(self, metadata_callback=None, project_id="default"):
        self.nodes = {}
        self.metadata_callback = metadata_callback
        self.project_id = project_id       
        self.edges = {}       
        self.msg_queue = queue.Queue(maxsize=1000)
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
                    # Preserve LogicNode state
                    if hasattr(old_node, 'last_final_val') and hasattr(new_node, 'last_final_val'):
                        new_node.last_final_val = old_node.last_final_val
                        new_node.last_emit_time = getattr(old_node, 'last_emit_time', 0.0)
                        new_node.last_ws_val = getattr(old_node, 'last_ws_val', None)
                        new_node.first_true = getattr(old_node, 'first_true', None)

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
            logger.warning(f"MessageRouter queue full! Dropping message from {source_id}")

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._route_loop, daemon=True)
            self.thread.start()

    def stop(self):
        self.running = False
        
        # Cleanup nodes (e.g. stop zero-latency threads)
        if hasattr(self, 'nodes'):
            for node in self.nodes.values():
                if hasattr(node, 'cleanup'):
                    try:
                        node.cleanup()
                    except Exception as e:
                        logger.error(f"Error cleaning up node {node.node_id}: {e}")
                        
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
                
                # Handle system commands
                if msg.get("action") == "reset_trackers" and msg.get("type") == "system":
                    with self._lock:
                        for node in self.nodes.values():
                            if hasattr(node, 'tracker') and hasattr(node.tracker, 'objects'):
                                node.tracker.objects.clear()
                                node.tracker.next_track_id = 1
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
