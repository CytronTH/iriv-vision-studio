import React, { useState, useEffect } from 'react';
import { 
  Camera, BrainCircuit, Bell, Save, Trash2, Plus, Film, Upload, ArrowUpCircle, Archive,
  Copy, Check, Cpu, ShieldCheck, Tag, FileCode
} from 'lucide-react';
import UpdateManager from './UpdateManager';
import BackupManager from './BackupManager';
import ModelUploadModal from './ModelUploadModal';

export default function Settings() {
  const [entities, setEntities] = useState({ cameras: [], models: [], integrations: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cameras');
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoFiles, setVideoFiles] = useState([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [soFiles, setSoFiles] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);

  // Model Upload & Hash Copying states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [copiedHashId, setCopiedHashId] = useState(null);

  const handleCopyHash = (id, hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  useEffect(() => {
    fetchEntities();
    fetchVideos();
    fetchSoFiles();
    fetchVideoDevices();
  }, []);

  const fetchVideoDevices = async () => {
    try {
      const res = await fetch('/api/system/video-devices');
      const data = await res.json();
      if (data.status === 'success') setVideoDevices(data.devices || []);
    } catch (err) {
      console.error('Failed to fetch video devices', err);
    }
  };

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

  const handleToggleCamera = (id, currentVal) => {
    const newVal = !currentVal;
    const updated = { ...entities };
    const updatedCams = updated.cameras.map(c => c.id === id ? { ...c, is_enabled: newVal } : c);
    updated.cameras = updatedCams;
    setEntities(updated);
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
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 sm:p-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold">
          {activeTab === 'updates' ? 'System & Platform Updates' : activeTab === 'backups' ? 'Project Backups & Migration' : 'Entity Management'}
        </h2>
        {activeTab !== 'updates' && activeTab !== 'backups' && (
          <button 
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors active:scale-95 w-full sm:w-auto"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 mb-6 overflow-x-auto whitespace-nowrap pb-2 scrollbar-none">
        <button 
          onClick={() => setActiveTab('cameras')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 font-medium text-xs sm:text-sm transition-colors shrink-0 ${
            activeTab === 'cameras' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Camera size={18} />
          Source Entities (Cameras)
        </button>
        <button 
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 font-medium text-xs sm:text-sm transition-colors shrink-0 ${
            activeTab === 'models' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <BrainCircuit size={18} />
          Model Entities (AI)
        </button>
        <button 
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 font-medium text-xs sm:text-sm transition-colors shrink-0 ${
            activeTab === 'integrations' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Bell size={18} />
          Integration Entities (Actions)
        </button>
        <button 
          onClick={() => setActiveTab('videos')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 font-medium text-xs sm:text-sm transition-colors shrink-0 ${
            activeTab === 'videos' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Film size={18} />
          Video Files
        </button>
        <button 
          onClick={() => setActiveTab('backups')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 font-medium text-xs sm:text-sm transition-colors shrink-0 ${
            activeTab === 'backups' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Archive size={18} />
          Backups & Migration
        </button>
        <button 
          onClick={() => setActiveTab('updates')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 font-medium text-xs sm:text-sm transition-colors shrink-0 ${
            activeTab === 'updates' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <ArrowUpCircle size={18} />
          Platform Updates
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        
        {/* CAMERAS */}
        {activeTab === 'cameras' && (
          <div className="flex flex-col gap-4">
            {entities.cameras.map(cam => {
              const isEnabled = cam.is_enabled !== false;
              return (
                <div key={cam.id} className={`p-3 sm:p-4 rounded-lg border transition-all flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start ${
                  isEnabled 
                    ? 'bg-gray-800/50 border-gray-700' 
                    : 'bg-gray-900/40 border-gray-800 opacity-70'
                }`}>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    <label className="flex flex-col gap-1 text-sm text-gray-400 sm:col-span-2">
                      Source Path / URL
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={cam.path} 
                          onChange={e => handleUpdate('cameras', cam.id, 'path', e.target.value)} 
                          list={cam.type === 'local' ? "video-devices" : undefined}
                          className="bg-gray-900 border border-gray-700 rounded p-2 text-white flex-1" 
                        />
                        {cam.type === 'local' && (
                          <datalist id="video-devices">
                            {videoDevices.map(dev => (
                              <option key={dev} value={dev}>{dev}</option>
                            ))}
                          </datalist>
                        )}
                      </div>
                    </label>
                  </div>
                  <div className="flex sm:flex-col justify-between sm:justify-center items-end gap-3 sm:mt-6">
                    <button
                      type="button"
                      onClick={() => handleToggleCamera(cam.id, isEnabled)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                        isEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-white'
                      }`}
                      title={isEnabled ? "Click to Disable Camera" : "Click to Enable Camera"}
                    >
                      <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                      {isEnabled ? 'Active' : 'Disabled'}
                    </button>
                    <button onClick={() => handleDelete('cameras', cam.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded active:scale-95 transition-colors" title="Delete Camera">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
            <button 
              onClick={() => handleAdd('cameras', { name: 'New Camera', type: 'local', path: '/dev/video0', is_enabled: true })}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 p-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} /> Add New Source Entity
            </button>
          </div>
        )}

        {/* MODELS */}
        {activeTab === 'models' && (
          <div className="flex flex-col gap-4">
            {/* Top Bar with Call-to-action */}
            <div className="bg-gradient-to-r from-purple-950/40 via-gray-900 to-gray-900 p-4 rounded-xl border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                  <BrainCircuit size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    AI Model Registry
                    <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full border border-purple-700/50">
                      {entities.models.length} Models
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Manage compiled .hef neural models, versioning, classes, and Hailo-8L post-processing libraries.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-900/30 hover:scale-[1.02] active:scale-95 shrink-0"
              >
                <Plus size={16} />
                Upload New AI Model
              </button>
            </div>

            {/* Model Cards List */}
            <div className="grid grid-cols-1 gap-3">
              {entities.models.map(model => {
                const isCopied = copiedHashId === model.id;
                return (
                  <div 
                    key={model.id} 
                    className="bg-gray-800/60 hover:bg-gray-800/80 p-4 rounded-xl border border-gray-700/70 hover:border-purple-500/40 transition-all flex flex-col gap-3.5 shadow-md"
                  >
                    {/* Card Top Row: Name, Badges, Delete */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-700/50 pb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-1.5 bg-purple-900/40 text-purple-300 rounded-lg border border-purple-700/40">
                          <Cpu size={16} />
                        </div>
                        <input 
                          type="text" 
                          value={model.name} 
                          onChange={e => handleUpdate('models', model.id, 'name', e.target.value)} 
                          className="bg-transparent border-b border-transparent hover:border-gray-600 focus:border-purple-500 font-bold text-white text-base focus:bg-gray-900 px-1 py-0.5 rounded transition-colors" 
                          title="Click to rename"
                        />
                        <span className="text-[11px] font-mono font-bold bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full">
                          {model.version || 'v1.0'}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          model.task === 'pose' 
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/50' 
                            : model.task === 'segmentation'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                            : model.task === 'classification'
                            ? 'bg-blue-950/60 text-blue-300 border-blue-800/50'
                            : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50'
                        }`}>
                          {model.task || 'detection'}
                        </span>
                        <span className="text-[10px] text-gray-400 bg-gray-900 px-2 py-0.5 rounded-full border border-gray-800 flex items-center gap-1">
                          <ShieldCheck size={11} className="text-green-400" /> Hailo-8L Ready
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button 
                          onClick={() => {
                            if (window.confirm(`Delete model '${model.name}'? Active projects using this model will be affected.`)) {
                              handleDelete('models', model.id);
                            }
                          }} 
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" 
                          title="Delete Model"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Specs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      {/* Stored & Original Filename */}
                      <div className="bg-gray-900/70 p-2.5 rounded-lg border border-gray-800/80 space-y-1">
                        <div className="text-gray-400 text-[11px] font-semibold flex items-center gap-1">
                          <FileCode size={13} className="text-purple-400" /> File Identity
                        </div>
                        <div className="text-gray-200 font-mono text-[11px] truncate" title={model.hef_path}>
                          {model.hef_path}
                        </div>
                        <div className="text-gray-500 text-[10px] truncate" title={model.original_filename || model.hef_path}>
                          Orig: {model.original_filename || model.hef_path}
                        </div>
                      </div>

                      {/* Checksum & Size */}
                      <div className="bg-gray-900/70 p-2.5 rounded-lg border border-gray-800/80 space-y-1">
                        <div className="text-gray-400 text-[11px] font-semibold flex items-center justify-between">
                          <span>SHA-256 Checksum</span>
                          <span className="text-purple-300 font-mono text-[10px]">
                            {formatFileSize(model.file_size)}
                          </span>
                        </div>
                        {model.file_hash ? (
                          <button
                            type="button"
                            onClick={() => handleCopyHash(model.id, model.file_hash)}
                            className="w-full flex items-center justify-between bg-gray-950 hover:bg-gray-900 border border-gray-800 rounded px-2 py-1 text-[11px] font-mono text-gray-300 transition-colors"
                            title={`Click to copy full SHA-256: ${model.file_hash}`}
                          >
                            <span className="truncate">{model.file_hash.substring(0, 14)}...</span>
                            {isCopied ? (
                              <span className="text-green-400 text-[10px] flex items-center gap-0.5">
                                <Check size={11} /> Copied
                              </span>
                            ) : (
                              <Copy size={11} className="text-gray-500 hover:text-gray-300" />
                            )}
                          </button>
                        ) : (
                          <div className="text-gray-500 text-[11px] italic">No hash recorded</div>
                        )}
                      </div>

                      {/* Post-Process .so */}
                      <div className="bg-gray-900/70 p-2.5 rounded-lg border border-gray-800/80 space-y-1">
                        <div className="text-gray-400 text-[11px] font-semibold">
                          Post-Process (.so)
                        </div>
                        <select 
                          value={model.so_path} 
                          onChange={e => handleUpdate('models', model.id, 'so_path', e.target.value)} 
                          className="w-full bg-gray-950 border border-gray-800 rounded p-1 text-xs text-gray-200 focus:outline-none focus:border-purple-500 font-mono"
                        >
                          {soFiles.length === 0 ? (
                            <option value={model.so_path}>{model.so_path}</option>
                          ) : (
                            soFiles.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Classes Tags Row */}
                    <div className="bg-gray-900/50 p-2.5 rounded-lg border border-gray-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                          <Tag size={12} className="text-purple-400" />
                          Classes ({model.classes ? model.classes.length : 0})
                        </span>
                        <label className="cursor-pointer text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-950/40 hover:bg-purple-900/40 px-2 py-0.5 rounded border border-purple-800/40 transition-colors">
                          <Upload size={11} />
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
                                  alert(`✅ Loaded ${data.classes.length} classes for ${model.name}`);
                                } else {
                                  alert('Error: ' + data.message);
                                }
                              } catch(err) {
                                alert('Upload failed: ' + err.message);
                              }
                            }}
                          />
                        </label>
                      </div>

                      {model.classes && model.classes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {model.classes.map((cls, idx) => (
                            <span key={idx} className="bg-purple-950/80 text-purple-300 border border-purple-800/50 text-[11px] px-2 py-0.5 rounded-md font-mono">
                              {cls}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-500 italic">
                          No class names defined (will use default COCO or model indices).
                        </div>
                      )}

                      {/* Quick comma-separated class editor */}
                      <input
                        type="text"
                        value={(model.classes || []).join(', ')}
                        onChange={e => handleUpdate('models', model.id, 'classes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="Edit classes comma-separated: cup, bottle, person"
                        className="w-full bg-gray-950/80 border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>
                );
              })}

              {entities.models.length === 0 && (
                <div className="text-center py-10 bg-gray-800/30 rounded-xl border border-gray-800 text-gray-500 text-sm">
                  No AI models registered yet. Click &quot;Upload New AI Model&quot; to add your first Hailo model.
                </div>
              )}
            </div>

            {/* Modal for Model Upload */}
            <ModelUploadModal
              isOpen={isUploadModalOpen}
              onClose={() => setIsUploadModalOpen(false)}
              onUploadSuccess={(data) => {
                fetchEntities();
              }}
              soFiles={soFiles}
            />
          </div>
        )}

        {/* INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="flex flex-col gap-4">
            {entities.integrations.map(int => (
              <div key={int.id} className="bg-gray-800/50 p-3 sm:p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  <label className="flex flex-col gap-1 text-sm text-gray-400 sm:col-span-2">
                    Target URL / Endpoint
                    <input type="text" value={int.target} onChange={e => handleUpdate('integrations', int.id, 'target', e.target.value)} className="bg-gray-900 border border-gray-700 rounded p-2 text-white" />
                  </label>
                </div>
                <div className="flex justify-end sm:mt-6">
                  <button onClick={() => handleDelete('integrations', int.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded active:scale-95 transition-colors" title="Delete Integration">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
            <button 
              onClick={() => handleAdd('integrations', { name: 'New Integration', type: 'webhook', target: 'https://...' })}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 p-4 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95"
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

        {/* PLATFORM UPDATES */}
        {activeTab === 'updates' && (
          <UpdateManager />
        )}

        {/* BACKUPS & MIGRATION */}
        {activeTab === 'backups' && (
          <BackupManager />
        )}

      </div>
    </div>
  );
}
