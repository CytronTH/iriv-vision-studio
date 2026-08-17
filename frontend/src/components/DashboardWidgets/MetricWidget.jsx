import React from 'react';
import { Activity } from 'lucide-react';

export default function MetricWidget({ title, value, unit, icon: Icon = Activity }) {
  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={20} className="text-blue-400" />
        <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-5xl font-black text-white tracking-tighter">
          {value !== undefined && value !== null ? value : '--'}
          {unit && <span className="text-xl text-gray-500 ml-1">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
