import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lightbulb } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function LEDNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handlePinChange = (e) => {
    updateNodeData(id, { pin: e.target.value });
  };

  const handleBrightnessChange = (e) => {
    updateNodeData(id, { brightness: Number(e.target.value) });
  };

  return (
    <div className="bg-gray-900 border-2 border-yellow-500 rounded-xl p-4 shadow-xl shadow-yellow-900/20 w-64">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-yellow-500 border-2 border-gray-900" />
      
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500/20 p-2 rounded-lg">
            <Lightbulb className="text-yellow-400" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-200 text-sm">LED Driver</h3>
            <p className="text-xs text-yellow-500 font-mono">PWM Output (Max 2A)</p>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Target Pin</label>
          <select 
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none nodrag"
            value={data.pin || 'L0'}
            onChange={handlePinChange}
          >
            <option value="L0">L0 (GPIO12)</option>
            <option value="L1">L1 (GPIO13)</option>
            <option value="LED0">User LED 0 (GPIO20)</option>
            <option value="LED1">User LED 1 (GPIO21)</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-400 block mb-1">Brightness (%)</label>
          <input 
            type="number"
            min="0"
            max="100"
            className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-200 outline-none nodrag"
            value={data.brightness ?? 100}
            onChange={handleBrightnessChange}
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
        Triggers when <code className="text-yellow-400 bg-gray-950 px-1 py-0.5 rounded">payload == {data?.triggerOn !== false ? "True" : "False"}</code>
      </div>
    </div>
  );
}
