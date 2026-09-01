import React, { useState, useEffect } from 'react';
import { Database, Image as ImageIcon, RefreshCw, X, ChevronDown, ChevronUp, Download, Play, Pause, Filter } from 'lucide-react';

export default function LogsViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  
  // Filtering
  const [filters, setFilters] = useState({
    event_type: '',
    camera_id: '',
    node_id: ''
  });
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Expandable rows
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const fetchLogs = async (currentPage = page, currentFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: perPage,
        page: currentPage
      });
      if (currentFilters.event_type) params.append('event_type', currentFilters.event_type);
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
    fetchLogs(page, filters);
  }, [page, perPage]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs(1, filters);
        if (page !== 1) setPage(1);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, filters, page, perPage]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    setPage(1);
    fetchLogs(1, newFilters);
  };

  const toggleRowExpanded = (id) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const getEventBadgeClass = (type) => {
    const lower = (type || '').toLowerCase();
    if (lower.includes('alert') || lower.includes('error')) return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (lower.includes('detection') || lower.includes('success')) return 'bg-green-500/10 text-green-400 border-green-500/20';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  const totalPages = Math.ceil(total / perPage);

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Event Type', 'Node ID', 'Camera ID', 'Payload', 'Snapshot Path'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => {
        const payloadStr = log.payload ? JSON.stringify(log.payload).replace(/"/g, '""') : '';
        return `"${log.timestamp}","${log.event_type}","${log.node_id}","${log.camera_id || ''}","${payloadStr}","${log.snapshot_path || ''}"`;
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logs_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Database Logs</h1>
            <p className="text-gray-400 text-sm mt-1">View historical events and system snapshots</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg transition-colors border border-gray-700"
          >
            <Download size={16} />
            Export CSV
          </button>
          
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${autoRefresh ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'}`}
          >
            {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
            {autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}
          </button>

          <button 
            onClick={() => fetchLogs(page, filters)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            <RefreshCw size={16} className={loading && !autoRefresh ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 flex items-center gap-4 flex-wrap shadow-md">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter size={18} />
          <span className="font-medium">Filters:</span>
        </div>
        
        <input 
          type="text" 
          name="event_type" 
          placeholder="Event Type (e.g. detection)" 
          value={filters.event_type}
          onChange={handleFilterChange}
          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 w-48"
        />
        
        <input 
          type="text" 
          name="camera_id" 
          placeholder="Camera ID" 
          value={filters.camera_id}
          onChange={handleFilterChange}
          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 w-48"
        />

        <input 
          type="text" 
          name="node_id" 
          placeholder="Node ID" 
          value={filters.node_id}
          onChange={handleFilterChange}
          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 w-48"
        />
        
        {(filters.event_type || filters.camera_id || filters.node_id) && (
          <button 
            onClick={() => { setFilters({event_type: '', camera_id: '', node_id: ''}); setPage(1); fetchLogs(1, {event_type: '', camera_id: '', node_id: ''}); }}
            className="text-gray-500 hover:text-gray-300 text-sm ml-auto flex items-center gap-1"
          >
            <X size={14} /> Clear Filters
          </button>
        )}
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-800/80 sticky top-0 border-b border-gray-800 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 font-semibold w-12"></th>
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold">Event Type</th>
                <th className="px-6 py-4 font-semibold">Node ID</th>
                <th className="px-6 py-4 font-semibold">Camera</th>
                <th className="px-6 py-4 font-semibold">Payload Preview</th>
                <th className="px-6 py-4 font-semibold">Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Database size={32} className="text-gray-700 mb-2" />
                      <p className="text-lg">No logs found</p>
                      <p className="text-sm">Try adjusting your filters or wait for new events.</p>
                    </div>
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-800/40 transition-colors group">
                      <td className="px-4 py-4 text-center">
                        {log.payload && (
                          <button 
                            onClick={() => toggleRowExpanded(log.id)}
                            className="text-gray-500 hover:text-white p-1 rounded transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-mono text-xs">
                        {new Date(log.timestamp + 'Z').toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getEventBadgeClass(log.event_type)}`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{log.node_id}</td>
                      <td className="px-6 py-4 text-gray-300">{log.camera_id || '-'}</td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs truncate max-w-[200px]">
                        {log.payload ? JSON.stringify(log.payload).substring(0, 50) + '...' : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {log.snapshot_path ? (
                          <button 
                            onClick={() => setSelectedImage(log.snapshot_path)}
                            className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 bg-pink-500/10 px-3 py-1.5 rounded-lg transition-colors border border-pink-500/20 text-xs font-medium"
                          >
                            <ImageIcon size={14} /> View
                          </button>
                        ) : (
                          <span className="text-gray-700">-</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && log.payload && (
                      <tr className="bg-gray-950/50">
                        <td colSpan="7" className="px-6 py-4 border-l-2 border-l-blue-500">
                          <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 shadow-inner">
                            <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Payload Details</div>
                            <pre className="text-xs text-blue-200 font-mono whitespace-pre-wrap break-words">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-gray-800/50 p-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
          <div>
            Showing {Math.min((page - 1) * perPage + 1, total)} to {Math.min(page * perPage, total)} of {total} entries
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select 
                value={perPage} 
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-gray-300"
              >
                Prev
              </button>
              <div className="px-3 py-1 font-medium text-white">
                {page} / {totalPages || 1}
              </div>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-4xl w-full bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
              <h3 className="text-white font-medium flex items-center gap-2">
                <ImageIcon size={18} className="text-pink-400" />
                Snapshot Viewer
              </h3>
              <button 
                onClick={() => setSelectedImage(null)}
                className="p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-gray-950 flex justify-center items-center flex-col min-h-[400px]">
              <img 
                src={`/api/snapshots/${selectedImage.split('/').pop()}`} 
                alt="Snapshot" 
                className="max-h-[600px] object-contain rounded-lg border border-gray-800"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="hidden text-gray-400 text-sm mt-4 text-center">
                Failed to load image.<br/>
                Path: {selectedImage}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
