import React from 'react';

export default function TrafficLightWidget({ title, value, config = {} }) {
  let status = 'error'; 
  if (typeof value === 'boolean') status = value ? 'ok' : 'error';
  else if (typeof value === 'number') {
    if (value === 0) status = 'error';
    else if (value === 1) status = 'warning';
    else if (value >= 2) status = 'ok';
  } else if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (['ok', 'good', 'true', 'on', 'active'].includes(v)) status = 'ok';
    else if (['warn', 'warning', 'yellow'].includes(v)) status = 'warning';
    else status = 'error';
  }

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden p-4 bg-[#111520] border border-gray-700/50 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] transition-colors duration-300 relative items-center justify-center">
      {title && <div className="absolute top-4 left-4 text-xs font-semibold text-gray-400 uppercase tracking-widest opacity-80">{title}</div>}
      
      <div className="flex gap-6 items-center mt-4 w-full justify-center">
          <div className="flex flex-col gap-2 bg-gradient-to-b from-[#1a2235] to-[#0b0e14] p-3 rounded-[30px] border border-gray-700/50 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_0_15px_rgba(0,0,0,0.8)] relative">
            {/* Glass reflection */}
            <div className="absolute top-2 left-2 bottom-2 w-1.5 bg-white/5 rounded-full blur-[1px]"></div>

            <div className={`w-10 h-10 rounded-full border-2 transition-all duration-300 relative ${status === 'error' ? 'bg-red-500 border-red-300 shadow-[0_0_30px_#ef4444,inset_0_0_10px_#fff] opacity-100 z-10' : 'bg-[#111] border-[#222] shadow-[inset_0_2px_5px_#000] opacity-50'}`}></div>
            <div className={`w-10 h-10 rounded-full border-2 transition-all duration-300 relative ${status === 'warning' ? 'bg-yellow-400 border-yellow-200 shadow-[0_0_30px_#facc15,inset_0_0_10px_#fff] opacity-100 z-10' : 'bg-[#111] border-[#222] shadow-[inset_0_2px_5px_#000] opacity-50'}`}></div>
            <div className={`w-10 h-10 rounded-full border-2 transition-all duration-300 relative ${status === 'ok' ? 'bg-green-500 border-green-300 shadow-[0_0_30px_#22c55e,inset_0_0_10px_#fff] opacity-100 z-10' : 'bg-[#111] border-[#222] shadow-[inset_0_2px_5px_#000] opacity-50'}`}></div>
          </div>
          
          <div className="flex flex-col">
            <span className={`text-xl font-black tracking-wider ${status === 'error' ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : status === 'warning' ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`}>
               {status === 'error' ? 'FAULT' : status === 'warning' ? 'WARN' : 'SYSTEM OK'}
            </span>
            <span className="text-xs text-gray-500 tracking-widest mt-1 uppercase">Status</span>
          </div>
      </div>
    </div>
  );
}
