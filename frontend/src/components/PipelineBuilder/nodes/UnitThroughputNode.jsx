import React, { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Activity } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';
import UnitThroughputNodeSettings from '../settings/UnitThroughputNodeSettings';

export default function UnitThroughputNode({ id, data }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const debugData = usePipelineStore(s => s.debugData || {});
  const debugState = debugData[id] || {};
  
  const liveRate = debugState?.throughput ?? data?.throughput ?? 0;
  const liveCount = debugState?.current_unit ?? data?.current_unit ?? 0;
  const isRunning = debugState?.is_running ?? data?.is_running ?? false;
  
  const isCompact = data?.viewMode === 'compact';

  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { 
        label: 'Unit Throughput',
        startTrigger: 'first_object',
        pauseTrigger: 'timeout',
        pauseTimeoutSeconds: 60,
        rateUnit: 'minute'
      });
    }
  }, [id, data?.label, updateNodeData]);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-gray-100 dark:bg-gray-900 border-2 border-indigo-600 rounded-xl shadow-lg shadow-indigo-900/20 text-gray-900 dark:text-white flex flex-col overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-72'}`}>
      <div className="bg-indigo-600/20 p-3 flex items-center justify-between border-b border-indigo-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Activity size={16} className="text-gray-900 dark:text-white" />
          </div>
          <div>
            <div className="flex flex-col justify-center">
              <div className="font-semibold text-sm truncate max-w-[140px] leading-tight">{data?.label || 'Unit Throughput'}</div>
              {data?.label && data.label !== 'Unit Throughput' && (
                <span className="text-[10px] text-gray-900 font-mono leading-none truncate mt-0.5 dark:text-white/50">Unit Throughput</span>
              )}
            </div>
            {!isCompact && (
              <div className="text-[10px] flex items-center gap-1 mt-1">
                 <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-gray-500 dark:bg-gray-500'}`}></span>
                 <span className="text-indigo-300/70">{isRunning ? 'Running' : 'Paused'}</span>
              </div>
            )}
          </div>
        </div>
        {!isCompact && <NodeMenu id={id} />}
      </div>

      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          {/* Quick Stats on the Node itself */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800 text-center">
              <div className="text-[10px] text-gray-500 uppercase dark:text-gray-500">Rate</div>
              <div className="text-sm font-mono text-emerald-400 font-bold">{Number(liveRate).toFixed(1)} <span className="text-[9px]">/{data?.rateUnit?.substring(0,1) || 'm'}</span></div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800 text-center">
              <div className="text-[10px] text-gray-500 uppercase dark:text-gray-500">Units</div>
              <div className="text-sm font-mono text-blue-400 font-bold">{liveCount}</div>
            </div>
          </div>

          <UnitThroughputNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      {/* Input from AI Model / upstream */}
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-gray-100 dark:border-gray-900" />
      {/* Output downstream if needed */}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-gray-100 dark:border-gray-900" />
    </div>
  );
}
