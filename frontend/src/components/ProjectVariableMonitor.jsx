import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Activity, Terminal, Hash, ChevronRight, Layers } from 'lucide-react';
import VariableDataViewerModal from './VariableDataViewerModal';

export default function ProjectVariableMonitor({ projectId }) {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVar, setSelectedVar] = useState(null);
  const [nodeMap, setNodeMap] = useState({});

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        const project = data.find(p => p.id === projectId);
        if (project && project.pipeline && project.pipeline.nodes) {
          const mapping = {};
          project.pipeline.nodes.forEach(n => {
            mapping[n.id] = { label: n.data?.label || n.type, type: n.type };
          });
          setNodeMap(mapping);
        }
      } catch(e) {
        console.error("Failed to fetch project nodes mapping:", e);
      }
    };
    if (projectId) fetchNodes();
  }, [projectId]);

  const fetchVariables = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/variables`);
      const data = await res.json();
      if (data.status === 'success') {
        setVariables(data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch variables:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchVariables();
      const interval = setInterval(fetchVariables, 5000);
      return () => clearInterval(interval);
    }
  }, [projectId]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-gray-50 dark:bg-slate-900/50">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 dark:text-white">
            <Activity size={20} className="text-indigo-400" />
            Project Variables
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time variables written to the database by this project
          </p>
        </div>
        <button
          onClick={fetchVariables}
          disabled={loading}
          className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-2 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {loading && variables.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : variables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
            <Database size={32} className="mb-3 opacity-20" />
            <p>No variables found in the database.</p>
            <p className="text-xs mt-1">Ensure a Database Writer Node is running.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {variables.map((v, i) => {
              const nodeInfo = nodeMap[v.node_id] || { label: 'Unknown Node', type: 'unknown' };
              return (
              <div 
                key={i} 
                onClick={() => setSelectedVar(v)}
                className="bg-white dark:bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 cursor-pointer group transition-all rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden mt-2"
              >
                <div className="absolute top-2 left-4 px-2 py-0.5 bg-gray-100 dark:bg-slate-800/80 text-[10px] text-slate-300 rounded-full font-medium border border-slate-700/50 flex items-center gap-1">
                  <Database size={10} className="text-indigo-400" /> {v.record_count?.toLocaleString() || 0} records
                </div>
                <div className="absolute top-4 right-4 text-slate-700 group-hover:text-indigo-400 transition-colors">
                  <ChevronRight size={18} />
                </div>
                <div className="flex items-center gap-2 mb-3 pr-6 mt-4">
                  <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-md">
                    <Hash size={16} />
                  </div>
                  <h3 className="font-semibold text-slate-200 truncate" title={v.variable_name}>
                    {v.variable_name}
                  </h3>
                </div>
                <div className="flex-1 flex items-end">
                  <div className="text-3xl font-bold font-mono text-gray-900 mb-2 dark:text-white">
                    {typeof v.value === 'number' ? (Number.isInteger(v.value) ? v.value : v.value.toFixed(2)) : v.value}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/60">
                  <span className="flex items-center gap-1 font-sans truncate" title={`${nodeInfo.label} (${nodeInfo.type})`}>
                    <Layers size={10} /> {nodeInfo.label} <span className="opacity-50">({nodeInfo.type})</span>
                  </span>
                  <span>
                    {new Date(v.last_updated + 'Z').toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      <VariableDataViewerModal 
        isOpen={!!selectedVar} 
        onClose={() => { setSelectedVar(null); fetchVariables(); }} 
        projectId={projectId} 
        variable={selectedVar}
        nodeMap={nodeMap}
      />
    </div>
  );
}
