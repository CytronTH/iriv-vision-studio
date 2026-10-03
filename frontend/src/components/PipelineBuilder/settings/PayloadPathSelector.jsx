import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Check, MousePointerClick } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export const JsonTreeNode = ({ nodeKey, value, path, selectedPath, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isObject = typeof value === 'object' && value !== null;
  const isSelected = selectedPath === path;

  return (
    <div className="font-mono text-[11px] leading-tight">
      <div 
        className={`group flex items-center py-1 hover:bg-gray-200/50 dark:hover:bg-gray-100 dark:bg-gray-800/50 rounded px-1 -ml-1 transition-colors ${isSelected ? 'bg-blue-900/30 border border-blue-800/50' : 'border border-transparent'}`}
      >
        <div className="flex items-center gap-1 flex-1 cursor-pointer select-none" onClick={() => isObject && setIsExpanded(!isExpanded)}>
          {isObject ? (
            isExpanded ? <ChevronDown size={12} className="text-gray-500 dark:text-gray-500" /> : <ChevronRight size={12} className="text-gray-500 dark:text-gray-500" />
          ) : (
            <span className="w-3" />
          )}
          <span className="text-purple-400">{nodeKey}</span>
          <span className="text-gray-500 dark:text-gray-500">:</span>
          {!isObject && (
            <span className={typeof value === 'number' ? 'text-orange-400' : typeof value === 'string' ? 'text-green-400' : 'text-blue-400'}>
              {JSON.stringify(value)}
            </span>
          )}
          {isObject && !isExpanded && <span className="text-gray-500 italic dark:text-gray-500">{"{...}"}</span>}
        </div>
        
        {!isObject && (
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(path); }}
            className={`opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all
              ${isSelected ? 'opacity-100 bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 hover:bg-blue-600 hover:text-white dark:text-gray-300'}`}
          >
            {isSelected ? <Check size={10} /> : <MousePointerClick size={10} />}
            {isSelected ? 'Selected' : 'Select'}
          </button>
        )}
      </div>
      
      {isObject && isExpanded && (
        <div className="ml-3 border-l border-gray-300/50 dark:border-gray-700/50 pl-2 mt-0.5 space-y-0.5">
          {Object.entries(value).map(([k, v]) => (
            <JsonTreeNode 
              key={k} 
              nodeKey={k} 
              value={v} 
              path={path ? `${path}.${k}` : k} 
              selectedPath={selectedPath}
              onSelect={onSelect} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function PayloadPathSelector({ nodeId, selectedPath, onSelect, maxHeight = '250px' }) {
  const edges = usePipelineStore(state => state.edges);
  const debugData = usePipelineStore(state => state.debugData);
  
  // Find incoming node payload
  const incomingEdges = edges.filter(e => e.target === nodeId);
  const incomingNodeIds = incomingEdges.map(e => e.source);
  
  let sourcePayload = null;
  for (const srcId of incomingNodeIds) {
    if (debugData[srcId]) {
      sourcePayload = debugData[srcId];
      break;
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between mt-1">
        <label className="text-xs text-gray-600 font-bold uppercase tracking-wider flex items-center gap-2 dark:text-gray-400">
          Realtime Data Mapping
          {sourcePayload ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          ) : (
            <span className="text-[9px] bg-gray-200 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-normal normal-case border border-gray-300 dark:border-gray-700 dark:text-gray-500">Waiting for data...</span>
          )}
        </label>
      </div>
      
      <div 
        className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded p-3 overflow-y-auto custom-scrollbar shadow-inner"
        style={{ maxHeight }}
      >
        {sourcePayload ? (
          Object.entries(sourcePayload).map(([k, v]) => (
            <JsonTreeNode 
              key={k} 
              nodeKey={k} 
              value={v} 
              path={k}
              selectedPath={selectedPath}
              onSelect={onSelect} 
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
            <p className="text-xs text-gray-500 dark:text-gray-500">No payload data available.</p>
            <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1 dark:text-gray-600">Connect an incoming node and trigger it to see the data structure.</p>
          </div>
        )}
      </div>
    </div>
  );
}
