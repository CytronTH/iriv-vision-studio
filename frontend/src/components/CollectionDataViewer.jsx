import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Image as ImageIcon, AlertTriangle, FileSpreadsheet, XCircle } from 'lucide-react';

export default function CollectionDataViewer({ projectId, collection, onCollectionDeleted }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/collections/${collection.id}/records`);
      const data = await res.json();
      if (data.status === 'success') {
        setRecords(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [collection.id, projectId]);

  const schema = React.useMemo(() => {
    try {
      return JSON.parse(collection.schema_json);
    } catch (e) {
      return [];
    }
  }, [collection.schema_json]);

  const handleClear = async () => {
    if (!confirm(`Are you sure you want to delete ALL records in "${collection.name}"? This cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/collections/${collection.id}/records`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchRecords();
      } else {
        alert("Error: " + data.message);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to clear collection.");
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteCollection = async () => {
    if (!confirm(`DANGER: Are you sure you want to delete the ENTIRE collection "${collection.name}" including all its structure and data?`)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/collections/${collection.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        if (onCollectionDeleted) onCollectionDeleted();
      } else {
        alert("Error: " + data.message);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete collection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-800/80 bg-gray-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              {collection.name}
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              <span className="text-emerald-400 font-mono">{total.toLocaleString()}</span> records in database
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <button 
            onClick={fetchRecords}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
            <span>Refresh</span>
          </button>
          
          <div className="w-px h-6 bg-gray-100 dark:bg-slate-800 mx-1"></div>

          <button 
            onClick={handleClear}
            disabled={loading || records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            title="Clear all records inside this collection"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear Data</span>
          </button>

          <button 
            onClick={handleDeleteCollection}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            title="Delete the collection structure and all its data"
          >
            <XCircle size={14} />
            <span className="hidden sm:inline">Delete Collection</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#0d1117] border-t border-slate-800">
        <table className="w-full text-left text-sm text-slate-400 border-collapse">
          <thead className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-gray-50 dark:bg-slate-900/90 sticky top-0 z-10 shadow-sm border-b border-slate-700 backdrop-blur-md">
            <tr className="divide-x divide-slate-800/60">
              <th className="px-4 py-2.5 whitespace-nowrap w-[160px] bg-gray-50 dark:bg-slate-900/50">Timestamp</th>
              {schema.map(col => (
                <th key={col.key} className="px-4 py-2.5 whitespace-nowrap bg-gray-50 dark:bg-slate-900/50">{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={schema.length + 1} className="px-4 py-12 text-center text-slate-500 font-medium">
                  Loading records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={schema.length + 1} className="px-4 py-16 text-center text-slate-500 font-medium bg-gray-50 dark:bg-slate-900/30">
                  <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-20" />
                  No data in this collection yet. Connect a Database Writer node to start saving data.
                </td>
              </tr>
            ) : (
              records.map(record => (
                <tr key={record.id} className="hover:bg-gray-100 dark:bg-slate-800/40 transition-colors divide-x divide-slate-800/60 group">
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400 font-mono">
                    {new Date(record.timestamp).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  {schema.map(col => {
                    const val = record.data[col.key];
                    return (
                      <td key={col.key} className="px-4 py-2 text-xs text-slate-300">
                        {col.type === 'image' ? (
                          val ? (
                            <div className="flex justify-center">
                              <img 
                                src={val.replace('/api/files/snapshots/', '/api/snapshots/')} 
                                alt="Snapshot" 
                                className="h-10 object-contain rounded bg-black/50 border border-slate-700 cursor-pointer hover:border-blue-500 hover:scale-105 transition-all shadow-sm" 
                                onClick={() => setSelectedImage(val.replace('/api/files/snapshots/', '/api/snapshots/'))}
                              />
                            </div>
                          ) : (
                            <div className="flex justify-center text-slate-700"><ImageIcon size={14} /></div>
                          )
                        ) : col.type === 'boolean' ? (
                          <div className="flex">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${val ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {val ? 'True' : 'False'}
                            </span>
                          </div>
                        ) : col.type === 'number' ? (
                           <span className="font-mono text-blue-300">{val !== undefined ? Number(val).toLocaleString() : '-'}</span>
                        ) : (
                          <span className="truncate max-w-[300px] block" title={String(val)}>{val !== undefined ? String(val) : '-'}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img 
              src={selectedImage} 
              alt="Full Snapshot" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
            />
            <button 
              className="absolute top-4 right-4 text-gray-900 bg-gray-100 dark:bg-slate-800/50 hover:bg-slate-700 p-2 rounded-full backdrop-blur-md dark:text-white"
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
