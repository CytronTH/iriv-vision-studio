import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Terminal, Activity, Table as TableIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';

export default function VariableDataViewerModal({ isOpen, onClose, projectId, variable, nodeMap = {} }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!projectId || !variable?.variable_name) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/variables/${variable.variable_name}/history?limit=100`);
      const data = await res.json();
      if (data.status === 'success') {
        // Reverse array to have chronological order for chart (oldest to newest)
        setHistory(data.data.reverse() || []);
      }
    } catch (e) {
      console.error("Failed to fetch variable history:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async (days) => {
    if (!window.confirm(`Are you sure you want to delete all historical data for '${variable.variable_name}' older than ${days} days?`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/variables/${variable.variable_name}/cleanup?days=${days}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
        fetchHistory();
      }
    } catch (e) {
      console.error("Failed to cleanup variable history:", e);
    }
  };

  const handleDeleteVariable = async () => {
    const confirmText = `delete ${variable.variable_name}`;
    const input = window.prompt(`WARNING: This will completely delete the variable '${variable.variable_name}' and ALL its historical data. This cannot be undone.\n\nPlease type '${confirmText}' to confirm:`);
    
    if (input !== confirmText) {
      if (input !== null) alert("Deletion cancelled: Confirmation text did not match.");
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/variables/${variable.variable_name}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
        onClose(); // Close modal and let parent refresh
      }
    } catch (e) {
      console.error("Failed to delete variable:", e);
    }
  };

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, projectId, variable]);

  if (!isOpen || !variable) return null;

  const nodeInfo = nodeMap[variable.node_id] || { label: 'Unknown Node', type: 'unknown' };

  // Calculate data span to show effective retention
  let spanText = "No data";
  if (history.length > 0) {
    const oldestTimestamp = history[0].timestamp * 1000;
    const now = Date.now();
    const diffMs = now - oldestTimestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffDays > 0) spanText = `${diffDays} Days`;
    else if (diffHours > 0) spanText = `${diffHours} Hours`;
    else spanText = `${diffMins} Minutes`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-gray-50 dark:bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 dark:text-white">
              <Activity size={20} className="text-indigo-400" />
              {variable.variable_name}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
              <span className="font-semibold text-slate-300">{nodeInfo.label}</span> ({nodeInfo.type}) &bull; <Terminal size={12} className="ml-1" /> <span className="font-mono text-[10px]">{variable.node_id}</span> &bull; Latest: {typeof variable.value === 'number' ? variable.value.toFixed(2) : variable.value}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-gray-900 hover:bg-gray-100 dark:bg-slate-800 rounded-lg transition-colors dark:hover:text-white"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 p-4 sm:p-6 flex flex-col gap-6">
          {/* Chart Section */}
          <div className="bg-gray-50 dark:bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm h-72 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trend (Last 100 points)</h4>
              <div className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">
                Data Span: {spanText}
              </div>
            </div>
            <div className="h-full w-full pb-4">
              {loading && history.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                  No historical data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#475569" 
                      fontSize={10}
                      tickFormatter={(unix) => new Date(unix + 'Z').toLocaleTimeString()}
                      minTickGap={30}
                    />
                    <YAxis stroke="#475569" fontSize={10} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', fontSize: '12px' }}
                      labelFormatter={(unix) => new Date(unix + 'Z').toLocaleString()}
                    />
                    <Area type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Action/Retention Section */}
          <div className="bg-gray-50 dark:bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Retention:</span>
              <button onClick={() => handleCleanup(7)} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">Keep 7 Days</button>
              <button onClick={() => handleCleanup(15)} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">Keep 15 Days</button>
              <button onClick={() => handleCleanup(30)} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">Keep 30 Days</button>
            </div>
            <button 
              onClick={handleDeleteVariable}
              className="text-xs px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-colors font-medium flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Delete Variable Entirely
            </button>
          </div>

          {/* Table Section */}
          <div className="flex-1 bg-gray-50 dark:bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-[250px]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                 <TableIcon size={14} /> Raw Data
               </h4>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-white dark:bg-slate-950 text-xs uppercase text-slate-500 sticky top-0 z-10 shadow-sm border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Timestamp</th>
                    <th className="px-4 py-3 font-semibold">Value</th>
                    <th className="px-4 py-3 font-semibold">Node ID</th>
                    <th className="px-4 py-3 font-semibold text-right">Log ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {/* Map history in descending order for table (newest first) */}
                  {[...history].reverse().map((row) => (
                    <tr key={row.id} className="hover:bg-gray-100 dark:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs">{new Date(row.timestamp + 'Z').toLocaleString()}</td>
                      <td className="px-4 py-2 font-mono text-indigo-400 font-semibold">{row.value}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{row.node_id}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs text-right">{row.id}</td>
                    </tr>
                  ))}
                  {history.length === 0 && !loading && (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
