import logging
import math
import time
from typing import Dict, Any, List, Optional
from ai_engine.message_router import PipelineNode

logger = logging.getLogger(__name__)


def point_in_polygon(x: float, y: float, polygon: List[Any]) -> bool:
    """
    Ray-casting algorithm to determine if a 2D point (x, y) is inside an arbitrary polygon.
    polygon is a list of dicts: [{'x': 0.1, 'y': 0.2}, ...] or points [[0.1, 0.2], ...]
    Coordinates are normalized (0.0 to 1.0).
    """
    n = len(polygon)
    if n < 3:
        return False

    def _pt(idx: int) -> tuple[float, float]:
        p = polygon[idx % n]
        if isinstance(p, dict):
            return float(p.get("x", 0.0)), float(p.get("y", 0.0))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            return float(p[0]), float(p[1])
        return 0.0, 0.0

    inside = False
    p1x, p1y = _pt(0)
    for i in range(1, n + 1):
        p2x, p2y = _pt(i)
        if min(p1y, p2y) < y <= max(p1y, p2y):
            if x <= max(p1x, p2x):
                if p1y != p2y:
                    xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                else:
                    xinters = p1x
                if p1x == p2x or x <= xinters:
                    inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def compute_iou(boxA: List[float], boxB: List[float]) -> float:
    """
    Computes Intersection-over-Union (IoU) between two bounding boxes:
    box = [xmin, ymin, xmax, ymax]
    """
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interWidth = max(0.0, xB - xA)
    interHeight = max(0.0, yB - yA)
    interArea = interWidth * interHeight

    boxAArea = max(1e-6, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(1e-6, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    iou = interArea / float(boxAArea + boxBArea - interArea)
    return iou


def deduplicate_detections(items: List[dict], iou_thresh: float = 0.40, min_dist: float = 0.08) -> List[dict]:
    """
    Non-Maximum Suppression (NMS) & Spatial Deduplication:
    Removes duplicate overlapping bounding boxes or detections belonging to the same physical vehicle/person.
    Keeps the detection with the highest confidence score.
    """
    if len(items) <= 1:
        return items

    sorted_items = sorted(items, key=lambda x: x.get("confidence", 0.0), reverse=True)
    kept: List[dict] = []

    for item in sorted_items:
        box = item["bbox"]
        ax, ay = item["anchor"]
        is_dup = False
        for k in kept:
            k_box = k["bbox"]
            k_ax, k_ay = k["anchor"]
            # 1. IoU Overlap Check
            if compute_iou(box, k_box) >= iou_thresh:
                is_dup = True
                break
            # 2. Footprint Proximity Check (two machines cannot occupy the same ground contact point)
            dist = math.sqrt((ax - k_ax) ** 2 + (ay - k_ay) ** 2)
            if dist < min_dist:
                is_dup = True
                break
        if not is_dup:
            kept.append(item)

    return kept


class ForkliftZoneNode(PipelineNode):
    """
    ForkliftZoneNode monitors warehouse intersections and blind spots for forklifts
    and pedestrian hazard conditions.

    Key Features:
      - Custom Arbitrary Polygon Danger Zones (Convex / Concave)
      - Ground-Contact Footprint Anchor (bottom-center) ideal for 45-degree angled cameras
      - Co-Presence & Critical Collision Detection (Forklift + Pedestrian, Forklift + Forklift)
      - Multi-tiered zoning: Caution / Danger / Pedestrian walkway
      - Near-miss distance monitoring and incident counting
      - Dedicated output handles for Relay, Tower Lights, and Siren automation
    """
    def __init__(self, node_id: str, data: dict, router: Any):
        super().__init__(node_id, data, router, node_type="forkliftZoneNode")
        self.label = data.get("label", "Forklift Safety Monitor")

        # Configured zones: list of polygon zones
        # Default to a trapezoidal intersection zone simulating a 45-degree angled view
        default_zones = [
            {
                "id": "zone_danger",
                "name": "Intersection Danger Zone",
                "type": "danger",
                "color": "#f43f5e",
                "polygon": [
                    {"x": 0.25, "y": 0.50},
                    {"x": 0.75, "y": 0.50},
                    {"x": 0.90, "y": 0.90},
                    {"x": 0.10, "y": 0.90},
                ],
            },
            {
                "id": "zone_approach",
                "name": "Approach Warning Zone",
                "type": "caution",
                "color": "#f59e0b",
                "polygon": [
                    {"x": 0.35, "y": 0.25},
                    {"x": 0.65, "y": 0.25},
                    {"x": 0.75, "y": 0.50},
                    {"x": 0.25, "y": 0.50},
                ],
            },
        ]
        self.zones = data.get("zones", default_zones)
        if not self.zones:
            self.zones = default_zones

        # Class configuration with aliases (e.g. folklift / forklift)
        forklift_cfg = data.get("forkliftClasses", ["forklift"])
        if isinstance(forklift_cfg, str):
            self.forklift_classes = [c.strip().lower() for c in forklift_cfg.split(",") if c.strip()]
        else:
            self.forklift_classes = [str(c).strip().lower() for c in forklift_cfg]
        if not self.forklift_classes:
            self.forklift_classes = ["forklift"]

        expanded_forklift = set(self.forklift_classes)
        for c in list(expanded_forklift):
            if c in ("forklift", "folklift"):
                expanded_forklift.update(["forklift", "folklift", "fork_lift", "fork-lift"])
        self.forklift_classes = list(expanded_forklift)

        person_cfg = data.get("personClasses", ["person"])
        if isinstance(person_cfg, str):
            self.person_classes = [c.strip().lower() for c in person_cfg.split(",") if c.strip()]
        else:
            self.person_classes = [str(c).strip().lower() for c in person_cfg]
        if not self.person_classes:
            self.person_classes = ["person"]

        expanded_person = set(self.person_classes)
        for c in list(expanded_person):
            if c in ("person", "people", "human", "pedestrian"):
                expanded_person.update(["person", "people", "human", "pedestrian"])
        self.person_classes = list(expanded_person)

        # Anchor Mode: 'bottom_center' (ground-contact) vs 'centroid'
        self.anchor_mode = data.get("anchorMode", "bottom_center")
        self.debounce_sec = float(data.get("debounceMs", 400)) / 1000.0
        self.co_presence_radius = float(data.get("coPresenceRadius", 0.18))
        self.critical_on_co_presence = data.get("criticalOnCoPresence", True)
        self.critical_on_multi_forklift = data.get("criticalOnMultiForklift", True)

        # Per-class confidence thresholds (filter weak phantom detections)
        self.forklift_conf = float(data.get("forkliftConfidence", data.get("forkliftMinConfidence", 0.30)))
        self.person_conf = float(data.get("personConfidence", data.get("personMinConfidence", 0.30)))

        # Per-class IoU deduplication thresholds (NMS)
        self.forklift_iou = float(data.get("forkliftIou", data.get("forkliftIouThreshold", 0.40)))
        self.person_iou = float(data.get("personIou", data.get("personIouThreshold", 0.45)))

        # Footprint distance deduplication (for ground contact / same physical machine)
        self.min_footprint_dist = float(data.get("minFootprintDist", 0.08))

        # State tracking
        self.first_occupied_times: Dict[str, Optional[float]] = {}
        self.zone_states: Dict[str, bool] = {}             # zone_id -> bool
        self.zone_counts: Dict[str, Dict[str, int]] = {}   # zone_id -> {"forklifts": int, "persons": int}
        self.near_miss_count: int = 0
        self._last_near_miss_time: float = 0.0
        self._last_broadcast_time: float = 0.0

        # Multi-model / Dual-AI fusion support (e.g. Model 1 for forklift + Model 2 for person)
        self.sources_detections: Dict[str, dict] = {}
        self.detection_ttl_sec = float(data.get("detectionTtlMs", 800)) / 1000.0

        for zone in self.zones:
            zid = zone.get("id")
            if zid:
                self.first_occupied_times[zid] = None
                self.zone_states[zid] = False
                self.zone_counts[zid] = {"forklifts": 0, "persons": 0}

    def _extract_bbox(self, d: dict) -> tuple[float, float, float, float]:
        """
        Extracts (xmin, ymin, xmax, ymax) normalized to [0.0, 1.0] from various detection formats:
        - {"bbox": [xmin, ymin, xmax, ymax]} (Standard Hailo / Tracker format)
        - {"box": [xmin, ymin, xmax, ymax]}
        - {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax}
        - {"x": x, "y": y, "w": w, "h": h}
        """
        if "bbox" in d and isinstance(d["bbox"], (list, tuple)) and len(d["bbox"]) >= 4:
            return float(d["bbox"][0]), float(d["bbox"][1]), float(d["bbox"][2]), float(d["bbox"][3])
        if "box" in d and isinstance(d["box"], (list, tuple)) and len(d["box"]) >= 4:
            return float(d["box"][0]), float(d["box"][1]), float(d["box"][2]), float(d["box"][3])
        if "xmin" in d and "ymin" in d and "xmax" in d and "ymax" in d:
            return float(d["xmin"]), float(d["ymin"]), float(d["xmax"]), float(d["ymax"])
        if "x" in d and "y" in d and ("w" in d or "width" in d) and ("h" in d or "height" in d):
            x = float(d["x"])
            y = float(d["y"])
            w = float(d.get("w", d.get("width", 0.0)))
            h = float(d.get("h", d.get("height", 0.0)))
            return x, y, x + w, y + h
        return 0.0, 0.0, 0.0, 0.0

    def _get_anchor_point(self, d: dict) -> tuple[float, float]:
        """Calculates normalized (x, y) anchor point for a detection."""
        xmin, ymin, xmax, ymax = self._extract_bbox(d)
        cx = (xmin + xmax) / 2.0
        if self.anchor_mode == "bottom_center":
            # Footprint contact point on the floor (crucial for 45-degree angled view)
            cy = ymax
        elif self.anchor_mode == "top_center":
            cy = ymin
        else:
            cy = (ymin + ymax) / 2.0
        return cx, cy

    def _is_in_zone(self, anchor: tuple[float, float], bbox: List[float], poly: List[Any]) -> bool:
        """Determines if a detection's footprint or anchor is inside the polygon zone."""
        cx, cy = anchor
        if point_in_polygon(cx, cy, poly):
            return True
        if len(bbox) >= 4:
            xmin, ymin, xmax, ymax = bbox[0], bbox[1], bbox[2], bbox[3]
            if self.anchor_mode == "bottom_center":
                # Check bottom-left and bottom-right floor contact points
                if point_in_polygon(xmin, ymax, poly) or point_in_polygon(xmax, ymax, poly):
                    return True
            elif self.anchor_mode == "centroid":
                mid_x = (xmin + xmax) / 2.0
                mid_y = (ymin + ymax) / 2.0
                if point_in_polygon(mid_x, mid_y, poly):
                    return True
        return False

    def process(self, msg: dict) -> dict:
        now = time.time()
        payload = msg.get("payload", {})
        if isinstance(payload, dict):
            if "detections" in payload:
                detections = payload.get("detections", [])
            elif "data" in payload:
                detections = payload.get("data", [])
            elif "items" in payload:
                detections = payload.get("items", [])
            else:
                detections = []
        elif isinstance(payload, list):
            detections = payload
        else:
            detections = []

        # 1. Parse Detections into Forklifts and Persons for this incoming message
        incoming_forklifts = []
        incoming_persons = []

        for d in detections:
            lbl = str(d.get("label", "")).strip().lower()
            cx, cy = self._get_anchor_point(d)
            xmin, ymin, xmax, ymax = self._extract_bbox(d)
            conf = float(d.get("confidence", 1.0))
            item = {
                "label": lbl,
                "confidence": conf,
                "anchor": (cx, cy),
                "bbox": [xmin, ymin, xmax, ymax],
            }
            if lbl in self.forklift_classes:
                if conf >= self.forklift_conf:
                    incoming_forklifts.append(item)
            elif lbl in self.person_classes:
                if conf >= self.person_conf:
                    incoming_persons.append(item)

        # Apply IoU NMS and footprint deduplication on incoming detections
        incoming_forklifts = deduplicate_detections(
            incoming_forklifts, iou_thresh=self.forklift_iou, min_dist=self.min_footprint_dist
        )
        incoming_persons = deduplicate_detections(
            incoming_persons, iou_thresh=self.person_iou, min_dist=self.min_footprint_dist
        )

        # Multi-model / Dual-AI fusion:
        # Cache detections per source node to combine detections from multiple models
        # (e.g., AINode 1 detects forklifts, AINode 2 detects persons)
        src_id = str(msg.get("_source_node_id") or msg.get("camera_id") or msg.get("metadata", {}).get("camera_id") or "default")
        self.sources_detections[src_id] = {
            "time": now,
            "forklifts": incoming_forklifts,
            "persons": incoming_persons,
        }

        # Combine active detections from all sources updated within TTL
        forklifts = []
        persons = []
        stale_sources = []
        for s_id, s_data in self.sources_detections.items():
            if (now - s_data["time"]) <= self.detection_ttl_sec:
                forklifts.extend(s_data["forklifts"])
                persons.extend(s_data["persons"])
            else:
                stale_sources.append(s_id)

        for s_id in stale_sources:
            del self.sources_detections[s_id]

        # Multi-model deduplication: if multiple models detected the same forklift/person
        forklifts = deduplicate_detections(
            forklifts, iou_thresh=self.forklift_iou, min_dist=self.min_footprint_dist
        )
        persons = deduplicate_detections(
            persons, iou_thresh=self.person_iou, min_dist=self.min_footprint_dist
        )

        # 2. Check Each Zone
        zone_summary = {}
        any_danger_occupied = False
        any_caution_occupied = False
        co_presence_hazard = False
        multi_forklift_hazard = False

        for zone in self.zones:
            zid = zone.get("id")
            if not zid:
                continue
            z_type = zone.get("type", "danger")
            poly = zone.get("polygon", [])

            # Count entities in this zone
            fk_count = 0
            p_count = 0

            for fk in forklifts:
                if self._is_in_zone(fk["anchor"], fk["bbox"], poly):
                    fk_count += 1

            for p in persons:
                if self._is_in_zone(p["anchor"], p["bbox"], poly):
                    p_count += 1

            self.zone_counts[zid] = {"forklifts": fk_count, "persons": p_count}

            # Check occupancy debounce for forklifts
            is_occupied = (fk_count > 0)
            if is_occupied:
                if self.first_occupied_times.get(zid) is None:
                    self.first_occupied_times[zid] = now
                elapsed = now - self.first_occupied_times[zid]
                if elapsed >= self.debounce_sec:
                    self.zone_states[zid] = True
            else:
                self.first_occupied_times[zid] = None
                self.zone_states[zid] = False

            confirmed_occupied = self.zone_states.get(zid, False)

            if confirmed_occupied:
                if z_type == "danger":
                    any_danger_occupied = True
                elif z_type == "caution":
                    any_caution_occupied = True

                # Check Co-Presence inside this zone
                if self.critical_on_co_presence and fk_count > 0 and p_count > 0:
                    co_presence_hazard = True

                # Check Multiple Forklifts inside danger zone
                if self.critical_on_multi_forklift and z_type == "danger" and fk_count >= 2:
                    multi_forklift_hazard = True

            zone_summary[zid] = {
                "id": zid,
                "name": zone.get("name", zid),
                "type": z_type,
                "color": zone.get("color", "#f43f5e"),
                "polygon": poly,
                "forklift_count": fk_count,
                "person_count": p_count,
                "occupied": confirmed_occupied,
                "status": "ALERT" if confirmed_occupied else "CLEAR",
            }

        # 3. Near-Miss Proximity Detection (Distance between any Forklift and Person)
        near_miss_current = False
        min_distance = 999.0
        for fk in forklifts:
            fx, fy = fk["anchor"]
            for p in persons:
                px, py = p["anchor"]
                dist = math.sqrt((fx - px) ** 2 + (fy - py) ** 2)
                if dist < min_distance:
                    min_distance = dist
                if dist <= self.co_presence_radius:
                    near_miss_current = True
                    break

        if near_miss_current and (now - self._last_near_miss_time > 5.0):
            # Record near miss with 5-second cooldown
            self.near_miss_count += 1
            self._last_near_miss_time = now
            logger.warning(
                f"[ForkliftZoneNode {self.node_id}] NEAR-MISS DETECTED! Distance={min_distance:.3f} <= {self.co_presence_radius}"
            )

        # 4. Determine Global Hazard Level
        # Level 0: SAFE
        # Level 1: CAUTION (Forklift in Caution/Approach Zone or Single Forklift in Danger Zone)
        # Level 2: CRITICAL (Forklift + Person in Zone, Multi-Forklift conflict, or Near-Miss)
        is_critical = co_presence_hazard or multi_forklift_hazard or near_miss_current
        is_danger = any_danger_occupied or any_caution_occupied or is_critical

        if is_critical:
            hazard_level = 2  # CRITICAL
            hazard_text = "CRITICAL COLLISION RISK"
        elif is_danger:
            hazard_level = 1  # CAUTION
            hazard_text = "CAUTION: FORKLIFT PRESENT"
        else:
            hazard_level = 0  # SAFE
            hazard_text = "ALL CLEAR"

        # 5. Build Handle Payloads
        debug_payload = {
            "hazard_level": hazard_level,
            "hazard_text": hazard_text,
            "is_critical": is_critical,
            "is_danger": is_danger,
            "forklift_count": len(forklifts),
            "person_count": len(persons),
            "near_miss_count": self.near_miss_count,
            "zones": zone_summary,
        }

        handle_payloads = {
            "is_critical": is_critical,
            "is_danger": is_danger,
            "hazard_level": hazard_level,
            "forklift_count": len(forklifts),
            "person_count": len(persons),
            "debug": debug_payload,
            "telemetry": debug_payload,
        }
        for zid, z in zone_summary.items():
            handle_payloads[zid] = z["occupied"]

        # Default payload outputs boolean is_danger (or is_critical)
        msg["payload"] = is_critical if is_critical else is_danger
        msg["_handle_payloads"] = handle_payloads
        msg["forklift_zone_data"] = debug_payload
        msg["debug"] = debug_payload

        # 6. Broadcast Telemetry to Frontend at max 10Hz
        if (now - self._last_broadcast_time >= 0.1) and self.router.metadata_callback:
            self._last_broadcast_time = now
            cam_id = msg.get("camera_id") or msg.get("metadata", {}).get("camera_id")
            self.router.metadata_callback({
                "type": "forklift_zone_update",
                "node_id": self.node_id,
                "camera_id": cam_id,
                "hazard_level": hazard_level,
                "hazard_text": hazard_text,
                "is_critical": is_critical,
                "is_danger": is_danger,
                "forklift_count": len(forklifts),
                "person_count": len(persons),
                "near_miss_count": self.near_miss_count,
                "zones": zone_summary,
            })

        return msg
