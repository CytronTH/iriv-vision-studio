import React from 'react';
import { Camera, BrainCircuit, Filter, Bell, ToggleLeft, ToggleRight, Lightbulb, BellRing, Settings2, Info, Camera as CameraIcon, BookOpen, X, Plus, Layers, ShieldAlert } from 'lucide-react';

export const NODE_CATEGORIES = [
  {
    title: 'Nodes',
    items: [
      { type: 'inputNode', label: 'Input Source', icon: Camera, bg: 'bg-blue-900/30 border-blue-700/50 text-blue-400' },
      { type: 'aiNode', label: 'AI Model', icon: BrainCircuit, bg: 'bg-purple-900/30 border-purple-700/50 text-purple-400' },
      { type: 'logicNode', label: 'Logic / Filter', icon: Filter, bg: 'bg-orange-900/30 border-orange-700/50 text-orange-400' },
      { type: 'counterNode', label: 'Counter', textIcon: '∑', bg: 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400' },
      { type: 'flowCounterNode', label: 'Flow Counter', textIcon: '⇄', bg: 'bg-teal-900/30 border-teal-700/50 text-teal-400' },
      { type: 'targetTrackerNode', label: '🎯 Target Tracker', bg: 'bg-indigo-900/30 border-indigo-700/50 text-indigo-400' },
      { type: 'unitThroughputNode', label: '⏱️ Unit Throughput', bg: 'bg-teal-900/30 border-teal-700/50 text-teal-400' },
      { type: 'databaseWriterNode', label: '💾 Database Writer', bg: 'bg-blue-900/30 border-blue-700/50 text-blue-400' },
      { type: 'collectionWriterNode', label: '📚 Collection Writer', bg: 'bg-orange-900/30 border-orange-700/50 text-orange-400' },
      { type: 'snapshotNode', label: 'Snapshot', icon: CameraIcon, bg: 'bg-pink-900/30 border-pink-700/50 text-pink-400' },
    ]
  },
  {
    title: 'Dashboard Outputs',
    items: [
      { type: 'dashboardVideoNode', label: 'Video Stream', textIcon: '📺', bg: 'bg-pink-900/30 border-pink-700/50 text-pink-400' },
      { type: 'dashboardMetricNode', label: 'Number / Metric', textIcon: '🔢', bg: 'bg-pink-900/30 border-pink-700/50 text-pink-400' },
      { type: 'dashboardTextNode', label: 'Text Value', textIcon: '📝', bg: 'bg-pink-900/30 border-pink-700/50 text-pink-400' },
      { type: 'dashboardChartNode', label: 'Chart', textIcon: '📊', bg: 'bg-indigo-900/30 border-indigo-700/50 text-indigo-400' },
    ]
  },
  {
    title: 'Debugging',
    items: [
      { type: 'debugNode', label: 'Debug Node', textIcon: '🐛', bg: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' },
    ]
  }
];

export default function Sidebar({ onOpenWiki, onAddNode, onCloseMobile }) {

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('text/plain', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleInfoClick = (e, nodeType) => {
    e.stopPropagation();
    if (onOpenWiki) onOpenWiki(nodeType);
  };

  const handleNodeClick = (nodeType) => {
    if (onAddNode) onAddNode(nodeType);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className="w-full md:w-64 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-3 overflow-y-auto h-full">
      {/* Mobile Drawer Header */}
      {onCloseMobile && (
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 md:hidden">
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">Tap to Add Node</span>
          <button 
            onClick={onCloseMobile} 
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-white border border-gray-300 dark:border-gray-700 active:scale-95"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <button 
        onClick={() => onOpenWiki && onOpenWiki(null)}
        className="flex items-center gap-2 mb-1 p-2.5 sm:p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg text-blue-100 font-medium text-xs sm:text-sm transition-all shadow-sm active:scale-95 shrink-0"
      >
        <BookOpen size={16} className="text-blue-400 shrink-0" />
        <span className="truncate">📖 เปิดดู Node Wiki (หน้าหลัก)</span>
      </button>

      {NODE_CATEGORIES.map(category => (
        <div key={category.title} className="flex flex-col gap-1.5">
          <div className="text-gray-600 dark:text-gray-400 font-semibold text-xs uppercase tracking-wider mt-2 mb-1">
            {category.title}
          </div>
          {category.items.map(item => {
            const IconComponent = item.icon;
            return (
              <div 
                key={item.type}
                className={`flex items-center gap-3 p-2.5 sm:p-3 ${item.bg} border rounded-lg cursor-pointer hover:brightness-125 transition-all group select-none active:scale-[0.98] shadow-sm`}
                onDragStart={(event) => onDragStart(event, item.type)}
                onClick={() => handleNodeClick(item.type)}
                draggable
                title="Click or tap to add, or drag to position"
              >
                {IconComponent ? (
                  <IconComponent size={18} className="shrink-0" />
                ) : (
                  <span className="font-bold text-sm shrink-0 w-4 text-center">{item.textIcon}</span>
                )}
                <span className="text-gray-800 dark:text-gray-200 font-medium text-xs sm:text-sm truncate flex-1">{item.label}</span>
                <span className="md:hidden text-[10px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700">Add</span>
                <button 
                  onClick={(e) => handleInfoClick(e, item.type)} 
                  className="text-gray-600 dark:text-gray-400 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition-all p-1 hover:bg-gray-100 dark:bg-gray-800 rounded shrink-0"
                  title="View Wiki Info"
                >
                  <Info size={15} />
                </button>
              </div>
            );
          })}
        </div>
      ))}

      <div className="mt-auto text-[11px] text-gray-500 italic text-center p-3 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
        <span className="hidden md:inline">Drag or tap node to add to canvas.</span>
        <span className="md:hidden">Tap any node to add to canvas.</span>
      </div>
    </aside>
  );
}
