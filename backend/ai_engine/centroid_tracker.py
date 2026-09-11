import math
import time
from typing import Dict, List, Tuple, Optional, Any

class TrackedObject:
    def __init__(self, track_id: int, centroid: Tuple[float, float], bbox: List[float], label: str, confidence: float):
        self.track_id = track_id
        self.centroid = centroid
        self.prev_centroid = centroid
        self.bbox = bbox
        self.label = label
        self.confidence = confidence
        self.disappeared = 0
        self.counted = False
        self.first_seen = time.time()
        self.last_seen = time.time()

    def update(self, centroid: Tuple[float, float], bbox: List[float], confidence: float):
        self.prev_centroid = self.centroid
        self.centroid = centroid
        self.bbox = bbox
        self.confidence = confidence
        self.disappeared = 0
        self.last_seen = time.time()

def line_intersects(p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float], p4: Tuple[float, float]) -> bool:
    """Check if line segment p1-p2 intersects line segment p3-p4."""
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
    return (ccw(p1, p3, p4) != ccw(p2, p3, p4)) and (ccw(p1, p2, p3) != ccw(p1, p2, p4))

def point_in_roi(pt: Tuple[float, float], roi: Dict[str, float]) -> bool:
    """Check if point (x, y) is inside normalized bounding box roi {x, y, w, h}."""
    x, y = pt
    rx = roi.get("x", 0.0)
    ry = roi.get("y", 0.0)
    rw = roi.get("w", 1.0)
    rh = roi.get("h", 1.0)
    return (rx <= x <= rx + rw) and (ry <= y <= ry + rh)

class CentroidTracker:
    def __init__(self, max_disappeared: int = 15, max_distance: float = 0.15):
        """
        CentroidTracker uses normalized coordinates [0.0, 1.0].
        :param max_disappeared: Number of consecutive frames an object can be missing before being deregistered.
        :param max_distance: Maximum normalized Euclidean distance to associate a detection with an existing track.
        """
        self.next_track_id = 1
        self.objects: Dict[int, TrackedObject] = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def update(self, detections: List[Dict[str, Any]]) -> List[TrackedObject]:
        """
        Takes raw detections: [{"label": str, "confidence": float, "bbox": [xmin, ymin, xmax, ymax]}]
        Returns active tracked objects.
        """
        # If no detections in current frame, increment disappeared count
        if len(detections) == 0:
            for track_id in list(self.objects.keys()):
                self.objects[track_id].disappeared += 1
                if self.objects[track_id].disappeared > self.max_disappeared:
                    del self.objects[track_id]
            return list(self.objects.values())

        # Compute centroids for current detections
        input_centroids = []
        for det in detections:
            bbox = det.get("bbox", [0, 0, 0, 0])
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = (bbox[1] + bbox[3]) / 2.0
            input_centroids.append((cx, cy))

        # If we have no existing tracked objects, register all detections
        if len(self.objects) == 0:
            for i, det in enumerate(detections):
                self._register(input_centroids[i], det.get("bbox", [0, 0, 0, 0]), det.get("label", "unknown"), det.get("confidence", 0.0))
            return list(self.objects.values())

        # Otherwise, match existing objects to input detections
        object_ids = list(self.objects.keys())
        object_centroids = [self.objects[tid].centroid for tid in object_ids]

        # Compute distance matrix
        distances = []
        for o_idx, o_cent in enumerate(object_centroids):
            for d_idx, d_cent in enumerate(input_centroids):
                dist = math.hypot(o_cent[0] - d_cent[0], o_cent[1] - d_cent[1])
                distances.append((dist, o_idx, d_idx))

        # Sort by shortest distance
        distances.sort(key=lambda x: x[0])

        used_objects = set()
        used_detections = set()

        for dist, o_idx, d_idx in distances:
            if o_idx in used_objects or d_idx in used_detections:
                continue

            # If distance exceeds threshold, do not associate
            if dist > self.max_distance:
                continue

            track_id = object_ids[o_idx]
            det = detections[d_idx]
            self.objects[track_id].update(
                centroid=input_centroids[d_idx],
                bbox=det.get("bbox", [0, 0, 0, 0]),
                confidence=det.get("confidence", 0.0)
            )
            # Update label if confidence is higher
            if det.get("confidence", 0.0) > self.objects[track_id].confidence:
                self.objects[track_id].label = det.get("label", self.objects[track_id].label)

            used_objects.add(o_idx)
            used_detections.add(d_idx)

        # Unmatched existing objects
        for o_idx, track_id in enumerate(object_ids):
            if o_idx not in used_objects:
                self.objects[track_id].disappeared += 1
                if self.objects[track_id].disappeared > self.max_disappeared:
                    del self.objects[track_id]

        # Unmatched new detections -> register new objects
        for d_idx, det in enumerate(detections):
            if d_idx not in used_detections:
                self._register(input_centroids[d_idx], det.get("bbox", [0, 0, 0, 0]), det.get("label", "unknown"), det.get("confidence", 0.0))

        return list(self.objects.values())

    def _register(self, centroid: Tuple[float, float], bbox: List[float], label: str, confidence: float):
        obj = TrackedObject(self.next_track_id, centroid, bbox, label, confidence)
        self.objects[self.next_track_id] = obj
        self.next_track_id += 1
        # Avoid integer overflow on prolonged running
        if self.next_track_id > 1000000000:
            self.next_track_id = 1
