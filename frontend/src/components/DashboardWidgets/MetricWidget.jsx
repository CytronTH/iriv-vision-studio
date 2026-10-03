import React from 'react';
import { Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye } from 'lucide-react';

const ICON_MAP = {
  Activity,
  Users,
  Thermometer,
  Car,
  Cpu,
  Droplets,
  Zap,
  Camera,
  Eye,
};

export default function MetricWidget({ title, value, unit, config = {}, icon: DefaultIcon = Activity }) {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);

  // Dynamic icon
  const SelectedIcon = config.iconName && ICON_MAP[config.iconName] ? ICON_MAP[config.iconName] : DefaultIcon;

  const valScale = config.valueFontSize || 1;
  const unitScale = config.unitFontSize || 1;

  let isAlert = false;
  
  if (value !== undefined && value !== null) {
    let valNum;
    if (typeof value === 'boolean') {
      valNum = value ? 1 : 0;
    } else {
      valNum = parseFloat(value);
    }

    if (!isNaN(valNum)) {
      // Check Upper Threshold
      if (config.enableUpperLimit && config.threshold !== undefined && config.threshold !== '') {
        const thresholdNum = parseFloat(config.threshold);
        if (!isNaN(thresholdNum)) {
          const condition = config.thresholdCondition || '>';
          if (condition === '>') {
            if (valNum > thresholdNum) isAlert = true;
          } else if (condition === '<') {
            if (valNum < thresholdNum) isAlert = true;
          } else if (condition === '==') {
            if (valNum === thresholdNum) isAlert = true;
          }
        }
      }

      // Check Lower Threshold (Always `<`)
      if (config.enableLowerLimit && config.thresholdMin !== undefined && config.thresholdMin !== '') {
        const thresholdMinNum = parseFloat(config.thresholdMin);
        if (!isNaN(thresholdMinNum) && valNum < thresholdMinNum) {
          isAlert = true;
        }
      }
    }
  }

  // Value formatting
  let displayValue = String(value);
  if (!isObject && typeof value !== 'boolean' && value !== undefined && value !== null) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      if (config.decimals !== undefined && config.decimals !== '') {
        displayValue = num.toFixed(parseInt(config.decimals, 10));
      } else {
        // Fallback to avoid long floats if not specified, though default is keep as is
        // displayValue = String(num); 
      }
    }
  }

  return (
    <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-xl p-4 transition-colors duration-300 ${isAlert ? 'bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-gray-900 border border-gray-800'}`} style={{ containerType: 'size' }}>
      {config.showTitle !== false && (
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <SelectedIcon size={20} className={isAlert ? 'text-red-400' : 'text-blue-400'} />
          <h3 className={`font-semibold text-sm uppercase tracking-wider ${isAlert ? 'text-red-400' : 'text-gray-400'}`}>{title}</h3>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {value !== undefined && value !== null ? (
          typeof value === 'boolean' ? (
            <div className="font-black tracking-tighter flex items-baseline" style={{ fontSize: `calc(clamp(2rem, 15cqw, 6rem) * ${valScale})` }}>
              <span className={value ? 'text-green-500' : 'text-red-500'}>{value ? 'TRUE' : 'FALSE'}</span>
              {unit && <span className="text-gray-500 ml-2" style={{ fontSize: `calc(clamp(1rem, 6cqw, 2.5rem) * ${unitScale})` }}>{unit}</span>}
            </div>
          ) : isObject ? (
            <div className="flex flex-col gap-1.5 w-full max-h-full overflow-y-auto px-1 py-1 custom-scrollbar">
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
            <div className="font-black tracking-tighter flex items-baseline" style={{ fontSize: `calc(clamp(2rem, ${displayValue.length > 5 ? '12cqw' : '16cqw'}, 6rem) * ${valScale})` }}>
              <span className={isAlert ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-white'}>{displayValue}</span>
              {unit && <span className={`ml-2 ${isAlert ? 'text-red-400' : 'text-gray-500'}`} style={{ fontSize: `calc(clamp(1rem, 6cqw, 2.5rem) * ${unitScale})` }}>{unit}</span>}
            </div>
          )
        ) : (
          <div className="font-black tracking-tighter flex items-baseline" style={{ fontSize: `calc(clamp(2rem, 15cqw, 6rem) * ${valScale})` }}>
            <span className="text-gray-600">--</span>
            {unit && <span className="text-gray-500 ml-2" style={{ fontSize: `calc(clamp(1rem, 6cqw, 2.5rem) * ${unitScale})` }}>{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
