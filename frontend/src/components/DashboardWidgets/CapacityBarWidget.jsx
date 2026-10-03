import React from 'react';
import { useTheme, getAdaptiveColor } from '../../utils/theme';
import { Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye, BarChart2 } from 'lucide-react';

const ICON_MAP = {
  Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye, BarChart2
};

export default function CapacityBarWidget({ title, value, unit, config = {} }) {
  const isDark = useTheme();
  
  const max = config.max !== undefined && config.max !== '' ? parseFloat(config.max) : 100;
  const min = config.min !== undefined && config.min !== '' ? parseFloat(config.min) : 0;
  
  let numValue = 0;
  if (value !== undefined && value !== null) {
      numValue = parseFloat(value) || 0;
  }
  
  const range = max - min;
  const percentage = range === 0 ? 0 : Math.min(Math.max(((numValue - min) / range) * 100, 0), 100);
  
  let displayValue = numValue.toString();
  if (config.decimals !== undefined && config.decimals !== '') {
      displayValue = numValue.toFixed(parseInt(config.decimals, 10));
  }
  
  const valScale = config.valueFontSize || 1;
  const unitScale = config.unitFontSize || 1;
  
  const isHorizontal = config.orientation === 'horizontal';
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
    if (!stops || stops.length === 0) return config.color || '#3b82f6';
    for (let stop of stops) {
      if (valPercent <= parseFloat(stop.limit)) {
        return stop.color;
      }
    }
    return stops[stops.length - 1].color;
  };

  const activeColor = getActiveColor(percentage, sortedStops);

  const displayColor = activeColor;
  const SelectedIcon = config.iconName ? ICON_MAP[config.iconName] : null;

  let bgStyle = activeColor;
  let shadowStyle = `0 0 15px ${activeColor}80`;

  if (sortedStops.length > 0) {
    if (config.colorMode === 'solid') {
      bgStyle = activeColor;
      shadowStyle = `0 0 15px ${activeColor}80`; // Add 50% opacity hex
    } else {
      let gradientStr = '';
      let prevLimit = 0;
      sortedStops.forEach((stop, i) => {
        const limit = Math.min(Math.max(parseFloat(stop.limit), 0), 100);
        gradientStr += `${stop.color} ${prevLimit}%, ${stop.color} ${limit}%${i < sortedStops.length - 1 ? ', ' : ''}`;
        prevLimit = limit;
      });
      bgStyle = `linear-gradient(${isHorizontal ? 'to right' : 'to top'}, ${gradientStr})`;
      shadowStyle = `0 0 15px ${activeColor}80`;
    }
  } else if (config.colorMode === 'solid') {
    bgStyle = activeColor;
    shadowStyle = `0 0 15px ${activeColor}80`;
  }
  
  return (
    <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] transition-colors duration-300 relative ${isAlert ? 'bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-[#111520] border border-gray-700/50'}`} style={{ containerType: 'size' }}>
      {title && config.showTitle !== false && (
        <div className="absolute top-4 left-4 flex items-center gap-2 text-blue-400 opacity-80 z-10">
          {SelectedIcon && <SelectedIcon size={14} />}
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontSize: `calc(0.75rem * ${unitScale})` }}>{title}</span>
        </div>
      )}
      
      <div className={`flex-1 flex items-center justify-center gap-[6cqw] mt-4 ${isHorizontal ? 'flex-col' : 'flex-row'}`}>
        {/* Tube Holder/Backdrop */}
        <div className={`relative p-[2cqw] bg-[#1a2235] rounded-3xl border-[max(1px,0.2cqw)] border-gray-700/50 shadow-xl ${isHorizontal ? 'rounded-l-none' : 'rounded-t-none'}`}>
            {/* The Glass Tube */}
            <div className={`relative bg-[#0b0e14] rounded-full border border-white/10 shadow-[inset_0_0_15px_rgba(0,0,0,1)] overflow-hidden flex ${
              isHorizontal ? 'rounded-l-sm flex-row justify-start' : 'rounded-t-sm flex-col justify-end'
            }`} style={{
              width: isHorizontal ? 'min(70cqw, 200cqh)' : 'min(20cqw, 30cqh)',
              height: isHorizontal ? 'min(15cqw, 30cqh)' : 'min(60cqh, 200cqw)',
              minWidth: isHorizontal ? '100px' : '30px',
              minHeight: isHorizontal ? '25px' : '80px',
            }}>
              {/* Lip */}
              <div className={`absolute z-20 bg-white/20 rounded-sm ${
                isHorizontal
                ? 'left-0 top-[-2px] bottom-[-2px] w-[3cqw] min-w-[4px] max-w-[8px]'
                : 'top-0 left-[-2px] right-[-2px] h-[3cqw] min-h-[4px] max-h-[8px]'
              }`}></div>
              
              {/* Liquid Fill */}
              <div 
                className="absolute inset-0 transition-all duration-700 ease-out z-10"
                style={{ 
                  background: bgStyle,
                  boxShadow: shadowStyle,
                  clipPath: isHorizontal ? `inset(0 ${100 - percentage}% 0 0)` : `inset(${100 - percentage}% 0 0 0)`
                }}
              ></div>

              {/* Liquid Edge Glare */}
              <div 
                className={`absolute z-10 bg-white/40 rounded-full blur-[1px] transition-all duration-700 ease-out ${
                  isHorizontal
                  ? 'w-[3cqw] min-w-[4px] max-w-[8px] h-full top-0'
                  : 'h-[3cqw] min-h-[4px] max-h-[8px] w-full left-0'
                }`}
                style={{
                  [isHorizontal ? 'left' : 'bottom']: `calc(${percentage}% - 4px)` 
                }}
              ></div>
              
              {/* Glass Glare */}
              <div className={`absolute from-white/20 to-transparent rounded-full z-20 pointer-events-none bg-gradient-to-b ${
                isHorizontal
                ? 'top-[15%] left-[5%] right-[5%] h-[20%]'
                : 'top-[5%] bottom-[5%] left-[15%] w-[20%]'
              }`}></div>
            </div>
        </div>
        
        {/* Values */}
        <div className={`flex ${isHorizontal ? 'flex-row items-baseline gap-4 mt-2' : 'flex-col'}`}>
          <div className="font-black drop-shadow-md tracking-tight transition-colors duration-300" style={{ color: displayColor, fontSize: `calc(clamp(1.5rem, 12cqw, 3.5rem) * ${valScale})` }}>{percentage.toFixed(0)}%</div>
          <div className="font-medium tracking-wider transition-colors duration-300" style={{ color: displayColor, opacity: 0.8, fontSize: `calc(clamp(0.6rem, 4cqw, 1rem) * ${unitScale})` }}>
            {displayValue} {config.enableDisplayScale !== false ? `/ ${max}` : ''} {unit}
          </div>
        </div>
      </div>
    </div>
  );
}
