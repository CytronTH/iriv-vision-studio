import React, { useState, useEffect } from 'react';
import { Handle, Position, useHandleConnections, useNodesData } from '@xyflow/react';
import { BrainCircuit, Filter, Crosshair, Settings } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';
import ROIEditorModal from './ROIEditorModal';
import AINodeSettingsModal from './AINodeSettingsModal';

export default function AINode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showROIEditor, setShowROIEditor] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // ── Find upstream Input Node ──────────────────────────────────────────────
  // Walk edges backwards: find an edge whose target === this node id,
  // then look up the source node (should be an inputNode).
  const connections = useHandleConnections({ type: 'target' });
  const upstreamNode = useNodesData(connections[0]?.source || 'empty-id');
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
  const classFilter = data?.classFilter ?? null;
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
        
        {/* Advanced Settings Button */}
        <button 
          onClick={() => setShowSettingsModal(true)}
          className="bg-gray-800 hover:bg-gray-700 text-purple-300 border border-purple-500/50 rounded-md py-1.5 px-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors nodrag mt-1"
        >
          <Settings size={14} /> Advanced Settings
        </button>

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

      {showSettingsModal && (
        <AINodeSettingsModal
          id={id}
          data={data}
          updateNodeData={updateNodeData}
          modelClasses={modelClasses}
          isInputNode={isInputNode}
          onClose={() => setShowSettingsModal(false)}
          onOpenROI={() => setShowROIEditor(true)}
        />
      )}
    </div>
  );
}

