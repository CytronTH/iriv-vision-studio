import React, { useState, useEffect } from 'react';
import { 
  X, Cpu, Zap, Activity, HardDrive, Thermometer, Layers, 
  Workflow, Play, CheckCircle, AlertTriangle, Clock, RefreshCw,
  Search, ChevronDown, ChevronRight, Terminal, BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, Legend 
} from 'recharts';

export default function ResourceMonitorModal({ isOpen, onClose, telemetry, history = [] }) {
  const [activeTab, setActiveTab] = useState('hierarchy'); // 'hierarchy' | 'charts' | 'processes'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPipelines, setExpandedPipelines] = useState({});

  if (!isOpen) return null;

  const system = telemetry?.system || {
    cpu_percent: telemetry?.cpu_percent || 0,
    cpu_cores: [0, 0, 0, 0],
    ram_percent: telemetry?.ram_percent || 0,
    ram_used_mb: 0,
    ram_total_mb: 0,
    temp_c: telemetry?.temp_c || 0,
    npu_percent: telemetry?.npu_percent || 0,
    npu_device: 'Hailo-8L (PCIe)'
  };

  const processes = telemetry?.processes || [];
  const pipelines = telemetry?.pipelines || [];

  const togglePipeline = (id) => {
    setExpandedPipelines(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  };

  const isPipelineExpanded = (id) => expandedPipelines[id] !== false; // Default expanded

  const filteredPipelines = pipelines.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchName = (p.name || '').toLowerCase().includes(query);
    const matchId = (p.pipeline_id || '').toLowerCase().includes(query);
    const matchNode = (p.nodes || []).some(n => 
      (n.name || '').toLowerCase().includes(query) || 
      (n.node_id || '').toLowerCase().includes(query) ||
      (n.node_type || '').toLowerCase().includes(query)
    );
    return matchName || matchId || matchNode;
  });

  const getNodeTypeBadge = (type) => {
    switch (type) {
      case 'aiNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60 rounded">AI Inference</span>;
      case 'inputNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60 rounded">Input Stream</span>;
      case 'logicNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded">Logic Check</span>;
      case 'dashboardVideoNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded">Video Out</span>;
      case 'functionNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 rounded">Function</span>;
      case 'counterNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded">Counter</span>;
      case 'snapshotNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded">Snapshot</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-800 text-gray-300 border border-gray-700 rounded">{type}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-gray-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-400">
              <Activity size={22} className="animate-pulse text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">System & AI Hardware Telemetry</h2>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live (1 Hz)
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Detailed attribution across Processes &rarr; Pipelines &rarr; Nodes (CPU &amp; NPU Hailo-8L)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/80 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 border-b border-gray-800/60 bg-gray-950/40">
          
          {/* CPU Card */}
          <div className="p-3.5 rounded-xl bg-gray-900/70 border border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <Cpu size={15} className="text-blue-400" /> CPU Load
              </span>
              <span className="text-base font-bold font-mono text-blue-400">
                {system.cpu_percent?.toFixed(1)}%
              </span>
            </div>
            {/* Core Mini Bars */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {(system.cpu_cores || [0, 0, 0, 0]).slice(0, 4).map((core, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        core > 80 ? 'bg-red-500' : core > 50 ? 'bg-amber-400' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, core))}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono text-center">C{i}</span>
                </div>
              ))}
            </div>
          </div>

          {/* NPU Hailo Card */}
          <div className="p-3.5 rounded-xl bg-gray-900/70 border border-purple-900/40 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Zap size={15} className="text-purple-400" /> NPU Hailo-8L
              </span>
              <span className="text-base font-bold font-mono text-purple-400">
                {system.npu_percent?.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-2.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  system.npu_percent > 85 ? 'bg-red-500' : system.npu_percent > 50 ? 'bg-purple-500' : 'bg-purple-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, system.npu_percent || 0))}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1 font-mono">
              <span className="truncate max-w-[130px]" title={system.npu_device}>{system.npu_device}</span>
              <span className={system.npu_percent > 0 ? 'text-purple-300 font-medium' : 'text-gray-500'}>
                {system.npu_percent > 0 ? 'Active' : 'Standby'}
              </span>
            </div>
          </div>

          {/* RAM Card */}
          <div className="p-3.5 rounded-xl bg-gray-900/70 border border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <HardDrive size={15} className="text-emerald-400" /> Memory (RAM)
              </span>
              <span className={`text-base font-bold font-mono ${system.ram_percent > 80 ? 'text-red-400' : 'text-emerald-400'}`}>
                {system.ram_percent?.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-2.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  system.ram_percent > 80 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, system.ram_percent || 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
              <span>{system.ram_used_mb ? `${system.ram_used_mb.toFixed(0)} MB` : ''}</span>
              <span>{system.ram_total_mb ? `${system.ram_total_mb.toFixed(0)} MB` : ''}</span>
            </div>
          </div>

          {/* Thermal Card */}
          <div className="p-3.5 rounded-xl bg-gray-900/70 border border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <Thermometer size={15} className="text-orange-400" /> Thermal
              </span>
              <span className={`text-base font-bold font-mono ${system.temp_c > 75 ? 'text-red-400' : 'text-orange-400'}`}>
                {system.temp_c ? `${system.temp_c.toFixed(1)}°C` : 'N/A'}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-2.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  system.temp_c > 75 ? 'bg-red-500' : system.temp_c > 60 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(10, ((system.temp_c || 40) - 30) * 1.5))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>Pi 5 SoC</span>
              <span className={system.temp_c > 75 ? 'text-red-400 font-bold' : 'text-green-400'}>
                {system.temp_c > 75 ? 'High Temp' : 'Normal'}
              </span>
            </div>
          </div>

        </div>

        {/* Tab Selection & Controls */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/30 gap-3">
          <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'hierarchy' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Workflow size={14} /> Pipeline &amp; Node Hierarchy
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'charts' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <BarChart2 size={14} /> Real-Time Trends
            </button>
            <button
              onClick={() => setActiveTab('processes')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'processes' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Terminal size={14} /> Processes ({processes.length})
            </button>
          </div>

          {activeTab === 'hierarchy' && (
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search pipeline or node..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/60 font-mono"
              />
            </div>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* TAB 1: HIERARCHICAL BREAKDOWN */}
          {activeTab === 'hierarchy' && (
            <div className="space-y-4">
              {filteredPipelines.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
                  <Workflow size={36} className="mx-auto text-gray-600 mb-3" />
                  <h3 className="text-sm font-semibold text-gray-300">No Active Pipelines Running</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    Start a project pipeline in the Pipeline Builder to see real-time CPU &amp; NPU node attribution.
                  </p>
                </div>
              ) : (
                filteredPipelines.map((pipeline) => {
                  const expanded = isPipelineExpanded(pipeline.pipeline_id);
                  const nodes = pipeline.nodes || [];

                  return (
                    <div 
                      key={pipeline.pipeline_id}
                      className="border border-gray-800/80 rounded-2xl bg-gray-900/40 overflow-hidden shadow-sm"
                    >
                      {/* Pipeline Header */}
                      <div 
                        onClick={() => togglePipeline(pipeline.pipeline_id)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/40 transition-colors select-none"
                      >
                        <div className="flex items-center gap-3">
                          <button className="text-gray-400 hover:text-white">
                            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-white">{pipeline.name || pipeline.pipeline_id}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800/50">
                                ID: {pipeline.pipeline_id}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                <CheckCircle size={12} /> {pipeline.status}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {nodes.length} registered nodes in dataflow
                            </span>
                          </div>
                        </div>

                        {/* Pipeline Resource Rollup */}
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 px-3 py-1.5 rounded-lg">
                            <Cpu size={14} className="text-blue-400" />
                            <span className="text-gray-400 text-[11px]">Pipe CPU:</span>
                            <span className="text-blue-300 font-bold">{pipeline.cpu_percent?.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-purple-950/40 border border-purple-900/50 px-3 py-1.5 rounded-lg">
                            <Zap size={14} className="text-purple-400" />
                            <span className="text-purple-300 text-[11px]">NPU:</span>
                            <span className="text-purple-300 font-bold">{pipeline.npu_percent?.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Nodes Table (Inside Pipeline) */}
                      {expanded && (
                        <div className="border-t border-gray-800/60 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-950/80 text-gray-400 font-medium border-b border-gray-800/80 text-[11px]">
                              <tr>
                                <th className="py-2.5 px-4">Node / Component</th>
                                <th className="py-2.5 px-3">Type</th>
                                <th className="py-2.5 px-3">CPU Usage</th>
                                <th className="py-2.5 px-3">NPU Hailo Load</th>
                                <th className="py-2.5 px-3">Latency Breakdown</th>
                                <th className="py-2.5 px-3">Rate / Throughput</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/40">
                              {nodes.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-6 text-center text-gray-500 font-mono text-xs">
                                    No node telemetry recorded yet for this pipeline.
                                  </td>
                                </tr>
                              ) : (
                                nodes.map((node) => {
                                  const isAi = node.node_type === 'aiNode';

                                  return (
                                    <tr key={node.node_id} className="hover:bg-gray-800/20 transition-colors">
                                      {/* Name & ID */}
                                      <td className="py-2.5 px-4 font-mono">
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-gray-200">{node.name || node.node_id}</span>
                                          <span className="text-[10px] text-gray-500">{node.node_id}</span>
                                        </div>
                                      </td>

                                      {/* Type */}
                                      <td className="py-2.5 px-3">
                                        {getNodeTypeBadge(node.node_type)}
                                      </td>

                                      {/* CPU % */}
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-blue-500 rounded-full transition-all"
                                              style={{ width: `${Math.min(100, Math.max(node.cpu_percent > 0 ? 5 : 0, (node.cpu_percent || 0) * 3))}%` }}
                                            />
                                          </div>
                                          <span className="font-mono text-gray-300 font-medium text-[11px]">
                                            {node.cpu_percent?.toFixed(1)}%
                                          </span>
                                        </div>
                                      </td>

                                      {/* NPU % */}
                                      <td className="py-2.5 px-3">
                                        {isAi ? (
                                          <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-purple-500 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, node.npu_percent || 0)}%` }}
                                              />
                                            </div>
                                            <span className="font-mono text-purple-300 font-bold text-[11px]">
                                              {node.npu_percent?.toFixed(1)}%
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-gray-600 font-mono text-[11px]">-</span>
                                        )}
                                      </td>

                                      {/* Latency Breakdown */}
                                      <td className="py-2.5 px-3 font-mono text-[11px]">
                                        {isAi ? (
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-purple-300">
                                              NPU Infer: <strong className="text-white">{node.npu_latency_ms?.toFixed(1) || 0} ms</strong>
                                            </span>
                                            {node.python_probe_ms > 0 && (
                                              <span className="text-gray-400 text-[10px]">
                                                Python Probe: {node.python_probe_ms?.toFixed(1)} ms
                                              </span>
                                            )}
                                          </div>
                                        ) : node.latency_ms > 0 ? (
                                          <span className="text-gray-300">{node.latency_ms?.toFixed(2)} ms</span>
                                        ) : (
                                          <span className="text-gray-600">&lt; 0.1 ms</span>
                                        )}
                                      </td>

                                      {/* Throughput */}
                                      <td className="py-2.5 px-3 font-mono text-[11px]">
                                        {node.fps > 0 ? (
                                          <span className="text-blue-300 font-medium">{node.fps?.toFixed(1)} FPS</span>
                                        ) : node.freq_hz > 0 ? (
                                          <span className="text-emerald-300 font-medium">{node.freq_hz?.toFixed(1)} Hz</span>
                                        ) : (
                                          <span className="text-gray-500">Idle</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: LIVE TREND CHARTS */}
          {activeTab === 'charts' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BarChart2 size={16} className="text-blue-400" /> CPU vs NPU Utilization Over Time
                    </h3>
                    <p className="text-xs text-gray-400">Rolling real-time performance telemetry history</p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {history.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="npuGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                        <XAxis dataKey="time" stroke="#9ca3af" fontSize={10} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={10} domain={[0, 100]} unit="%" tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem' }}
                          labelStyle={{ color: '#9ca3af' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area 
                          type="monotone" 
                          dataKey="cpu" 
                          name="System CPU %" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#cpuGrad)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="npu" 
                          name="Hailo NPU %" 
                          stroke="#a855f7" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#npuGrad)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono">
                      Collecting telemetry history samples...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROCESSES LIST */}
          {activeTab === 'processes' && (
            <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-950 text-gray-400 font-medium border-b border-gray-800 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Process Name / Command</th>
                    <th className="py-2.5 px-3">PID</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Pipeline Attribution</th>
                    <th className="py-2.5 px-3">CPU Usage</th>
                    <th className="py-2.5 px-3">Memory (RSS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 font-mono text-[11px]">
                  {processes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No active child processes detected.
                      </td>
                    </tr>
                  ) : (
                    processes.map((proc, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/20">
                        <td className="py-2.5 px-4 font-semibold text-gray-200 flex items-center gap-2">
                          <Terminal size={13} className="text-gray-400" />
                          {proc.name}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400">{proc.pid}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            proc.role === 'core' 
                              ? 'bg-blue-950 text-blue-300 border border-blue-800/40' 
                              : proc.role === 'media_server'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                              : 'bg-gray-800 text-gray-300'
                          }`}>
                            {proc.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-300">
                          {proc.pipeline_id ? (
                            <span className="text-blue-400 font-semibold">{proc.pipeline_id}</span>
                          ) : (
                            <span className="text-gray-500">Global / System</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-blue-400">
                          {proc.cpu_percent?.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-gray-300">
                          {proc.memory_mb ? `${proc.memory_mb.toFixed(1)} MB` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800/80 bg-gray-900/60 text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span>Hardware: Raspberry Pi 5 (4 Cores)</span>
            <span>&bull;</span>
            <span>AI Hat: Hailo-8L (13 TOPS)</span>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors font-sans text-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
