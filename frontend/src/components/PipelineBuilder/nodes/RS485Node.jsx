import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings2 } from 'lucide-react';
import NodeMenu from './NodeMenu';

export default function RS485Node({ id, data }) {
  return (
    <div className="bg-gray-900 border-2 border-indigo-500 rounded-xl p-4 shadow-xl shadow-indigo-900/20 w-64">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-gray-900" />
      
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-lg">
            <Settings2 className="text-indigo-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-200 text-sm">RS485 Modbus</h3>
            <p className="text-xs text-indigo-500 font-mono">/dev/ttyACM0</p>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Payload Format</label>
          <select 
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none"
            value={data.hex_mode ? 'hex' : 'text'}
            onChange={(e) => data.onChange?.({ ...data, hex_mode: e.target.value === 'hex' })}
          >
            <option value="text">Plain Text (ASCII)</option>
            <option value="hex">HEX Code</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-400 block mb-1">Data to send</label>
          <input 
            type="text"
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none font-mono"
            placeholder={data.hex_mode ? "01 05 00 01 FF 00 DD FA" : "Trigger=1"}
            value={data.payload || ''}
            onChange={(e) => data.onChange?.({ ...data, payload: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-gray-800 text-[10px] text-gray-500">
        Triggers when <code className="text-indigo-400 bg-gray-950 px-1 py-0.5 rounded">msg.payload == True</code>
      </div>
    </div>
  );
}
