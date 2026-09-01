import logging
import json
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

from ai_engine.message_router import MessageRouter, LogicNode, RateLimitNode, FunctionNode, ActionNode, HardwareOutputNode, DashboardOutputNode, CounterNode, SnapshotNode

class CameraStreamConfig:
    def __init__(self, stream_id: str):
        self.stream_id = stream_id
        self.video_source_type = "local"
        self.video_source = "/dev/video0"
        self.has_ai_node = False
        self.ai_task = "detection"
        self.hef_path = ""
        self.so_path = ""
        self.roi = {"x": 0, "y": 0, "w": 1, "h": 1}
        self.backend_resolution = "auto"
        self.dashboard_video_nodes = []
        self.input_node_id = None
        self.ai_node_id = None
        self.loop = True
        self.speed = 1.0
        
        self.bbox_draw_mode = "frontend"
        self.bbox_line_thickness = 2
        self.bbox_font_thickness = 1
        
        self.classes = []
        self.class_filter = None
        self.confidence_threshold = 0.5
        self.class_confidences = {}

class ParsedPipelineConfig:
    def __init__(self):
        self.camera_streams: List[CameraStreamConfig] = []
        self.digital_inputs = []
        self.digital_outputs = []
        self.dashboard_nodes = []
        self.has_ai_node = False
        self.router = None
        
    def __repr__(self):
        return f"<ParsedPipelineConfig streams={len(self.camera_streams)}>"

