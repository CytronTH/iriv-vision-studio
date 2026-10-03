import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeMenu from './NodeMenu';
import DatabaseWriterNodeSettings from '../settings/DatabaseWriterNodeSettings';

export default function DatabaseWriterNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const isCompact = data?.viewMode === 'compact';
  
  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-gray-100 dark:bg-gray-900 border-2 rounded-xl shadow-xl overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-64'} ${selected ? 'border-teal-500' : 'border-teal-500/30'}`}>
      <div className="bg-gradient-to-r from-teal-900/50 to-teal-800/50 p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-teal-400" />
          <div className="flex flex-col justify-center">
            <span className="font-semibold text-gray-800 text-sm tracking-wide truncate max-w-[120px] leading-tight dark:text-gray-200">{data?.label || 'Database Writer'}</span>
            {data?.label && data.label !== 'Database Writer' && (
              <span className="text-[10px] text-gray-900 font-mono leading-none truncate mt-0.5 dark:text-white/50">Database Writer</span>
            )}
          </div>
        </div>
        {!isCompact && <NodeMenu id={id} />}
      </div>
      
      {!isCompact && (
        <div className={`p-4 flex flex-col gap-3 ${isCompact ? 'hidden' : ''}`}>
          <DatabaseWriterNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-teal-500 border-2 border-gray-100 dark:border-gray-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-teal-500 border-2 border-gray-100 dark:border-gray-900" />
    </div>
  );
}
