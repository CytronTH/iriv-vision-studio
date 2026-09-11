import logging
from typing import Dict, Any, List, Set, Tuple

logger = logging.getLogger(__name__)

# Node types handled entirely inside Python MessageRouter
ROUTER_NODE_TYPES = {
    "logicNode",
    "counterNode",
    "flowCounterNode",
    "rateLimitNode",
    "functionNode",
    "actionNode",
    "digitalOutputNode",
    "ledNode",
    "buzzerNode",
    "dashboardMetricNode",
    "dashboardTextNode",
    "dashboardLogNode",
    "snapshotNode",
    "debugNode",
    "debugOutputNode",
    "shelfSlotMonitorNode",
    "forkliftZoneNode",
}

# Video / NPU pipeline node types
STREAM_NODE_TYPES = {
    "inputNode",
    "aiNode",
    "dashboardVideoNode",
}

# Dynamic parameters in aiNode that can be updated on-the-fly without rebuilding GStreamer/Hailo
AI_DYNAMIC_PARAMS = {
    "confidenceThreshold",
    "classConfidences",
    "roi",
    "roiEnabled",
    "showRoi",
    "classFilter",
    "bboxDrawMode",
    "bboxLineThickness",
    "bboxFontThickness",
    "backendResolution",
}

class PipelineDiffResult:
    def __init__(self):
        self.action: str = "full_restart"  # "none" | "ai_params_only" | "router_only" | "hybrid_hot" | "flow_restart" | "full_restart"
        self.added_nodes: List[str] = []
        self.removed_nodes: List[str] = []
        self.modified_nodes: List[str] = []
        self.added_edges: List[Dict[str, Any]] = []
        self.removed_edges: List[Dict[str, Any]] = []
        self.affected_stream_ids: List[str] = []
        self.ai_param_updates: Dict[str, Dict[str, Any]] = {}  # ai_node_id -> {param: new_val}
        self.has_structural_changes: bool = False
        self.summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action,
            "added_nodes": self.added_nodes,
            "removed_nodes": self.removed_nodes,
            "modified_nodes": self.modified_nodes,
            "added_edges_count": len(self.added_edges),
            "removed_edges_count": len(self.removed_edges),
            "affected_stream_ids": self.affected_stream_ids,
            "ai_param_updates": self.ai_param_updates,
            "has_structural_changes": self.has_structural_changes,
            "summary": self.summary
        }

