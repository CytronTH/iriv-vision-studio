import React, { useState } from 'react';
import { X, Download, Package, FileCode, CheckCircle2, Video, HardDrive, Sparkles, Loader2 } from 'lucide-react';

export default function ExportProjectModal({ project, isOpen, onClose }) {
  const [bundleType, setBundleType] = useState('full');
  const [includeVideos, setIncludeVideos] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !project) return null;

  const handleDownload = () => {
    setIsExporting(true);
    const format = bundleType === 'config_only' ? 'json' : 'zip';
    const exportUrl = `/api/projects/backup/export/${project.id}?bundle_type=${bundleType}&include_videos=${includeVideos}&format=${format}`;
    
    // Create temporary download link
    const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsExporting(false);
      onClose();
    }, 1200);
  };

  const nodeCount = project.pipeline?.nodes?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gray-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Download size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Export & Backup Project</h3>
              <p className="text-xs text-gray-400 line-clamp-1">{project.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Project Summary Chip */}
          <div className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <span className="text-gray-400">Pipeline Complexity</span>
            <span className="font-semibold text-blue-400 bg-blue-950/40 border border-blue-800/30 px-2.5 py-1 rounded-lg">
              {nodeCount} Nodes Configured
            </span>
          </div>

          {/* Export Mode Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Select Package Type
            </label>

            {/* Option 1: Full Deployment Package */}
            <div 
              onClick={() => setBundleType('full')}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                bundleType === 'full' 
                  ? 'bg-blue-600/10 border-blue-500/80 shadow-lg shadow-blue-950/30' 
                  : 'bg-gray-950/40 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${bundleType === 'full' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                <Package size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white text-sm">Full Deployment Package (.irivproj)</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Bundles everything: Pipeline logic, dashboard layout, and actual <strong>AI model binary files (.hef)</strong>. Ready to deploy onto any fresh board out-of-the-box.
                </p>
              </div>
            </div>

            {/* Option 2: Config Only */}
            <div 
              onClick={() => setBundleType('config_only')}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                bundleType === 'config_only' 
                  ? 'bg-blue-600/10 border-blue-500/80 shadow-lg shadow-blue-950/30' 
                  : 'bg-gray-950/40 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${bundleType === 'config_only' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                <FileCode size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white text-sm">Workflow Config Only (.json)</span>
                  <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-medium">
                    Lightweight (&lt;50KB)
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Exports node graph structure and dashboard settings without heavy model binaries. Ideal for sharing logic between devices that already have the models installed.
                </p>
              </div>
            </div>
          </div>

          {/* Option: Include sample videos */}
          {bundleType === 'full' && (
            <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-950/40 border border-gray-800/80 cursor-pointer hover:bg-gray-950 transition-colors">
              <input 
                type="checkbox"
                checked={includeVideos}
                onChange={(e) => setIncludeVideos(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-gray-800 border-gray-700 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <Video size={15} className="text-blue-400 shrink-0" />
                <span>Bundle referenced sample video files if camera is a video file</span>
              </div>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Preparing Archive...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Download Package</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
