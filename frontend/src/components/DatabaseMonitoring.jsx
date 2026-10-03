import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Image as ImageIcon, Trash2, Activity, ShieldAlert, Check, RefreshCw, Archive, Zap, Server, BarChart3, DatabaseZap, Code2 } from 'lucide-react';
import SqlExplorer from './SqlExplorer';

export default function DatabaseMonitoring({ projectId }) {
  const [activeTab, setActiveTab] = useState('health');
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Cleanup states
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupOptions, setCleanupOptions] = useState({
    days: 30,
    max_records: 50000,
    delete_files: true
  });

  const fetchDbStats = async () => {
    try {
      const url = projectId ? `/api/database/stats?project_id=${projectId}` : '/api/database/stats';
      const res = await fetch(url);
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
    const interval = setInterval(fetchDbStats, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleExecuteCleanup = async () => {
    setActionLoading(true);
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
      setActionLoading(false);
    }
  };

  const handleVacuum = async () => {
    if (!confirm('This will lock the databases temporarily to reclaim disk space. Proceed?')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/database/maintenance/vacuum', { method: 'POST' });
      const data = await res.json();
      alert(data.message || (data.status === 'success' ? 'Vacuum successful' : 'Vacuum failed'));
      fetchDbStats();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/database/maintenance/rollup', { method: 'POST' });
      const data = await res.json();
      alert(data.message || (data.status === 'success' ? 'Rollup successful' : 'Rollup failed'));
      fetchDbStats();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200">System Metrics</h2>
          <p className="text-xs text-slate-400 mt-0.5">Health monitoring and SQL Explorer</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${activeTab === 'health' ? 'bg-slate-800 text-gray-900 dark:text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Activity size={16} />
            Health & Maintenance
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${activeTab === 'explorer' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Code2 size={16} />
            SQL Explorer
          </button>
        </div>
      </div>

      {activeTab === 'explorer' ? (
        <div className="flex-1 min-h-[500px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 p-4">
          <SqlExplorer />
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button 
              onClick={fetchDbStats}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Primary Storage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Main SD Card / Disk Space */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Device Storage</p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1 tracking-tight dark:text-white">
                {dbStats?.disk_free_gb ? `${dbStats.disk_free_gb} GB` : (loading ? '...' : '-')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Free of {dbStats?.disk_total_gb || 0} GB</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dbStats?.disk_usage_percent > 85 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <HardDrive size={20} />
            </div>
          </div>
          {dbStats && (
            <div className="mt-4 w-full bg-slate-800 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${dbStats.disk_usage_percent > 85 ? 'bg-rose-500' : dbStats.disk_usage_percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(100, dbStats.disk_usage_percent)}%` }} 
              />
            </div>
          )}
        </div>

        {/* Config DB Size */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Config DB (vision_studio)</p>
            <h3 className="text-2xl font-extrabold text-gray-900 mt-1 tracking-tight dark:text-white">
              {dbStats?.db_file_size_mb ? `${dbStats.db_file_size_mb} MB` : (loading ? '...' : '-')}
            </h3>
            <p className="text-xs text-indigo-400 mt-1">Projects, Models, Cameras</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Database size={20} />
          </div>
        </div>

        {/* Telemetry DB Size */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Telemetry DB (Logs)</p>
            <h3 className="text-2xl font-extrabold text-gray-900 mt-1 tracking-tight dark:text-white">
              {dbStats?.telemetry_file_size_mb ? `${dbStats.telemetry_file_size_mb} MB` : (loading ? '...' : '-')}
            </h3>
            <p className="text-xs text-blue-400 mt-1">High-freq Event Logs</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <DatabaseZap size={20} />
          </div>
        </div>

        {/* Snapshots Size */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Snapshot Images</p>
            <h3 className="text-2xl font-extrabold text-gray-900 mt-1 tracking-tight dark:text-white">
              {dbStats?.snapshot_size_mb ? `${(dbStats.snapshot_size_mb / 1024).toFixed(2)} GB` : (loading ? '...' : '-')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{dbStats?.snapshot_count?.toLocaleString() || 0} files stored</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <ImageIcon size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Data Metrics & Row Counts */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <BarChart3 size={16} /> Data Row Counts
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-gray-200/60 dark:border-gray-800/60">
              <div className="text-xs text-gray-500 mb-1 dark:text-gray-500">Raw Event Logs</div>
              <div className="text-xl font-bold text-blue-400">{dbStats?.total_event_logs?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-gray-200/60 dark:border-gray-800/60">
              <div className="text-xs text-gray-500 mb-1 dark:text-gray-500">System Metrics</div>
              <div className="text-xl font-bold text-amber-400">{dbStats?.total_metrics?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-gray-200/60 dark:border-gray-800/60">
              <div className="text-xs text-gray-500 mb-1 dark:text-gray-500">Raw Class Counts</div>
              <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{dbStats?.total_class_counts?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-xs text-emerald-500 mb-1">Hourly Rollups</div>
              <div className="text-xl font-bold text-emerald-400">{dbStats?.total_hourly_rollups?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>

        {/* Database Write Queue Health */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Server size={16} /> Database Write Queue Health
          </h2>
          <div className="flex gap-4">
            <div className="flex-1 bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 relative overflow-hidden">
              <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider dark:text-gray-500">Pending Writes</div>
              <div className="text-3xl font-mono font-bold text-gray-900 dark:text-white">{dbStats?.log_queue_size || 0}</div>
              <div className="text-xs text-slate-500 mt-2">Max Capacity: {dbStats?.log_queue_max || 10000}</div>
              
              {dbStats && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-800">
                  <div 
                    className={`h-full ${dbStats.log_queue_size > 5000 ? 'bg-rose-500' : 'bg-blue-500'}`}
                    style={{ width: `${(dbStats.log_queue_size / (dbStats.log_queue_max || 10000)) * 100}%` }}
                  />
                </div>
              )}
            </div>
            
            <div className="flex-1 bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col justify-center">
              <div className="text-sm text-slate-400 mb-1">Status</div>
              {dbStats?.log_queue_size > 5000 ? (
                <div className="text-rose-400 font-medium flex items-center gap-1.5"><ShieldAlert size={16}/> High Load</div>
              ) : (
                <div className="text-emerald-400 font-medium flex items-center gap-1.5"><Check size={16}/> Healthy</div>
              )}
              <div className="text-xs text-slate-500 mt-2">Background batch writer is active.</div>
            </div>
          </div>
        </div>

      </div>

      {/* Admin Actions */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
          <Activity size={16} /> Manual Maintenance Actions
        </h2>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => handleRollup()}
            disabled={actionLoading}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-left flex-1 min-w-[250px]"
          >
            <div className="p-2 bg-emerald-500/20 rounded-lg"><Zap size={18} /></div>
            <div>
              <div className="font-semibold text-sm">Force Data Rollup</div>
              <div className="text-xs text-emerald-500/70 mt-0.5">Aggregate raw data into hourly buckets immediately</div>
            </div>
          </button>
          
          <button 
            onClick={() => handleVacuum()}
            disabled={actionLoading}
            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-left flex-1 min-w-[250px]"
          >
            <div className="p-2 bg-indigo-500/20 rounded-lg"><Archive size={18} /></div>
            <div>
              <div className="font-semibold text-sm">Vacuum Database</div>
              <div className="text-xs text-indigo-500/70 mt-0.5">Defragment and reclaim unused disk space</div>
            </div>
          </button>

          <button 
            onClick={() => setShowCleanupModal(true)}
            disabled={actionLoading}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-left flex-1 min-w-[250px]"
          >
            <div className="p-2 bg-rose-500/20 rounded-lg"><Trash2 size={18} /></div>
            <div>
              <div className="font-semibold text-sm">Purge Old Logs</div>
              <div className="text-xs text-rose-500/70 mt-0.5">Delete historical logs and snapshots to free space</div>
            </div>
          </button>
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Database Cleanup</h3>
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
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-gray-900 transition-colors dark:hover:text-white"
                disabled={actionLoading}
              >
                Close
              </button>
              <button 
                onClick={handleExecuteCleanup}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-gray-900 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 dark:text-white"
              >
                {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Execute Cleanup
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
