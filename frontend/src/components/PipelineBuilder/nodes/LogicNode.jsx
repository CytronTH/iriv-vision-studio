import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Filter } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function LogicNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleConditionChange = (e) => {
    updateNodeData(id, { condition: e.target.value });
  };

  const handleValueChange = (e) => {
    updateNodeData(id, { value: e.target.value });
  };

  return (
    <div className="bg-gray-900 border-2 border-orange-600 rounded-xl shadow-lg shadow-orange-900/20 w-64 text-white overflow-hidden">
      <div className="bg-orange-600/20 p-3 flex items-center justify-between border-b border-orange-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 p-1.5 rounded-lg">
            <Filter size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">Logic Filter</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Condition
          <select 
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-orange-500 nodrag"
            value={data?.condition || 'confidence_gt'}
            onChange={handleConditionChange}
          >
            <option value="confidence_gt">Confidence &gt;</option>
            <option value="object_count_gt">Object Count &gt;</option>
            <option value="label_equals">Label Equals</option>
          </select>
        </label>
        
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Value
          <input 
            type="text" 
            placeholder="0.5" 
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-orange-500 nodrag"
            value={data?.value || ''}
            onChange={handleValueChange}
          />
        </label>
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-orange-500 border-2 border-gray-900"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-orange-500 border-2 border-gray-900"
      />
    </div>
  );
}
