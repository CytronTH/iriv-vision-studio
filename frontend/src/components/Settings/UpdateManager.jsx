import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, DownloadCloud, CheckCircle2, AlertCircle, 
  UploadCloud, Terminal, ShieldCheck, History, Cpu, 
  GitBranch, ArrowUpRight, HardDrive, RotateCcw, FileArchive,
  ChevronDown, ChevronUp, Sparkles, Loader2, Check, AlertTriangle
} from 'lucide-react';

export default function UpdateManager() {
  // System Version State
  const [versionInfo, setVersionInfo] = useState(null);
  const [versionLoading, setVersionLoading] = useState(true);

  // Update Check State
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkError, setCheckError] = useState(null);

  // Update Execution State
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectCountdown, setReconnectCountdown] = useState(25);

  // Offline Package Upload
  const [dragOver, setDragOver] = useState(false);
  const [uploadingPackage, setUploadingPackage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Fetch initial version & status
  useEffect(() => {
    fetchSystemVersion();
    checkCurrentUpdateStatus();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const fetchSystemVersion = async () => {
    try {
      setVersionLoading(true);
      const res = await fetch('/api/system/version');
      const data = await res.json();
      if (data.status === 'success') {
        setVersionInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch system version:', err);
    } finally {
      setVersionLoading(false);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      setCheckingUpdate(true);
      setCheckError(null);
      const res = await fetch('/api/system/update/check');
      const data = await res.json();

      if (data.status === 'offline') {
        setCheckError('System appears to be offline or unable to reach GitHub remote repository.');
        setUpdateInfo({ has_update: false, offline: true });
      } else if (data.status === 'success') {
        setUpdateInfo(data);
      } else {
        setCheckError(data.message || 'Failed to check for updates');
      }
    } catch (err) {
      setCheckError('Network error while checking updates: ' + err.message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const checkCurrentUpdateStatus = async () => {
    try {
      const res = await fetch('/api/system/update/status');
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setUpdateStatus(data.data);
        if (data.data.status === 'running') {
          setUpdating(true);
          startPolling();
        }
      }
    } catch (err) {
      console.error('Failed to get update status', err);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/system/update/status');
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          const current = data.data;
          setUpdateStatus(current);

          if (current.status === 'completed' || current.step === 'restart') {
            clearInterval(pollIntervalRef.current);
            startReconnectionFlow();
          } else if (current.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setUpdating(false);
          }
        }
      } catch (err) {
        // If fetch fails during restart, trigger reconnection flow
        clearInterval(pollIntervalRef.current);
        startReconnectionFlow();
      }
    }, 1500);
  };

  const startReconnectionFlow = () => {
    setReconnecting(true);
    let count = 25;
    setReconnectCountdown(count);

    const countdownTimer = setInterval(() => {
      count -= 1;
      setReconnectCountdown(count);
      if (count <= 0) {
        clearInterval(countdownTimer);
      }
    }, 1000);

    // Ping healthcheck every 2 seconds
    const pingInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/system/ping', { cache: 'no-store' });
        const data = await res.json();
        if (data.status === 'ok') {
          clearInterval(pingInterval);
          clearInterval(countdownTimer);
          setReconnecting(false);
          setUpdating(false);
          // Auto reload page to apply all changes
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        }
      } catch (e) {
        // Still rebooting / restarting
      }
    }, 2000);
  };

  const handleApplyUpdate = async () => {
    const confirmMsg = updateInfo?.commits_behind 
      ? `Update platform with ${updateInfo.commits_behind} new commit(s)? System will restart automatically.`
      : "Update platform to latest version? System will restart automatically.";

    if (!window.confirm(confirmMsg)) return;

    try {
      setUpdating(true);
      setShowLogDrawer(true);
      const res = await fetch('/api/system/update/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_version: updateInfo?.latest_version || 'main' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        startPolling();
      } else {
        alert('Failed to start update: ' + data.message);
        setUpdating(false);
      }
    } catch (err) {
      alert('Error triggering update: ' + err.message);
      setUpdating(false);
    }
  };

  const handleOfflinePackageUpload = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.tar.gz') && !file.name.endsWith('.tgz')) {
      alert('Please upload a valid .tar.gz archive');
      return;
    }

    if (!window.confirm(`Apply offline update package "${file.name}"? System will backup current settings, apply updates, and restart.`)) {
      return;
    }

    setUploadingPackage(true);
    setUploadProgress(10);
    const formData = new FormData();
    formData.append('package', file);

    try {
      setUpdating(true);
      setShowLogDrawer(true);
      const res = await fetch('/api/system/update/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setUploadingPackage(false);

      if (data.status === 'success') {
        startPolling();
      } else {
        alert('Update upload failed: ' + data.message);
        setUpdating(false);
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
      setUploadingPackage(false);
      setUpdating(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleOfflinePackageUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/20 border border-blue-800/40 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Platform & System Updates
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                IRIV Vision Studio
              </span>
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Keep your Edge AI platform up-to-date with seamless 1-click OTA or offline air-gapped packages.
            </p>
          </div>
        </div>

        <button
          onClick={handleCheckUpdates}
          disabled={checkingUpdate || updating}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-900/30 active:scale-95 shrink-0 w-full sm:w-auto justify-center"
        >
          <RefreshCw size={16} className={checkingUpdate ? 'animate-spin' : ''} />
          {checkingUpdate ? 'Checking Remote...' : 'Check for Updates'}
        </button>
      </div>

      {/* Grid: Current Version & System Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Installed Version */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <History size={14} className="text-blue-400" />
              Installed Version
            </span>
            <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 font-mono text-[11px] border border-green-500/20">
              Active
            </span>
          </div>
          <div className="my-1">
            <div className="text-xl font-bold font-mono text-white tracking-wide truncate">
              {versionLoading ? 'Loading...' : versionInfo?.version || 'v1.0.0'}
            </div>
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
              <span>Commit: <span className="font-mono text-gray-400">{versionInfo?.commit || '—'}</span></span>
              <span>•</span>
              <span>{versionInfo?.commit_date || 'Recent'}</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 pt-3 mt-2 border-t border-gray-800/80 flex items-center gap-1">
            <GitBranch size={12} className="text-gray-500" />
            Branch: <span className="text-gray-300 font-medium">{versionInfo?.branch || 'main'}</span>
          </div>
        </div>

        {/* Card 2: Device Hardware & OS */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <Cpu size={14} className="text-purple-400" />
              Host Device
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono text-[11px] border border-purple-500/20">
              Raspberry Pi 5
            </span>
          </div>
          <div className="my-1">
            <div className="text-sm font-semibold text-gray-200 line-clamp-1">
              {versionInfo?.platform ? versionInfo.platform.split('-')[0] : 'Linux OS'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Python runtime: <span className="font-mono text-purple-300">{versionInfo?.python_version || '3.11'}</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 pt-3 mt-2 border-t border-gray-800/80 flex items-center gap-1">
            <HardDrive size={12} className="text-gray-500" />
            Hailo-8L AI Accelerator Ready
          </div>
        </div>

        {/* Card 3: Backup & Safety Guarantee */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Fail-Safe Protection
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[11px] border border-emerald-500/20">
              Auto-Backup
            </span>
          </div>
          <div className="my-1">
            <div className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              Database & Models Safeguarded
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Previous configurations are backed up to <code className="text-gray-300 bg-gray-800 px-1 rounded">/home/pi/iriv-backups/</code> before update.
            </p>
          </div>
          <div className="text-[11px] text-emerald-400/80 pt-3 mt-2 border-t border-gray-800/80 flex items-center gap-1">
            <RotateCcw size={12} />
            Auto-rollback enabled on failure
          </div>
        </div>
      </div>

      {/* Online Update Status Display */}
      {checkError && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4 text-sm text-amber-300 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-200">Notice</div>
            <div>{checkError}</div>
          </div>
        </div>
      )}

      {updateInfo && updateInfo.has_update && (
        <div className="bg-gradient-to-r from-blue-950/60 to-purple-950/40 border border-blue-500/50 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center shrink-0 mt-1">
                <DownloadCloud size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    New Update Available
                  </span>
                  <span className="text-sm font-semibold text-gray-300 font-mono">
                    {updateInfo.commits_behind} commit(s) ahead
                  </span>
                </div>
                <h4 className="text-xl font-bold text-white mt-1">
                  IRIV Vision Studio {updateInfo.latest_version || 'Latest'}
                </h4>
                <p className="text-xs sm:text-sm text-gray-300 mt-1">
                  Ready to upgrade from <span className="font-mono text-gray-400">{updateInfo.current_version}</span> to latest remote code.
                </p>
              </div>
            </div>

            <button
              onClick={handleApplyUpdate}
              disabled={updating}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/30 active:scale-95 shrink-0"
            >
              <DownloadCloud size={18} />
              {updating ? 'Updating System...' : 'Update to Latest Now'}
            </button>
          </div>

          {/* Changelog list */}
          {updateInfo.changelog && updateInfo.changelog.length > 0 && (
            <div className="mt-5 pt-4 border-t border-blue-800/40">
              <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">
                What's New in this Update:
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                {updateInfo.changelog.map((c, idx) => (
                  <div key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="font-mono text-blue-400 shrink-0 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/50">
                      {c.hash}
                    </span>
                    <span className="line-clamp-1">{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {updateInfo && !updateInfo.has_update && !updateInfo.offline && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Check size={20} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">IRIV Vision Studio is Up to Date</h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Your system is running the latest commits on branch <span className="font-mono text-gray-300">{updateInfo.branch || 'main'}</span>.
              </p>
            </div>
          </div>

          <button
            onClick={handleApplyUpdate}
            disabled={updating}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors shrink-0"
          >
            Force Reinstall / Re-sync
          </button>
        </div>
      )}

      {/* Progress & Live Console (Visible when updating or requested) */}
      {(updating || (updateStatus && updateStatus.status !== 'idle')) && (
        <div className="bg-gray-900 border border-blue-500/40 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span className="text-sm font-bold text-white">
                {updateStatus?.step === 'restart' || reconnecting ? 'Platform Restarting...' : 'Applying Platform Update...'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-semibold">
                {updateStatus?.progress || 0}%
              </span>
            </div>

            <button
              onClick={() => setShowLogDrawer(!showLogDrawer)}
              className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors"
            >
              <Terminal size={14} />
              {showLogDrawer ? 'Hide Logs' : 'View Logs'}
              {showLogDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(5, updateStatus?.progress || 0)}%` }}
            />
          </div>

          <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
            <span>{updateStatus?.message || 'Processing update...'}</span>
            <span className="font-mono text-gray-500 uppercase">{updateStatus?.step || 'init'}</span>
          </div>

          {/* Collapsible Log Terminal */}
          {showLogDrawer && (
            <div className="mt-4 bg-black/80 rounded-xl p-3 border border-gray-800 font-mono text-[11px] text-gray-300 max-h-52 overflow-y-auto space-y-1">
              {updateStatus?.logs && updateStatus.logs.length > 0 ? (
                updateStatus.logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-gray-600 select-none mr-2">{i + 1}</span>
                    <span className={log.includes('ERROR') ? 'text-red-400 font-semibold' : log.includes('Backup') ? 'text-emerald-400' : 'text-gray-300'}>
                      {log}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 italic">Waiting for update log output...</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reconnecting Overlay Modal */}
      {reconnecting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-blue-500/40 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <RotateCcw size={32} className="animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-white">Restarting Platform</h3>
            <p className="text-sm text-gray-300 mt-2">
              IRIV Vision Studio is restarting with the latest updates. Reconnecting to services automatically...
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="text-xs text-gray-400">Estimated reconnect:</span>
              <span className="font-mono font-bold text-blue-400 text-lg">~{Math.max(0, reconnectCountdown)}s</span>
            </div>
            <div className="mt-4 text-[11px] text-gray-500">
              Do not unplug the power. Page will refresh automatically when online.
            </div>
          </div>
        </div>
      )}

      {/* Offline / Air-Gapped Section */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <FileArchive size={18} />
          </div>
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              Air-Gapped / Offline Update
              <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                Factory Environment
              </span>
            </h4>
            <p className="text-xs text-gray-400">
              If the device has no internet access, upload an update archive package (<code className="text-gray-300">.tar.gz</code>) directly.
            </p>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragOver 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-gray-700/80 hover:border-gray-600 bg-gray-950/40 hover:bg-gray-950/70'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleOfflinePackageUpload(e.target.files[0]);
              }
            }}
            accept=".tar.gz,.tgz"
            className="hidden"
          />

          <div className="w-12 h-12 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center mb-3">
            <UploadCloud size={24} />
          </div>

          <div className="text-sm font-semibold text-gray-200 text-center">
            {uploadingPackage ? 'Uploading update package...' : 'Click to browse or drag & drop update package (.tar.gz)'}
          </div>
          <div className="text-xs text-gray-500 text-center mt-1">
            Packages are verified, unpacked, and applied with automatic database backups.
          </div>
        </div>
      </div>
    </div>
  );
}
