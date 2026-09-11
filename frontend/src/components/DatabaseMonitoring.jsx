import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Image as ImageIcon, Trash2, Activity, ShieldAlert, Check, RefreshCw } from 'lucide-react';

export default function DatabaseMonitoring() {
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cleanup states
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupOptions, setCleanupOptions] = useState({
    days: 30,
    max_records: 50000,
    delete_files: true
  });

  const fetchDbStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/database/stats');
      const data = await res.json();
      if (data.status === 'success') {
        setDbStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch DB stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbStats();
    const interval = setInterval(fetchDbStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteCleanup = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/database/maintenance/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanupOptions)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCleanupResult(data.result);
        fetchDbStats();
      } else {
        setCleanupResult({ error: data.message || 'Cleanup failed' });
      }
    } catch (err) {
      setCleanupResult({ error: err.message });
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 overflow-y-auto bg-gray-950">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Database Monitoring</h1>
            <p className="text-gray-400 text-sm mt-1">Global Storage & Database Health</p>
          </div>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SQLite DB File</p>
            <h3 className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {dbStats?.db_file_size_mb ? `${dbStats.db_file_size_mb} MB` : (loading ? 'Loading...' : '-')}
            </h3>
            <p className="text-[11px] text-emerald-400/90 mt-0.5 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              WAL Mode Enabled (WAL: {dbStats?.wal_file_size_mb || 0} MB)
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HardDrive size={20} />
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Snapshots Stored</p>
            <h3 className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {dbStats?.snapshot_count ? dbStats.snapshot_count.toLocaleString() : (loading ? 'Loading...' : '-')}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {dbStats?.snapshot_size_mb ? `${(dbStats.snapshot_size_mb / 1024).toFixed(2)} GB on disk` : '...'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ImageIcon size={20} />
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Event Logs</p>
            <h3 className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {dbStats?.total_event_logs ? dbStats.total_event_logs.toLocaleString() : (loading ? 'Loading...' : '0')}
            </h3>
            <p className="text-[11px] text-blue-400 mt-0.5">All Projects</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Activity size={20} />
          </div>
        </div>
        
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Storage Cleanup</p>
            <button 
              onClick={() => setShowCleanupModal(true)}
              className="mt-2 text-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={16} /> Manage Space
            </button>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Global Records Summary */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mt-4">
        <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">Global Records Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-500 mb-1">Projects</div>
            <div className="text-xl font-bold text-gray-200">{dbStats?.total_projects || 0}</div>
          </div>
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-500 mb-1">Cameras</div>
            <div className="text-xl font-bold text-gray-200">{dbStats?.total_cameras || 0}</div>
          </div>
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-500 mb-1">Models</div>
            <div className="text-xl font-bold text-gray-200">{dbStats?.total_models || 0}</div>
          </div>
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-500 mb-1">Metrics Logged</div>
            <div className="text-xl font-bold text-gray-200">{dbStats?.total_metrics?.toLocaleString() || 0}</div>
          </div>
        </div>
      </div>

      {/* Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Database Cleanup</h3>
                <p className="text-xs text-slate-400">Purge old event logs and reclaim disk space</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-lg text-xs">
                <strong>Warning:</strong> This action permanently deletes historical event logs and associated snapshot images. It cannot be undone.
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Retention Policy (Keep logs newer than):
                  </label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                    value={cleanupOptions.days}
                    onChange={(e) => setCleanupOptions({...cleanupOptions, days: Number(e.target.value)})}
                  >
                    <option value="7">7 Days</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="del_files"
                    checked={cleanupOptions.delete_files}
                    onChange={(e) => setCleanupOptions({...cleanupOptions, delete_files: e.target.checked})}
                    className="accent-rose-500 w-4 h-4 rounded bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="del_files" className="text-slate-300">Also delete associated snapshot images from disk</label>
                </div>
              </div>

              {cleanupResult && (
                <div className={`mt-4 p-3 rounded-lg border text-sm ${cleanupResult.error ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                  {cleanupResult.error ? (
                    <div>Error: {cleanupResult.error}</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5"><Check size={16} /> Cleanup successful!</div>
                      <div className="text-xs opacity-90 pl-5">
                        • Deleted {cleanupResult.deleted_rows?.toLocaleString() || 0} rows<br/>
                        • Deleted {cleanupResult.deleted_files?.toLocaleString() || 0} files
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => { setShowCleanupModal(false); setCleanupResult(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                disabled={cleanupLoading}
              >
                Close
              </button>
              <button 
                onClick={handleExecuteCleanup}
                disabled={cleanupLoading}
                className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {cleanupLoading ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Execute Cleanup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
