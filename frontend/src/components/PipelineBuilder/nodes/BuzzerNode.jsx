import usePipelineStore from "../../../store/usePipelineStore";
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BellRing } from 'lucide-react';
import NodeMenu from './NodeMenu';

export default function BuzzerNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  return (
    <div className="bg-gray-900 border-2 border-red-500 rounded-xl p-4 shadow-xl shadow-red-900/20 w-64">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-red-500 border-2 border-gray-900" />
      
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-lg">
            <BellRing className="text-red-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-200 text-sm">Active Buzzer</h3>
            <p className="text-xs text-red-500 font-mono">GPIO19 Onboard</p>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Duration (seconds)</label>
          <input 
            type="number"
            step="0.1"
            min="0.1"
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none"
            value={data.duration ?? 1.0}
            onChange={(e) => data.onChange?.({ ...data, duration: Number(e.target.value) })}
          />
        
        <div>
          <label className="text-xs text-gray-400 block mb-1">Trigger On (Payload)</label>
          <select 
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none nodrag"
            value={data.triggerOn !== undefined ? String(data.triggerOn) : "true"}
            onChange={(e) => data.onChange ? data.onChange({ ...data, triggerOn: e.target.value === 'true' }) : updateNodeData(id, { triggerOn: e.target.value === 'true' })}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
</div>
      </div>
      <div className="mt-3 pt-2 border-t border-gray-800 text-[10px] text-gray-500">
        Triggers when <code className="text-red-400 bg-gray-950 px-1 py-0.5 rounded">payload == {data?.triggerOn !== false ? "True" : "False"}</code>
      </div>
    </div>
  );
}
