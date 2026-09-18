import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BarChart2, Edit3, List } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function DashboardChartNode({ id, data }) {
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  const edges = usePipelineStore((state) => state.edges);
  const nodes = usePipelineStore((state) => state.nodes);
  const debugData = usePipelineStore((state) => state.debugData || {});

  const [models, setModels] = useState([]);
  const [isCustomMode, setIsCustomMode] = useState(false);

  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => setModels(json.models || []))
      .catch(err => console.error("Failed to load entities in DashboardChartNode", err));
  }, []);

  const handleLabelChange = (e) => {
    updateNodeData(id, { label: e.target.value });
  };

  const upstreamEdge = edges.find(e => e.target === id);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;

  const getAvailableProperties = () => {
    if (!upstreamNode) return [];
    
    // For Chart, we usually want array data or historical data
    if (upstreamNode.type === 'counterNode' || upstreamNode.type === 'flowCounterNode') {
      return [
        { value: 'msg.payload', label: 'msg.payload (Single Number)' },
        { value: 'msg.payload.total', label: 'msg.payload.total (Flow Counter)' },
        { value: 'msg.payload.history', label: 'msg.payload.history (Array)' },
        { value: 'msg.payload.counts', label: 'msg.payload.counts (Object)' }
      ];
    }
    
    return [
      { value: 'msg.payload.history', label: 'msg.payload.history (Array)' },
      { value: 'msg.payload.data', label: 'msg.payload.data (Array)' },
      { value: 'msg.payload', label: 'msg.payload (Full Object)' }
    ];
  };

  const availableProperties = getAvailableProperties();
  const isKnownProperty = availableProperties.some(p => p.value === data?.sourcePath);
  const showCustomInput = isCustomMode || (!isKnownProperty && Boolean(data?.sourcePath));

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      updateNodeData(id, { sourcePath: val });
    }
  };

  const handleCustomInputChange = (e) => {
    updateNodeData(id, { sourcePath: e.target.value });
  };

  return (
    <div className="bg-gray-900 border-2 border-indigo-600 rounded-xl shadow-lg shadow-indigo-900/20 w-64 text-white overflow-hidden">
      <div className="bg-indigo-600/20 p-3 flex items-center justify-between border-b border-indigo-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <BarChart2 size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">Dashboard Chart</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Chart Title (For Dashboard)
          <input 
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-indigo-500 nodrag text-white"
            value={data?.label || ''}
            onChange={handleLabelChange}
            placeholder="e.g. Traffic Trend"
          />
        </label>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Data Property</span>
            {upstreamNode && (
              <button
                type="button"
                onClick={() => setIsCustomMode(!showCustomInput)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors nodrag cursor-pointer"
                title={showCustomInput ? "Choose from property list" : "Enter custom path manually"}
              >
                {showCustomInput ? (
                  <>
                    <List size={10} />
                    <span>Select from list</span>
                  </>
                ) : (
                  <>
                    <Edit3 size={10} />
                    <span>Custom</span>
                  </>
                )}
              </button>
            )}
          </div>

          {!upstreamNode ? (
            <input
              type="text"
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm text-gray-500 nodrag disabled:opacity-50 cursor-not-allowed"
              value=""
              placeholder="Connect a node first..."
              disabled
            />
          ) : showCustomInput ? (
            <input
              type="text"
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-indigo-500 nodrag text-white font-mono text-xs"
              value={data?.sourcePath || ''}
              onChange={handleCustomInputChange}
              placeholder="e.g. msg.payload.history"
              autoFocus
            />
          ) : (
            <select
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-indigo-500 nodrag text-white cursor-pointer"
              value={data?.sourcePath || ''}
              onChange={handleSelectChange}
            >
              <option value="" disabled>-- Select Property --</option>
              {availableProperties.map(prop => (
                <option key={prop.value} value={prop.value} className="bg-gray-900 text-white">
                  {prop.label}
                </option>
              ))}
              <option value="__custom__" className="bg-gray-900 text-indigo-400">
                ✏️ Custom Path...
              </option>
            </select>
          )}
        </div>

        <div className="text-[10px] text-gray-500 mt-1">
          Provides array data to Chart widgets.
        </div>
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-indigo-500 border-2 border-gray-900"
      />
    </div>
  );
}
