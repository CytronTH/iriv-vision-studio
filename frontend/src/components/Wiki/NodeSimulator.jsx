import React, { useState, useEffect } from 'react';
import { Play, Settings2, ToggleRight } from 'lucide-react';

const NodeSimulator = ({ config, nodeType }) => {
  const [inputVal, setInputVal] = useState(0);
  const [outputVal, setOutputVal] = useState(null);

  // Initialize inputVal based on config type
  useEffect(() => {
    if (config?.type === 'text-input') setInputVal('Hello');
    else if (config?.type === 'boolean-toggle' || config?.type === 'ai-mock') setInputVal(false);
    else setInputVal(0);
  }, [config, nodeType]);

  if (!config || config.type === 'none') {
    return null; // Not simulatable
  }

  // Calculate output based on mock logic
  useEffect(() => {
    switch (config.type) {
      case 'boolean-slider':
        setOutputVal(inputVal > 0 ? 'TRUE (Triggered)' : 'FALSE');
        break;
      case 'boolean-toggle':
        setOutputVal(inputVal ? 'TRUE (Active)' : 'FALSE');
        break;
      case 'number-slider':
      case 'number-input':
        setOutputVal(inputVal);
        break;
      case 'text-input':
        setOutputVal(`"${inputVal}"`);
        break;
      case 'ai-mock':
        setOutputVal(inputVal ? '[ { label: "person", bbox: [...] } ]' : '[]');
        break;
      default:
        setOutputVal('N/A');
    }
  }, [inputVal, config.type]);

  const renderControl = () => {
    switch (config.type) {
      case 'boolean-slider':
        return (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Count: 0</span>
              <span>Count: 10</span>
            </div>
            <input 
              type="range" min="0" max="10" 
              value={inputVal} 
              onChange={(e) => setInputVal(Number(e.target.value))}
              className="w-full accent-blue-500" 
            />
            <div className="text-center font-mono text-sm mt-2 text-gray-200">
              Mock Data: {'{ count: ' + inputVal + ' }'}
            </div>
          </div>
        );
      case 'boolean-toggle':
      case 'ai-mock':
        return (
          <div className="flex flex-col items-center gap-3">
             <button 
               onClick={() => setInputVal(!inputVal)}
               className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg active:scale-95 ${inputVal ? 'bg-green-500 text-white shadow-green-900/50' : 'bg-gray-700 text-gray-300'}`}
             >
               <ToggleRight size={20} />
               {inputVal ? 'Signal: ON' : 'Signal: OFF'}
             </button>
             <div className="text-center font-mono text-xs text-gray-400">
              Click to toggle input state
            </div>
          </div>
        );
      case 'number-slider':
         return (
          <div className="flex flex-col gap-2 w-full">
             <div className="flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>100</span>
            </div>
            <input 
              type="range" min="0" max="100" 
              value={inputVal} 
              onChange={(e) => setInputVal(Number(e.target.value))}
              className="w-full accent-green-500" 
            />
            <div className="text-center font-mono text-sm mt-2 text-gray-200">
              Input Value: {inputVal}
            </div>
          </div>
        );
      case 'number-input':
        return (
           <div className="flex flex-col items-center gap-2 w-full max-w-xs mx-auto">
             <input 
               type="number"
               value={inputVal} 
               onChange={(e) => setInputVal(Number(e.target.value))}
               className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-center text-xl font-bold text-white focus:outline-none focus:border-blue-500" 
             />
           </div>
        );
      case 'text-input':
        return (
           <div className="flex flex-col items-center gap-2 w-full max-w-md mx-auto">
             <input 
               type="text"
               value={inputVal} 
               onChange={(e) => setInputVal(e.target.value)}
               placeholder="Enter text..."
               className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-center text-white focus:outline-none focus:border-blue-500" 
             />
           </div>
        );
      default: return null;
    }
  };

  return (
    <div className="mt-8 bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 bg-gray-800/50 border-b border-gray-800 flex items-center gap-2">
        <Play size={18} className="text-blue-400" />
        <h3 className="font-semibold text-gray-200">Interactive Simulator (Playground)</h3>
      </div>
      
      <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center">
        
        {/* Input Control */}
        <div className="flex-1 w-full bg-gray-900 border border-gray-800 p-6 rounded-xl relative">
          <div className="absolute -top-3 left-4 bg-gray-800 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider rounded border border-gray-700">Mock Input</div>
          {renderControl()}
        </div>

        {/* Arrow */}
        <div className="hidden md:flex flex-col items-center text-gray-600">
           <div className="h-0.5 w-8 bg-gray-700"></div>
           <Settings2 size={24} className="my-2 animate-pulse text-blue-500/50" />
           <div className="h-0.5 w-8 bg-gray-700"></div>
        </div>

        {/* Output Display */}
        <div className="flex-1 w-full bg-black/40 border border-gray-800 p-6 rounded-xl relative flex items-center justify-center min-h-[120px] shadow-inner">
          <div className="absolute -top-3 left-4 bg-gray-800 px-2 text-xs font-bold text-green-400 uppercase tracking-wider rounded border border-gray-700">Output Result</div>
          
          <div className={`text-xl md:text-2xl font-mono font-bold text-center break-all ${outputVal && outputVal.toString().includes('TRUE') ? 'text-green-400' : 'text-gray-300'}`}>
            {outputVal}
          </div>
        </div>

      </div>
    </div>
  );
};

export default NodeSimulator;
