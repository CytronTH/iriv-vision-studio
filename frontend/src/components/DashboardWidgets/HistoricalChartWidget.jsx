import React from 'react';
import { BarChart3, Lock } from 'lucide-react';

export default function HistoricalChartWidget() {
  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl relative group">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center gap-2 border-b border-gray-700 shrink-0">
        <BarChart3 size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-gray-200">Historical Activity</span>
      </div>
      
      {/* Blurred background mock */}
      <div className="flex-1 p-4 opacity-20 blur-sm pointer-events-none flex items-end gap-2 justify-between">
        {[40, 70, 45, 90, 65, 30, 85].map((h, i) => (
          <div key={i} className="w-full bg-purple-500 rounded-t-sm" style={{ height: `${h}%` }}></div>
        ))}
      </div>

      {/* Unavailable Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-[2px] z-10">
        <div className="bg-gray-800/90 p-4 rounded-xl border border-gray-700 flex flex-col items-center text-center max-w-[80%]">
          <Lock size={24} className="text-gray-400 mb-2" />
          <h4 className="text-white font-bold text-sm mb-1">Database Required</h4>
          <p className="text-xs text-gray-400">Historical charts require a Time-Series Database. Currently unavailable.</p>
        </div>
      </div>
    </div>
  );
}
