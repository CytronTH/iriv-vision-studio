import React, { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PlusCircle } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function CounterNode({ id, data }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);

  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { label: 'Event Counter', edgeType: 'rising' });
    }
  }, [id, data?.label, updateNodeData]);

  const handleLabelChange = (e) => {
    updateNodeData(id, { label: e.target.value });
  };

  const handleEdgeTypeChange = (e) => {
    updateNodeData(id, { edgeType: e.target.value });
  };

  return (
    <div className="bg-gray-900 border-2 border-emerald-600 rounded-xl shadow-lg shadow-emerald-900/20 w-64 text-white flex flex-col">
      <div className="bg-emerald-600/20 p-3 flex items-center justify-between border-b border-emerald-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <PlusCircle size={16} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">Edge Counter</div>
            <div className="text-[10px] text-emerald-300/70">Count Events</div>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>

      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Node Label
          <input 
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-emerald-500 nodrag"
            value={data?.label || ''}
            onChange={handleLabelChange}
            placeholder="e.g. NG Counter"
          />
        </label>

        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Trigger Condition
          <select 
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-emerald-500 nodrag"
            value={data?.edgeType || 'rising'}
            onChange={handleEdgeTypeChange}
          >
            <option value="rising">Rising Edge (False ➔ True)</option>
            <option value="falling">Falling Edge (True ➔ False)</option>
          </select>
        </label>

        <div className="text-[10px] text-gray-500 leading-relaxed bg-gray-950 p-2 rounded border border-gray-800">
          {data?.edgeType === 'falling' 
            ? "Increments by 1 when payload changes from True to False (e.g. object leaves)." 
            : "Increments by 1 when payload changes from False to True (e.g. object enters)."}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500 border-2 border-gray-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500 border-2 border-gray-900" />
    </div>
  );
}
