import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

export default function WidgetSettingsModal({ isOpen, onClose, onSave, widgetItem, projectId }) {
  const [formData, setFormData] = useState({ title: '', dataPath: '', unit: '' });
  const [dataSources, setDataSources] = useState([]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/data-sources?project_id=${projectId}`)
      .then(res => res.json())
      .then(data => setDataSources(data))
      .catch(err => console.error("Failed to load data sources:", err));
  }, [projectId]);

  useEffect(() => {
    if (widgetItem && widgetItem.config) {
      setFormData({
        title: widgetItem.config.title || '',
        dataPath: widgetItem.config.dataPath || '',
        dataPaths: widgetItem.config.dataPaths || (widgetItem.config.dataPath ? [widgetItem.config.dataPath] : []),
        unit: widgetItem.config.unit || '',
        chartType: widgetItem.config.chartType || 'stepAfter',
        color: widgetItem.config.color || '#10b981',
        threshold: widgetItem.config.threshold || '',
        timeframe: widgetItem.config.timeframe || '5m',
        lockTimeframe: widgetItem.config.lockTimeframe || false,
        yMin: widgetItem.config.yMin || '',
        yMax: widgetItem.config.yMax || ''
      });
    }
  }, [widgetItem]);

  if (!isOpen || !widgetItem) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    const selectedSource = dataSources.find(ds => ds.id === formData.dataPath);
    const extraConfig = {};
    if (selectedSource) {
      if (selectedSource.stream_id !== undefined) extraConfig.stream_id = selectedSource.stream_id;
      if (selectedSource.has_ai !== undefined) extraConfig.has_ai = selectedSource.has_ai;
    }
    onSave(widgetItem.i, { ...widgetItem.config, ...formData, ...extraConfig });
  };

  const getSupportedTypes = (type) => {
    switch(type) {
      case 'metric': return ['number'];
      case 'text': return ['text', 'boolean'];
      case 'textFeed': return ['array_text'];
      case 'chart': return ['number', 'array_number'];
      case 'video': return ['video'];
      case 'imageGallery': return ['image'];
      default: return []; // Specific widgets like heatmap, status, actions might not need data binding here
    }
  };

  const supportedTypes = widgetItem ? getSupportedTypes(widgetItem.type) : [];
  const filteredSources = dataSources.filter(ds => supportedTypes.includes(ds.dataType));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="flex justify-between items-center bg-gray-800 p-4 border-b border-gray-700">
          <h3 className="font-bold text-gray-200">Widget Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Widget Title</label>
            <input 
              type="text" 
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
              placeholder="e.g. People Count"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Data Path Binding</label>
            {widgetItem.type === 'chart' ? (
              <div className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus-within:border-blue-500 max-h-32 overflow-y-auto">
                {filteredSources.length === 0 ? (
                  <p className="text-gray-500 italic">No supported sources available.</p>
                ) : (
                  filteredSources.map(ds => (
                    <label key={ds.id} className="flex items-center gap-2 mb-1 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.dataPaths?.includes(ds.id)}
                        onChange={(e) => {
                          const paths = formData.dataPaths || [];
                          if (e.target.checked) {
                            setFormData({ ...formData, dataPaths: [...paths, ds.id] });
                          } else {
                            setFormData({ ...formData, dataPaths: paths.filter(p => p !== ds.id) });
                          }
                        }}
                        className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{ds.name} ({ds.dataType})</span>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <select 
                name="dataPath"
                value={formData.dataPath}
                onChange={handleChange}
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
              >
                <option value="">-- Select Data Source --</option>
                {filteredSources.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name} ({ds.dataType})</option>
                ))}
              </select>
            )}
            
            <p className="text-xs text-gray-500 mt-1">
              {supportedTypes.length > 0 
                ? `Only data types [${supportedTypes.join(', ')}] are supported.` 
                : "No data binding required for this widget."}
            </p>
          </div>

          {widgetItem.type === 'metric' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Unit Label (Optional)</label>
              <input 
                type="text" 
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                placeholder="e.g. %, persons, °C"
              />
            </div>
          )}

          {widgetItem.type === 'chart' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Chart Type</label>
                  <select 
                    name="chartType"
                    value={formData.chartType}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                  >
                    <option value="stepAfter">Step Line</option>
                    <option value="monotone">Smooth Line</option>
                    <option value="area">Area Chart</option>
                    <option value="bar">Bar Chart</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Timeframe</label>
                  <div className="flex flex-col gap-2">
                    <select 
                      name="timeframe"
                      value={formData.timeframe}
                      onChange={handleChange}
                      className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    >
                      <option value="5m">5 Minutes</option>
                      <option value="15m">15 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="24h">24 Hours</option>
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input 
                        type="checkbox" 
                        name="lockTimeframe"
                        checked={formData.lockTimeframe || false}
                        onChange={(e) => setFormData({ ...formData, lockTimeframe: e.target.checked })}
                        className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-400">Lock X-Axis (Fixed Window)</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Base Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      className="h-9 w-12 bg-gray-950 border border-gray-700 rounded cursor-pointer"
                    />
                    <input 
                      type="text" 
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                      placeholder="#10b981"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Alert Threshold</label>
                  <input 
                    type="number" 
                    name="threshold"
                    value={formData.threshold}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    placeholder="e.g. 5000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Y-Axis Min (Auto: empty)</label>
                  <input 
                    type="number" 
                    name="yMin"
                    value={formData.yMin}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Y-Axis Max (Auto: empty)</label>
                  <input 
                    type="number" 
                    name="yMax"
                    value={formData.yMax}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    placeholder="Auto"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-800 p-4 border-t border-gray-700 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/50"
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
