import React from 'react';
import { RotateCcw, Activity, Clock, Timer, Settings2 } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function UnitThroughputNodeSettings({ nodeId, data, onChange, isSidebar }) {
  const debugState = usePipelineStore((state) => state.debugData?.[nodeId]) || {};
  const liveRate = debugState?.throughput ?? data?.throughput ?? 0;
  const liveCount = debugState?.current_unit ?? data?.current_unit ?? 0;
  const isRunning = debugState?.is_running ?? data?.is_running ?? false;

  const handleReset = async () => {
    try {
      await fetch('/api/analytics/throughput/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId })
      });
    } catch (err) {
      console.error("Failed to reset throughput counter:", err);
    }
  };

  const handleManualToggle = async () => {
    try {
      await fetch('/api/analytics/throughput/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId, state: !isRunning })
      });
    } catch (err) {
      console.error("Failed to toggle throughput state:", err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      
      {/* Settings section */}
      <div className="flex flex-col gap-3">
        {/* Start Trigger */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Start Trigger</label>
          <select 
            className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 w-full dark:text-white"
            value={data?.startTrigger || 'first_object'}
            onChange={(e) => onChange({ startTrigger: e.target.value })}
          >
            <option value="first_object">1st Object Detected</option>
            <option value="manual">Human Trigger (Manual)</option>
            <option value="time">Scheduled Time</option>
            <option value="sensor">Hardware Sensor</option>
          </select>
          
          {data?.startTrigger === 'time' && (
            <input 
              type="time" 
              className="mt-1 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:border-indigo-500 dark:text-white"
              value={data?.startTimeConfig || ''}
              onChange={(e) => onChange({ startTimeConfig: e.target.value })}
              placeholder="08:00"
            />
          )}
          {data?.startTrigger === 'sensor' && (
            <input 
              type="text" 
              className="mt-1 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:border-indigo-500 dark:text-white"
              value={data?.startSensorId || ''}
              onChange={(e) => onChange({ startSensorId: e.target.value })}
              placeholder="e.g. GPIO_4_IN"
            />
          )}
        </div>

        {/* Pause Trigger */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pause Trigger</label>
          <select 
            className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 w-full dark:text-white"
            value={data?.pauseTrigger || 'timeout'}
            onChange={(e) => onChange({ pauseTrigger: e.target.value })}
          >
            <option value="timeout">Time After Last Object (Timeout)</option>
            <option value="manual">Human Trigger (Manual)</option>
            <option value="time">Scheduled Time</option>
            <option value="sensor">Hardware Sensor</option>
          </select>
          
          {data?.pauseTrigger === 'timeout' && (
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="number" 
                min="1"
                className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:border-indigo-500 w-24 dark:text-white"
                value={data?.pauseTimeoutSeconds || 60}
                onChange={(e) => onChange({ pauseTimeoutSeconds: parseInt(e.target.value, 10) })}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">seconds</span>
            </div>
          )}
          {data?.pauseTrigger === 'time' && (
            <input 
              type="time" 
              className="mt-1 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:border-indigo-500 dark:text-white"
              value={data?.pauseTimeConfig || ''}
              onChange={(e) => onChange({ pauseTimeConfig: e.target.value })}
              placeholder="17:00"
            />
          )}
          {data?.pauseTrigger === 'sensor' && (
            <input 
              type="text" 
              className="mt-1 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:border-indigo-500 dark:text-white"
              value={data?.pauseSensorId || ''}
              onChange={(e) => onChange({ pauseSensorId: e.target.value })}
              placeholder="e.g. GPIO_5_IN"
            />
          )}
        </div>
        
        {/* Mode Selector for rate calculation */}
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rate Unit</label>
            <select 
              className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 w-full dark:text-white"
              value={data?.rateUnit || 'minute'}
              onChange={(e) => onChange({ rateUnit: e.target.value })}
            >
              <option value="second">Units / Second</option>
              <option value="minute">Units / Minute</option>
              <option value="hour">Units / Hour</option>
            </select>
        </div>
        
        {/* Decimal Places */}
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Decimal Places</label>
            <input 
              type="number"
              min="0"
              max="5"
              className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 w-full dark:text-white"
              value={data?.decimalPlaces ?? 2}
              onChange={(e) => onChange({ decimalPlaces: parseInt(e.target.value, 10) || 0 })}
            />
        </div>
      </div>

      <hr className="border-gray-200 dark:border-gray-800" />

      {/* Live Telemetry Display */}
      <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col gap-3">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-indigo-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-400">Status:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isRunning ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {isRunning ? 'RUNNING' : 'PAUSED'}
            </span>
            {(data?.startTrigger === 'manual' || data?.pauseTrigger === 'manual') && (
              <button 
                type="button"
                onClick={handleManualToggle}
                className="px-2 py-1 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-700 text-xs rounded transition-colors text-gray-900 dark:text-white"
              >
                {isRunning ? 'Pause' : 'Start'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-400">Throughput:</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-emerald-400">
              {Number(liveRate).toFixed(data?.decimalPlaces ?? 2)} <span className="text-xs text-gray-500 font-sans font-normal dark:text-gray-500">/{data?.rateUnit || 'min'}</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-blue-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-400">Total Units:</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-blue-400">{liveCount}</span>
            <button
              type="button"
              onClick={handleReset}
              className="text-gray-600 hover:text-red-400 p-1 rounded transition-colors dark:text-gray-400"
              title="Reset Counter"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
