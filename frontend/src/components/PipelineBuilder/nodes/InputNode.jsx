import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function InputNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch camera entities from backend
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setCameras(json.cameras || []);
        setLoading(false);
        
        // Auto-select first camera if not set
        if (!data?.entityId && json.cameras && json.cameras.length > 0) {
          updateNodeData(id, { entityId: json.cameras[0].id });
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

  const selectedCam = cameras.find(c => c.id === data?.entityId);

  return (
    <div className="bg-gray-900 border-2 border-blue-600 rounded-xl shadow-lg shadow-blue-900/20 w-64 text-white overflow-hidden">
      <div className="bg-blue-600/20 p-3 flex items-center justify-between border-b border-blue-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Camera size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">Input Source</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Camera Entity
          {loading ? (
            <div className="text-sm text-gray-500 py-1">Loading...</div>
          ) : (
            <select 
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-blue-500 nodrag"
              value={data?.entityId || ''}
              onChange={handleEntityChange}
            >
              <option value="" disabled>Select Camera</option>
              {cameras.map(cam => (
                <option key={cam.id} value={cam.id}>
                  {cam.name}
                </option>
              ))}
            </select>
          )}
        </label>
        
        {/* Preview of the selected entity's path/type */}
        {selectedCam && (
          <div className="text-[10px] text-gray-500 bg-gray-800 p-2 rounded-md break-all">
            <span className="text-blue-400 uppercase font-semibold mr-1">{selectedCam.type}:</span>
            {selectedCam.path}
          </div>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-blue-500 border-2 border-gray-900"
      />
    </div>
  );
}
