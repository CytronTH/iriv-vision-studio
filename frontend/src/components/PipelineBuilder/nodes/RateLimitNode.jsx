import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Timer } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function RateLimitNode({ id, data, isConnectable }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleRateChange = (e) => {
    updateNodeData(id, { rate: parseFloat(e.target.value) || 1 });
  };

  const handlePeriodChange = (e) => {
    updateNodeData(id, { period: e.target.value });
  };

  return (
    <div className="bg-gray-900 border-2 border-teal-600 rounded-xl shadow-lg shadow-teal-900/20 w-56 text-white overflow-hidden">
      <div className="bg-teal-600/20 p-2 flex items-center justify-between border-b border-teal-900/50">
        <div className="flex items-center gap-2">
          <div className="bg-teal-600 p-1 rounded-lg">
            <Timer size={14} className="text-white" />
          </div>
          <div className="font-semibold text-xs uppercase tracking-wider text-teal-100">Rate Limit</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-3 flex flex-col gap-3">
        <div className="text-[10px] text-gray-400">
          Limits the rate of messages passing through. Excess messages are dropped.
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300">Allow</span>
          <input 
            type="number"
            min="0.1"
            step="0.1"
            className="bg-gray-800 border border-gray-700 rounded-md p-1 text-sm focus:outline-none focus:border-teal-500 nodrag w-16 text-center"
            value={data?.rate || 1}
            onChange={handleRateChange}
          />
          <span className="text-xs text-gray-300">msg(s) per</span>
          <select
            className="bg-gray-800 border border-gray-700 rounded-md p-1 text-xs focus:outline-none focus:border-teal-500 nodrag flex-1"
            value={data?.period || 'second'}
            onChange={handlePeriodChange}
          >
            <option value="second">Second</option>
            <option value="minute">Minute</option>
            <option value="hour">Hour</option>
          </select>
        </div>
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable}
        className="w-3 h-3 bg-teal-500 border-2 border-gray-900"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={isConnectable}
        className="w-3 h-3 bg-teal-500 border-2 border-gray-900"
      />
    </div>
  );
}
