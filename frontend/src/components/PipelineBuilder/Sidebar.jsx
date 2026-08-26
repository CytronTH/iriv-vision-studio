import React, { useState } from 'react';
import { Camera, BrainCircuit, Filter, Bell, ToggleLeft, ToggleRight, Lightbulb, BellRing, Settings2, Info, Camera as CameraIcon } from 'lucide-react';
import TutorialModal from './TutorialModal';

export default function Sidebar() {
  const [tutorialNode, setTutorialNode] = useState(null);

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleInfoClick = (e, nodeType) => {
    e.stopPropagation();
    setTutorialNode(nodeType);
  };

  return (
    <aside className="w-64 bg-gray-900 border-l border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="text-gray-300 font-semibold text-sm uppercase tracking-wider mb-2">
        Nodes
      </div>
      
      <div 
        className="flex items-center gap-3 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg cursor-grab hover:bg-blue-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'inputNode')}
        draggable
      >
        <Camera className="text-blue-400" size={20} />
        <span className="text-blue-100 font-medium text-sm">Input Source</span>
        <button onClick={(e) => handleInfoClick(e, 'inputNode')} className="ml-auto text-blue-400/50 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-blue-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg cursor-grab hover:bg-purple-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'aiNode')}
        draggable
      >
        <BrainCircuit className="text-purple-400" size={20} />
        <span className="text-purple-100 font-medium text-sm">AI Model</span>
        <button onClick={(e) => handleInfoClick(e, 'aiNode')} className="ml-auto text-purple-400/50 hover:text-purple-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-purple-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-orange-900/30 border border-orange-700/50 rounded-lg cursor-grab hover:bg-orange-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'logicNode')}
        draggable
      >
        <Filter className="text-orange-400" size={20} />
        <span className="text-orange-100 font-medium text-sm">Logic / Filter</span>
        <button onClick={(e) => handleInfoClick(e, 'logicNode')} className="ml-auto text-orange-400/50 hover:text-orange-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-orange-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-emerald-900/30 border border-emerald-700/50 rounded-lg cursor-grab hover:bg-emerald-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'counterNode')}
        draggable
      >
        <span className="text-emerald-400 font-bold">∑</span>
        <span className="text-emerald-100 font-medium text-sm">Counter</span>
        <button onClick={(e) => handleInfoClick(e, 'counterNode')} className="ml-auto text-emerald-400/50 hover:text-emerald-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-emerald-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-700/50 rounded-lg cursor-grab hover:bg-green-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'actionNode')}
        draggable
      >
        <Bell className="text-green-400" size={20} />
        <span className="text-green-100 font-medium text-sm">Action / Alert</span>
        <button onClick={(e) => handleInfoClick(e, 'actionNode')} className="ml-auto text-green-400/50 hover:text-green-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-green-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-pink-900/30 border border-pink-700/50 rounded-lg cursor-grab hover:bg-pink-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'snapshotNode')}
        draggable
      >
        <CameraIcon className="text-pink-400" size={20} />
        <span className="text-pink-100 font-medium text-sm">Snapshot</span>
        <button onClick={(e) => handleInfoClick(e, 'snapshotNode')} className="ml-auto text-pink-400/50 hover:text-pink-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-pink-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div className="text-gray-300 font-semibold text-sm uppercase tracking-wider mt-4 mb-2">
        Hardware (CM5)
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-cyan-900/30 border border-cyan-700/50 rounded-lg cursor-grab hover:bg-cyan-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'digitalInputNode')}
        draggable
      >
        <ToggleLeft className="text-cyan-400" size={20} />
        <span className="text-cyan-100 font-medium text-sm">Digital Input</span>
        <button onClick={(e) => handleInfoClick(e, 'digitalInputNode')} className="ml-auto text-cyan-400/50 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-cyan-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-orange-900/30 border border-orange-700/50 rounded-lg cursor-grab hover:bg-orange-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'digitalOutputNode')}
        draggable
      >
        <ToggleRight className="text-orange-400" size={20} />
        <span className="text-orange-100 font-medium text-sm">Digital Output</span>
        <button onClick={(e) => handleInfoClick(e, 'digitalOutputNode')} className="ml-auto text-orange-400/50 hover:text-orange-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-orange-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg cursor-grab hover:bg-yellow-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'ledNode')}
        draggable
      >
        <Lightbulb className="text-yellow-400" size={20} />
        <span className="text-yellow-100 font-medium text-sm">LED Driver</span>
        <button onClick={(e) => handleInfoClick(e, 'ledNode')} className="ml-auto text-yellow-400/50 hover:text-yellow-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-yellow-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg cursor-grab hover:bg-red-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'buzzerNode')}
        draggable
      >
        <BellRing className="text-red-400" size={20} />
        <span className="text-red-100 font-medium text-sm">Active Buzzer</span>
        <button onClick={(e) => handleInfoClick(e, 'buzzerNode')} className="ml-auto text-red-400/50 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-indigo-900/30 border border-indigo-700/50 rounded-lg cursor-grab hover:bg-indigo-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'rs485Node')}
        draggable
      >
        <Settings2 className="text-indigo-400" size={20} />
        <span className="text-indigo-100 font-medium text-sm">RS485 Modbus</span>
        <button onClick={(e) => handleInfoClick(e, 'rs485Node')} className="ml-auto text-indigo-400/50 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-indigo-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div className="text-gray-300 font-semibold text-sm uppercase tracking-wider mt-4 mb-2">
        Dashboard Outputs
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-pink-900/30 border border-pink-700/50 rounded-lg cursor-grab hover:bg-pink-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'dashboardVideoNode')}
        draggable
      >
        <span className="text-pink-400 font-bold">📺</span>
        <span className="text-pink-100 font-medium text-sm">Video Stream</span>
        <button onClick={(e) => handleInfoClick(e, 'dashboardVideoNode')} className="ml-auto text-pink-400/50 hover:text-pink-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-pink-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-pink-900/30 border border-pink-700/50 rounded-lg cursor-grab hover:bg-pink-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'dashboardMetricNode')}
        draggable
      >
        <span className="text-pink-400 font-bold">🔢</span>
        <span className="text-pink-100 font-medium text-sm">Number / Metric</span>
        <button onClick={(e) => handleInfoClick(e, 'dashboardMetricNode')} className="ml-auto text-pink-400/50 hover:text-pink-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-pink-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-pink-900/30 border border-pink-700/50 rounded-lg cursor-grab hover:bg-pink-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'dashboardTextNode')}
        draggable
      >
        <span className="text-pink-400 font-bold">📝</span>
        <span className="text-pink-100 font-medium text-sm">Text Value</span>
        <button onClick={(e) => handleInfoClick(e, 'dashboardTextNode')} className="ml-auto text-pink-400/50 hover:text-pink-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-pink-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-indigo-900/30 border border-indigo-700/50 rounded-lg cursor-grab hover:bg-indigo-800/40 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'dashboardLogNode')}
        draggable
      >
        <span className="text-indigo-400 font-bold">📋</span>
        <span className="text-indigo-100 font-medium text-sm">Log History</span>
        <button onClick={(e) => handleInfoClick(e, 'dashboardLogNode')} className="ml-auto text-indigo-400/50 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-indigo-800/50 rounded">
          <Info size={16} />
        </button>
      </div>

      <div className="text-gray-300 font-semibold text-sm uppercase tracking-wider mt-4 mb-2">
        Debugging
      </div>

      <div 
        className="flex items-center gap-3 p-3 bg-gray-800 border border-gray-600 rounded-lg cursor-grab hover:bg-gray-700 transition-colors group"
        onDragStart={(event) => onDragStart(event, 'debugNode')}
        draggable
      >
        <span className="text-gray-300 font-bold">🐛</span>
        <span className="text-gray-200 font-medium text-sm">Debug Node</span>
        <button onClick={(e) => handleInfoClick(e, 'debugNode')} className="ml-auto text-gray-400/50 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-gray-600 rounded">
          <Info size={16} />
        </button>
      </div>

      <div className="mt-auto text-xs text-gray-500 italic text-center p-4">
        Drag and drop nodes onto the canvas to build your pipeline.
      </div>
      
      {/* Tutorial Modal */}
      {tutorialNode && (
        <TutorialModal 
          nodeType={tutorialNode} 
          onClose={() => setTutorialNode(null)} 
        />
      )}
    </aside>
  );
}
