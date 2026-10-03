import React from 'react';

export default function RadialDonutWidget({ title, value, unit, config = {} }) {
  const max = config.max || 100;
  let numValue = parseFloat(value) || 0;
  let percentageRaw = Math.min((numValue / max) * 100, 100);
  
  let decimals = 0;
  if (config.decimals !== undefined && config.decimals !== '') {
      decimals = parseInt(config.decimals, 10);
  }
  const percentage = percentageRaw.toFixed(decimals);
  
  const color = config.color || '#a855f7'; // Default to purple to match mockup

  return (
    <div className="flex flex-col h-full w-full rounded-xl overflow-hidden p-4 bg-[#111520] border border-gray-700/50 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] transition-colors duration-300 relative items-center justify-center" style={{ containerType: 'inline-size' }}>
      {title && <div className="absolute top-4 left-4 text-xs font-semibold text-purple-400 uppercase tracking-widest opacity-80">{title}</div>}
      
      <div className="relative w-[65cqw] h-[65cqw] max-w-[200px] max-h-[200px] flex items-center justify-center mt-4">
        {/* Outer segmented ring (fake it with a dashed border) */}
        <div className="absolute inset-[-10%] rounded-full border-[3px] border-[#222b40] border-dashed opacity-70"></div>
        <div className="absolute inset-[-3%] rounded-full border border-[#2a3650]"></div>
        
        {/* Glow backdrop */}
        <div className="absolute inset-[5%] rounded-full" style={{ boxShadow: `0 0 30px ${color}50` }}></div>
        
        {/* Main Donut - Using CSS Masking */}
        <div 
          className="absolute inset-0 rounded-full transition-all duration-500"
          style={{
            background: `conic-gradient(${color} ${percentageRaw}%, transparent 0)`,
            maskImage: 'radial-gradient(transparent 58%, black 59%)',
            WebkitMaskImage: 'radial-gradient(transparent 58%, black 59%)',
            filter: `drop-shadow(0 0 6px ${color})`
          }}
        ></div>
        
        {/* Track inner base */}
        <div 
          className="absolute inset-0 rounded-full bg-white/5 pointer-events-none" 
          style={{ 
            maskImage: 'radial-gradient(transparent 58%, black 59%)', 
            WebkitMaskImage: 'radial-gradient(transparent 58%, black 59%)'
          }}>
        </div>

        {/* Center Text */}
        <div className="z-10 flex flex-col items-center mt-1">
          <span 
            className="font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] tracking-tighter" 
            style={{ fontSize: `clamp(1rem, ${percentage.length > 3 ? '12cqw' : '16cqw'}, 3rem)` }}
          >
             {percentage}<span className="text-[0.6em] text-purple-400 ml-0.5">%</span>
          </span>
          {unit && <span className="text-gray-500 tracking-widest mt-1 uppercase" style={{ fontSize: 'clamp(0.5rem, 5cqw, 0.75rem)' }}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}
