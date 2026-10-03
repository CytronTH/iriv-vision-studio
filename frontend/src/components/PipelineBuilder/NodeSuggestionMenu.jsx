import React, { useEffect, useRef, useMemo } from 'react';
import { NODE_CATEGORIES } from './Sidebar';

const getSuggestedNodeTypes = (sourceNodeType, sourceHandleType) => {
  if (!sourceNodeType) return null; // allow all if no source

  const isDraggingFromOutput = sourceHandleType === 'source';

  if (isDraggingFromOutput) {
    // Dragging from an Output handle (finding a target/input)
    switch (sourceNodeType) {
      case 'inputNode':
        return ['aiNode', 'snapshotNode', 'debugNode'];
      case 'aiNode':
        return ['logicNode', 'flowCounterNode', 'unitThroughputNode', 'targetTrackerNode', 'debugNode'];
      case 'logicNode':
        return ['counterNode', 'snapshotNode', 'debugNode'];
      case 'counterNode':
      case 'flowCounterNode':
      case 'unitThroughputNode':
      case 'targetTrackerNode':
        return ['logicNode', 'debugNode'];
      default:
        return ['debugNode'];
    }
  } else {
    // Dragging from an Input handle backwards (finding a source/output)
    switch (sourceNodeType) {
      case 'logicNode':
        return ['aiNode'];
      case 'counterNode':
        return ['logicNode'];
      case 'flowCounterNode':
      case 'unitThroughputNode':
      case 'targetTrackerNode':
        return ['aiNode'];
      case 'aiNode':
        return ['inputNode'];
      case 'snapshotNode':
        return ['inputNode', 'logicNode'];
      case 'debugNode':
        return ['inputNode', 'aiNode', 'logicNode', 'counterNode', 'flowCounterNode', 'unitThroughputNode', 'targetTrackerNode'];
      default:
        return null;
    }
  }
};

export default function NodeSuggestionMenu({ position, sourceNodeType, sourceHandleType, onSelect, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredCategories = useMemo(() => {
    const allowedTypes = getSuggestedNodeTypes(sourceNodeType, sourceHandleType);
    
    if (!allowedTypes) return NODE_CATEGORIES;

    // Filter categories and items based on allowed types
    const filtered = NODE_CATEGORIES.map(category => {
      const items = category.items.filter(item => allowedTypes.includes(item.type));
      return { ...category, items };
    }).filter(category => category.items.length > 0);

    return filtered;
  }, [sourceNodeType, sourceHandleType]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl p-2 w-64 max-h-[400px] overflow-y-auto animate-in fade-in zoom-in duration-150"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, 0)', // Center horizontally on the mouse
      }}
    >
      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider px-2 py-1.5 border-b border-gray-200 dark:border-gray-800 mb-2 dark:text-gray-400">
        {filteredCategories.length > 0 ? 'Suggested Nodes' : 'No Suggested Nodes'}
      </div>

      {filteredCategories.map(category => (
        <div key={category.title} className="mb-2">
          <div className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider px-2 py-1 dark:text-gray-500">
            {category.title}
          </div>
          <div className="flex flex-col gap-1">
            {category.items.map(item => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => onSelect(item.type)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800 text-left transition-colors active:scale-95 group"
                >
                  <div className={`p-1.5 rounded-md flex items-center justify-center border ${item.bg}`}>
                    {IconComponent ? (
                      <IconComponent size={14} />
                    ) : (
                      <span className="font-bold text-[10px]">{item.textIcon}</span>
                    )}
                  </div>
                  <span className="text-gray-800 font-medium text-xs flex-1 dark:text-gray-200">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      
      {filteredCategories.length === 0 && (
        <div className="px-2 py-3 text-xs text-gray-500 text-center dark:text-gray-500">
          No valid connections found.
        </div>
      )}
    </div>
  );
}
