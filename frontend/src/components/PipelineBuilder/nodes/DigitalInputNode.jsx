import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToggleLeft } from 'lucide-react';
import NodeMenu from './NodeMenu';

export default function DigitalInputNode({ id, data }) {
  return (
    <div className="bg-gray-900 border-2 border-cyan-500 rounded-xl p-4 shadow-xl shadow-cyan-900/20 w-64">
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/20 p-2 rounded-lg">
            <ToggleLeft className="text-cyan-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-200 text-sm">Digital Input</h3>
            <p className="text-xs text-cyan-500 font-mono">Isolated DI (Max 50V)</p>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Target Pin</label>
          <select 
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none"
            value={data.pin || 'DI0'}
            onChange={(e) => data.onChange?.({ ...data, pin: e.target.value })}
          >
            <option value="DI0">DI0 (GPIO22)</option>
            <option value="DI1">DI1 (GPIO27)</option>
            <option value="USER_BTN">User Button (GPIO4)</option>
          </select>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-cyan-500 border-2 border-gray-900" />
    </div>
  );
}
