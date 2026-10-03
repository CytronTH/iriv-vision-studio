import React from 'react';
import PayloadPathSelector from './PayloadPathSelector';

export default function DashboardWidgetSettings({ nodeId, data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-600 font-bold uppercase tracking-wider dark:text-gray-400">Topic / Payload Path</label>
        <div className="relative">
          <input 
            type="text" 
            value={data?.sourcePath || ''} 
            onChange={(e) => onChange({ sourcePath: e.target.value })}
            className="bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 focus:border-blue-500 text-sm font-mono text-blue-400 rounded px-2.5 py-1.5 w-full outline-none transition-colors"
            placeholder="e.g. payload.counts.Eco"
          />
        </div>
      </div>

      <PayloadPathSelector 
        nodeId={nodeId} 
        selectedPath={data?.sourcePath} 
        onSelect={(path) => onChange({ sourcePath: path })} 
      />
    </div>
  );
}
