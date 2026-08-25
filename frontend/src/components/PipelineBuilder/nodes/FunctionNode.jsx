import React, { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Code } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function FunctionNode({ id, data }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);

  useEffect(() => {
    if (data?.code === undefined) {
      updateNodeData(id, {
        code: 'def process(msg):\n    # Modify msg.payload here\n    return msg',
      });
    }
  }, [id]);

  const code = data?.code ?? 'def process(msg):\n    return msg';

  const setCode = (val) => updateNodeData(id, { code: val });

  return (
    <div className="bg-gray-900 border-2 border-emerald-600 rounded-xl shadow-lg shadow-emerald-900/20 w-80 text-white overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-600/20 p-3 flex items-center justify-between border-b border-emerald-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Code size={16} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">Function</div>
            <div className="text-[10px] text-emerald-300/70">Python Script</div>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>

      <div className="p-3 flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Code (def process)
          </label>
          <textarea
            className="nodrag bg-gray-950 border border-gray-700 rounded-lg p-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
            rows={6}
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="text-[9px] text-gray-500 italic">
          Input: msg = {"{ 'payload': ..., 'metadata': ... }"}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500 border-2 border-gray-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500 border-2 border-gray-900" />
    </div>
  );
}
