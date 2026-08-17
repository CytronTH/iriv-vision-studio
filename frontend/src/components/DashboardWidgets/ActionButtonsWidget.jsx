import React from 'react';
import { ToggleRight, Siren, DoorOpen, Lightbulb } from 'lucide-react';

export default function ActionButtonsWidget() {
  const triggerAction = (actionName) => {
    // In the future, this will POST to FastAPI to trigger a specific webhook/GPIO
    console.log(`Triggering manual action: ${actionName}`);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-gray-800/80 px-3 py-2 flex items-center gap-2 border-b border-gray-700 shrink-0">
        <ToggleRight size={16} className="text-cyan-400" />
        <span className="text-sm font-semibold text-gray-200">Manual Triggers</span>
      </div>
      
      <div className="flex-1 p-3 grid grid-cols-2 gap-3">
        <button 
          onClick={() => triggerAction('Alarm')}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-gray-600"
        >
          <Siren size={24} className="text-red-400" />
          <span className="text-xs text-gray-300 font-medium">Trigger Alarm</span>
        </button>

        <button 
          onClick={() => triggerAction('Door')}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-gray-600"
        >
          <DoorOpen size={24} className="text-green-400" />
          <span className="text-xs text-gray-300 font-medium">Open Door</span>
        </button>

        <button 
          onClick={() => triggerAction('Lights')}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-gray-600"
        >
          <Lightbulb size={24} className="text-yellow-400" />
          <span className="text-xs text-gray-300 font-medium">Toggle Lights</span>
        </button>

        <button 
          onClick={() => triggerAction('Reset')}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-gray-600"
        >
          <ToggleRight size={24} className="text-gray-400" />
          <span className="text-xs text-gray-300 font-medium">System Reset</span>
        </button>
      </div>
    </div>
  );
}
