import React, { useState, useEffect, useMemo } from 'react';
import { Crosshair, Database, RotateCcw, ArrowRightLeft, Check } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import ROIEditorModal from '../nodes/ROIEditorModal';
import ClassFilterSelector from '../nodes/ClassFilterSelector';

export default function FlowCounterNodeSettings({ nodeId, data, onChange, isSidebar }) {
  const [cameras, setCameras] = useState([]);
  const [models, setModels] = useState([]);
  const [showROIEditor, setShowROIEditor] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(false);

  const { edges, nodes } = usePipelineStore(useShallow((state) => ({
    edges: state.edges,
    nodes: state.nodes
  })));

  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setCameras(json.cameras || []);
        setModels(json.models || []);
      })
      .catch(() => {});
  }, []);

  // Walk backwards to find upstream AINode
  const upstreamAiNode = useMemo(() => {
    let currId = nodeId;
    const visited = new Set();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const inEdge = edges.find(e => e.target === currId);
      if (!inEdge) break;
      const src = nodes.find(n => n.id === inEdge.source);
      if (!src) break;
      if (src.type === 'aiNode') {
        return src;
      }
      currId = src.id;
    }
    return null;
  }, [nodeId, nodes, edges]);

  const selectedModel = useMemo(() => {
    if (!upstreamAiNode?.data?.entityId) return null;
    return models.find(m => m.id === upstreamAiNode.data.entityId) || null;
  }, [upstreamAiNode, models]);

  const availableClasses = useMemo(() => {
    return selectedModel?.classes || [];
  }, [selectedModel]);

  // Walk backwards to find upstream Camera
  const resolvedCamera = useMemo(() => {
    if (!cameras || cameras.length === 0) return null;
    let currId = nodeId;
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
    const anyInput = nodes.find(n => n.type === 'inputNode' && n.data?.entityId);
    if (anyInput) {
      const cam = cameras.find(c => c.id === anyInput.data.entityId);
      if (cam) return cam;
    }
    return cameras.find(c => c.is_enabled) || cameras[0] || null;
  }, [nodeId, nodes, edges, cameras]);

  const handleSyncROI = () => {
    if (!upstreamAiNode?.data?.roi) return;
    const aiRoi = upstreamAiNode.data.roi;
    
    if (data?.mode === 'line') {
      const cx = parseFloat((aiRoi.x + (aiRoi.w / 2)).toFixed(4));
      const y1 = aiRoi.y;
      const y2 = parseFloat((aiRoi.y + aiRoi.h).toFixed(4));
      onChange({ roi: aiRoi, line: [cx, y1, cx, y2] });
    } else {
      onChange({ roi: aiRoi });
    }
    
    setSyncFeedback(true);
    setTimeout(() => setSyncFeedback(false), 2000);
  };

  const handleClassFilterChange = (classes, raw) => {
    onChange({ classFilter: classes, classFilterRaw: raw });
  };

  const handleResetCounters = async () => {
    try {
      await fetch('/api/analytics/counts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId })
      });
    } catch (err) {
      console.error("Failed to reset counter:", err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Trigger Mode & Zone */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trigger Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-teal-500 dark:text-white"
            value={data?.mode || 'roi'}
            onChange={(e) => onChange({ mode: e.target.value })}
          >
            <option value="roi">Action Zone Entry</option>
            <option value="line">Line Crossing</option>
          </select>

          <button
            type="button"
            onClick={() => setShowROIEditor(true)}
            className="bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 text-teal-300 border border-teal-600/50 rounded-md p-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Crosshair size={14} /> Edit Action Zone / Tripwire
          </button>
        </div>
        {upstreamAiNode?.data?.roiEnabled && upstreamAiNode?.data?.roi && (
          <button
            type="button"
            onClick={handleSyncROI}
            className="bg-purple-900/30 hover:bg-purple-800/50 text-purple-300 border border-purple-700/50 rounded-md py-1.5 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors w-full mt-1"
            title={data?.mode === 'line' ? "Generate vertical center line from AI Node's ROI" : "Sync ROI from connected AI Node"}
          >
            {syncFeedback ? (
              <>
                <Check size={13} className="text-green-400" />
                <span className="text-green-400">Synced successfully!</span>
              </>
            ) : (
              <>
                <RotateCcw size={13} /> {data?.mode === 'line' ? 'Auto-Generate Line from AI Mask' : 'Sync Zone with AI Mask'}
              </>
            )}
          </button>
        )}
      </div>

      {/* Target Classes Selector */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50/40 dark:bg-gray-950/40">
        <ClassFilterSelector
          selectedClasses={data?.classFilter || []}
          availableClasses={availableClasses}
          modelName={selectedModel?.name || ''}
          hasUpstreamAi={!!upstreamAiNode}
          onChange={handleClassFilterChange}
          rawInput={data?.classFilterRaw}
        />
      </div>



      {/* Reset Action */}
      <button
        type="button"
        onClick={handleResetCounters}
        className="w-full bg-gray-200 dark:bg-gray-800 hover:bg-red-950/40 text-gray-700 hover:text-red-300 border border-gray-300 dark:border-gray-700 hover:border-red-800/60 rounded-lg py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-2 dark:text-gray-300"
      >
        <RotateCcw size={14} /> Reset Current Counts
      </button>

      {/* ROI Modal */}
      {showROIEditor && (
        <ROIEditorModal
          sourceType={resolvedCamera?.type || 'local'}
          cameraId={resolvedCamera?.id}
          videoPath={resolvedCamera?.path}
          mode={data?.mode === 'line' ? 'line' : 'roi'}
          boundaryRoi={upstreamAiNode?.data?.roiEnabled ? upstreamAiNode?.data?.roi : null}
          currentRoi={data?.roi || { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }}
          currentLine={data?.line || [0.1, 0.5, 0.9, 0.5]}
          onApply={(newVal) => {
             if (data?.mode === 'line') onChange({ line: newVal });
             else onChange({ roi: newVal });
          }}
          onClose={() => setShowROIEditor(false)}
        />
      )}
    </div>
  );
}
