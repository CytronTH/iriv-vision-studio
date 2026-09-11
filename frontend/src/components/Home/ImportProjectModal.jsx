import React, { useState, useRef } from 'react';
import { 
  X, Upload, FileUp, CheckCircle2, AlertTriangle, Package, BrainCircuit, 
  Video, Play, Loader2, ArrowRight, RefreshCw, HardDrive, ShieldAlert, FileText 
} from 'lucide-react';

export default function ImportProjectModal({ isOpen, onClose, onImportSuccess, onOpenProject }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  // Import Options
  const [importMode, setImportMode] = useState('new'); // 'new' | 'overwrite'
  const [customName, setCustomName] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [overwriteModels, setOverwriteModels] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setImportMode('new');
    setCustomName('');
    setAutoStart(false);
    setOverwriteModels(false);
    setIsImporting(false);
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) processFile(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  };

  const processFile = async (selectedFile) => {
    setFile(selectedFile);
    setIsInspecting(true);
    setError(null);
    setPreview(null);

    const formData = new FormData();
    formData.append('package_file', selectedFile);

    try {
      const res = await fetch('/api/projects/backup/inspect', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.status === 'success') {
        setPreview(data);
        // Default custom name if conflict exists
        if (data.conflicts?.name_exists || data.conflicts?.id_exists) {
          setCustomName(`${data.project.name} (Imported)`);
        } else {
          setCustomName(data.project.name);
        }
      } else {
        setError(data.message || 'Failed to inspect backup package');
      }
    } catch (err) {
      setError(err.message || 'Network error while inspecting package');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);

    const formData = new FormData();
    formData.append('package_file', file);
    formData.append('mode', importMode);
    if (customName && customName.trim()) {
      formData.append('custom_name', customName.trim());
    }
    formData.append('overwrite_models', overwriteModels);
    formData.append('auto_start', autoStart);

    try {
      const res = await fetch('/api/projects/backup/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.status === 'success') {
        setImportResult(data);
        if (onImportSuccess) onImportSuccess(data);
      } else {
        setError(data.message || 'Import failed');
      }
    } catch (err) {
      setError(err.message || 'Network error during import');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gray-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Upload size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Import & Deploy Project</h3>
              <p className="text-xs text-gray-400">Restore or migrate a pipeline package from file</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* STEP 1: Success Banner */}
          {importResult ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">Import Successful!</h4>
                <p className="text-sm text-gray-400 mt-1 max-w-md">
                  Project <span className="text-emerald-400 font-semibold font-mono">"{importResult.project_name}"</span> has been deployed onto this board and is ready.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  View in Projects
                </button>
                {onOpenProject && (
                  <button
                    onClick={() => {
                      handleClose();
                      onOpenProject({ id: importResult.project_id, name: importResult.project_name });
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                  >
                    <span>Open in Studio</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          ) : !preview ? (
            /* STEP 2: Dropzone */
            <div className="space-y-4">
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-500/10 scale-[0.99]' 
                    : 'border-gray-700 hover:border-blue-500/50 bg-gray-950/40 hover:bg-gray-950/70'
                }`}
              >
                <input 
                  ref={fileInputRef}
                  type="file"
                  accept=".irivproj,.zip,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-gray-800/80 border border-gray-700 flex items-center justify-center text-blue-400 mb-1">
                  <FileUp size={32} />
                </div>

                {isInspecting ? (
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <Loader2 size={24} className="animate-spin text-blue-400" />
                    <span className="text-sm font-medium">Analyzing package & dependencies...</span>
                  </div>
                ) : (
                  <>
                    <h4 className="text-base font-semibold text-white">
                      Drop your project package here, or <span className="text-blue-400 hover:underline">browse</span>
                    </h4>
                    <p className="text-xs text-gray-500 max-w-sm">
                      Supports <span className="text-gray-300 font-mono">.irivproj</span> (Full Deployment Bundle with AI models) or <span className="text-gray-300 font-mono">.json</span> configuration files.
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5">
                  <ShieldAlert size={16} className="text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* STEP 3: Inspection Preview & Configuration */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Project Card Preview */}
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <Package size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base leading-tight">{preview.project.name}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{preview.project.description || "No description provided"}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 shrink-0 border border-gray-700">
                    {preview.project.file_size_mb} MB ({preview.project.bundle_type})
                  </span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-800/40">
                    {preview.project.nodes_count} Nodes
                  </span>
                  {preview.project.node_types?.map(t => (
                    <span key={t} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gray-800/80 text-gray-400 border border-gray-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* AI Models Included */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <BrainCircuit size={14} className="text-purple-400" />
                  <span>AI Models Required ({preview.models?.length || 0})</span>
                </label>
                
                {preview.models?.length > 0 ? (
                  <div className="space-y-1.5">
                    {preview.models.map(m => (
                      <div key={m.id} className="p-3 rounded-xl bg-gray-950/60 border border-gray-800/80 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-purple-950 text-purple-300 border border-purple-800/40 rounded">
                              {m.task}
                            </span>
                          </div>
                          <div className="text-gray-500 text-[11px] font-mono mt-0.5 truncate">
                            {m.hef_file} ({m.classes_count} classes)
                          </div>
                        </div>

                        {m.exists_on_device ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-md shrink-0">
                            <CheckCircle2 size={12} />
                            Already Installed
                          </span>
                        ) : m.is_bundled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-1 rounded-md shrink-0">
                            <HardDrive size={12} />
                            Will Install (.hef)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-1 rounded-md shrink-0">
                            <AlertTriangle size={12} />
                            Missing Binary
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic p-2 bg-gray-950/30 rounded-lg">
                    No dedicated AI model entities required.
                  </div>
                )}
              </div>

              {/* Conflict Resolution */}
              {(preview.conflicts?.id_exists || preview.conflicts?.name_exists) && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                    <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                    <span>Project name or ID already exists on this device</span>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="new" 
                        checked={importMode === 'new'} 
                        onChange={() => setImportMode('new')}
                        className="text-blue-600 bg-gray-800 border-gray-700"
                      />
                      <span>Import as a new project (Recommended)</span>
                    </label>

                    {importMode === 'new' && (
                      <div className="pl-6 pt-1">
                        <input 
                          type="text"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="Custom Project Name"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="overwrite" 
                        checked={importMode === 'overwrite'} 
                        onChange={() => setImportMode('overwrite')}
                        className="text-red-500 bg-gray-800 border-gray-700"
                      />
                      <span className="text-red-300">Overwrite existing project on this board</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Additional Options */}
              <div className="space-y-2 pt-1 border-t border-gray-800">
                <label className="flex items-center gap-3 text-xs text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => setAutoStart(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-gray-800 border-gray-700 focus:ring-blue-500"
                  />
                  <span>Start and deploy pipeline engine immediately after import</span>
                </label>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5">
                  <ShieldAlert size={16} className="text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/60 shrink-0">
          {preview && !importResult ? (
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Choose different file
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              {importResult ? 'Close' : 'Cancel'}
            </button>

            {preview && !importResult && (
              <button
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all active:scale-95 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Importing & Setting up...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>Import & Deploy Project</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
