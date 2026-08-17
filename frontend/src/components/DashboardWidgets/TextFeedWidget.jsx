import React from 'react';
import { AlignLeft } from 'lucide-react';

export default function TextFeedWidget({ title, feedData = [], icon: Icon = AlignLeft }) {
  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-800">
        <Icon size={20} className="text-purple-400" />
        <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
        {feedData.length > 0 ? (
          feedData.map((item, index) => (
            <div key={index} className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-700/50 font-mono">
              <span className="text-xs text-gray-500 mr-2">[{item.timestamp || new Date().toLocaleTimeString()}]</span>
              {item.text || item.message || JSON.stringify(item)}
            </div>
          ))
        ) : (
          <div className="text-gray-500 text-sm italic flex items-center justify-center h-full">
            No data
          </div>
        )}
      </div>
    </div>
  );
}
