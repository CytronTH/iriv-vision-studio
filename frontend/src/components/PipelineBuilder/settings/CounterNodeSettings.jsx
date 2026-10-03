import React from 'react';
import { RotateCcw, Activity, Database } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function CounterNodeSettings({ nodeId, data, onChange, isSidebar }) {
  const debugState = usePipelineStore((state) => state.debugData?.[nodeId]);
  const liveCount = debugState?.value ?? data?.count ?? 0;

  const handleReset = async () => {
    try {
      await fetch('/api/analytics/counts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId })
      });
    } catch (err) {
      console.error("Failed to reset counter:", err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Trigger Condition */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trigger Condition (Edge)</label>
        <select 
          className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-emerald-500 w-full dark:text-white"
          value={data?.edgeType || 'rising'}
          onChange={(e) => onChange({ edgeType: e.target.value })}
        >
          <option value="rising">Rising Edge (False ➔ True)</option>
          <option value="falling">Falling Edge (True ➔ False)</option>
        </select>
      </div>

      {/* Explanation Box */}
      <div className="text-xs text-gray-600 bg-gray-50/80 dark:bg-gray-950/80 p-3 rounded-lg border border-gray-200 dark:border-gray-800 leading-relaxed dark:text-gray-400">
        {data?.edgeType === 'falling' 
          ? "Counts +1 whenever the incoming signal changes from True to False (e.g. an object departs or condition clears)." 
          : "Counts +1 whenever the incoming signal changes from False to True (e.g. an object arrives or alarm activates)."}
      </div>

      {/* Live Counter Display */}
      <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-emerald-400" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-400">Current Count:</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold font-mono text-emerald-400">{liveCount}</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-gray-600 hover:text-red-400 p-1 rounded transition-colors dark:text-gray-400"
            title="Reset Counter to 0"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

    </div>
  );
}
