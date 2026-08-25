import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bell } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function ActionNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch integration entities from backend
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setIntegrations(json.integrations || []);
        setLoading(false);
        
        // Auto-select first integration if not set
        if (!data?.entityId && json.integrations && json.integrations.length > 0) {
          updateNodeData(id, { entityId: json.integrations[0].id });
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

  const selectedIntegration = integrations.find(i => i.id === data?.entityId);

  return (
    <div className="bg-gray-900 border-2 border-green-600 rounded-xl shadow-lg shadow-green-900/20 w-64 text-white overflow-hidden">
      <div className="bg-green-600/20 p-3 flex items-center justify-between border-b border-green-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-1.5 rounded-lg">
            <Bell size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">Action / Alert</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Integration Entity
          {loading ? (
            <div className="text-sm text-gray-500 py-1">Loading...</div>
          ) : (
            <select 
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-green-500 nodrag"
              value={data?.entityId || ''}
              onChange={handleEntityChange}
            >
              <option value="" disabled>Select Integration</option>
              {integrations.map(int => (
                <option key={int.id} value={int.id}>
                  {int.name}
                </option>
              ))}
            </select>
          )}
        </label>
        
        
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Trigger On (Payload)
          <select 
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-green-500 nodrag"
            value={data?.triggerOn !== undefined ? String(data.triggerOn) : "true"}
            onChange={(e) => updateNodeData(id, { triggerOn: e.target.value === 'true' })}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </label>
{/* Preview of the selected entity's target */}
        {selectedIntegration && (
          <div className="text-[10px] text-gray-500 bg-gray-800 p-2 rounded-md break-all">
            <span className="text-green-400 uppercase font-semibold mr-1">{selectedIntegration.type}:</span>
            {selectedIntegration.target || "N/A"}
          </div>
        )}
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-green-500 border-2 border-gray-900"
      />
      <div className="px-4 pb-4 mt-1 border-t border-gray-800 text-[10px] text-gray-500">
        Triggers when <code className="text-indigo-400 bg-gray-950 px-1 py-0.5 rounded">payload == {data?.triggerOn !== false ? "True" : "False"}</code>
      </div>
    </div>
  );
}
