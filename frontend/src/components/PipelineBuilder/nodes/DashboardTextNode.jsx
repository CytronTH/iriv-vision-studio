import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlignLeft } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function DashboardTextNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleLabelChange = (e) => {
    updateNodeData(id, { label: e.target.value });
  };

  const handleSourceChange = (e) => {
    updateNodeData(id, { sourcePath: e.target.value });
  };

  return (
    <div className="bg-gray-900 border-2 border-pink-600 rounded-xl shadow-lg shadow-pink-900/20 w-64 text-white overflow-hidden">
      <div className="bg-pink-600/20 p-3 flex items-center justify-between border-b border-pink-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-pink-600 p-1.5 rounded-lg">
            <AlignLeft size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">Dashboard Text/Log</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Output Label (For Dashboard)
          <input 
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag"
            value={data?.label || ''}
            onChange={handleLabelChange}
            placeholder="e.g. Alert Messages"
          />
        </label>
        
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Data to Output
          <select
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag"
            value={data?.sourcePath || ''}
            onChange={handleSourceChange}
          >
            <option value="" disabled>Select internal data...</option>
            <option value="alerts">System Alerts (Feed)</option>
          </select>
        </label>

        <div className="text-[10px] text-gray-500 mt-1">
          Provides text or log data to Text Feed widgets.
        </div>
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-pink-500 border-2 border-gray-900"
      />
    </div>
  );
}
