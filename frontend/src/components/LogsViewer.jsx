import React, { useState, useEffect } from 'react';
import { Database, Image as ImageIcon, Search, RefreshCw, X } from 'lucide-react';

export default function LogsViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs?limit=100');
      const data = await res.json();
      if (data.status === 'success') {
        setLogs(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Database Logs</h1>
            <p className="text-gray-400 text-sm mt-1">View historical events and snapshots</p>
          </div>
        </div>
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors border border-gray-700"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-800/50 sticky top-0 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold">Event Type</th>
                <th className="px-6 py-4 font-semibold">Node ID</th>
                <th className="px-6 py-4 font-semibold">Camera</th>
                <th className="px-6 py-4 font-semibold">Payload</th>
                <th className="px-6 py-4 font-semibold">Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No logs found in database.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                    {new Date(log.timestamp + 'Z').toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-500/20">
                      {log.event_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{log.node_id}</td>
                  <td className="px-6 py-4 text-gray-300">{log.camera_id || '-'}</td>
                  <td className="px-6 py-4">
                    <pre className="text-xs bg-gray-950 p-2 rounded text-gray-300 max-w-xs overflow-auto border border-gray-800">
                      {log.payload ? JSON.stringify(log.payload, null, 2) : '-'}
                    </pre>
                  </td>
                  <td className="px-6 py-4">
                    {log.snapshot_path ? (
                      <button 
                        onClick={() => setSelectedImage(log.snapshot_path)}
                        className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 bg-pink-500/10 px-3 py-1.5 rounded-lg transition-colors border border-pink-500/20 text-xs font-medium"
                      >
                        <ImageIcon size={14} /> View Image
                      </button>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
