import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BrainCircuit } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function AINode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch model entities from backend
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setModels(json.models || []);
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

  const handleEntityChange = (e) => {
    updateNodeData(id, { entityId: e.target.value });
  };

  const selectedModel = models.find(m => m.id === data?.entityId);

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
        
        {/* Preview of the selected entity's config */}
        {selectedModel && (
          <div className="text-[10px] text-gray-500 bg-gray-800 p-2 rounded-md break-all">
            <div className="text-purple-400 uppercase font-semibold mb-1">Config:</div>
            <div>Task: {selectedModel.task}</div>
            <div className="mt-1 opacity-70">HEF: {selectedModel.hef_path}</div>
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
    </div>
  );
}
