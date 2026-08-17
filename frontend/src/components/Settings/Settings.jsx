import React, { useState, useEffect } from 'react';
import { Camera, BrainCircuit, Bell, Save, Trash2, Plus } from 'lucide-react';

export default function Settings() {
  const [entities, setEntities] = useState({ cameras: [], models: [], integrations: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cameras');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      const res = await fetch('/api/entities');
      const data = await res.json();
      setEntities({
        cameras: data.cameras || [],
        models: data.models || [],
        integrations: data.integrations || []
      });
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch entities", err);
      setLoading(false);
    }
  };

  const saveEntities = async (newEntities) => {
    setSaving(true);
    try {
      await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntities)
      });
      setEntities(newEntities);
    } catch (err) {
      console.error("Failed to save entities", err);
    }
    setSaving(false);
  };

  // --- Handlers for general entity updates ---
  const handleUpdate = (category, id, field, value) => {
    const updated = { ...entities };
    const updatedCategory = [...updated[category]];
    const idx = updatedCategory.findIndex(e => e.id === id);
    if (idx !== -1) {
      updatedCategory[idx] = { ...updatedCategory[idx], [field]: value };
      updated[category] = updatedCategory;
      setEntities(updated);
    }
  };

  const handleDelete = (category, id) => {
    const updated = { ...entities };
    updated[category] = updated[category].filter(e => e.id !== id);
    saveEntities(updated);
  };

  const handleAdd = (category, defaultItem) => {
    const updated = { ...entities };
    updated[category].push({
      id: `${category.substring(0, 3)}_${Date.now()}`,
      ...defaultItem
    });
    saveEntities(updated);
  };

  const handleSaveAll = () => {
    saveEntities(entities);
  };

  if (loading) return <div className="text-gray-400 p-8">Loading Settings...</div>;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col h-[80vh]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Entity Management</h2>
        <button 
          onClick={handleSaveAll}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 mb-6">
        <button 
          onClick={() => setActiveTab('cameras')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'cameras' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Camera size={18} />
          Source Entities (Cameras)
        </button>
        <button 
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'models' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <BrainCircuit size={18} />
          Model Entities (AI)
        </button>
        <button 
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'integrations' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Bell size={18} />
          Integration Entities (Actions)
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        
        {/* CAMERAS */}
        {activeTab === 'cameras' && (
          <div className="flex flex-col gap-4">
            {entities.cameras.map(cam => (
              <div key={cam.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex gap-4 items-start">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    Name
                    <input type="text" value={cam.name} onChange={e => handleUpdate('cameras', cam.id, 'name', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    Type
                    <select value={cam.type} onChange={e => handleUpdate('cameras', cam.id, 'type', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white">
                      <option value="local">Local Camera (V4L2)</option>
                      <option value="rtsp">RTSP Stream</option>
                      <option value="file">Video File</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400 col-span-2">
                    Source Path / URL
                    <input type="text" value={cam.path} onChange={e => handleUpdate('cameras', cam.id, 'path', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                </div>
                <button onClick={() => handleDelete('cameras', cam.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded mt-6">
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            <button 
              onClick={() => handleAdd('cameras', { name: 'New Camera', type: 'local', path: '/dev/video0' })}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 p-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} /> Add New Source Entity
            </button>
          </div>
        )}

        {/* MODELS */}
        {activeTab === 'models' && (
          <div className="flex flex-col gap-4">
            {entities.models.map(model => (
              <div key={model.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex gap-4 items-start">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    Name
                    <input type="text" value={model.name} onChange={e => handleUpdate('models', model.id, 'name', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    Task Type
                    <select value={model.task} onChange={e => handleUpdate('models', model.id, 'task', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white">
                      <option value="detection">Object Detection</option>
                      <option value="pose">Pose Estimation</option>
                      <option value="segmentation">Segmentation</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    .HEF File Name (in backend/models/)
                    <input type="text" value={model.hef_path} onChange={e => handleUpdate('models', model.id, 'hef_path', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    .SO File Name (Tappas post_process)
                    <input type="text" value={model.so_path} onChange={e => handleUpdate('models', model.id, 'so_path', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                </div>
                <button onClick={() => handleDelete('models', model.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded mt-6">
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            <button 
              onClick={() => handleAdd('models', { name: 'New Model', task: 'detection', hef_path: 'model.hef', so_path: 'lib.so' })}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 p-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} /> Add New Model Entity
            </button>
          </div>
        )}

        {/* INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="flex flex-col gap-4">
            {entities.integrations.map(int => (
              <div key={int.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex gap-4 items-start">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    Name
                    <input type="text" value={int.name} onChange={e => handleUpdate('integrations', int.id, 'name', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    Action Type
                    <select value={int.type} onChange={e => handleUpdate('integrations', int.id, 'type', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white">
                      <option value="console_log">Print to Console</option>
                      <option value="webhook">Send Webhook (POST)</option>
                      <option value="gpio">Trigger GPIO Pin</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400 col-span-2">
                    Target URL / Endpoint
                    <input type="text" value={int.target} onChange={e => handleUpdate('integrations', int.id, 'target', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                </div>
                <button onClick={() => handleDelete('integrations', int.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded mt-6">
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            <button 
              onClick={() => handleAdd('integrations', { name: 'New Integration', type: 'webhook', target: 'https://...' })}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 p-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} /> Add New Integration Entity
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
