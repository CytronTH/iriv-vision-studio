import logging
import json
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class CameraStreamConfig:
    def __init__(self, stream_id: str):
        self.stream_id = stream_id
        self.video_source_type = "local"
        self.video_source = "/dev/video0"
        self.has_ai_node = False
        self.ai_task = "detection"
        self.hef_path = ""
        self.so_path = ""
        self.dashboard_video_nodes = []
        
        # Stream-specific logic and outputs
        self.logic_rules = []
        self.actions = []
        self.led_outputs = []
        self.buzzer_actions = []
        self.rs485_actions = []

class ParsedPipelineConfig:
    def __init__(self):
        self.camera_streams: List[CameraStreamConfig] = []
        self.logic_rules = []
        self.actions = []
        self.digital_inputs = []
        self.digital_outputs = []
        self.led_outputs = []
        self.buzzer_actions = []
        self.rs485_actions = []
        self.dashboard_nodes = []
        self.has_ai_node = False # Global flag
        
    def __repr__(self):
        return f"<ParsedPipelineConfig streams={len(self.camera_streams)}>"

class PipelineParser:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.entities_path = base_dir / "db" / "entities.json"
        
    def _load_entities(self):
        if not self.entities_path.exists():
            return {"cameras": [], "models": [], "integrations": []}
        try:
            with open(self.entities_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load entities.json: {e}")
            return {"cameras": [], "models": [], "integrations": []}
            
    def parse(self, payload: Dict[str, Any]) -> ParsedPipelineConfig:
        config = ParsedPipelineConfig()
        nodes = payload.get("nodes", [])
        edges = payload.get("edges", [])
        entities = self._load_entities()
        
        # Default Hailo paths
        hailo_post_process_dir = "/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes"
        models_dir = self.base_dir / "models"
        
        # Build adjacency list for forward traversal
        adj = {n["id"]: [] for n in nodes}
        for edge in edges:
            src = edge.get("source")
            tgt = edge.get("target")
            if src in adj and tgt in adj:
                adj[src].append(tgt)
                
        # 1. Parse Camera Streams (Tracing from Input Nodes)
        input_nodes = [n for n in nodes if n.get("type") == "inputNode"]
        
        for input_node in input_nodes:
            stream_config = CameraStreamConfig(stream_id=f"cam_{input_node['id']}")
            
            # Setup input
            node_data = input_node.get("data", {})
            entity_id = node_data.get("entityId")
            camera = next((c for c in entities.get("cameras", []) if c.get("id") == entity_id), None)
            if camera:
                stream_config.video_source_type = camera.get("type", "local")
                stream_config.video_source = camera.get("path", "/dev/video0")
            else:
                stream_config.video_source_type = "local"
                stream_config.video_source = "/dev/video0"
                
            # Traverse graph using BFS from this input node
            visited = set()
            queue = [(input_node["id"], False)]
            
            while queue:
                curr_id, path_has_ai = queue.pop(0)
                if curr_id in visited:
                    continue
                visited.add(curr_id)
                
                curr_node = next((n for n in nodes if n["id"] == curr_id), None)
                if not curr_node:
                    continue
                    
                c_type = curr_node.get("type")
                c_data = curr_node.get("data", {})
                
                if c_type == "aiNode":
                    path_has_ai = True
                    stream_config.has_ai_node = True
                    config.has_ai_node = True
                    
                    m_entity_id = c_data.get("entityId")
                    model = next((m for m in entities.get("models", []) if m.get("id") == m_entity_id), None)
                    if model:
                        stream_config.ai_task = model.get("task", "detection")
                        
                        # Fallback to default if mock model file doesn't exist
                        hef_path = models_dir / model.get("hef_path", "yolov8s.hef")
                        if not hef_path.exists():
                            hef_path = models_dir / "yolov8s.hef"
                            logger.warning(f"HEF file not found, falling back to {hef_path}")
                            
                        stream_config.hef_path = str(hef_path)
                        
                        so_path = Path(hailo_post_process_dir) / model.get("so_path", "libyolo_hailortpp_post.so")
                        if not so_path.exists():
                            so_path = Path(hailo_post_process_dir) / "libyolo_hailortpp_post.so"
                            
                        stream_config.so_path = str(so_path)
                    else:
                        stream_config.hef_path = str(models_dir / "yolov8s.hef")
                        stream_config.so_path = f"{hailo_post_process_dir}/libyolo_hailortpp_post.so"
                
                elif c_type == "dashboardVideoNode":
                    vid_id = f"stream.rtsp.{curr_id}"
                    stream_config.dashboard_video_nodes.append(vid_id)
                    # Add to exposed data sources using the unique vid_id
                    config.dashboard_nodes.append({
                        "id": vid_id,
                        "name": c_data.get("label", "Video Stream"),
                        "dataType": "video",
                        "stream_id": stream_config.stream_id,
                        "has_ai": path_has_ai
                    })
                    
                elif c_type == "logicNode":
                    condition = c_data.get("condition", "confidence_gt")
                    value = c_data.get("value", "0.5")
                    if condition == "label_equals":
                        threshold = str(value)
                    else:
                        try:
                            threshold = float(value)
                        except ValueError:
                            threshold = 0.5
                    stream_config.logic_rules.append({
                        "node_id": curr_id,
                        "type": condition,
                        "threshold": threshold
                    })
                    
                elif c_type == "actionNode":
                    entity_id = c_data.get("entityId")
                    integration = next((i for i in entities.get("integrations", []) if i.get("id") == entity_id), None)
                    if integration:
                        stream_config.actions.append({
                            "type": integration.get("type", "console_log"),
                            "target": integration.get("target", ""),
                            "name": integration.get("name", "Unknown Action")
                        })
                        
                elif c_type == "digitalInputNode":
                    pin = c_data.get("pin", "DI0")
                    config.digital_inputs.append({"pin": pin})
                    
                elif c_type == "digitalOutputNode":
                    pin = c_data.get("pin", "DO0")
                    config.digital_outputs.append({"pin": pin, "action": c_data.get("action", "on")})
                    
                elif c_type == "ledNode":
                    pin = c_data.get("pin", "L0")
                    brightness = float(c_data.get("brightness", 100)) / 100.0
                    stream_config.led_outputs.append({"pin": pin, "brightness": brightness})
                    
                elif c_type == "buzzerNode":
                    stream_config.buzzer_actions.append({"duration": float(c_data.get("duration", 1.0))})
                    
                elif c_type == "rs485Node":
                    stream_config.rs485_actions.append({
                        "payload": c_data.get("payload", ""),
                        "hex_mode": bool(c_data.get("hex_mode", False))
                    })
                    
                elif c_type == "dashboardMetricNode":
                    source_path = c_data.get("sourcePath", "data.length")
                    new_id = f"{stream_config.stream_id}.{source_path}"
                    config.dashboard_nodes.append({
                        "id": new_id,
                        "name": c_data.get("label", "Numeric Metric"),
                        "dataType": "number"
                    })
                    
                elif c_type == "dashboardTextNode":
                    source_path = c_data.get("sourcePath", "data.length")
                    new_id = f"{stream_config.stream_id}.{source_path}"
                    config.dashboard_nodes.append({
                        "id": new_id,
                        "name": c_data.get("label", "Text/Log Feed"),
                        "dataType": "array_text"
                    })
                    
                # Continue traversal
                queue.extend([(child, path_has_ai) for child in adj.get(curr_id, [])])
                
            config.camera_streams.append(stream_config)

        return config
