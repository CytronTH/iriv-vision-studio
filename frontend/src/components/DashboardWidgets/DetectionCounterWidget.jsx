import React, { useMemo } from 'react';
import { Focus } from 'lucide-react';

export default function DetectionCounterWidget({ metadata }) {
  
  const counts = useMemo(() => {
    if (!metadata || !metadata.detections) return {};
    const c = {};
    metadata.detections.forEach(det => {
      c[det.label] = (c[det.label] || 0) + 1;
    });
    return c;
  }, [metadata]);

  const total = useMemo(() => {
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }, [counts]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-gray-800/50 px-3 py-2 flex items-center gap-2 border-b border-gray-700 shrink-0">
        <Focus size={16} className="text-blue-400" />
        <span className="text-sm font-semibold text-gray-200">Live Detections</span>
      </div>
      <div className="flex-1 p-4 flex flex-col items-center justify-center">
        <div className="text-6xl font-bold text-white mb-2 tracking-tighter shadow-sm">
          {total}
        </div>
        <div className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">
          Total Objects
        </div>
        
        <div className="w-full space-y-2 mt-auto">
          {Object.entries(counts).map(([label, count]) => (
            <div key={label} className="flex items-center justify-between bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-800">
              <span className="text-gray-300 capitalize text-sm">{label}</span>
              <span className="text-white font-bold text-sm bg-blue-600 px-2 py-0.5 rounded-md">{count}</span>
            </div>
          ))}
          {total === 0 && (
            <div className="text-center text-gray-500 text-sm italic py-2">
              No objects detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