def _clean_node_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Strip out transient UI keys like position, selection, etc. to compare pure data."""
    if not isinstance(data, dict):
        return {}
    ignore_keys = {"selected", "dragging", "position", "positionAbsolute", "width", "height"}
    return {k: v for k, v in data.items() if k not in ignore_keys}

def _edge_key(edge: Dict[str, Any]) -> Tuple[str, str, str, str]:
    """Unique key for edge comparison ignoring UI styles."""
    return (
        edge.get("source", ""),
        edge.get("target", ""),
        edge.get("sourceHandle", "") or "",
        edge.get("targetHandle", "") or ""
    )

def diff_pipelines(
    old_nodes: List[Dict[str, Any]],
    old_edges: List[Dict[str, Any]],
    new_nodes: List[Dict[str, Any]],
    new_edges: List[Dict[str, Any]],
    requested_mode: str = "modified_nodes"
) -> PipelineDiffResult:
    """
    Compare old and new pipeline graphs and classify the required deployment action.
    Modes:
      - 'full': Always perform full restart
      - 'modified_flows': Restart only changed camera stream flows
      - 'modified_nodes': Prefer hot-reload (router/AI params) whenever possible
    """
    result = PipelineDiffResult()

    if requested_mode == "full":
        result.action = "full_restart"
        result.summary = "Full deploy explicitly requested."
        result.has_structural_changes = True
        return result

    # Index old and new nodes by ID
    old_map = {n["id"]: n for n in old_nodes if not n.get("data", {}).get("disabled", False)}
    new_map = {n["id"]: n for n in new_nodes if not n.get("data", {}).get("disabled", False)}

    old_ids = set(old_map.keys())
    new_ids = set(new_map.keys())

    result.added_nodes = list(new_ids - old_ids)
    result.removed_nodes = list(old_ids - new_ids)
    common_ids = old_ids & new_ids

    # Compare edge sets
    old_edge_keys = {_edge_key(e) for e in old_edges}
    new_edge_keys = {_edge_key(e) for e in new_edges}
    
    result.added_edges = [e for e in new_edges if _edge_key(e) not in old_edge_keys]
    result.removed_edges = [e for e in old_edges if _edge_key(e) not in new_edge_keys]
    edges_changed = bool(result.added_edges or result.removed_edges)

    # Check modified nodes
    stream_structural_change = False
    router_change = False

    # Check added/removed nodes types
    for nid in result.added_nodes:
        ntype = new_map[nid].get("type", "")
        if ntype in STREAM_NODE_TYPES:
            stream_structural_change = True
        elif ntype in ROUTER_NODE_TYPES:
            router_change = True

    for nid in result.removed_nodes:
        ntype = old_map[nid].get("type", "")
        if ntype in STREAM_NODE_TYPES:
            stream_structural_change = True
        elif ntype in ROUTER_NODE_TYPES:
            router_change = True

    # Check edge changes touching stream nodes
    if edges_changed:
        for e in result.added_edges + result.removed_edges:
            src_node = new_map.get(e.get("source")) or old_map.get(e.get("source"))
            tgt_node = new_map.get(e.get("target")) or old_map.get(e.get("target"))
            src_type = src_node.get("type", "") if src_node else ""
            tgt_type = tgt_node.get("type", "") if tgt_node else ""
            
            # If edge touches inputNode, aiNode, or dashboardVideoNode
            if src_type in STREAM_NODE_TYPES or tgt_type in STREAM_NODE_TYPES:
                # If it's an edge between inputNode and aiNode, or aiNode and dashboardVideoNode,
                # this changes the GStreamer video branch topology!
                if (src_type == "inputNode" and tgt_type == "aiNode") or \
                   (src_type in {"inputNode", "aiNode"} and tgt_type == "dashboardVideoNode"):
                    stream_structural_change = True
                else:
                    # Edge from aiNode to logicNode (output of detections) is pure router data!
                    router_change = True
            else:
                router_change = True

    # Inspect common nodes for attribute changes
    for nid in common_ids:
        old_n = old_map[nid]
        new_n = new_map[nid]
        old_data = _clean_node_data(old_n.get("data", {}))
        new_data = _clean_node_data(new_n.get("data", {}))
        
        if old_data != new_data:
            result.modified_nodes.append(nid)
            ntype = new_n.get("type", "")
            
            if ntype in ROUTER_NODE_TYPES:
                router_change = True
            elif ntype == "aiNode":
                # Check what changed in aiNode
                diff_keys = set()
                all_keys = set(old_data.keys()) | set(new_data.keys())
                for k in all_keys:
                    if old_data.get(k) != new_data.get(k):
                        diff_keys.add(k)
                
                # Check if only dynamic params changed
                non_dynamic = diff_keys - AI_DYNAMIC_PARAMS
                if non_dynamic:
                    # e.g. entityId changed (different model!), task changed
                    stream_structural_change = True
                else:
                    # Only dynamic parameters changed!
                    result.ai_param_updates[nid] = {k: new_data.get(k) for k in diff_keys}
            elif ntype in {"inputNode", "dashboardVideoNode"}:
                stream_structural_change = True

    # No changes at all?
    if not result.added_nodes and not result.removed_nodes and not result.modified_nodes and not edges_changed:
        result.action = "none"
        result.summary = "No pipeline changes detected."
        return result

    result.has_structural_changes = stream_structural_change

    # Decision Matrix
    if stream_structural_change:
        if requested_mode == "modified_flows":
            result.action = "flow_restart"
            result.summary = "Stream structure changed. Restarting affected camera flow(s)."
        else:
            result.action = "full_restart"
            result.summary = "Video/NPU pipeline structure or AI model changed. Full restart required."
    elif router_change and result.ai_param_updates:
        result.action = "hybrid_hot"
        result.summary = "Hot-reloading Logic Router and updating AI parameters with zero video downtime."
    elif router_change:
        result.action = "router_only"
        result.summary = "Hot-reloading MessageRouter with zero video downtime."
    elif result.ai_param_updates:
        result.action = "ai_params_only"
        result.summary = "Hot-updating AI confidence/ROI filters with zero video downtime."
    else:
        result.action = "router_only"
        result.summary = "Hot-reloading graph connections."

    return result
