import React from 'react';
import { Check, Edit3, Type, Hash, List as ListIcon, Box } from 'lucide-react';
import { getValueByPath } from '../../../utils/payloadSchema';

const TypeIcon = ({ type }) => {
  switch (type) {
    case 'string':
      return <Type size={12} className="text-blue-400" />;
    case 'number':
      return <Hash size={12} className="text-yellow-400" />;
    case 'boolean':
      return <div className="w-3 h-3 rounded-full border-2 border-green-400 flex items-center justify-center text-[8px] font-bold text-green-400">b</div>;
    case 'array':
      return <ListIcon size={12} className="text-purple-400" />;
    case 'object':
      return <Box size={12} className="text-orange-400" />;
    default:
      return <Type size={12} className="text-gray-400" />;
  }
};

const formatValue = (val, type) => {
  if (val === undefined || val === null) return <span className="text-gray-500 italic">null</span>;
  
  if (type === 'boolean') {
    return <span className={val ? "text-green-400" : "text-red-400"}>{val ? 'true' : 'false'}</span>;
  }
  
  if (type === 'number') {
    return <span className="text-yellow-300">{Number(val).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>;
  }
  
  if (type === 'string') {
    // Truncate long strings
    const str = String(val);
    return <span className="text-blue-300">"{str.length > 20 ? str.substring(0, 20) + '...' : str}"</span>;
  }
  
  if (type === 'array') {
    return <span className="text-purple-300">Array({val.length || 0})</span>;
  }
  
  if (type === 'object') {
    return <span className="text-orange-300">{'{...}'}</span>;
  }
  
  return <span className="text-gray-300">{String(val)}</span>;
};

export default function RealtimePropertySelector({ 
  options = [], 
  payload = null, 
  selectedValue = '', 
  onChange,
  onCustomClick,
  isCustomMode
}) {

  // If no options (e.g. not connected, or waiting)
  if (!options || options.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 text-center text-xs text-gray-500 italic nodrag">
        Waiting for data stream...<br/>Run pipeline to see properties.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 nodrag">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Available Properties</span>
        <button
          type="button"
          onClick={onCustomClick}
          className={`text-[10px] hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded ${isCustomMode ? 'text-white bg-gray-700' : 'text-gray-400'}`}
          title="Enter custom path manually"
        >
          <Edit3 size={10} />
          <span>Custom</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
        {options.map((opt) => {
          const isSelected = !isCustomMode && selectedValue === opt.value;
          const liveValue = getValueByPath(payload, opt.value);
          
          return (
            <div 
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`
                relative flex flex-col p-2 rounded-md cursor-pointer border transition-all duration-200 overflow-hidden
                ${isSelected 
                  ? 'bg-gray-800 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                  : 'bg-gray-900/80 border-gray-800 hover:border-gray-600 hover:bg-gray-800'}
              `}
            >
              {/* Highlight bar for selected */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
              )}
              
              <div className="flex items-center justify-between pl-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TypeIcon type={opt.type} />
                  <span className={`text-[11px] font-mono truncate max-w-[120px] ${isSelected ? 'text-indigo-300 font-bold' : 'text-gray-300'}`} title={opt.value}>
                    {opt.value}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-gray-300 max-w-[80px] truncate" title={String(liveValue)}>
                    {formatValue(liveValue, opt.type)}
                  </div>
                  {isSelected ? (
                    <Check size={12} className="text-indigo-400" />
                  ) : (
                    <div className="w-3" /> /* Placeholder to keep alignment */
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
