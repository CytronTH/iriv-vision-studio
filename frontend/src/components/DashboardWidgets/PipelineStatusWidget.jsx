import React, { useState, useEffect } from 'react';
import { Server, Zap } from 'lucide-react';

export default function PipelineStatusWidget({ connected, metadata }) {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (metadata && metadata.fps) {
      setFps(metadata.fps);
    }
  }, [metadata]);

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center justify-between border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-gray-200">Pipeline Status</span>
        </div>
      </div>
      
      <div className="flex-1 p-4 flex flex-col justify-center space-y-4">
        
        <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700">
          <span className="text-sm text-gray-400">Connection</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Active' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700">
          <span className="text-sm text-gray-400">Inference Rate (FPS)</span>
          <div className="flex items-center gap-2">
            <Zap size={16} className={fps > 0 ? "text-yellow-400" : "text-gray-600"} />
            <span className="text-lg font-mono font-bold text-white w-12 text-right">
              {connected ? (fps > 0 ? fps.toFixed(1) : '~30.0') : '0.0'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
