import React from 'react';
import { Target, RotateCcw } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function TargetTrackerNodeSettings({ nodeId, data, onChange, isSidebar }) {
  const debugState = usePipelineStore((state) => state.debugData?.[nodeId]);
  const liveCount = debugState?.actual ?? data?.count ?? 0;

  const handleReset = async () => {
    try {
      await fetch('/api/analytics/counts/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId })
      });
    } catch (err) {
      console.error("Failed to reset target tracker:", err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Target Count */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Target Count</label>
        <input 
          type="number"
          className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 w-full dark:text-white"
          value={data?.targetCount || 100}
          onChange={(e) => onChange({ targetCount: parseInt(e.target.value) || 1 })}
          min="1"
        />
      </div>

      {/* Unit Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Unit Name</label>
        <input 
          type="text"
          className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 w-full dark:text-white"
          value={data?.unitName || 'items'}
          onChange={(e) => onChange({ unitName: e.target.value })}
          placeholder="e.g. items, cars, boxes"
        />
      </div>
      
      {/* Trigger Condition */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Counting Mode</label>
        <select 
          className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 w-full dark:text-white"
          value={data?.edgeType || 'rising'}
          onChange={(e) => onChange({ edgeType: e.target.value })}
        >
          <option value="rising">Rising Edge (False ➔ True)</option>
          <option value="falling">Falling Edge (True ➔ False)</option>
        </select>
      </div>

      {/* Reset Controls */}
      <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-amber-400" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-400">Current:</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold font-mono text-amber-400">{liveCount}</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-gray-600 hover:text-red-400 p-1 rounded transition-colors dark:text-gray-400"
            title="Reset Tracker to 0"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
