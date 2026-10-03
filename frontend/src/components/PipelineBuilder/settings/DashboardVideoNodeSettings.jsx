import React from 'react';

export default function DashboardVideoNodeSettings({ nodeId, data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-600 font-bold uppercase tracking-wider dark:text-gray-400">Data Path (Stream ID)</label>
        <div className="relative">
          <input 
            type="text" 
            value={data?.dataPath || ''} 
            onChange={(e) => onChange({ dataPath: e.target.value })}
            className="bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 focus:border-pink-500 text-sm font-mono text-pink-400 rounded px-2.5 py-1.5 w-full outline-none transition-colors"
            placeholder="e.g. cam_1_video"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 dark:text-gray-500">Identifier for this video stream. Used when binding data in the Dashboard.</p>
      </div>
    </div>
  );
}
