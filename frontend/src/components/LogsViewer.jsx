import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Image as ImageIcon, RefreshCw, X, ChevronDown, ChevronUp, 
  Download, Play, Pause, Filter, Grid, List, Trash2, HardDrive, 
  Clock, Camera, Search, CheckCircle2, AlertTriangle, ChevronLeft, 
  ChevronRight, Copy, Check, Sparkles, Maximize2, ShieldAlert
} from 'lucide-react';

export default function LogsViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState(null);
  const [cameras, setCameras] = useState([]);
  
  // View mode: 'table' or 'gallery'
  const [viewMode, setViewMode] = useState('gallery');
  
  // Modals
  const [selectedLogIndex, setSelectedLogIndex] = useState(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupOptions, setCleanupOptions] = useState({
    days: 30,
    max_records: 50000,
    delete_files: true
  });

  // Copied payload state
  const [copied, setCopied] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [total, setTotal] = useState(0);
  
  // Filtering
  const [filters, setFilters] = useState({
    event_type: '',
    camera_id: '',
    node_id: '',
    quick: 'all', // 'all', 'snapshot', 'ok', 'ng'
    search: ''
  });
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Expandable rows (table view)
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Fetch Database & Storage Stats
  const fetchDbStats = async () => {
    try {
      const res = await fetch('/api/database/stats');
      const data = await res.json();
      if (data.status === 'success') {
        setDbStats(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch DB stats:", e);
    }
  };

  // Fetch Cameras for Human-readable labels
  const fetchCameras = async () => {
    try {
      const res = await fetch('/api/entities');
      const data = await res.json();
      if (data && data.cameras) {
        setCameras(data.cameras);
      }
    } catch (e) {
      console.error("Failed to fetch cameras:", e);
    }
  };

  // Map camera_id to human readable camera name
  const cameraMap = useMemo(() => {
    const map = {};
    cameras.forEach(c => {
      map[c.id] = c.name || c.id;
    });
    return map;
  }, [cameras]);

  // Fetch Event Logs
  const fetchLogs = async (currentPage = page, currentFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: perPage,
        page: currentPage
      });

      // Quick filter mapping
      let eventType = currentFilters.event_type;
      if (currentFilters.quick === 'snapshot' || currentFilters.quick === 'ok' || currentFilters.quick === 'ng') {
        eventType = 'SNAPSHOT';
      }

      if (eventType) params.append('event_type', eventType);
      if (currentFilters.camera_id) params.append('camera_id', currentFilters.camera_id);
      if (currentFilters.node_id) params.append('node_id', currentFilters.node_id);
      
      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbStats();
    fetchCameras();
  }, []);

  useEffect(() => {
    fetchLogs(page, filters);
  }, [page, perPage, filters.event_type, filters.camera_id, filters.node_id, filters.quick]);

  // Auto-refresh interval
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs(1, filters);
        fetchDbStats();
        if (page !== 1) setPage(1);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, filters, page, perPage]);

  // Filter logs by client-side search (search in payload, camera, node)
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Quick filter for OK / NG
      if (filters.quick === 'ok') {
        const label = log.payload?.label?.toUpperCase();
        if (label !== 'OK') return false;
      } else if (filters.quick === 'ng') {
        const label = log.payload?.label?.toUpperCase();
        if (label !== 'NG') return false;
      }

      // Search keyword filter
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const payloadStr = JSON.stringify(log.payload || {}).toLowerCase();
        const camName = (cameraMap[log.camera_id] || log.camera_id || '').toLowerCase();
        const nodeId = (log.node_id || '').toLowerCase();
        const eventType = (log.event_type || '').toLowerCase();
        return payloadStr.includes(q) || camName.includes(q) || nodeId.includes(q) || eventType.includes(q);
      }
      return true;
    });
  }, [logs, filters.quick, filters.search, cameraMap]);

  // Handle Quick Filter click
  const handleQuickFilter = (quickKey) => {
    setFilters(prev => ({
      ...prev,
      quick: quickKey,
      event_type: quickKey === 'snapshot' || quickKey === 'ok' || quickKey === 'ng' ? 'SNAPSHOT' : ''
    }));
    setPage(1);
  };

  const toggleRowExpanded = (id) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  // Helper for Result Badge (OK, NG, Snapshot, Alert)
  const getBadgeInfo = (log) => {
    const label = log.payload?.label?.toUpperCase();
    if (label === 'OK') {
      return { text: 'OK', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
    }
    if (label === 'NG') {
      return { text: 'NG', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse', icon: AlertTriangle };
    }
    const lowerType = (log.event_type || '').toLowerCase();
    if (lowerType.includes('snapshot')) {
      return { text: log.payload?.label || 'SNAPSHOT', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', icon: ImageIcon };
    }
    if (lowerType.includes('alert') || lowerType.includes('error')) {
      return { text: log.event_type, bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30', icon: AlertTriangle };
    }
    return { text: log.event_type, bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Sparkles };
  };

  const totalPages = Math.ceil(total / perPage);

  // Export filtered/current logs to CSV
  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Event Type', 'Result', 'Camera ID', 'Camera Name', 'Node ID', 'Payload', 'Snapshot Path'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => {
        const payloadStr = log.payload ? JSON.stringify(log.payload).replace(/"/g, '""') : '';
        const camName = cameraMap[log.camera_id] || '';
        const resultLabel = log.payload?.label || '';
        return `"${log.timestamp}","${log.event_type}","${resultLabel}","${log.camera_id || ''}","${camName}","${log.node_id}","${payloadStr}","${log.snapshot_path || ''}"`;
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `iriv_logs_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Run Database Cleanup
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
        fetchLogs(1, filters);
      } else {
        setCleanupResult({ error: data.message || 'Cleanup failed' });
      }
    } catch (err) {
      setCleanupResult({ error: err.message });
    } finally {
      setCleanupLoading(false);
    }
  };

  // Lightbox Navigation
  const selectedLog = selectedLogIndex !== null ? filteredLogs[selectedLogIndex] : null;

  const handleNextImage = () => {
    if (selectedLogIndex !== null && selectedLogIndex < filteredLogs.length - 1) {
      setSelectedLogIndex(selectedLogIndex + 1);
    }
  };

  const handlePrevImage = () => {
    if (selectedLogIndex !== null && selectedLogIndex > 0) {
      setSelectedLogIndex(selectedLogIndex - 1);
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedLogIndex === null) return;
      if (e.key === 'ArrowRight') handleNextImage();
      if (e.key === 'ArrowLeft') handlePrevImage();
      if (e.key === 'Escape') setSelectedLogIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLogIndex, filteredLogs.length]);

  return (
    <div className="h-full flex flex-col p-6 space-y-5 overflow-y-auto bg-slate-950 text-slate-100 font-sans">
      
      {/* ── Top Header & Stats Cards ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Database size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">Database & Event Logs</h1>
                {autoRefresh && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Search, filter, and inspect AI inference events, OK/NG snapshots, and edge storage.
              </p>
            </div>
          </div>

          {/* Quick Global Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button 
              onClick={() => setShowCleanupModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition-all shadow-sm"
              title="Manage Storage and Prune Old Snapshots"
            >
              <Trash2 size={15} />
              <span>Storage Cleanup</span>
            </button>

            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border ${
                autoRefresh 
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-500/10' 
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {autoRefresh ? <Pause size={15} className="text-emerald-400" /> : <Play size={15} />}
              <span>{autoRefresh ? 'Live Auto-Refresh: ON' : 'Auto-Refresh: OFF'}</span>
            </button>

            <button 
              onClick={() => { fetchLogs(page, filters); fetchDbStats(); }}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading && !autoRefresh ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Events */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Event Logs</p>
              <h3 className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">
                {total.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Inference triggers & alerts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database size={20} />
            </div>
          </div>

          {/* Snapshots on Disk */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Snapshots Stored</p>
              <h3 className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">
                {dbStats?.snapshot_count ? dbStats.snapshot_count.toLocaleString() : '-'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {dbStats?.snapshot_size_mb ? `${(dbStats.snapshot_size_mb / 1024).toFixed(2)} GB on disk` : 'Calculating...'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ImageIcon size={20} />
            </div>
          </div>

          {/* Database Health & WAL */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SQLite DB File</p>
              <h3 className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">
                {dbStats?.db_file_size_mb ? `${dbStats.db_file_size_mb} MB` : '-'}
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

          {/* Inspection Result Ratio or View Switcher Card */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Display Mode</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                {viewMode === 'gallery' ? 'Visual Grid' : 'Data Table'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setViewMode('gallery')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === 'gallery'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid size={14} /> Gallery
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <List size={14} /> Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar & Quick Filter Pills ─────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={14} /> Filter:
          </span>
          {[
            { key: 'all', label: 'All Events' },
            { key: 'snapshot', label: '📷 Snapshots' },
            { key: 'ok', label: '✓ OK Items' },
            { key: 'ng', label: '✕ NG Alerts' },
          ].map(pill => (
            <button
              key={pill.key}
              onClick={() => handleQuickFilter(pill.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filters.quick === pill.key
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 border border-slate-800/80'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Dropdowns & Search */}
        <div className="flex items-center gap-2.5 flex-wrap flex-1 md:justify-end">
          {/* Camera Selector Dropdown */}
          <div className="relative">
            <select
              value={filters.camera_id}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, camera_id: e.target.value }));
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer max-w-[180px] truncate"
            >
              <option value="">All Cameras</option>
              {cameras.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Keyword Search Input */}
          <div className="relative flex-1 max-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search payload / node..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
          </div>

          {/* Reset Filters */}
          {(filters.camera_id || filters.search || filters.quick !== 'all' || filters.node_id || filters.event_type) && (
            <button
              onClick={() => {
                setFilters({ event_type: '', camera_id: '', node_id: '', quick: 'all', search: '' });
                setPage(1);
              }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-colors"
            >
              <X size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Main Content Area (Gallery or Table) ────────────────────────── */}
      {viewMode === 'gallery' ? (
        /* ── Visual Gallery View ───────────────────────────────────────── */
        <div className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col">
          {loading && logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <RefreshCw size={28} className="animate-spin text-blue-500" />
              <p className="text-sm">Loading snapshots from database...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <ImageIcon size={38} className="text-slate-700" />
              <p className="text-base font-semibold text-slate-300">No snapshot events found</p>
              <p className="text-xs text-slate-500 max-w-sm text-center">
                Try switching quick filters or wait for the AI inspection node to capture frames.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredLogs.map((log, index) => {
                const badge = getBadgeInfo(log);
                const BadgeIcon = badge.icon;
                const snapUrl = log.snapshot_path ? `/api/snapshots/${log.snapshot_path.split('/').pop()}` : null;
                const camName = cameraMap[log.camera_id] || log.camera_id || 'Camera';
                const timeStr = new Date(log.timestamp + 'Z').toLocaleTimeString();
                const dateStr = new Date(log.timestamp + 'Z').toLocaleDateString();

                return (
                  <div 
                    key={log.id}
                    onClick={() => setSelectedLogIndex(index)}
                    className="group relative bg-slate-950/80 border border-slate-800/80 hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer flex flex-col"
                  >
                    {/* Image Preview Container */}
                    <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
                      {snapUrl ? (
                        <img 
                          src={snapUrl} 
                          alt="Snapshot"
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}

                      <div className={`${snapUrl ? 'hidden' : 'flex'} flex-col items-center justify-center text-slate-600 gap-1 p-2 text-center`}>
                        <ImageIcon size={24} />
                        <span className="text-[10px]">No image</span>
                      </div>

                      {/* Result Badge Overlay */}
                      <div className="absolute top-2 left-2 z-10">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border backdrop-blur-md shadow-sm ${badge.bg}`}>
                          <BadgeIcon size={12} />
                          {badge.text}
                        </span>
                      </div>

                      {/* Time Badge Overlay */}
                      <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-md border border-white/10 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-slate-300">
                        {timeStr}
                      </div>

                      {/* Zoom Indicator on Hover */}
                      <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
                          <Maximize2 size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Meta Footer */}
                    <div className="p-3 flex flex-col justify-between flex-1 bg-slate-950">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-semibold text-slate-300 truncate" title={camName}>
                          {camName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {dateStr}
                        </span>
                      </div>

                      <div className="mt-1.5 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800/60 truncate">
                        {log.payload ? JSON.stringify(log.payload) : log.event_type}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Enhanced Table View ────────────────────────────────────────── */
        <div className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-xl">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] font-semibold text-slate-400 uppercase bg-slate-900/90 border-b border-slate-800 sticky top-0 backdrop-blur-md z-10">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center"></th>
                  <th className="px-4 py-3.5">Snapshot</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Event / Result</th>
                  <th className="px-5 py-3.5">Camera</th>
                  <th className="px-5 py-3.5">Node ID</th>
                  <th className="px-5 py-3.5">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-blue-500" />
                        <p className="text-sm">Loading event logs...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Database size={32} className="text-slate-700" />
                        <p className="text-sm font-semibold text-slate-300">No logs found</p>
                        <p className="text-xs text-slate-500">Try adjusting your filters or keyword query.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isExpanded = expandedRows.has(log.id);
                    const badge = getBadgeInfo(log);
                    const BadgeIcon = badge.icon;
                    const snapUrl = log.snapshot_path ? `/api/snapshots/${log.snapshot_path.split('/').pop()}` : null;
                    const camName = cameraMap[log.camera_id] || log.camera_id || '-';

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-800/40 transition-colors group">
                          {/* Expand Button */}
                          <td className="px-3 py-3 text-center">
                            {log.payload && (
                              <button 
                                onClick={() => toggleRowExpanded(log.id)}
                                className="text-slate-500 hover:text-white p-1 rounded-lg transition-colors hover:bg-slate-800"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            )}
                          </td>

                          {/* Snapshot Thumbnail */}
                          <td className="px-4 py-3">
                            {snapUrl ? (
                              <div 
                                onClick={() => setSelectedLogIndex(index)}
                                className="w-14 h-9 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer relative group/thumb hover:border-blue-500 transition-colors"
                              >
                                <img 
                                  src={snapUrl} 
                                  alt="Thumb" 
                                  className="w-full h-full object-cover" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 size={12} className="text-white" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono text-[11px]">-</span>
                            )}
                          </td>

                          {/* Timestamp */}
                          <td className="px-5 py-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                            {new Date(log.timestamp + 'Z').toLocaleString()}
                          </td>

                          {/* Event / Result */}
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.bg}`}>
                              <BadgeIcon size={12} />
                              {badge.text}
                            </span>
                          </td>

                          {/* Camera Name */}
                          <td className="px-5 py-3 text-slate-200 font-medium">
                            {camName}
                          </td>

                          {/* Node ID */}
                          <td className="px-5 py-3 font-mono text-[11px] text-slate-400">
                            {log.node_id}
                          </td>

                          {/* Payload Summary */}
                          <td className="px-5 py-3 font-mono text-[11px] text-slate-400 max-w-[280px] truncate">
                            {log.payload ? JSON.stringify(log.payload) : '-'}
                          </td>
                        </tr>

                        {/* Expanded Payload Code Block */}
                        {isExpanded && log.payload && (
                          <tr className="bg-slate-950/70">
                            <td colSpan="7" className="px-6 py-4 border-l-2 border-l-blue-500">
                              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 shadow-inner">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                    Structured Payload Data
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2));
                                      setCopied(true);
                                      setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
                                  >
                                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                                  </button>
                                </div>
                                <pre className="text-xs text-blue-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination Bar ─────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 shadow-sm">
        <div>
          Showing {Math.min((page - 1) * perPage + 1, total)} to {Math.min(page * perPage, total)} of {total.toLocaleString()} records
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Per page:</span>
            <select 
              value={perPage} 
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors text-slate-300 flex items-center gap-1 font-medium"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="px-3 py-1 font-semibold text-white bg-slate-950 border border-slate-800 rounded-xl">
              {page} / {totalPages || 1}
            </div>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors text-slate-300 flex items-center gap-1 font-medium"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Lightbox Image Inspector Modal ─────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative max-w-5xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Snapshot Inspector
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getBadgeInfo(selectedLog).bg}`}>
                      {getBadgeInfo(selectedLog).text}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {cameraMap[selectedLog.camera_id] || selectedLog.camera_id || 'Camera'} • {new Date(selectedLog.timestamp + 'Z').toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedLog.snapshot_path && (
                  <a 
                    href={`/api/snapshots/${selectedLog.snapshot_path.split('/').pop()}`}
                    download
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700/80 text-xs flex items-center gap-1.5"
                    title="Download high-resolution image"
                  >
                    <Download size={15} />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                )}
                <button 
                  onClick={() => setSelectedLogIndex(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors border border-slate-700/80"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Image + Metadata */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row bg-slate-950">
              
              {/* Image View with Navigation Arrows */}
              <div className="relative flex-1 bg-black flex items-center justify-center p-4 min-h-[360px] max-h-[65vh]">
                {selectedLog.snapshot_path ? (
                  <img 
                    src={`/api/snapshots/${selectedLog.snapshot_path.split('/').pop()}`} 
                    alt="Snapshot Large" 
                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="text-slate-600 flex flex-col items-center gap-2">
                    <ImageIcon size={48} />
                    <span>No snapshot image file available</span>
                  </div>
                )}

                {/* Left/Right Prev/Next Buttons */}
                {selectedLogIndex > 0 && (
                  <button 
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-lg backdrop-blur-md transition-all active:scale-95"
                    title="Previous Snapshot (Arrow Left)"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                {selectedLogIndex < filteredLogs.length - 1 && (
                  <button 
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-lg backdrop-blur-md transition-all active:scale-95"
                    title="Next Snapshot (Arrow Right)"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>

              {/* Sidebar Metadata */}
              <div className="w-full md:w-80 bg-slate-900/80 border-t md:border-t-0 md:border-l border-slate-800 p-5 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Event Information</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-500">Log ID</span>
                        <span className="font-mono text-slate-300">{selectedLog.id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-500">Event Type</span>
                        <span className="text-slate-200 font-semibold">{selectedLog.event_type}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-500">Camera</span>
                        <span className="text-slate-200 font-medium truncate max-w-[150px]" title={cameraMap[selectedLog.camera_id]}>
                          {cameraMap[selectedLog.camera_id] || selectedLog.camera_id}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-500">Pipeline Node</span>
                        <span className="font-mono text-[11px] text-slate-300 truncate max-w-[140px]" title={selectedLog.node_id}>
                          {selectedLog.node_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payload Details */}
                  {selectedLog.payload && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payload JSON</h4>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(selectedLog.payload, null, 2));
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-blue-200 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                        {JSON.stringify(selectedLog.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="pt-4 text-center">
                  <span className="text-[11px] text-slate-500">
                    Item {selectedLogIndex + 1} of {filteredLogs.length} on this page
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Storage Cleanup & Maintenance Modal ─────────────────────────── */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6">
            
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Storage Maintenance</h3>
                  <p className="text-xs text-slate-400">Purge historical logs & free up SD/Flash storage</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowCleanupModal(false); setCleanupResult(null); }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Storage Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 mb-5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Database File Size:</span>
                <span className="font-mono font-bold text-white">{dbStats?.db_file_size_mb || 0} MB</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Snapshots on Disk:</span>
                <span className="font-mono font-bold text-indigo-400">{dbStats?.snapshot_count?.toLocaleString() || 0} files</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Snapshots Disk Usage:</span>
                <span className="font-mono font-bold text-rose-400">
                  {dbStats?.snapshot_size_mb ? `${(dbStats.snapshot_size_mb / 1024).toFixed(2)} GB` : '0 GB'}
                </span>
              </div>
            </div>

            {/* Cleanup Options Form */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Retention Policy (Purge logs older than):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 14, 30, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCleanupOptions(prev => ({ ...prev, days: d }))}
                      className={`py-2 rounded-xl font-semibold border transition-all ${
                        cleanupOptions.days === d
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Maximum Records to Retain in SQLite:
                </label>
                <select
                  value={cleanupOptions.max_records}
                  onChange={(e) => setCleanupOptions(prev => ({ ...prev, max_records: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="25000">25,000 records</option>
                  <option value="50000">50,000 records (Recommended)</option>
                  <option value="100000">100,000 records</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                <input
                  type="checkbox"
                  id="delete_files"
                  checked={cleanupOptions.delete_files}
                  onChange={(e) => setCleanupOptions(prev => ({ ...prev, delete_files: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
                />
                <label htmlFor="delete_files" className="text-slate-300 cursor-pointer select-none">
                  <span className="font-semibold block">Delete associated snapshot images from disk</span>
                  <span className="text-[11px] text-slate-500">Safely reclaims SD card/NVMe disk space</span>
                </label>
              </div>
            </div>

            {/* Results or Error Message */}
            {cleanupResult && (
              <div className={`mt-4 p-3 rounded-xl border text-xs ${
                cleanupResult.error 
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                {cleanupResult.error ? (
                  <p>Error: {cleanupResult.error}</p>
                ) : (
                  <p>
                    ✓ Successfully pruned <strong>{cleanupResult.deleted_rows?.toLocaleString()}</strong> logs and deleted <strong>{cleanupResult.deleted_files?.toLocaleString()}</strong> image files!
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowCleanupModal(false); setCleanupResult(null); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleExecuteCleanup}
                disabled={cleanupLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50"
              >
                {cleanupLoading && <RefreshCw size={14} className="animate-spin" />}
                <span>{cleanupLoading ? 'Pruning...' : 'Run Cleanup Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
