import React from 'react';
import { X, Activity, Cpu, LogIn, LogOut } from 'lucide-react';
import { nodeTutorials } from '../../data/nodeTutorials';

export default function TutorialModal({ nodeType, onClose }) {
  if (!nodeType) return null;

  const data = nodeTutorials[nodeType];

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl text-center">
          <p className="text-gray-300">No tutorial available for {nodeType}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 rounded text-white">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-900 border border-gray-700 w-full max-w-3xl rounded-xl shadow-2xl relative flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
              <Activity className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{data.title}</h2>
              <p className="text-gray-400 text-sm">{data.description}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Input Section */}
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <LogIn className="text-green-400" size={18} />
                <h3 className="text-lg font-semibold text-gray-200">1. Input</h3>
              </div>
              <p className="text-gray-300 text-sm">{data.input.desc}</p>
              <div className="mt-3 bg-black/40 border border-gray-800 rounded p-2 text-xs text-gray-400 border-l-2 border-l-green-500">
                <span className="font-semibold text-gray-300">Ex: </span>{data.input.example}
              </div>
            </div>

            {/* Process Section */}
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="text-blue-400" size={18} />
                <h3 className="text-lg font-semibold text-gray-200">2. Process</h3>
              </div>
              <p className="text-gray-300 text-sm">{data.process.desc}</p>
              <div className="mt-3 bg-black/40 border border-gray-800 rounded p-2 text-xs text-gray-400 border-l-2 border-l-blue-500">
                <span className="font-semibold text-gray-300">Ex: </span>{data.process.example}
              </div>
            </div>

            {/* Output Section */}
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <LogOut className="text-orange-400" size={18} />
                <h3 className="text-lg font-semibold text-gray-200">3. Output</h3>
              </div>
              <p className="text-gray-300 text-sm">{data.output.desc}</p>
              <div className="mt-3 bg-black/40 border border-gray-800 rounded p-2 text-xs text-gray-400 border-l-2 border-l-orange-500">
                <span className="font-semibold text-gray-300">Ex: </span>{data.output.example}
              </div>
            </div>
          </div>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end items-center bg-gray-900 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
          >
            เข้าใจแล้ว (Got it!)
          </button>
        </div>
        
      </div>
    </div>
  );
}
