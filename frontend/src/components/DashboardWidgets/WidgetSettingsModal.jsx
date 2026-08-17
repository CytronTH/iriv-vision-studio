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
        unit: widgetItem.config.unit || ''
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
      case 'textFeed': return ['text', 'array_text'];
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
        
        <div className="p-4 space-y-4">
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
            <p className="text-xs text-gray-500 mt-1">
              {supportedTypes.length > 0 
                ? `Only data types [${supportedTypes.join(', ')}] are supported for this widget.` 
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
