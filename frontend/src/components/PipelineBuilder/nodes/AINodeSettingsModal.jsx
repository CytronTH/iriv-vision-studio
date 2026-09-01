import React from 'react';
import { createPortal } from 'react-dom';
import { Filter, Crosshair, X, Settings } from 'lucide-react';

export default function AINodeSettingsModal({
  id, data, updateNodeData, modelClasses, isInputNode, onClose, onOpenROI
}) {
  const confidenceThreshold = data?.confidenceThreshold ?? 0.5;
  const classFilter = data?.classFilter ?? null;

  const handleConfidenceChange = (e) => {
    updateNodeData(id, { confidenceThreshold: parseFloat(e.target.value) });
  };

  const handleClassConfidenceChange = (cls, val) => {
    if (isNaN(val)) return;
    const currentConfs = data?.classConfidences || {};
    updateNodeData(id, { classConfidences: { ...currentConfs, [cls]: val } });
  };

  const handleClassToggle = (cls) => {
    let current = classFilter ? [...classFilter] : [...modelClasses];
    if (current.includes(cls)) {
      current = current.filter(c => c !== cls);
    } else {
      current = [...current, cls];
    }
    if (current.length === modelClasses.length) {
      updateNodeData(id, { classFilter: null });
    } else {
      updateNodeData(id, { classFilter: current });
    }
  };

  const handleAllToggle = () => {
    if (classFilter === null) {
      updateNodeData(id, { classFilter: [] });
    } else {
      updateNodeData(id, { classFilter: null });
    }
  };

  const isClassSelected = (cls) => {
    if (classFilter === null) return true;
    return classFilter.includes(cls);
  };

  const allSelected = classFilter === null;
  const activeClassCount = classFilter === null ? modelClasses.length : classFilter.length;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" 
      onMouseDown={onClose}
    >
      <div 
        className="bg-gray-900 border border-purple-600/50 rounded-xl shadow-2xl w-[450px] max-h-[85vh] flex flex-col overflow-hidden text-white" 
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
          <h3 className="text-white font-semibold flex items-center gap-2"><Settings size={16} className="text-purple-400"/> AI Node Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16}/></button>
        </div>
        
        <div className="p-4 overflow-y-auto flex flex-col gap-4 nodrag custom-scrollbar">
          
          {/* ROI Settings */}
          <div className="border border-gray-700/50 rounded-lg p-3 bg-gray-800/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Inspection Zone (ROI)</div>
              {isInputNode ? (
                <button
                  onClick={onOpenROI}
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/60 hover:border-purple-600 px-2.5 py-1 rounded-md transition-all"
                  title="Open visual ROI editor"
                >
                  <Crosshair size={12} />
                  Draw Zone
                </button>
              ) : (
                <span className="text-xs text-gray-600 italic">connect Input first</span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {['x','y','w','h'].map((key) => (
                <label key={key} className="text-xs text-gray-400 flex flex-col items-center gap-1">
                  {key.toUpperCase()}
                  <input
                    type="number" min="0" max="1" step="0.01"
                    className="bg-gray-900 border border-gray-700 rounded p-1 w-full text-center focus:border-purple-500 outline-none text-sm"
                    value={data?.roi?.[key] ?? (key === 'w' || key === 'h' ? 1.0 : 0.0)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) return;
                      const base = { x:0, y:0, w:1, h:1, ...(data?.roi || {}) };
                      updateNodeData(id, { roi: { ...base, [key]: val } });
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-gray-700/50">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-gray-300 group-hover:text-purple-300 transition-colors">Enable ROI Filter</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only" 
                    checked={data?.roiEnabled ?? false} 
                    onChange={(e) => updateNodeData(id, { roiEnabled: e.target.checked })} 
                  />
                  <div className={`block w-8 h-5 rounded-full transition-colors ${data?.roiEnabled ? 'bg-purple-600' : 'bg-gray-700'}`}></div>
                  <div className={`dot absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${data?.roiEnabled ? 'transform translate-x-3' : ''}`}></div>
                </div>
              </label>
              
              <label className={`flex items-center justify-between cursor-pointer group ${!data?.roiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="text-xs text-gray-300 group-hover:text-purple-300 transition-colors">Show ROI Box on Stream</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only" 
                    disabled={!data?.roiEnabled}
                    checked={data?.roiEnabled ? (data?.showRoi ?? false) : false} 
                    onChange={(e) => updateNodeData(id, { showRoi: e.target.checked })} 
                  />
                  <div className={`block w-8 h-5 rounded-full transition-colors ${data?.roiEnabled && data?.showRoi ? 'bg-purple-600' : 'bg-gray-700'}`}></div>
                  <div className={`dot absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${data?.roiEnabled && data?.showRoi ? 'transform translate-x-3' : ''}`}></div>
                </div>
              </label>
            </div>
            
            {data?.roiEnabled && data?.roi && (data.roi.x !== 0 || data.roi.y !== 0 || data.roi.w !== 1 || data.roi.h !== 1) && (
              <div className="text-xs text-purple-400/80 bg-purple-950/20 rounded px-2 py-1.5 border border-purple-900/40 text-center">
                Zone active: ({(data.roi.x*100).toFixed(0)}%, {(data.roi.y*100).toFixed(0)}%) &nbsp;
                {(data.roi.w*100).toFixed(0)}% × {(data.roi.h*100).toFixed(0)}%
              </div>
            )}
          </div>

          {/* Bounding Box Settings */}
          <div className="border border-gray-700/50 rounded-lg p-3 bg-gray-800/30 flex flex-col gap-3">
            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Bounding Box Style</div>
            
            <label className="text-sm text-gray-400 flex flex-col gap-1.5">
              Draw Mode
              <select
                className="bg-gray-900 border border-gray-700 rounded p-1.5 text-sm focus:outline-none focus:border-purple-500 text-white"
                value={data?.bboxDrawMode || 'frontend'}
                onChange={(e) => updateNodeData(id, { bboxDrawMode: e.target.value })}
              >
                <option value="frontend">Frontend (HTML Canvas)</option>
                <option value="backend">Backend (Burn into Video)</option>
              </select>
            </label>

            {data?.bboxDrawMode === 'backend' && (
              <label className="text-sm text-gray-400 flex flex-col gap-1.5 mt-1">
                Video Resolution <span className="text-xs text-amber-500/80">(High resolutions increase CPU load)</span>
                <select
                  className="bg-gray-900 border border-gray-700 rounded p-1.5 text-sm focus:outline-none focus:border-purple-500 text-white"
                  value={data?.backendResolution || 'auto'}
                  onChange={(e) => updateNodeData(id, { backendResolution: e.target.value })}
                >
                  <option value="auto">Auto (Adaptive based on CPU)</option>
                  <option value="360p">360p (640x360)</option>
                  <option value="480p">480p (854x480)</option>
                  <option value="720p">720p (1280x720) - Heavy</option>
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3 mt-1">
              <label className="text-xs text-gray-400 flex flex-col gap-1.5">
                Line Thickness
                <input
                  type="number" min="1" max="10" step="1"
                  className="bg-gray-900 border border-gray-700 rounded p-1.5 text-center focus:border-purple-500 outline-none text-white text-sm"
                  value={data?.bboxLineThickness ?? 2}
                  onChange={(e) => updateNodeData(id, { bboxLineThickness: parseInt(e.target.value) || 2 })}
                />
              </label>
              <label className="text-xs text-gray-400 flex flex-col gap-1.5">
                Font Thickness
                <input
                  type="number" min="1" max="10" step="1"
                  className="bg-gray-900 border border-gray-700 rounded p-1.5 text-center focus:border-purple-500 outline-none text-white text-sm"
                  value={data?.bboxFontThickness ?? 1}
                  onChange={(e) => updateNodeData(id, { bboxFontThickness: parseInt(e.target.value) || 1 })}
                />
              </label>
            </div>
          </div>

          {/* Confidence Threshold */}
          <div className="border border-gray-700/50 rounded-lg p-3 bg-gray-800/30 flex flex-col gap-3">
            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Confidence Threshold</div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={confidenceThreshold}
                onChange={handleConfidenceChange}
                className="flex-1 accent-purple-500"
              />
              <span className="text-sm font-mono text-purple-300 w-10 text-right">{confidenceThreshold.toFixed(2)}</span>
            </div>
          </div>

          {/* Class Filter */}
          {modelClasses.length > 0 ? (
            <div className="border border-gray-700/50 rounded-lg p-3 bg-gray-800/30 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Filter size={12} /> Class Filter
                </div>
                <span className="text-xs font-semibold text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">{activeClassCount}/{modelClasses.length} Selected</span>
              </div>
              
              <label className="flex items-center gap-3 cursor-pointer py-1 border-b border-gray-700/50 pb-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleAllToggle}
                  className="accent-purple-500 w-4 h-4"
                />
                <span className="text-sm text-gray-200 font-semibold">Select All Classes</span>
              </label>
              
              <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {modelClasses.map(cls => (
                  <div key={cls} className="flex items-center justify-between py-1 group hover:bg-gray-800/50 rounded px-1 -mx-1">
                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isClassSelected(cls)}
                        onChange={() => handleClassToggle(cls)}
                        className="accent-purple-500 w-3.5 h-3.5"
                      />
                      <span className="text-sm text-gray-300 truncate">{cls}</span>
                    </label>
                    {isClassSelected(cls) && (
                      <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">conf</span>
                        <input
                          type="number" min="0" max="1" step="0.05"
                          value={data?.classConfidences?.[cls] ?? confidenceThreshold}
                          onChange={e => handleClassConfidenceChange(cls, parseFloat(e.target.value))}
                          className="bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs w-14 text-center text-purple-300 outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600 text-center py-4 border border-dashed border-gray-700 rounded-lg">
              No class names — set them in{' '}
              <span className="text-purple-500">Settings → Models</span>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end bg-gray-800/30 mt-auto">
          <button onClick={onClose} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-purple-900/20">Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
