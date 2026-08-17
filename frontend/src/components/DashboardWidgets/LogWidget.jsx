import React from 'react';
import { Terminal } from 'lucide-react';

export default function LogWidget({ metadata }) {
  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center gap-2 border-b border-gray-700 shrink-0">
        <Terminal size={16} className="text-green-400" />
        <span className="text-sm font-semibold text-gray-200">Raw AI Metadata</span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto text-xs font-mono scrollbar-thin scrollbar-thumb-gray-700">
        {metadata ? (
          <pre className="text-green-400 whitespace-pre-wrap">{JSON.stringify(metadata, null, 2)}</pre>
        ) : (
          <span className="text-gray-500 italic">Waiting for AI inference data...</span>
        )}
      </div>
    </div>
  );
}