class PipelineParser:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.entities_path = base_dir / "db" / "entities.json"
        
    def _load_entities(self):
        try:
            from sqlmodel import Session, select
            from db.database import db
            from db.models import Camera, AIModel, Integration
            with Session(db.engine) as session:
                cameras = [c.model_dump() for c in session.exec(select(Camera)).all()]
                models = []
                for m in session.exec(select(AIModel)).all():
                    md = m.model_dump()
                    try: md["tags"] = json.loads(md["tags_json"])
                    except: md["tags"] = []
                    try: md["classes"] = json.loads(md["classes_json"])
                    except: md["classes"] = []
                    del md["tags_json"]
                    del md["classes_json"]
                    models.append(md)
                integrations = [i.model_dump() for i in session.exec(select(Integration)).all()]
                return {"cameras": cameras, "models": models, "integrations": integrations}
        except Exception as e:
            logger.error(f"Failed to load entities from DB: {e}")
            return {"cameras": [], "models": [], "integrations": []}
            
    def parse(self, payload: Dict[str, Any], project_id: str = "default") -> ParsedPipelineConfig:
        config = ParsedPipelineConfig()
        raw_nodes = payload.get("nodes", [])
        raw_edges = payload.get("edges", [])
        
        # Filter out disabled nodes
        nodes = [n for n in raw_nodes if not n.get("data", {}).get("disabled", False)]
        active_node_ids = {n["id"] for n in nodes}
        
        # Filter out edges connected to disabled nodes
        edges = [e for e in raw_edges if e.get("source") in active_node_ids and e.get("target") in active_node_ids]
        
        entities = self._load_entities()
        
        # Build MessageRouter graph
        router = MessageRouter(project_id=project_id)
        config.router = router
        
        # 1. Create Router Nodes for Data Flow
        for n in nodes:
            nid = n["id"]
            ntype = n.get("type")
            ndata = n.get("data", {})
            
            if ntype == "logicNode":
                router.add_node(nid, LogicNode(nid, ndata, router))
            elif ntype == "counterNode":
                router.add_node(nid, CounterNode(nid, ndata, router))
            elif ntype == "rateLimitNode":
                router.add_node(nid, RateLimitNode(nid, ndata, router))
            elif ntype == "functionNode":
                router.add_node(nid, FunctionNode(nid, ndata, router))
            elif ntype == "actionNode":
                action_entity_id = ndata.get("entityId")
                integration = next((i for i in entities.get("integrations", []) if i.get("id") == action_entity_id), None)
                merged_data = {**ndata, "name": integration.get("name") if integration else "Action"}
                router.add_node(nid, ActionNode(nid, merged_data, router))
            elif ntype == "digitalOutputNode":
                router.add_node(nid, HardwareOutputNode(nid, ndata, router, hw_type="digital_output"))
                config.digital_outputs.append({"pin": ndata.get("pin", "DO0")}) # Keep for GPIO init
            elif ntype == "ledNode":
                router.add_node(nid, HardwareOutputNode(nid, ndata, router, hw_type="led"))
            elif ntype == "buzzerNode":
                router.add_node(nid, HardwareOutputNode(nid, ndata, router, hw_type="buzzer"))
            elif ntype == "digitalInputNode":
                config.digital_inputs.append({"id": nid, "pin": ndata.get("pin", "DI0")})
            elif ntype == "dashboardMetricNode":
                router.add_node(nid, DashboardOutputNode(nid, ndata, router))
                config.dashboard_nodes.append({
                    "id": f"dashboard.{nid}.value", "name": ndata.get("label", "Metric"), "dataType": "number"
                })
            elif ntype == "snapshotNode":
                router.add_node(nid, SnapshotNode(nid, ndata, router))
                config.dashboard_nodes.append({
                    "id": f"dashboard.{nid}.value", "name": ndata.get("label", "Text"), "dataType": "text"
                })
            elif ntype == "dashboardTextNode":
                router.add_node(nid, DashboardOutputNode(nid, ndata, router))
                config.dashboard_nodes.append({
                    "id": f"dashboard.{nid}.value", "name": ndata.get("label", "Text"), "dataType": "text"
                })
            elif ntype == "dashboardLogNode":
                router.add_node(nid, DashboardOutputNode(nid, ndata, router))
                config.dashboard_nodes.append({
                    "id": f"dashboard.{nid}.history", "name": ndata.get("label", "Log"), "dataType": "array_text"
                })
        for edge in edges:
            src = edge.get("source")
            tgt = edge.get("target")
            router.add_edge(src, tgt)

        hailo_post_process_dir = "/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes"
        models_dir = self.base_dir / "models"
        
        adj = {n["id"]: [] for n in nodes}
        for edge in edges:
            src = edge.get("source")
            tgt = edge.get("target")
            if src in adj and tgt in adj:
                adj[src].append(tgt)
                
        # 2. Parse Camera Streams (GStreamer Config)
        input_nodes = [n for n in nodes if n.get("type") == "inputNode"]
        
        for input_node in input_nodes:
            node_data = input_node.get("data", {})
            entity_id = node_data.get("entityId")
            camera = next((c for c in entities.get("cameras", []) if c.get("id") == entity_id), None)
            
            src_type = camera.get("type", "local") if camera else "local"
            src_path = camera.get("path", "/dev/video0") if camera else "/dev/video0"
            src_loop = node_data.get("loop", True)
            try:
                src_speed = float(node_data.get("speed", 1.0))
            except:
                src_speed = 1.0
            
            ai_node_ids = [child_id for child_id in adj.get(input_node["id"], [])
                           if any(n["id"] == child_id and n.get("type") == "aiNode" for n in nodes)]
            
            if not ai_node_ids:
                stream_config = CameraStreamConfig(stream_id=f"cam_{input_node['id']}")
                stream_config.video_source_type = src_type
                stream_config.video_source = src_path
                stream_config.loop = src_loop
                stream_config.speed = src_speed
                
                # BFS for dashboard nodes
                visited = set([input_node["id"]])
                queue_bfs = list(adj.get(input_node["id"], []))
                while queue_bfs:
                    curr_id = queue_bfs.pop(0)
                    if curr_id in visited: continue
                    visited.add(curr_id)
                    curr_node = next((n for n in nodes if n["id"] == curr_id), None)
                    if curr_node and curr_node.get("type") == "dashboardVideoNode":
                        vid_id = f"stream.rtsp.{curr_id}"
                        stream_config.dashboard_video_nodes.append(vid_id)
                        config.dashboard_nodes.append({
                            "id": vid_id, "name": curr_node.get("data", {}).get("label", "Video"), 
                            "dataType": "video", "stream_id": stream_config.stream_id, "has_ai": False
                        })
                    queue_bfs.extend(adj.get(curr_id, []))
                
                config.camera_streams.append(stream_config)
            else:
                for ai_idx, ai_node_id in enumerate(ai_node_ids):
                    ai_node = next((n for n in nodes if n["id"] == ai_node_id), None)
                    if not ai_node: continue
                    
                    sid = f"cam_{input_node['id']}" if len(ai_node_ids) == 1 else f"cam_{input_node['id']}_{ai_idx}"
                    stream_config = CameraStreamConfig(stream_id=sid)
                    stream_config.video_source_type = src_type
                    stream_config.video_source = src_path
                    stream_config.loop = src_loop
                    stream_config.speed = src_speed
                    stream_config.has_ai_node = True
                    stream_config.input_node_id = input_node["id"]
                    stream_config.ai_node_id = ai_node_id
                    config.has_ai_node = True
                    
                    ai_data = ai_node.get("data", {})
                    m_entity_id = ai_data.get("entityId")
                    model = next((m for m in entities.get("models", []) if m.get("id") == m_entity_id), None)
                    
                    stream_config.roi = ai_data.get("roi", {"x": 0, "y": 0, "w": 1, "h": 1})
                    stream_config.roi_enabled = ai_data.get("roiEnabled", False)
                    stream_config.show_roi = ai_data.get("showRoi", False)
                    stream_config.confidence_threshold = float(ai_data.get("confidenceThreshold", 0.5))
                    stream_config.class_confidences = ai_data.get("classConfidences", {})
                    
                    stream_config.bbox_draw_mode = ai_data.get("bboxDrawMode", "frontend")
                    stream_config.bbox_line_thickness = int(ai_data.get("bboxLineThickness", 2))
                    stream_config.bbox_font_thickness = int(ai_data.get("bboxFontThickness", 1))
                    stream_config.backend_resolution = ai_data.get("backendResolution", "auto")
                    
                    raw_filter = ai_data.get("classFilter", None)
                    stream_config.class_filter = raw_filter if raw_filter and isinstance(raw_filter, list) else None
                    
                    if model:
                        stream_config.ai_task = model.get("task", "detection")
                        hef_path = models_dir / model.get("hef_path", "yolov8s.hef")
                        stream_config.hef_path = str(hef_path) if hef_path.exists() else str(models_dir / "yolov8s.hef")
                        so_path = Path(hailo_post_process_dir) / model.get("so_path", "libyolo_hailortpp_post.so")
                        stream_config.so_path = str(so_path) if so_path.exists() else f"{hailo_post_process_dir}/libyolo_hailortpp_post.so"
                        stream_config.classes = model.get("classes", [])
                    else:
                        stream_config.hef_path = str(models_dir / "yolov8s.hef")
                        stream_config.so_path = f"{hailo_post_process_dir}/libyolo_hailortpp_post.so"
                    
                    # BFS for dashboard video nodes downstream
                    visited = set([input_node["id"], ai_node_id])
                    queue_bfs = list(adj.get(ai_node_id, []))
                    while queue_bfs:
                        curr_id = queue_bfs.pop(0)
                        if curr_id in visited: continue
                        visited.add(curr_id)
                        curr_node = next((n for n in nodes if n["id"] == curr_id), None)
                        if curr_node and curr_node.get("type") == "dashboardVideoNode":
                            vid_id = f"stream.rtsp.{curr_id}" if len(ai_node_ids) == 1 else f"stream.rtsp.{curr_id}_{ai_idx}"
                            stream_config.dashboard_video_nodes.append(vid_id)
                            config.dashboard_nodes.append({
                                "id": vid_id, "name": curr_node.get("data", {}).get("label", "Video"), 
                                "dataType": "video", "stream_id": stream_config.stream_id, "has_ai": True
                            })
                        queue_bfs.extend(adj.get(curr_id, []))
                    
                    config.camera_streams.append(stream_config)

        return config
