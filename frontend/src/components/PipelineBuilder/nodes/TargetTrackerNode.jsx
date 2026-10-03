import React, { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Target } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';
import TargetTrackerNodeSettings from '../settings/TargetTrackerNodeSettings';

export default function TargetTrackerNode({ id, data }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const debugData = usePipelineStore(s => s.debugData || {});
  const debugState = debugData[id] || {};

  const targetCount = data?.targetCount ?? 100;
  const liveCount = debugState?.actual ?? data?.count ?? 0;
  const progressPercent = debugState?.progress_percent ?? 0;
  const etaSeconds = debugState?.eta_seconds ?? null;
  const isComplete = debugState?.is_complete ?? false;

  const isCompact = data?.viewMode === 'compact';

  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { 
        label: 'Target Tracker', 
        targetCount: 100,
        unitName: 'items',
        edgeType: 'rising'
      });
    }
  }, [id, data?.label, updateNodeData]);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  const formatETA = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    if (seconds === Infinity) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className={`bg-gray-100 dark:bg-gray-900 border-2 ${isComplete ? 'border-amber-400' : 'border-amber-600'} rounded-xl shadow-lg shadow-amber-900/20 text-gray-900 dark:text-white flex flex-col overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-72'}`}>
      <div className="bg-amber-600/20 p-3 flex items-center justify-between border-b border-amber-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 p-1.5 rounded-lg">
            <Target size={16} className="text-gray-900 dark:text-white" />
          </div>
          <div>
            <div className="flex flex-col justify-center">
              <div className="font-semibold text-sm truncate max-w-[140px] leading-tight">{data?.label || 'Target Tracker'}</div>
              {data?.label && data.label !== 'Target Tracker' && (
                <span className="text-[10px] text-gray-900 font-mono leading-none truncate mt-0.5 dark:text-white/50">Target Tracker</span>
              )}
            </div>
            {!isCompact && (
              <div className="text-[10px] flex items-center gap-1 mt-1">
                 <span className={`w-2 h-2 rounded-full ${isComplete ? 'bg-amber-400 shadow-[0_0_5px_#fbbf24]' : 'bg-gray-500 dark:bg-gray-500'}`}></span>
                 <span className="text-amber-300/70">{isComplete ? 'Target Reached' : 'Tracking'}</span>
              </div>
            )}
          </div>
        </div>
        {!isCompact && <NodeMenu id={id} />}
      </div>

      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          {/* Progress Section */}
          <div className="flex flex-col gap-1 mb-2">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>{liveCount} / {targetCount} {data?.unitName || 'items'}</span>
              <span className="text-amber-400 font-mono">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${isComplete ? 'bg-amber-400' : 'bg-amber-600'}`} 
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              ></div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800 text-center">
              <div className="text-[10px] text-gray-500 uppercase dark:text-gray-500">Rate</div>
              <div className="text-sm font-mono text-emerald-400 font-bold">{Number(debugState?.current_rate_per_minute || 0).toFixed(1)} <span className="text-[9px]">/m</span></div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800 text-center">
              <div className="text-[10px] text-gray-500 uppercase dark:text-gray-500">ETA</div>
              <div className="text-sm font-mono text-blue-400 font-bold">{formatETA(etaSeconds)}</div>
            </div>
          </div>

          <TargetTrackerNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      {/* Input from upstream */}
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-amber-500 border-2 border-gray-100 dark:border-gray-900" />
      {/* Output downstream when reached */}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-amber-500 border-2 border-gray-100 dark:border-gray-900" />
    </div>
  );
}
