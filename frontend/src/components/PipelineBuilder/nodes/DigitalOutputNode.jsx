import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToggleRight } from 'lucide-react';
import NodeMenu from './NodeMenu';

export default function DigitalOutputNode({ id, data }) {
  return (
    <div className="bg-gray-900 border-2 border-orange-500 rounded-xl p-4 shadow-xl shadow-orange-900/20 w-64">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500 border-2 border-gray-900" />
      
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500/20 p-2 rounded-lg">
            <ToggleRight className="text-orange-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-200 text-sm">Digital Output</h3>
            <p className="text-xs text-orange-500 font-mono">Isolated DO (Max 50V)</p>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Target Pin</label>
          <select 
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none"
            value={data.pin || 'DO0'}
            onChange={(e) => data.onChange?.({ ...data, pin: e.target.value })}
          >
            <option value="DO0">DO0 (GPIO23)</option>
            <option value="DO1">DO1 (GPIO24)</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-400 block mb-1">Action when triggered</label>
          <select 
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none"
            value={data.action || 'on'}
            onChange={(e) => data.onChange?.({ ...data, action: e.target.value })}
          >
            <option value="on">Turn ON</option>
            <option value="off">Turn OFF</option>
          </select>
        </div>
      </div>
    </div>
  );
}
