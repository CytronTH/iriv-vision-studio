import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { HardDrive } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeMenu from './NodeMenu';
import CollectionWriterSettings from '../settings/CollectionWriterSettings';

export default function CollectionWriterNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const isCompact = data?.viewMode === 'compact';
  
  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-gray-50 dark:bg-slate-900 border-2 rounded-xl shadow-xl overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-72'} ${selected ? 'border-indigo-500' : 'border-indigo-500/30'}`}>
      <div className="bg-gradient-to-r from-indigo-900/50 to-indigo-800/50 p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-indigo-400" />
          <div className="flex flex-col justify-center">
            <span className="font-semibold text-slate-200 text-sm tracking-wide truncate max-w-[120px] leading-tight">{data?.label || 'Collection Writer'}</span>
            {data?.label && data.label !== 'Collection Writer' && (
              <span className="text-[10px] text-gray-900 font-mono leading-none truncate mt-0.5 dark:text-white/50">Collection Writer</span>
            )}
          </div>
        </div>
        {!isCompact && <NodeMenu id={id} />}
      </div>
      
      {!isCompact && (
        <div className={`p-4 flex flex-col gap-3 ${isCompact ? 'hidden' : ''}`}>
          <CollectionWriterSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900" />
    </div>
  );
}
