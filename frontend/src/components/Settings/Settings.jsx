import React, { useState, useEffect } from 'react';
import { Camera, BrainCircuit, Bell, Save, Trash2, Plus, Film, Upload } from 'lucide-react';

export default function Settings() {
  const [entities, setEntities] = useState({ cameras: [], models: [], integrations: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cameras');
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoFiles, setVideoFiles] = useState([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [soFiles, setSoFiles] = useState([]);

  useEffect(() => {
    fetchEntities();
    fetchVideos();
    fetchSoFiles();
  }, []);

  const fetchSoFiles = async () => {
    try {
      const res = await fetch('/api/so-files');
      const data = await res.json();
      if (data.status === 'success') setSoFiles(data.files);
    } catch (err) {
      console.error('Failed to fetch .so files', err);
    }
  };

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      if (data.status === 'success') setVideoFiles(data.files);
    } catch (err) {
      console.error('Failed to fetch videos', err);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) {
      alert('File exceeds 1GB limit!');
      return;
    }
    setVideoUploading(true);
    const formData = new FormData();
    formData.append('video_file', file);
    try {
      const res = await fetch('/api/videos/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        alert(`Uploaded: ${data.filename}`);
        fetchVideos();
        fetchEntities();
      } else {
        alert('Upload failed: ' + data.message);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setVideoUploading(false);
    e.target.value = '';
  };

  const handleVideoDelete = async (filename) => {
    if (!confirm(`Delete "${filename}" and remove from system?`)) return;
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        fetchVideos();
        fetchEntities();
      } else {
        alert('Delete failed: ' + data.message);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

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

  const handleUploadModel = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    // so_name is a plain text field — send as multipart form string (already in FormData)
    setUploading(true);
    try {
      const res = await fetch('/api/models/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if(data.status === 'success') {
        alert('Model uploaded successfully!');
        fetchEntities();
        e.target.reset();
      } else {
        alert('Error: ' + data.message);
      }
    } catch(err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading(false);
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
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col h-full">
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
        <button 
          onClick={() => setActiveTab('videos')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'videos' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Film size={18} />
          Video Files
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
            
            {/* Upload Form */}
            <div className="bg-gray-800 p-4 rounded-lg border border-purple-500/50 mb-2 shadow-lg shadow-purple-900/10">
              <h3 className="text-lg font-bold text-purple-400 mb-3">Upload Custom Model</h3>
              <form onSubmit={handleUploadModel} className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm text-gray-400">
                  Model Name
                  <input type="text" name="name" required placeholder="e.g. Expiry Date Detector" className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-400">
                  Task Type
                  <select name="task" className="bg-gray-900 border border-gray-700 rounded p-2 text-white">
                    <option value="detection">Object Detection</option>
                    <option value="pose">Pose Estimation</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-400">
                  .HEF File
                  <input type="file" name="hef_file" accept=".hef" required className="text-white mt-1 text-xs file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500" />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-400">
                  metadata.yaml <span className="text-gray-600 text-xs">(optional — auto-fills class names)</span>
                  <input type="file" name="metadata_file" accept=".yaml,.yml" className="text-white mt-1 text-xs file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-400">
                  Post-Process Library (.so)
                  <select name="so_name" required className="bg-gray-900 border border-gray-700 rounded p-2 text-white">
                    {soFiles.length === 0 ? (
                      <option value="">Loading .so files...</option>
                    ) : (
                      soFiles.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))
                    )}
                  </select>
                  <span className="text-xs text-gray-500 mt-1">Select from TAPPAS libs installed on this device</span>
                </label>
                <button type="submit" disabled={uploading} className="col-span-2 bg-purple-600 hover:bg-purple-500 text-white rounded p-2 font-bold mt-2 transition-colors">
                  {uploading ? 'Uploading...' : 'Upload Model'}
                </button>
              </form>
            </div>

            <h3 className="text-lg font-bold text-gray-300 mt-2 pb-2 border-b border-gray-800">Available Models</h3>

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
                    .SO File (Post-process)
                    <select value={model.so_path} onChange={e => handleUpdate('models', model.id, 'so_path', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white">
                      {soFiles.length === 0 ? (
                        <option value={model.so_path}>{model.so_path}</option>
                      ) : (
                        soFiles.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400 col-span-2">
                    <div className="flex items-center justify-between">
                      <span>Class Names <span className="text-gray-600 text-xs">(comma-separated, e.g. cup, expire_date)</span></span>
                      <label className="cursor-pointer text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
                        <Upload size={12} />
                        Upload metadata.yaml
                        <input
                          type="file"
                          accept=".yaml,.yml"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('metadata_file', file);
                            try {
                              const res = await fetch(`/api/models/${model.id}/metadata`, { method: 'POST', body: formData });
                              const data = await res.json();
                              if (data.status === 'success') {
                                handleUpdate('models', model.id, 'classes', data.classes);
                                alert(`✅ Loaded ${data.classes.length} classes: ${data.classes.join(', ')}`);
                              } else {
                                alert('Error: ' + data.message);
                              }
                            } catch (err) {
                              alert('Upload failed: ' + err.message);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={(model.classes || []).join(', ')}
                      onChange={e => {
                        const classes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        handleUpdate('models', model.id, 'classes', classes);
                      }}
                      placeholder="e.g. cup, expire_date"
                      className="bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
                    />
                    {(model.classes || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(model.classes || []).map(cls => (
                          <span key={cls} className="bg-purple-900/50 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-700/50">{cls}</span>
                        ))}
                      </div>
                    )}
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

        {/* VIDEO FILES */}
        {activeTab === 'videos' && (
          <div className="flex flex-col gap-4">

            {/* Upload Area */}
            <div className="bg-gray-800 p-5 rounded-xl border border-cyan-500/40 shadow-lg shadow-cyan-900/10">
              <h3 className="text-lg font-bold text-cyan-400 mb-1 flex items-center gap-2">
                <Film size={18} /> Upload Video File
              </h3>
              <p className="text-xs text-gray-400 mb-4">Supported formats: .mp4, .avi, .mkv, .mov, .webm — Max 1GB</p>
              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${videoUploading ? 'border-gray-600 bg-gray-700/30' : 'border-cyan-600/50 bg-cyan-900/10 hover:bg-cyan-900/20 hover:border-cyan-500'}`}>
                <div className="flex flex-col items-center justify-center gap-2">
                  {videoUploading ? (
                    <div className="text-cyan-400 text-sm animate-pulse">Uploading... please wait</div>
                  ) : (
                    <>
                      <Upload size={28} className="text-cyan-500" />
                      <span className="text-sm text-gray-300">Click to select or drag & drop a video file</span>
                    </>
                  )}
                </div>
                <input type="file" accept=".mp4,.avi,.mkv,.mov,.webm" className="hidden" onChange={handleVideoUpload} disabled={videoUploading} />
              </label>
            </div>

            {/* Video List */}
            <h3 className="text-base font-bold text-gray-300 pt-2 pb-1 border-b border-gray-800 flex items-center gap-2">
              <Film size={16} className="text-cyan-400" /> Uploaded Videos ({videoFiles.length})
            </h3>

            {videoFiles.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No video files uploaded yet.</div>
            ) : (
              videoFiles.map((vf) => (
                <div key={vf.filename} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Film size={20} className="text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{vf.filename}</div>
                      <div className="text-xs text-gray-400">{(vf.size_bytes / (1024 * 1024)).toFixed(1)} MB</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleVideoDelete(vf.filename)}
                    className="p-2 text-red-500 hover:bg-red-500/20 rounded shrink-0 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
