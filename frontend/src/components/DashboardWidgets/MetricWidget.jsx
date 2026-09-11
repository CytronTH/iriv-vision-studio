import React from 'react';
import { Activity } from 'lucide-react';

export default function MetricWidget({ title, value, unit, icon: Icon = Activity }) {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={20} className="text-blue-400" />
        <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {value !== undefined && value !== null ? (
          typeof value === 'boolean' ? (
            <div className="text-5xl font-black tracking-tighter">
              <span className={value ? 'text-green-500' : 'text-red-500'}>{value ? 'TRUE' : 'FALSE'}</span>
              {unit && <span className="text-xl text-gray-500 ml-1">{unit}</span>}
            </div>
          ) : isObject ? (
            <div className="flex flex-col gap-1.5 w-full max-h-full overflow-y-auto px-1 py-1">
              {Object.entries(value).length > 0 ? (
                Object.entries(value).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-gray-800/70 border border-gray-700/50 text-xs">
                    <span className="text-gray-300 font-medium truncate max-w-[120px]" title={k}>{k}</span>
                    <span className="text-blue-400 font-mono font-bold text-sm">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))
              ) : (
                <span className="text-gray-500 text-xs italic text-center">Empty Object</span>
              )}
            </div>
          ) : (
            <div className="text-5xl font-black tracking-tighter">
              <span className="text-white">{String(value)}</span>
              {unit && <span className="text-xl text-gray-500 ml-1">{unit}</span>}
            </div>
          )
        ) : (
          <div className="text-5xl font-black tracking-tighter">
            <span className="text-gray-600">--</span>
            {unit && <span className="text-xl text-gray-500 ml-1">{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
