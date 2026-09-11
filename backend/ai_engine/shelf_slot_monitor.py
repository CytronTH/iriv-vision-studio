import logging
import time
from typing import Dict, Any, List, Optional
from ai_engine.message_router import PipelineNode

logger = logging.getLogger(__name__)

class ShelfSlotMonitorNode(PipelineNode):
    """
    ShelfSlotMonitorNode monitors retail shelf slots/compartments for out-of-stock (empty) conditions.
    
    Key Features:
      - Multi-slot definitions (each with ROI, name, targetClasses, minCount)
      - Person presence detection to suppress/pause false alerts when someone is browsing or restocking
      - Debounce time per slot to confirm sustained emptiness
      - Multi-handle output: outputs boolean signals per slot (and global any_empty)
    """
    def __init__(self, node_id: str, data: dict, router: Any):
        super().__init__(node_id, data, router, node_type="shelfSlotMonitorNode")
        self.label = data.get("label", "Shelf Slot Monitor")
        
        # Slots configuration: list of dicts:
        # [{"id": "slot_0", "name": "Slot 1 (Eco)", "roi": {"x": 0.1, "y": 0.2, "w": 0.25, "h": 0.6}, "targetClasses": [], "minCount": 1}]
        self.slots = data.get("slots", [])
        if not self.slots:
            # Default to 3 horizontal slots across the shelf frame if none configured
            self.slots = [
                {"id": "slot_0", "name": "Slot 1 (Left)", "roi": {"x": 0.05, "y": 0.15, "w": 0.28, "h": 0.70}, "targetClasses": [], "minCount": 1},
                {"id": "slot_1", "name": "Slot 2 (Center)", "roi": {"x": 0.36, "y": 0.15, "w": 0.28, "h": 0.70}, "targetClasses": [], "minCount": 1},
                {"id": "slot_2", "name": "Slot 3 (Right)", "roi": {"x": 0.67, "y": 0.15, "w": 0.28, "h": 0.70}, "targetClasses": [], "minCount": 1},
            ]

        self.person_suppression = data.get("personSuppression", True)
        self.person_class = data.get("personClass", "person").strip()
        self.debounce_sec = float(data.get("debounceMs", 3000)) / 1000.0
        self.person_cooldown_sec = float(data.get("personCooldownMs", 2000)) / 1000.0

        # State tracking
        self.last_person_seen_time: float = 0.0
        self.first_empty_times: Dict[str, Optional[float]] = {}
        self.slot_states: Dict[str, bool] = {}                  # slot_id -> is_empty boolean (True = EMPTY)
        self.slot_counts: Dict[str, int] = {}                   # slot_id -> count of products
        self._last_broadcast_time: float = 0.0

        for slot in self.slots:
            sid = slot.get("id")
            if sid:
                self.first_empty_times[sid] = None
                self.slot_states[sid] = False
                self.slot_counts[sid] = 0

    def process(self, msg: dict) -> dict:
        now = time.time()
        payload = msg.get("payload", {})
        if isinstance(payload, dict) and "detections" in payload:
            detections = payload.get("detections", [])
        elif isinstance(payload, list):
            detections = payload
        else:
            detections = []

        # 1. Check for person in frame (if person suppression enabled)
        has_person = False
        if self.person_suppression:
            target_p = self.person_class.lower()
            for d in detections:
                lbl = str(d.get("label", "")).lower()
                if lbl == target_p:
                    has_person = True
                    break

        if has_person:
            self.last_person_seen_time = now

        # Cooldown check: person was seen recently within person_cooldown_sec
        in_cooldown = (now - self.last_person_seen_time) < self.person_cooldown_sec
        is_paused = has_person or in_cooldown

        slot_summary = {}

        if is_paused:
            # Inspection is PAUSED / FROZEN while person is present or in cooldown
            # Reset the first_empty_times so transient occluded frames don't count towards debounce
            for slot in self.slots:
                sid = slot.get("id")
                if sid:
                    self.first_empty_times[sid] = None
                    slot_summary[sid] = {
                        "id": sid,
                        "name": slot.get("name", sid),
                        "count": self.slot_counts.get(sid, 0),
                        "is_empty": self.slot_states.get(sid, False),
                        "status": "PAUSED"
                    }
        else:
            # Inspection is ACTIVE
            # Filter detections for products (exclude person class)
            prod_detections = []
            target_p = self.person_class.lower()
            for d in detections:
                if str(d.get("label", "")).lower() != target_p:
                    prod_detections.append(d)

            for slot in self.slots:
                sid = slot.get("id")
                if not sid:
                    continue
                roi = slot.get("roi", {"x": 0, "y": 0, "w": 1, "h": 1})
                target_classes = slot.get("targetClasses", [])
                min_count = int(slot.get("minCount", 1))

                # Count detections in this slot's ROI
                count = 0
                rx = roi.get("x", 0.0)
                ry = roi.get("y", 0.0)
                rw = roi.get("w", 1.0)
                rh = roi.get("h", 1.0)

                for d in prod_detections:
                    lbl = d.get("label", "")
                    if target_classes and len(target_classes) > 0 and lbl not in target_classes:
                        continue

                    # Bounding box normalized coordinates
                    xmin = d.get("xmin", 0.0)
                    ymin = d.get("ymin", 0.0)
                    xmax = d.get("xmax", 0.0)
                    ymax = d.get("ymax", 0.0)
                    cx = (xmin + xmax) / 2.0
                    cy = (ymin + ymax) / 2.0

                    # 1. Point-in-ROI test (Centroid check)
                    in_roi = (rx <= cx <= rx + rw) and (ry <= cy <= ry + rh)
                    if in_roi:
                        count += 1
                    else:
                        # 2. Fallback: check 30% area overlap
                        inter_w = max(0.0, min(xmax, rx + rw) - max(xmin, rx))
                        inter_h = max(0.0, min(ymax, ry + rh) - max(ymin, ry))
                        inter_area = inter_w * inter_h
                        obj_area = max(1e-6, (xmax - xmin) * (ymax - ymin))
                        if (inter_area / obj_area) >= 0.30:
                            count += 1

                self.slot_counts[sid] = count

                # Empty condition: count < min_count
                is_below_min = (count < min_count)

                if is_below_min:
                    if self.first_empty_times.get(sid) is None:
                        self.first_empty_times[sid] = now

                    elapsed = now - self.first_empty_times[sid]
                    if elapsed >= self.debounce_sec:
                        self.slot_states[sid] = True  # Confirmed EMPTY
                    else:
                        # Still debouncing, retain previous state (defaults to False initially)
                        pass
                else:
                    # Item detected (count >= min_count) -> Immediately OCCUPIED
                    self.first_empty_times[sid] = None
                    self.slot_states[sid] = False

                is_empty = self.slot_states.get(sid, False)
                slot_summary[sid] = {
                    "id": sid,
                    "name": slot.get("name", sid),
                    "count": count,
                    "is_empty": is_empty,
                    "status": "EMPTY" if is_empty else "OCCUPIED"
                }

        any_empty = any(s["is_empty"] for s in slot_summary.values())

        # Build handle-specific payloads for edge routing
        handle_payloads = {
            "any_empty": any_empty
        }
        for sid, s in slot_summary.items():
            handle_payloads[sid] = s["is_empty"]

        # Default payload is any_empty boolean (True if any slot empty, False otherwise)
        msg["payload"] = any_empty
        msg["_handle_payloads"] = handle_payloads
        msg["shelf_slot_data"] = {
            "has_person": has_person,
            "is_paused": is_paused,
            "any_empty": any_empty,
            "slots": slot_summary
        }

        # Broadcast telemetry/UI update to frontend WebSocket at max 10Hz
        if (now - self._last_broadcast_time >= 0.1) and self.router.metadata_callback:
            self._last_broadcast_time = now
            cam_id = msg.get("camera_id") or msg.get("metadata", {}).get("camera_id")
            self.router.metadata_callback({
                "type": "shelf_slot_monitor_update",
                "node_id": self.node_id,
                "camera_id": cam_id,
                "has_person": has_person,
                "is_paused": is_paused,
                "any_empty": any_empty,
                "slots": slot_summary
            })

        return msg
