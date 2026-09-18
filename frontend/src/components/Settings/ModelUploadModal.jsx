import React, { useState, useRef } from 'react';
import { 
  X, UploadCloud, FileCode, CheckCircle2, AlertCircle, 
  Cpu, Tag, Layers, Scan, UserCheck, ShieldCheck, ChevronDown, ChevronUp,
  Loader2, Sparkles, FileText, Info
} from 'lucide-react';

export default function ModelUploadModal({ isOpen, onClose, onUploadSuccess, soFiles = [] }) {
  const [hefFile, setHefFile] = useState(null);
  const [metadataFile, setMetadataFile] = useState(null);
  const [name, setName] = useState('');
  const [task, setTask] = useState('detection');
  const [version, setVersion] = useState('v1.0');
  const [description, setDescription] = useState('');
  const [soName, setSoName] = useState('');
  const [showAdvancedSo, setShowAdvancedSo] = useState(false);
  const [detectedClasses, setDetectedClasses] = useState([]);
  const [customClassesText, setCustomClassesText] = useState('');
  const [isDraggingHef, setIsDraggingHef] = useState(false);
  const [isDraggingMeta, setIsDraggingMeta] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const hefInputRef = useRef(null);
  const metaInputRef = useRef(null);

  if (!isOpen) return null;

  // Format bytes to readable size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Extract clean title from filename
  const suggestModelName = (filename) => {
    if (!filename) return '';
    const clean = filename.replace(/\.hef$/i, '').replace(/[-_]+/g, ' ').trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  // Client-side quick parser for Ultralytics YOLO metadata.yaml
  const parseYamlClasses = (text) => {
    try {
      const arrayMatch = text.match(/names:\s*\[([^\]]+)\]/);
      if (arrayMatch) {
        return arrayMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      }
      const lines = text.split('\n');
      let inNames = false;
      const names = [];
      for (const line of lines) {
        if (/^names\s*:/i.test(line.trim())) {
          inNames = true;
          continue;
        }
        if (inNames) {
          const itemMatch = line.match(/^\s+(?:\d+|-)\s*:\s*['"]?([^'"]+)['"]?/);
          if (itemMatch) {
            names.push(itemMatch[1].trim());
          } else if (/^\s*-\s+['"]?([^'"]+)['"]?/.test(line)) {
            const listMatch = line.match(/^\s*-\s+['"]?([^'"]+)['"]?/);
            names.push(listMatch[1].trim());
          } else if (/^[a-zA-Z0-9_-]+:/.test(line.trim())) {
            break;
          }
        }
      }
      return names;
    } catch {
      return [];
    }
  };

  const handleHefSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.hef')) {
      setErrorMessage('Please select a valid Hailo .hef model file');
      return;
    }
    setErrorMessage('');
    setHefFile(file);
    if (!name || name === '') {
      setName(suggestModelName(file.name));
    }
  };

  const handleMetadataSelect = (file) => {
    if (!file) return;
    setMetadataFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const classes = parseYamlClasses(text);
      if (classes.length > 0) {
        setDetectedClasses(classes);
        setCustomClassesText(classes.join(', '));
      }
    };
    reader.readAsText(file);
  };

  const handleTaskChange = (newTask) => {
    setTask(newTask);
    // Auto-map default .so if user hasn't chosen a custom one
    const soMap = {
      detection: 'libyolo_hailortpp_post.so',
      pose: 'libyolo_hailortpp_post.so',
      segmentation: 'libyolo_hailortpp_post.so',
      classification: 'libclassification_post.so',
    };
    if (!showAdvancedSo || !soName) {
      setSoName(soMap[newTask] || 'libyolo_hailortpp_post.so');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hefFile) {
      setErrorMessage('Please upload a .hef model file');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('name', name.trim() || suggestModelName(hefFile.name));
      formData.append('task', task);
      formData.append('version', version.trim() || 'v1.0');
      formData.append('description', description.trim());
      formData.append('hef_file', hefFile);
      
      const effectiveSo = soName || (task === 'classification' ? 'libclassification_post.so' : 'libyolo_hailortpp_post.so');
      formData.append('so_name', effectiveSo);

      if (metadataFile) {
        formData.append('metadata_file', metadataFile);
      }

      const res = await fetch('/api/models/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.status === 'success') {
        // If user manually edited classes that differ from metadata, update them
        if (customClassesText.trim()) {
          const manualClasses = customClassesText.split(',').map(s => s.trim()).filter(Boolean);
          if (manualClasses.length > 0 && (!data.classes_found || manualClasses.length !== data.classes_found)) {
            try {
              await fetch(`/api/models/${data.model_id}/classes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classes: manualClasses })
              });
            } catch (err) {
              console.warn("Failed to set manual classes:", err);
            }
          }
        }

        onUploadSuccess(data);
        onClose();
      } else {
        setErrorMessage(data.message || 'Failed to upload model');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const taskOptions = [
    { id: 'detection', label: 'Object Detection', icon: Scan, desc: 'Bounding boxes & labels (YOLOv8, etc.)' },
    { id: 'pose', label: 'Pose Estimation', icon: UserCheck, desc: 'Human keypoints & skeleton tracking' },
    { id: 'segmentation', label: 'Segmentation', icon: Layers, desc: 'Pixel-level masks & boundary contours' },
    { id: 'classification', label: 'Classification', icon: Tag, desc: 'Whole-image category classification' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-purple-500/30 w-full max-w-2xl rounded-2xl shadow-2xl shadow-purple-950/50 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-950/60 via-gray-900 to-gray-900 px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600/30 p-2.5 rounded-xl border border-purple-500/40 text-purple-300">
              <Cpu size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Upload & Register AI Model
                <span className="text-[10px] bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full font-mono">
                  Hailo-8L
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Safe, collision-free storage with automatic checksum verification and post-process matching.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-950/50 border border-red-500/50 text-red-200 text-xs p-3 rounded-xl flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Section 1: HEF File Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Model Binary (.hef) <span className="text-purple-400">*</span>
            </label>

            {!hefFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingHef(true); }}
                onDragLeave={() => setIsDraggingHef(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingHef(false);
                  if (e.dataTransfer.files?.[0]) handleHefSelect(e.dataTransfer.files[0]);
                }}
                onClick={() => hefInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                  isDraggingHef 
                    ? 'border-purple-500 bg-purple-950/30' 
                    : 'border-gray-700 hover:border-purple-500/60 hover:bg-gray-800/50 bg-gray-900/50'
                }`}
              >
                <div className="p-3 bg-purple-600/20 text-purple-400 rounded-full">
                  <UploadCloud size={28} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-200">
                    Drag & drop your <span className="text-purple-400 font-mono font-bold">.hef</span> file here, or <span className="text-purple-400 underline">browse</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Compiled for Hailo-8 / Hailo-8L NPU (e.g. from Hailo DFC or IRIV Model Studio)
                  </div>
                </div>
                <input
                  ref={hefInputRef}
                  type="file"
                  accept=".hef"
                  className="hidden"
                  onChange={(e) => handleHefSelect(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="bg-gray-800/80 border border-purple-500/40 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-900/60 text-purple-300 rounded-lg border border-purple-700/50">
                    <FileCode size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      {hefFile.name}
                      <span className="text-[10px] bg-green-950 text-green-400 border border-green-800 px-1.5 py-0.2 rounded font-mono">
                        {formatFileSize(hefFile.size)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck size={12} className="text-green-400" />
                      Ready to store with unique collision-safe ID
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setHefFile(null); if (hefInputRef.current) hefInputRef.current.value = ''; }}
                  className="text-xs text-gray-400 hover:text-red-400 p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                  Change File
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Model Name & Version */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Model Name <span className="text-purple-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Expiry Date Detector"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 pl-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <Tag size={15} className="absolute left-3 top-3 text-gray-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Version Tag
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Section 3: Task Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              AI Task Type <span className="text-purple-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {taskOptions.map(opt => {
                const IconComponent = opt.icon;
                const isSelected = task === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleTaskChange(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-500 bg-purple-950/40 shadow-sm shadow-purple-900/30'
                        : 'border-gray-800 bg-gray-950/60 hover:bg-gray-800/40 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <IconComponent size={18} className={isSelected ? 'text-purple-300' : 'text-gray-400'} />
                      {isSelected && <CheckCircle2 size={14} className="text-purple-400" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isSelected ? 'text-purple-200' : 'text-gray-300'}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Metadata & Classes */}
          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <FileText size={14} className="text-purple-400" />
                Class Names & Labels
              </span>
              <button
                type="button"
                onClick={() => metaInputRef.current?.click()}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-950/40 hover:bg-purple-900/40 px-2.5 py-1 rounded-lg border border-purple-800/40 transition-colors"
              >
                <UploadCloud size={12} />
                Load metadata.yaml
              </button>
              <input
                ref={metaInputRef}
                type="file"
                accept=".yaml,.yml"
                className="hidden"
                onChange={(e) => handleMetadataSelect(e.target.files?.[0])}
              />
            </div>

            {/* Detected Classes Badges */}
            {detectedClasses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-900/80 rounded-lg border border-gray-800">
                <div className="w-full text-[10px] text-purple-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Detected Classes ({detectedClasses.length}):</span>
                  <span className="text-gray-500">From {metadataFile?.name}</span>
                </div>
                {detectedClasses.map((cls, idx) => (
                  <span key={idx} className="bg-purple-950 text-purple-300 border border-purple-800/60 text-xs px-2 py-0.5 rounded-md font-mono">
                    {cls}
                  </span>
                ))}
              </div>
            )}

            <div>
              <input
                type="text"
                value={customClassesText}
                onChange={(e) => {
                  setCustomClassesText(e.target.value);
                  setDetectedClasses(e.target.value.split(',').map(s => s.trim()).filter(Boolean));
                }}
                placeholder="Comma-separated: cup, person, bottle, forklift"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Type classes or upload YOLO `metadata.yaml` to auto-extract label indices.
              </span>
            </div>
          </div>

          {/* Section 5: Advanced Post-process Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvancedSo(!showAdvancedSo)}
              className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1.5 transition-colors"
            >
              {showAdvancedSo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Advanced: Custom Post-Process (.so Library)
            </button>

            {showAdvancedSo && (
              <div className="mt-2 bg-gray-950/80 p-3 rounded-xl border border-gray-800 space-y-2">
                <label className="block text-xs text-gray-400">
                  Shared Post-Processing Library (.so)
                </label>
                <select
                  value={soName}
                  onChange={(e) => setSoName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Auto-select based on Task ({task})</option>
                  {soFiles.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-500 block">
                  Installed TAPPAS shared libraries on device. By default, IRIV Vision Studio pairs the appropriate YOLO or classification library automatically.
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Description / Notes <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. YOLOv8s trained on 500 warehouse images, 94% mAP"
              className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-gray-950 px-5 py-3.5 border-t border-gray-800 flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <Info size={14} className="text-purple-400" />
            <span>Files are isolated by Unique Model ID</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading || !hefFile}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                isUploading || !hefFile
                  ? 'bg-purple-800/40 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Uploading & Hashing...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Upload & Register Model
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
