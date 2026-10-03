import React, { useState, useEffect, useMemo } from 'react';
import usePipelineStore from '../../store/usePipelineStore';
import { X, Save, Undo } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

// Map node types to their settings components
import InputNodeSettings from './settings/InputNodeSettings';
import LogicNodeSettings from './settings/LogicNodeSettings';
import AINodeSettings from './settings/AINodeSettings';
import FlowCounterNodeSettings from './settings/FlowCounterNodeSettings';
import CounterNodeSettings from './settings/CounterNodeSettings';
import UnitThroughputNodeSettings from './settings/UnitThroughputNodeSettings';
import DatabaseWriterNodeSettings from './settings/DatabaseWriterNodeSettings';
import CollectionWriterSettings from './settings/CollectionWriterSettings';
import DashboardWidgetSettings from './settings/DashboardWidgetSettings';
import DashboardVideoNodeSettings from './settings/DashboardVideoNodeSettings';
import SnapshotNodeSettings from './settings/SnapshotNodeSettings';
import TargetTrackerNodeSettings from './settings/TargetTrackerNodeSettings';

const settingsComponents = {
  inputNode: InputNodeSettings,
  logicNode: LogicNodeSettings,
  aiNode: AINodeSettings,
  flowCounterNode: FlowCounterNodeSettings,
  counterNode: CounterNodeSettings,
  unitThroughputNode: UnitThroughputNodeSettings,
  databaseWriterNode: DatabaseWriterNodeSettings,
  collectionWriterNode: CollectionWriterSettings,
  dashboardMetricNode: DashboardWidgetSettings,
  dashboardChartNode: DashboardWidgetSettings,
  dashboardTextNode: DashboardWidgetSettings,
  dashboardVideoNode: DashboardVideoNodeSettings,
  snapshotNode: SnapshotNodeSettings,
  targetTrackerNode: TargetTrackerNodeSettings,
};

export default function NodeSettingsSidebar({ selectedNodeId, isOpen, onClose }) {
  const { nodes, updateNodeData } = usePipelineStore(useShallow((state) => ({
    nodes: state.nodes,
    updateNodeData: state.updateNodeData
  })));

  const [shouldRender, setRender] = useState(isOpen);
  const [cachedNodeId, setCachedNodeId] = useState(selectedNodeId);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      if (selectedNodeId) setCachedNodeId(selectedNodeId);
    }
  }, [isOpen, selectedNodeId]);

  const onAnimationEnd = () => {
    if (!isOpen) setRender(false);
  };

  const activeId = isOpen ? selectedNodeId : cachedNodeId;
  const selectedNode = useMemo(() => nodes.find(n => n.id === activeId), [nodes, activeId]);

  // Local state for draft changes
  const [draftData, setDraftData] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Initialize draft data when the selected node changes
  useEffect(() => {
    if (selectedNode) {
      setDraftData(JSON.parse(JSON.stringify(selectedNode.data)));
      setIsDirty(false);
    }
  }, [activeId, selectedNode?.data]); // Re-sync if external changes happen

  if (!shouldRender || !selectedNode) return null;

  const SettingsComponent = settingsComponents[selectedNode.type];

  const handleDataChange = (updates) => {
    setDraftData(prev => {
      const next = { ...prev, ...updates };
      setIsDirty(true);
      return next;
    });
  };

  const handleSave = () => {
    updateNodeData(selectedNode.id, draftData);
    setIsDirty(false);
  };

  const handleUndo = () => {
    setDraftData(JSON.parse(JSON.stringify(selectedNode.data)));
    setIsDirty(false);
  };

  return (
    <>
      <style>{`
        @keyframes customSlideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes customSlideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .custom-animate-slide-in {
          animation: customSlideInRight 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-animate-slide-out {
          animation: customSlideOutRight 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <div 
        className={`absolute top-0 right-0 h-full w-80 sm:w-96 bg-gray-100 dark:bg-gray-900 border-l border-gray-300 dark:border-gray-700 shadow-2xl z-50 flex flex-col ${isOpen ? 'custom-animate-slide-in' : 'custom-animate-slide-out'}`}
        onAnimationEnd={onAnimationEnd}
      >
        {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="flex-1 mr-4">
          <div className="flex flex-col gap-1 mb-2">
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider dark:text-gray-500">Node Name</label>
            <input
              type="text"
              value={draftData.label !== undefined ? draftData.label : ''}
              placeholder={selectedNode.type}
              onChange={(e) => handleDataChange({ label: e.target.value })}
              className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:border-blue-500 text-sm font-semibold text-gray-900 rounded px-2.5 py-1.5 w-full outline-none transition-colors dark:text-gray-100"
            />
          </div>
          <p className="text-[10px] text-gray-500 font-mono dark:text-gray-500">ID: {selectedNode.id}</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800 transition-colors shrink-0 dark:text-gray-400">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 styled-scrollbar">
        {SettingsComponent ? (
          <SettingsComponent 
            nodeId={selectedNode.id}
            data={draftData} 
            onChange={handleDataChange} 
            isSidebar={true}
          />
        ) : (
          <div className="text-center text-gray-500 py-10 flex flex-col items-center dark:text-gray-500">
            <div className="mb-3 p-3 bg-gray-200 dark:bg-gray-800 rounded-full">
              <X size={24} className="text-gray-600 dark:text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-sm">No dedicated settings panel available for <br/> <span className="text-gray-700 font-mono dark:text-gray-300">{selectedNode.type}</span></p>
            <p className="text-xs mt-2 text-gray-600 dark:text-gray-400 dark:text-gray-600">Please switch to Inline view to edit.</p>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex gap-2">
        <button 
          onClick={handleUndo}
          disabled={!isDirty}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition-colors ${isDirty ? 'bg-gray-200 dark:bg-gray-800 text-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700' : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-600 cursor-not-allowed'}`}
        >
          <Undo size={16} /> Undo
        </button>
        <button 
          onClick={handleSave}
          disabled={!isDirty}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition-colors ${isDirty ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-blue-900/50 text-blue-400/50 cursor-not-allowed'}`}
        >
          <Save size={16} /> Save
        </button>
      </div>
    </div>
    </>
  );
}
