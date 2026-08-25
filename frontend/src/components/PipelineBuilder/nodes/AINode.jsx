import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BrainCircuit, Filter, Crosshair } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';
import ROIEditorModal from './ROIEditorModal';

export default function AINode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showROIEditor, setShowROIEditor] = useState(false);

  // ── Find upstream Input Node ──────────────────────────────────────────────
  // Walk edges backwards: find an edge whose target === this node id,
  // then look up the source node (should be an inputNode).
  const upstreamEdge = edges.find(e => e.target === id);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;
  const isInputNode = upstreamNode?.type === 'inputNode';

  // Resolve camera entity from upstream InputNode data
  const [cameras, setCameras] = useState([]);

  useEffect(() => {
    // Fetch all entities (models + cameras) in one call
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setModels(json.models || []);
        setCameras(json.cameras || []);
        setLoading(false);

        // Auto-select first model if not set
        if (!data?.entityId && json.models && json.models.length > 0) {
          updateNodeData(id, { entityId: json.models[0].id });
        }
      })
      .catch(err => {
        console.error("Failed to fetch entities", err);
        setLoading(false);
      });
  }, [id, data?.entityId, updateNodeData]);

  // Derived from upstream InputNode
  const upstreamCameraEntityId = isInputNode ? upstreamNode?.data?.entityId : null;
  const upstreamCamera = cameras.find(c => c.id === upstreamCameraEntityId);
  // 'local' | 'rtsp' → camera snapshot; 'file' → video scrubber
  const upstreamSourceType = upstreamCamera?.type ?? null;
  const upstreamVideoPath = upstreamCamera?.path ?? null;

  const handleEntityChange = (e) => {

    // Reset class filter when model changes
    updateNodeData(id, { entityId: e.target.value, classFilter: null });
  };

  const selectedModel = models.find(m => m.id === data?.entityId);
  const modelClasses = selectedModel?.classes || [];
  const confidenceThreshold = data?.confidenceThreshold ?? 0.5;
  const classFilter = data?.classFilter ?? null; // null = all classes

  const handleConfidenceChange = (e) => {
    updateNodeData(id, { confidenceThreshold: parseFloat(e.target.value) });
  };

  const handleClassConfidenceChange = (cls, val) => {
    if (isNaN(val)) return;
    const currentConfs = data?.classConfidences || {};
    updateNodeData(id, { classConfidences: { ...currentConfs, [cls]: val } });
  };

  const handleClassToggle = (cls) => {
    let current = classFilter ? [...classFilter] : [...modelClasses]; // start from all if none set
    if (current.includes(cls)) {
      current = current.filter(c => c !== cls);
    } else {
      current = [...current, cls];
    }
    // If all selected, set to null (= all)
    if (current.length === modelClasses.length) {
      updateNodeData(id, { classFilter: null });
    } else {
      updateNodeData(id, { classFilter: current });
    }
  };

  const handleAllToggle = () => {
    if (classFilter === null) {
      // Deselect all
      updateNodeData(id, { classFilter: [] });
    } else {
      // Select all
      updateNodeData(id, { classFilter: null });
    }
  };

  const isClassSelected = (cls) => {
    if (classFilter === null) return true; // all selected
    return classFilter.includes(cls);
  };

  const allSelected = classFilter === null;
  const activeClassCount = classFilter === null ? modelClasses.length : classFilter.length;

  return (
    <div className="bg-gray-900 border-2 border-purple-600 rounded-xl shadow-lg shadow-purple-900/20 w-64 text-white overflow-hidden">
      <div className="bg-purple-600/20 p-3 flex items-center justify-between border-b border-purple-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-1.5 rounded-lg">
            <BrainCircuit size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">AI Model</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Model Entity
          {loading ? (
            <div className="text-sm text-gray-500 py-1">Loading...</div>
          ) : (
            <select 
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-purple-500 nodrag"
              value={data?.entityId || ''}
              onChange={handleEntityChange}
            >
              <option value="" disabled>Select Model</option>
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          )}
        </label>
        
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Hardware
          <select className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-purple-500 nodrag" disabled>
            <option>Hailo-8L NPU</option>
          </select>
        </label>
        
        {/* ROI Settings */}
        <div className="border border-gray-700/50 rounded-lg p-2 bg-gray-800/30 flex flex-col gap-2 nodrag">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Inspection Zone (ROI)</div>
            {/* Draw Zone button — only show when an Input Node is connected */}
            {isInputNode ? (
              <button
                onClick={() => setShowROIEditor(true)}
                className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/60 hover:border-purple-600 px-2 py-0.5 rounded-md transition-all"
                title="Open visual ROI editor"
              >
                <Crosshair size={10} />
                Draw Zone
              </button>
            ) : (
              <span className="text-[10px] text-gray-600 italic">connect Input first</span>
            )}
          </div>

          {/* Compact numeric readout */}
          <div className="grid grid-cols-2 gap-2">
            {['x','y','w','h'].map((key) => (
              <label key={key} className="text-[10px] text-gray-400 flex items-center justify-between">
                {key.toUpperCase()}
                <input
                  type="number" min="0" max="1" step="0.01"
                  className="bg-gray-900 border border-gray-700 rounded p-1 w-14 text-right focus:border-purple-500 outline-none"
                  value={data?.roi?.[key] ?? (key === 'w' || key === 'h' ? 1.0 : 0.0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    const base = { x:0, y:0, w:1, h:1, ...(data?.roi || {}) };
                    updateNodeData(id, { roi: { ...base, [key]: val } });
                  }}
                />
              </label>
            ))}
          </div>

          {/* ROI Toggles */}
          <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-gray-700/50">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-[10px] text-gray-300 group-hover:text-purple-300 transition-colors">Enable ROI Filter</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" 
                  checked={data?.roiEnabled ?? false} 
                  onChange={(e) => updateNodeData(id, { roiEnabled: e.target.checked })} 
                />
                <div className={`block w-7 h-4 rounded-full transition-colors ${data?.roiEnabled ? 'bg-purple-600' : 'bg-gray-700'}`}></div>
                <div className={`dot absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${data?.roiEnabled ? 'transform translate-x-3' : ''}`}></div>
              </div>
            </label>
            
            <label className={`flex items-center justify-between cursor-pointer group ${!data?.roiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-[10px] text-gray-300 group-hover:text-purple-300 transition-colors">Show ROI Box on Stream</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" 
                  disabled={!data?.roiEnabled}
                  checked={data?.roiEnabled ? (data?.showRoi ?? false) : false} 
                  onChange={(e) => updateNodeData(id, { showRoi: e.target.checked })} 
                />
                <div className={`block w-7 h-4 rounded-full transition-colors ${data?.roiEnabled && data?.showRoi ? 'bg-purple-600' : 'bg-gray-700'}`}></div>
                <div className={`dot absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${data?.roiEnabled && data?.showRoi ? 'transform translate-x-3' : ''}`}></div>
              </div>
            </label>
          </div>

          {/* Visual hint about active ROI */}
          {data?.roiEnabled && data?.roi && (data.roi.x !== 0 || data.roi.y !== 0 || data.roi.w !== 1 || data.roi.h !== 1) && (
            <div className="text-[10px] text-purple-400/80 bg-purple-950/20 rounded px-2 py-1 border border-purple-900/40 mt-1">
              Zone active: ({(data.roi.x*100).toFixed(0)}%, {(data.roi.y*100).toFixed(0)}%) &nbsp;
              {(data.roi.w*100).toFixed(0)}% × {(data.roi.h*100).toFixed(0)}%
            </div>
          )}
        </div>

        {/* Confidence Threshold */}
        <div className="border border-gray-700/50 rounded-lg p-2 bg-gray-800/30 flex flex-col gap-2 nodrag">
          <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Confidence Threshold</div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={confidenceThreshold}
              onChange={handleConfidenceChange}
              className="flex-1 accent-purple-500"
            />
            <span className="text-xs font-mono text-purple-300 w-8 text-right">{confidenceThreshold.toFixed(2)}</span>
          </div>
        </div>

        {/* Class Filter */}
        {modelClasses.length > 0 ? (
          <div className="border border-gray-700/50 rounded-lg p-2 bg-gray-800/30 flex flex-col gap-1.5 nodrag">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
                <Filter size={10} /> Class Filter
              </div>
              <span className="text-[10px] text-purple-400">{activeClassCount}/{modelClasses.length}</span>
            </div>
            {/* All Classes toggle */}
            <label className="flex items-center gap-2 cursor-pointer py-0.5 border-b border-gray-700/50">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleAllToggle}
                className="accent-purple-500"
              />
              <span className="text-xs text-gray-300 font-semibold">All Classes</span>
            </label>
            {/* Individual class toggles */}
            {modelClasses.map(cls => (
              <div key={cls} className="flex items-center justify-between py-0.5 group">
                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isClassSelected(cls)}
                    onChange={() => handleClassToggle(cls)}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-gray-400 truncate pr-1">{cls}</span>
                </label>
                {isClassSelected(cls) && (
                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-gray-500 font-mono">conf:</span>
                    <input
                      type="number" min="0" max="1" step="0.05"
                      value={data?.classConfidences?.[cls] ?? confidenceThreshold}
                      onChange={e => handleClassConfidenceChange(cls, parseFloat(e.target.value))}
                      className="bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-[10px] w-12 text-center text-purple-300 outline-none focus:border-purple-500 nodrag font-mono"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : selectedModel ? (
          <div className="text-[10px] text-gray-600 text-center py-1 border border-dashed border-gray-700 rounded-lg">
            No class names — set them in{' '}
            <span className="text-purple-500">Settings → Models</span>
          </div>
        ) : null}

        {/* Preview of the selected entity's config */}
        {selectedModel && (
          <div className="text-[10px] text-gray-500 bg-gray-800 p-2 rounded-md break-all mt-1">
            <div className="text-purple-400 uppercase font-semibold mb-1">Config:</div>
            <div>Task: {selectedModel.task}</div>
            <div className="mt-1 opacity-70 truncate" title={selectedModel.hef_path}>HEF: {selectedModel.hef_path.split('/').pop()}</div>
          </div>
        )}
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-purple-500 border-2 border-gray-900"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-purple-500 border-2 border-gray-900"
      />

      {/* ROI Editor Modal — rendered outside the node overflow:hidden container via portal-like approach */}
      {showROIEditor && (
        <ROIEditorModal
          sourceType={upstreamSourceType}
          cameraId={upstreamCameraEntityId}
          videoPath={upstreamVideoPath}
          currentRoi={data?.roi || { x: 0, y: 0, w: 1, h: 1 }}
          onApply={(newRoi) => updateNodeData(id, { roi: newRoi })}
          onClose={() => setShowROIEditor(false)}
        />
      )}
    </div>
  );
}

