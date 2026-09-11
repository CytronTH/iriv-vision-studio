import React, { useState, useEffect } from 'react';
import { Handle, Position, useHandleConnections, useNodesData } from '@xyflow/react';
import { ArrowRightLeft, Crosshair, RotateCcw, Database } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';
import ROIEditorModal from './ROIEditorModal';

export default function FlowCounterNode({ id, data }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const nodes = usePipelineStore(s => s.nodes);
  const edges = usePipelineStore(s => s.edges);

  const [showROIEditor, setShowROIEditor] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [liveCounts, setLiveCounts] = useState(data?.counts || {});
  const [liveTotal, setLiveTotal] = useState(data?.total || 0);

  // Initialize default node data
  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, {
        label: 'Flow Counter',
        mode: 'roi',
        roi: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
        line: [0.1, 0.5, 0.9, 0.5],
        classFilter: [],
        autoLog: true,
        flushIntervalSec: 60
      });
    }
  }, [id, data?.label, updateNodeData]);

  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => setCameras(json.cameras || []))
      .catch(() => {});
  }, []);

  // Walk edges backwards from this node to find the upstream InputNode (Camera Entity)
  const resolvedCamera = React.useMemo(() => {
    if (!cameras || cameras.length === 0) return null;

    // 1. Walk edges backwards
    let currId = id;
    const visited = new Set();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const inEdge = edges.find(e => e.target === currId);
      if (!inEdge) break;
      const src = nodes.find(n => n.id === inEdge.source);
      if (!src) break;
      if (src.type === 'inputNode' && src.data?.entityId) {
        const cam = cameras.find(c => c.id === src.data.entityId);
        if (cam) return cam;
      }
      currId = src.id;
    }

    // 2. Fallback: find any inputNode on canvas
    const anyInput = nodes.find(n => n.type === 'inputNode' && n.data?.entityId);
    if (anyInput) {
      const cam = cameras.find(c => c.id === anyInput.data.entityId);
      if (cam) return cam;
    }

    // 3. Fallback: first enabled camera
    return cameras.find(c => c.is_enabled) || cameras[0] || null;
  }, [id, nodes, edges, cameras]);

  const handleLabelChange = (e) => {
    updateNodeData(id, { label: e.target.value });
  };

  const handleModeChange = (e) => {
    updateNodeData(id, { mode: e.target.value });
  };

  const handleAutoLogChange = (e) => {
    updateNodeData(id, { autoLog: e.target.checked });
  };

  const handleClassFilterChange = (e) => {
    const raw = e.target.value;
    const classes = raw.split(',').map(s => s.trim()).filter(Boolean);
    updateNodeData(id, { classFilter: classes, classFilterRaw: raw });
  };

  const handleReset = async () => {
    try {
      await fetch('/api/analytics/counts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: id })
      });
      setLiveCounts({});
      setLiveTotal(0);
    } catch (err) {
      console.error("Failed to reset counter:", err);
    }
  };

  return (
    <div className="bg-gray-900 border-2 border-teal-500 rounded-xl shadow-lg shadow-teal-900/20 w-72 text-white flex flex-col">
      <div className="bg-teal-500/20 p-3 flex items-center justify-between border-b border-teal-800/50">
        <div className="flex items-center gap-2.5">
          <div className="bg-teal-600 p-1.5 rounded-lg text-white">
            <ArrowRightLeft size={16} />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">Flow Counter</div>
            <div className="text-[10px] text-teal-300/80">Anti-Duplicate Class Counter</div>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>

      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Node Label */}
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Node Label
          <input
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-teal-500 nodrag"
            value={data?.label || ''}
            onChange={handleLabelChange}
            placeholder="e.g. Conveyor Counter"
          />
        </label>

        {/* Trigger Mode */}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-400 flex flex-col gap-1">
            Trigger Mode
            <select
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-xs focus:outline-none focus:border-teal-500 nodrag"
              value={data?.mode || 'roi'}
              onChange={handleModeChange}
            >
              <option value="roi">Zone (ROI Entry)</option>
              <option value="line">Line Crossing</option>
            </select>
          </label>

          <div className="flex flex-col justify-end">
            <button
              onClick={() => setShowROIEditor(true)}
              className="bg-gray-800 hover:bg-gray-700 text-teal-300 border border-teal-600/50 rounded-md py-1.5 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors nodrag"
              title="Configure Zone coordinates"
            >
              <Crosshair size={13} /> Edit Zone
            </button>
          </div>
        </div>

        {/* Target Classes Filter */}
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Target Classes (Comma-separated, blank for all)
          <input
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-xs focus:outline-none focus:border-teal-500 nodrag placeholder:text-gray-600"
            value={data?.classFilterRaw !== undefined ? data.classFilterRaw : (data?.classFilter || []).join(', ')}
            onChange={handleClassFilterChange}
            placeholder="e.g. person, car, box_a"
          />
        </label>

        {/* Auto Log Toggle */}
        <div className="flex items-center justify-between bg-gray-950/80 px-2.5 py-1.5 rounded border border-gray-800 text-xs text-gray-300">
          <div className="flex items-center gap-1.5">
            <Database size={13} className="text-teal-400" />
            <span>Auto-Save to DB</span>
          </div>
          <input
            type="checkbox"
            checked={data?.autoLog ?? true}
            onChange={handleAutoLogChange}
            className="rounded bg-gray-800 border-gray-700 text-teal-500 focus:ring-0 nodrag cursor-pointer"
          />
        </div>

        {/* Live Counters Display & Reset */}
        <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Current Total:</span>
            <div className="flex items-center gap-2">
              <span className="text-teal-300 font-bold text-sm">{liveTotal}</span>
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-red-400 p-0.5 rounded transition-colors nodrag"
                title="Reset Counters"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>

          {Object.keys(liveCounts).length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
              {Object.entries(liveCounts).map(([cls, cnt]) => (
                <span key={cls} className="text-[10px] bg-teal-950/60 border border-teal-800/60 text-teal-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span>{cls}:</span>
                  <span className="font-bold text-white">{cnt}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-gray-600 italic">Ready for streaming detections</div>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-teal-400 border-2 border-gray-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-teal-400 border-2 border-gray-900" />

      {/* ROI / Zone Editor Modal */}
      {showROIEditor && (
        <ROIEditorModal
          sourceType={resolvedCamera?.type || 'local'}
          cameraId={resolvedCamera?.id}
          videoPath={resolvedCamera?.path}
          currentRoi={data?.roi || { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }}
          onApply={(newRoi) => updateNodeData(id, { roi: newRoi })}
          onClose={() => setShowROIEditor(false)}
        />
      )}
    </div>
  );
}
