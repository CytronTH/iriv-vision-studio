import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeMenu from './NodeMenu';

export default function SnapshotNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  return (
    <div className={`bg-gray-900 border-2 rounded-xl shadow-xl w-64 overflow-hidden transition-colors ${selected ? 'border-pink-500' : 'border-pink-500/30'}`}>
      <div className="bg-gradient-to-r from-pink-900/50 to-pink-800/50 p-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-pink-400" />
          <span className="font-semibold text-gray-200 text-sm tracking-wide">Snapshot Node</span>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Snapshot Label</label>
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-sm text-gray-200 focus:outline-none focus:border-pink-500 transition-colors nodrag"
            value={data.label || ''}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            placeholder="e.g. Save NG Image"
          />
        </div>
        
        <div className="text-xs text-gray-500 leading-relaxed bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
          Saves a high-res frame to disk and logs it to the database when triggered by a <span className="text-blue-400 font-medium">True</span> payload.
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-pink-500 border-2 border-gray-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-pink-500 border-2 border-gray-900" />
    </div>
  );
}
