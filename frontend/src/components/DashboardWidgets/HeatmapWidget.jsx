import React from 'react';
import { Map, Lock } from 'lucide-react';

export default function HeatmapWidget() {
  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl relative group">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center gap-2 border-b border-gray-700 shrink-0">
        <Map size={16} className="text-yellow-400" />
        <span className="text-sm font-semibold text-gray-200">Zone Heatmap</span>
      </div>
      
      {/* Blurred background mock */}
      <div className="flex-1 p-3 opacity-20 blur-sm pointer-events-none flex items-center justify-center">
        <div className="w-full h-full bg-gradient-to-tr from-yellow-500/20 via-red-500/30 to-purple-500/10 rounded-lg"></div>
      </div>

      {/* Unavailable Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-[2px] z-10">
        <div className="bg-gray-800/90 p-4 rounded-xl border border-gray-700 flex flex-col items-center text-center max-w-[80%]">
          <Lock size={24} className="text-gray-400 mb-2" />
          <h4 className="text-white font-bold text-sm mb-1">Advanced Analytics</h4>
          <p className="text-xs text-gray-400">Heatmaps require historical coordinate mapping. Currently unavailable.</p>
        </div>
      </div>
    </div>
  );
}
