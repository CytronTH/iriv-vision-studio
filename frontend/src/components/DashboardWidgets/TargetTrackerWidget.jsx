import React, { useState, useEffect } from 'react';
import { Target, Save, RefreshCw, Clock } from 'lucide-react';

export default function TargetTrackerWidget({ title, data, config, projectId }) {
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync internal input value with the latest target when it changes from backend (initially)
  useEffect(() => {
    if (data?.target !== undefined && inputValue === '') {
      setInputValue(data.target.toString());
    }
  }, [data?.target, inputValue]);

  const handleUpdateTarget = async () => {
    if (!config?.nodeId) {
      alert("Please configure the target node ID in Widget Settings first.");
      return;
    }
    
    const newTarget = parseInt(inputValue, 10);
    if (isNaN(newTarget) || newTarget <= 0) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/analytics/target_tracker/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId || 'default',
          node_id: config.nodeId,
          target: newTarget
        })
      });
      if (!res.ok) {
        throw new Error('Failed to set target');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating target. Make sure the pipeline is running.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!config?.nodeId) return;
    try {
      await fetch('/api/analytics/counts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId || 'default',
          node_id: config.nodeId
        })
      });
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  const formatETA = (seconds) => {
    if (seconds === null || seconds === undefined) return "Calculating...";
    if (seconds === 0) return "Done";
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m ${Math.ceil(seconds % 60)}s`;
  };

  const progress = data?.progress_percent || 0;
  const isComplete = data?.is_complete || false;
  const actual = data?.actual || 0;
  const target = data?.target || 0;
  const rate = data?.current_rate_per_minute || 0;
  const unit = config?.unit || 'items';

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gray-200/80 dark:bg-gray-100 dark:bg-gray-800/80 px-3 py-2 flex items-center justify-between border-b border-gray-300 dark:border-gray-300 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Target size={16} className={isComplete ? "text-amber-400" : "text-blue-400"} />
          <span className="text-sm font-semibold text-gray-800 truncate dark:text-gray-800 dark:text-gray-200">{title || 'Target Tracker'}</span>
        </div>
        <button 
          onClick={handleReset}
          className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 text-gray-600 hover:text-gray-900 dark:text-white transition-colors dark:text-gray-500 dark:text-gray-400 dark:text-gray-400"
          title="Reset Counts"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        
        {/* Actual vs Target Big Display */}
        <div className="flex items-end justify-between px-2">
          <div className="flex flex-col">
            <span className="text-xs text-gray-600 uppercase font-semibold tracking-wider dark:text-gray-500 dark:text-gray-400 dark:text-gray-400">Actual</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-bold tracking-tighter ${isComplete ? 'text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {actual.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wider dark:text-gray-500 dark:text-gray-400">Target</span>
            <span className="text-2xl font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">
              {target.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-4 bg-gray-200 dark:bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-300/50 dark:border-gray-200 dark:border-gray-300 dark:border-gray-700/50 shadow-inner">
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${
              isComplete ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-900 drop-shadow-md dark:text-gray-900 dark:text-white">
              {progress.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 bg-gray-200/40 dark:bg-gray-100 dark:bg-gray-800/40 p-2 rounded-lg border border-gray-200 dark:border-gray-200 dark:border-gray-800">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-600 uppercase tracking-wide dark:text-gray-500 dark:text-gray-400 dark:text-gray-400">Current Rate</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-800 dark:text-gray-200">{rate.toFixed(1)} {unit}/min</span>
          </div>
          <div className="flex flex-col items-center border-l border-gray-300/50 dark:border-gray-200 dark:border-gray-300 dark:border-gray-700/50">
            <span className="text-[10px] text-gray-600 uppercase tracking-wide dark:text-gray-500 dark:text-gray-400 dark:text-gray-400">ETA</span>
            <div className="flex items-center gap-1">
              <Clock size={12} className={isComplete ? "text-amber-400" : "text-gray-600 dark:text-gray-500 dark:text-gray-400 dark:text-gray-400"} />
              <span className={`text-sm font-semibold ${isComplete ? 'text-amber-400' : 'text-gray-800 dark:text-gray-800 dark:text-gray-200'}`}>
                {formatETA(data?.eta_seconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Target Input Section */}
        <div className="mt-auto pt-2 border-t border-gray-200/80 dark:border-gray-200 dark:border-gray-800/80">
          <label className="block text-[10px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-1.5 dark:text-gray-500 dark:text-gray-400">
            Set New Target
          </label>
          <div className="flex gap-2">
            <input 
              type="number" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 outline-none transition-colors dark:text-gray-900 dark:text-white"
              placeholder="e.g. 500"
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateTarget()}
            />
            <button 
              onClick={handleUpdateTarget}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-gray-900 dark:text-white p-1.5 rounded-lg flex items-center justify-center transition-colors shadow-md"
              title="Save Target"
            >
              <Save size={16} />
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
