import React from 'react';
import { AlignLeft } from 'lucide-react';

export default function TextFeedWidget({ title, feedData = [], icon: Icon = AlignLeft }) {
  const renderValue = (val) => {
    if (val === undefined || val === null) return <span className="text-gray-500 italic">-</span>;
    if (typeof val === 'boolean') {
      return <span className={val ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{val ? 'TRUE' : 'FALSE'}</span>;
    }
    if (typeof val === 'number') {
      return <span className="text-blue-300">{Number.isInteger(val) ? val : val.toFixed(4)}</span>;
    }
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'object') {
         const counts = val.reduce((acc, obj) => {
            const l = obj.label || 'item';
            acc[l] = (acc[l] || 0) + 1;
            return acc;
         }, {});
         const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
         return <span className="text-yellow-300">Found: {summary || '0 items'}</span>;
      }
      return <span className="text-indigo-300">[{val.join(', ')}]</span>;
    }
    if (typeof val === 'object') {
       if (val.label !== undefined) {
           return <span className="text-yellow-300">{val.label} {val.confidence ? `(${(val.confidence*100).toFixed(0)}%)` : ''}</span>;
       }
       return <span className="text-gray-400 text-xs">{JSON.stringify(val)}</span>;
    }
    return <span className="text-gray-300">{String(val)}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-800">
        <Icon size={20} className="text-purple-400" />
        <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
        {feedData.length > 0 ? (
          feedData.map((item, index) => {
            const isWrapped = item && typeof item === 'object' && ('timestamp' in item) && ('value' in item || 'text' in item || 'message' in item);
            const ts = isWrapped ? item.timestamp : new Date().toLocaleTimeString();
            const val = isWrapped ? (item.value !== undefined ? item.value : (item.text || item.message)) : item;
            
            return (
              <div key={index} className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-700/50 font-mono flex items-start gap-2">
                <span className="text-xs text-gray-500 mt-0.5 shrink-0">[{ts}]</span>
                <div className="flex-1 overflow-hidden break-words">{renderValue(val)}</div>
              </div>
            );
          })
        ) : (
          <div className="text-gray-500 text-sm italic flex items-center justify-center h-full">
            No data
          </div>
        )}
      </div>
    </div>
  );
}
