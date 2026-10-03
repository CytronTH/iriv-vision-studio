import React from 'react';

export default function SnapshotNodeSettings({ data, onChange }) {
  const zeroLatency = data?.zeroLatency ?? false;
  const drawBbox = data?.drawBbox ?? true;
  const triggerEdge = data?.triggerEdge || 'rising';
  const syncDelay = data?.syncDelay ?? 250;

  return (
    <div className="flex flex-col gap-5">
      
      {/* Trigger Edge Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Trigger Edge</label>
        <p className="text-[10px] text-gray-500 leading-relaxed mb-1 dark:text-gray-500">
          Choose when the snapshot should be taken relative to the incoming condition.
        </p>
        <div className="flex bg-gray-50 dark:bg-gray-950 p-1 rounded-lg border border-gray-200 dark:border-gray-800">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${triggerEdge === 'rising' ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 shadow-sm' : 'text-gray-600 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800 border border-transparent dark:text-gray-400 dark:hover:text-gray-700 dark:text-gray-300'}`}
            onClick={() => onChange({ triggerEdge: 'rising' })}
          >
            Rising Edge (False → True)
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${triggerEdge === 'falling' ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 shadow-sm' : 'text-gray-600 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800 border border-transparent dark:text-gray-400 dark:hover:text-gray-700 dark:text-gray-300'}`}
            onClick={() => onChange({ triggerEdge: 'falling' })}
          >
            Falling Edge (True → False)
          </button>
        </div>
      </div>
      
      {/* Zero Latency Toggle */}
      <div className="flex items-start justify-between bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="pr-4">
          <label className="text-sm font-medium text-gray-800 block mb-1 dark:text-gray-200">Zero Latency Mode</label>
          <p className="text-[10px] text-gray-500 leading-relaxed dark:text-gray-500">
            Continuously buffers frames in memory to eliminate RTSP connection delay when triggered. 
            Improves accuracy but consumes slightly more memory per snapshot node.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={zeroLatency}
            onChange={(e) => onChange({ zeroLatency: e.target.checked })}
          />
          <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:border-gray-700 dark:after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
        </label>
      </div>

      {/* RTSP Sync Delay Slider */}
      {zeroLatency && (
        <div className="flex flex-col gap-1.5 bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Video Sync Delay (ms)</label>
          <p className="text-[10px] text-gray-500 leading-relaxed mb-2 dark:text-gray-500">
            Fine-tune the capture timing. Negative values (-ms) will act as a Time Machine, pulling an older frame from memory so the object hasn't crossed the line yet.
          </p>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="-500" 
              max="500" 
              step="10"
              value={syncDelay}
              onChange={(e) => onChange({ syncDelay: parseInt(e.target.value, 10) })}
              className="flex-1 accent-pink-600 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-pink-400 w-14 text-right">{syncDelay > 0 ? `+${syncDelay}` : syncDelay}ms</span>
          </div>
        </div>
      )}

      {/* Draw Bbox Toggle */}
      <div className="flex items-start justify-between bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="pr-4">
          <label className="text-sm font-medium text-gray-800 block mb-1 dark:text-gray-200">Draw Bounding Boxes</label>
          <p className="text-[10px] text-gray-500 leading-relaxed dark:text-gray-500">
            Overlays detection bounding boxes on the saved snapshot image if detection data is available in the message payload.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={drawBbox}
            onChange={(e) => onChange({ drawBbox: e.target.checked })}
          />
          <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:border-gray-700 dark:after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
        </label>
      </div>

    </div>
  );
}
