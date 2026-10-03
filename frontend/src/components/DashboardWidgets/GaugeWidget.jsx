import React from 'react';
import { useTheme, getAdaptiveColor } from '../../utils/theme';
import { Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye, BarChart2 } from 'lucide-react';

const ICON_MAP = {
  Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye, BarChart2
};

export default function GaugeWidget({ title, value, unit, config = {} }) {
  const isDark = useTheme();
  
  const max = config.max !== undefined && config.max !== '' ? parseFloat(config.max) : 100;
  const min = config.min !== undefined && config.min !== '' ? parseFloat(config.min) : 0;
  
  const valScale = config.valueFontSize || 1;
  const unitScale = config.unitFontSize || 1;
  
  // Treat thickness as a percentage of the width (default 16%)
  const thickness = config.thickness || 16;
  
  let numValue = 0;
  if (value !== undefined && value !== null) {
      numValue = parseFloat(value) || 0;
  }
  let displayValue = numValue.toString();
  if (config.decimals !== undefined && config.decimals !== '') {
      displayValue = numValue.toFixed(parseInt(config.decimals, 10));
  }
  
  const range = max - min;
  const percentage = range === 0 ? 0 : Math.min(Math.max((numValue - min) / range, 0), 1);
  const sortedStops = config.enableDynamicColors ? [...(config.colorStops || [])].sort((a, b) => a.limit - b.limit) : [];

  let isAlert = false;
  if (!isNaN(numValue)) {
    if (config.enableUpperLimit && config.threshold !== undefined && config.threshold !== '') {
      const thresholdNum = parseFloat(config.threshold);
      if (!isNaN(thresholdNum)) {
        const condition = config.thresholdCondition || '>';
        if (condition === '>') {
          if (numValue > thresholdNum) isAlert = true;
        } else if (condition === '<') {
          if (numValue < thresholdNum) isAlert = true;
        } else if (condition === '==') {
          if (numValue === thresholdNum) isAlert = true;
        }
      }
    }
    if (config.enableLowerLimit && config.thresholdMin !== undefined && config.thresholdMin !== '') {
      const thresholdMinNum = parseFloat(config.thresholdMin);
      if (!isNaN(thresholdMinNum) && numValue < thresholdMinNum) {
        isAlert = true;
      }
    }
  }
  
  const getActiveColor = (valPercent, stops) => {
    if (!stops || stops.length === 0) return config.color || '#00f2fe';
    for (let stop of stops) {
      if (valPercent * 100 <= parseFloat(stop.limit)) {
        return stop.color;
      }
    }
    return stops[stops.length - 1].color;
  };

  const activeColor = getActiveColor(percentage, sortedStops);
  
  const displayColor = activeColor;
  const SelectedIcon = config.iconName ? ICON_MAP[config.iconName] : null;
  
  if (config.gaugeStyle === 'horseshoe') {
    const C = 2 * Math.PI * 40; // 251.327
    const arcLength = C * 0.75; // 188.495
    
    let segments = [];
    if (config.colorMode === 'solid' || sortedStops.length === 0) {
      segments = [{ color: activeColor, length: arcLength, rotation: 135 }];
    } else {
      let previousLimit = 0;
      segments = sortedStops.map((stop) => {
        const limit = Math.min(Math.max(parseFloat(stop.limit), 0), 100);
        const fraction = Math.max(limit - previousLimit, 0) / 100;
        const length = fraction * arcLength;
        const rotation = 135 + (previousLimit / 100) * 270;
        previousLimit = limit;
        return { color: stop.color, length, rotation };
      });
    }
    
    // Needle rotation: 0% -> -135deg, 100% -> +135deg
    const needleRotation = percentage * 270 - 135;
    
    return (
      <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden p-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] transition-colors duration-300 relative items-center justify-center ${isAlert ? 'bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-gray-900 border border-gray-800'}`} style={{ containerType: 'size' }}>
        {title && (
          <div className="absolute top-4 left-4 flex items-center gap-2 text-gray-400 opacity-80 z-10">
            {SelectedIcon && <SelectedIcon size={14} />}
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontSize: `calc(0.75rem * ${unitScale})` }}>{title}</span>
          </div>
        )}
        <div className="relative flex-1 w-full min-h-0 flex items-center justify-center mt-4">
          <div 
            className="relative flex items-center justify-center shrink-0 w-full h-full max-w-[100cqh] max-h-[100cqw]"
            style={{ width: 'min(100cqw, 100cqh - 10px)', height: 'min(100cqw, 100cqh - 10px)' }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-md">
              {/* Background track (useful if parts of the segments are empty) */}
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1f2937" strokeWidth="14" strokeDasharray={`${arcLength} ${C}`} transform="rotate(135 50 50)" />
              
              {/* Segments */}
              {segments.map((seg, i) => (
                <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${seg.length + 0.5} ${C}`} transform={`rotate(${seg.rotation} 50 50)`} />
              ))}
              
              {/* Needle */}
              <g 
                style={{
                  transform: `rotate(${needleRotation}deg)`,
                  transformOrigin: '50px 50px',
                  transition: 'transform 0.5s ease-out'
                }}
              >
                <circle cx="50" cy="50" r="4" fill="#334155" />
                <circle cx="50" cy="50" r="2" fill="#94a3b8" />
                <polygon points="48,50 52,50 50,15" fill={config.colorMode === 'solid' ? activeColor : "#475569"} className="transition-colors duration-300" />
              </g>
            </svg>
            
            <div className="absolute top-[60%] flex flex-col items-center justify-center pointer-events-none">
              <span className="font-black drop-shadow-md tracking-tighter transition-colors duration-300 leading-none" style={{ color: displayColor, fontSize: `calc(clamp(1.2rem, ${displayValue.length > 4 ? '10cqw' : '15cqw'}, 3.5rem) * ${valScale})` }}>
                {displayValue}
              </span>
              {unit && <span className="text-gray-400 font-medium mt-1 uppercase tracking-widest leading-none" style={{ fontSize: `calc(clamp(0.5rem, 4cqw, 0.875rem) * ${unitScale})` }}>{unit}</span>}
            </div>
            {config.enableDisplayScale !== false && (
              <>
                <div className="absolute bottom-[10%] left-[5%] text-gray-500 font-medium" style={{ fontSize: `calc(clamp(0.4rem, 4cqw, 0.75rem) * ${unitScale})` }}>{min}</div>
                <div className="absolute bottom-[10%] right-[5%] text-gray-500 font-medium" style={{ fontSize: `calc(clamp(0.4rem, 4cqw, 0.75rem) * ${unitScale})` }}>{max}</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const rotation = percentage * 180 - 180; // -180 to 0
  const innerSize = 100 - (thickness * 2);
  const innerPos = thickness; 
  
  let bgStyle = `conic-gradient(from 270deg, ${activeColor} 0deg, ${activeColor} 180deg, transparent 180deg)`;
  if (sortedStops.length > 0) {
    if (config.colorMode === 'solid') {
      bgStyle = `conic-gradient(from 270deg, ${activeColor} 0deg, ${activeColor} 180deg, transparent 180deg)`;
    } else {
      let gradientStr = '';
      let prevDeg = 0;
      sortedStops.forEach((stop, i) => {
        const limit = Math.min(Math.max(parseFloat(stop.limit), 0), 100);
        const deg = (limit / 100) * 180;
        gradientStr += `${stop.color} ${prevDeg}deg ${deg}deg${i < sortedStops.length - 1 ? ', ' : ''}`;
        prevDeg = deg;
      });
      bgStyle = `conic-gradient(from 270deg, ${gradientStr}, transparent 180deg)`;
    }
  }
  
  return (
    <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden p-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] transition-colors duration-300 relative items-center justify-center ${isAlert ? 'bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-gray-900 border border-gray-800'}`} style={{ containerType: 'size' }}>
      {title && config.showTitle !== false && (
        <div className="absolute top-4 left-4 flex items-center gap-2 text-gray-400 opacity-80 z-10">
          {SelectedIcon && <SelectedIcon size={14} />}
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontSize: `calc(0.75rem * ${unitScale})` }}>{title}</span>
        </div>
      )}
      
      <div className="relative w-full flex-1 flex flex-col justify-center items-center mt-6 mb-2">
        <div 
          className="relative flex flex-col items-center w-full"
          style={{ maxWidth: 'min(90cqw, calc((100cqh - 60px) * 2))' }}
        >
          <div className="relative w-full aspect-[2/1] overflow-hidden flex justify-center shrink-0">
            <div className="absolute top-0 left-0 w-full aspect-square">
              <div className="absolute inset-0 rounded-full bg-gray-800 border-[max(1px,0.2cqw)] border-gray-900/50 box-border"></div>
              
              <div 
                 className="absolute inset-0 rounded-full origin-center box-border transition-colors duration-300" 
                 style={{
                   background: bgStyle,
                   transform: `rotate(${rotation}deg)`,
                   transition: 'transform 0.5s ease-out, background 0.3s'
                 }}>
              </div>
              
              <div 
                className="absolute bg-gray-900 rounded-full z-10 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] border-[max(1px,0.2cqw)] border-gray-800 box-border"
                style={{
                  width: `${innerSize}%`,
                  height: `${innerSize}%`,
                  top: `${innerPos}%`,
                  left: `${innerPos}%`,
                }}
              ></div>
            </div>
            
            <div className="absolute bottom-[2%] left-0 right-0 z-20 flex flex-col items-center justify-end pointer-events-none px-4">
              <div 
                className="font-bold drop-shadow-[0_0_8px_rgba(0,0,0,0.5)] tracking-tight flex flex-col items-center justify-center leading-none transition-colors duration-300"
                style={{ color: displayColor, fontSize: `calc(clamp(1rem, ${displayValue.length > 4 ? '10cqw' : '14cqw'}, 3rem) * ${valScale})` }}
              >
                <span>{displayValue}</span>
                {unit && <span className="opacity-80 font-medium mt-1 leading-none uppercase" style={{ fontSize: `calc(clamp(0.5rem, 4cqw, 0.875rem) * ${unitScale})` }}>{unit}</span>}
              </div>
            </div>
          </div>
          {config.enableDisplayScale !== false && (
            <div className="flex justify-between w-full pointer-events-none text-gray-500 font-medium mt-1 shrink-0 px-[2%]" style={{ fontSize: `calc(clamp(0.4rem, 4cqw, 0.75rem) * ${unitScale})` }}>
              <span>{min}</span>
              <span>{max}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
