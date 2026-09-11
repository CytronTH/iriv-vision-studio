import React, { useState, useEffect } from 'react';
import { 
  Archive, Download, Upload, RefreshCw, HardDrive, CheckCircle2, 
  AlertTriangle, Clock, ShieldCheck, FolderDown, Plus, Trash2, Loader2, Sparkles 
} from 'lucide-react';

export default function BackupManager() {
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [snapshotTag, setSnapshotTag] = useState('');
  const [includeModelsInMaster, setIncludeModelsInMaster] = useState(false);
  const [isExportingMaster, setIsExportingMaster] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch('/api/projects/backup/snapshots');
      const data = await res.json();
      if (data.status === 'success') {
        setSnapshots(data.snapshots || []);
      }
    } catch (err) {
      console.error('Failed to fetch snapshots', err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      if (snapshotTag.trim()) {
        formData.append('name', snapshotTag.trim());
      }
      const res = await fetch('/api/projects/backup/snapshots/create', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatusMessage({ type: 'success', text: data.message });
        setSnapshotTag('');
        fetchSnapshots();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Failed to create snapshot' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (filename) => {
    if (!window.confirm(`Are you sure you want to restore from "${filename}"? Current projects matching IDs in this snapshot will be overwritten.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/backup/snapshots/restore/${encodeURIComponent(filename)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
        window.location.reload();
      } else {
        alert('Failed: ' + data.message);
      }
    } catch (err) {
      alert('Restore error: ' + err.message);
    }
  };

  const handleExportAll = () => {
    setIsExportingMaster(true);
    const url = `/api/projects/backup/export-all?include_models=${includeModelsInMaster}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsExportingMaster(false);
    }, 1500);
  };

  const formatDate = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString();
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner Alert */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-3 animate-in fade-in duration-200 border ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={18} className="text-rose-400 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Hero Cards: Master Backup & Snapshots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Card 1: Master Archive Export */}
        <div className="bg-gray-900 border border-gray-800 hover:border-blue-900/50 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
                <Archive size={24} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Master Archive Export</h3>
                <p className="text-xs text-gray-400">Export all projects into a single archive</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed pt-1">
              Creates a master backup package containing all configured projects, cameras, and integration definitions on this board.
            </p>

            <label className="flex items-center gap-2.5 pt-2 text-xs text-gray-300 cursor-pointer">
              <input 
                type="checkbox"
                checked={includeModelsInMaster}
                onChange={(e) => setIncludeModelsInMaster(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-gray-800 border-gray-700"
              />
              <span>Bundle all AI Model binary weights (.hef)</span>
            </label>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExportAll}
              disabled={isExportingMaster}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all active:scale-95 disabled:opacity-50"
            >
              {isExportingMaster ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Preparing Master Package...</span>
                </>
              ) : (
                <>
                  <FolderDown size={18} />
                  <span>Download All Projects</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Instant Local Snapshot */}
        <div className="bg-gray-900 border border-gray-800 hover:border-indigo-900/50 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                <HardDrive size={24} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Local Quick-Snapshot</h3>
                <p className="text-xs text-gray-400">Save restore point on device storage</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed pt-1">
              Instantly stores an on-board backup in <code className="text-gray-300 bg-gray-950 px-1 py-0.5 rounded text-[11px] font-mono">/home/pi/iriv-backups/projects/</code>. Perfect before trying experimental pipeline changes.
            </p>

            <div className="pt-1">
              <input 
                type="text"
                placeholder="Optional tag (e.g. before_update)"
                value={snapshotTag}
                onChange={(e) => setSnapshotTag(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 transition-all active:scale-95 disabled:opacity-50"
            >
              {creatingSnapshot ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Snapshot...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Create Snapshot Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Snapshots Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-400" />
            <h3 className="text-base font-bold text-white">Local Restore Points</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {snapshots.length}
            </span>
          </div>

          <button
            onClick={fetchSnapshots}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            title="Refresh list"
          >
            <RefreshCw size={16} className={loadingSnapshots ? "animate-spin" : ""} />
          </button>
        </div>

        {loadingSnapshots ? (
          <div className="py-12 flex justify-center text-gray-500">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-xl bg-gray-950/40">
            No local snapshots created yet. Click "Create Snapshot Now" above to save your first restore point.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-950/80 uppercase tracking-wider text-[10px] text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="py-3 px-3">Snapshot File</th>
                  <th className="py-3 px-3">Created At</th>
                  <th className="py-3 px-3">Projects</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {snapshots.map((s) => (
                  <tr key={s.filename} className="hover:bg-gray-850 transition-colors">
                    <td className="py-3 px-3 font-mono text-gray-200 font-semibold">{s.filename}</td>
                    <td className="py-3 px-3 text-gray-400">{formatDate(s.created_at)}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-blue-950/60 border border-blue-800/40 text-blue-300 rounded font-semibold">
                        {s.projects_count} Projects
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-400">{s.size_mb} MB</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleRestoreSnapshot(s.filename)}
                        className="bg-gray-800 hover:bg-emerald-600 hover:text-white text-gray-300 px-3 py-1 rounded-lg text-xs font-medium transition-colors border border-gray-700"
                        title="Restore this snapshot"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
