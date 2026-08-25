import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera, Film } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function InputNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setCameras(json.cameras || []);
        setLoading(false);
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
  const isFileSource = selectedCam?.type === 'file';

  return (
    <div className="bg-gray-900 border-2 border-blue-600 rounded-xl shadow-lg shadow-blue-900/20 w-64 text-white overflow-hidden">
      <div className="bg-blue-600/20 p-3 flex items-center justify-between border-b border-blue-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            {isFileSource ? <Film size={16} className="text-white" /> : <Camera size={16} className="text-white" />}
          </div>
          <div className="font-semibold text-sm">Input Source</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          {isFileSource ? 'Video File' : 'Camera Entity'}
          {loading ? (
            <div className="text-sm text-gray-500 py-1">Loading...</div>
          ) : (
            <select 
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-blue-500 nodrag"
              value={data?.entityId || ''}
              onChange={handleEntityChange}
            >
              <option value="" disabled>Select Source</option>
              {cameras.filter(c => c.type !== 'file').length > 0 && (
                <optgroup label="── Cameras ──">
                  {cameras.filter(c => c.type !== 'file').map(cam => (
                    <option key={cam.id} value={cam.id}>{cam.name}</option>
                  ))}
                </optgroup>
              )}
              {cameras.filter(c => c.type === 'file').length > 0 && (
                <optgroup label="── Video Files ──">
                  {cameras.filter(c => c.type === 'file').map(cam => (
                    <option key={cam.id} value={cam.id}>📁 {cam.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </label>
        
        {/* Preview */}
        {selectedCam && (
          <div className="text-[10px] text-gray-500 bg-gray-800 p-2 rounded-md break-all">
            <span className="text-blue-400 uppercase font-semibold mr-1">{selectedCam.type}:</span>
            <span className="truncate">{selectedCam.path?.split('/').pop() || selectedCam.path}</span>
          </div>
        )}

        {/* File-only options */}
        {isFileSource && (
          <div className="border border-gray-700/50 rounded-lg p-2 bg-gray-800/30 flex flex-col gap-2">
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Playback Options</div>

            <label className="text-xs text-gray-400 flex items-center justify-between">
              <span>Loop (repeat)</span>
              <input
                type="checkbox"
                className="nodrag w-4 h-4 accent-blue-500 cursor-pointer"
                checked={data?.loop ?? true}
                onChange={(e) => updateNodeData(id, { loop: e.target.checked })}
              />
            </label>

            <label className="text-xs text-gray-400 flex items-center justify-between">
              <span>Speed</span>
              <select
                className="bg-gray-900 border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none nodrag"
                value={data?.speed ?? '1.0'}
                onChange={(e) => updateNodeData(id, { speed: e.target.value })}
              >
                <option value="0.5">0.5x (Slow)</option>
                <option value="1.0">1x (Normal)</option>
                <option value="2.0">2x (Fast)</option>
                <option value="4.0">4x (Ultra Fast)</option>
              </select>
            </label>
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
