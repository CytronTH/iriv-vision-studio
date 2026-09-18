import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Hash, Edit3, List } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function DashboardMetricNode({ id, data }) {
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
      .catch(err => console.error("Failed to load entities in DashboardMetricNode", err));
  }, []);

  const handleLabelChange = (e) => {
    updateNodeData(id, { label: e.target.value });
  };

  const upstreamEdge = edges.find(e => e.target === id);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;

  const getAvailableProperties = () => {
    if (!upstreamNode) return [];
    
    if (upstreamNode.type === 'aiNode' || upstreamNode.type === 'logicNode') {
      return [
        { value: 'msg.payload.count', label: 'msg.payload.count (Number)' },
        { value: 'msg.payload.max_confidence', label: 'msg.payload.max_confidence (Number)' },
        { value: 'msg.payload', label: 'msg.payload (Full Object)' }
      ];
    }
    
    if (upstreamNode.type === 'counterNode') {
      return [
        { value: 'msg.payload', label: 'msg.payload (Counter Value)' }
      ];
    }

    if (upstreamNode.type === 'flowCounterNode') {
      const classes = new Set();
      
      // 1. From FlowCounterNode classFilter
      if (Array.isArray(upstreamNode.data?.classFilter)) {
        upstreamNode.data.classFilter.forEach(c => c && classes.add(c));
      }
      
      // 2. From FlowCounterNode runtime debug data
      const liveCounts = debugData[upstreamNode.id]?.counts;
      if (liveCounts && typeof liveCounts === 'object') {
        Object.keys(liveCounts).forEach(c => c && classes.add(c));
      }

      // 3. From FlowCounterNode node.data.counts
      if (upstreamNode.data?.counts && typeof upstreamNode.data.counts === 'object') {
        Object.keys(upstreamNode.data.counts).forEach(c => c && classes.add(c));
      }

      // 4. From connected upstream AI node
      const aiIncoming = edges.find(e => e.target === upstreamNode.id);
      if (aiIncoming) {
        const aiNode = nodes.find(n => n.id === aiIncoming.source);
        if (aiNode) {
          if (Array.isArray(aiNode.data?.classFilter)) {
            aiNode.data.classFilter.forEach(c => c && classes.add(c));
          }
          if (aiNode.data?.entityId) {
            const aiModel = models.find(m => m.id === aiNode.data.entityId);
            if (aiModel?.classes && Array.isArray(aiModel.classes)) {
              aiModel.classes.forEach(c => c && classes.add(c));
            }
          }
        }
      }

      // 5. Fallback: Check any AI model on canvas if classes still empty
      if (classes.size === 0) {
        const anyAiNode = nodes.find(n => n.type === 'aiNode');
        if (anyAiNode?.data?.entityId) {
          const aiModel = models.find(m => m.id === anyAiNode.data.entityId);
          if (aiModel?.classes && Array.isArray(aiModel.classes)) {
            aiModel.classes.forEach(c => c && classes.add(c));
          }
        }
      }

      const classProps = Array.from(classes).map(cls => ({
        value: `msg.payload.counts.${cls}`,
        label: `msg.payload.counts.${cls} (${cls} Count)`
      }));

      return [
        { value: 'msg.payload.total', label: 'msg.payload.total (Total Count)' },
        { value: 'msg.payload.newly_counted', label: 'msg.payload.newly_counted (Delta)' },
        ...classProps,
        { value: 'msg.payload.counts', label: 'msg.payload.counts (All Classes Object)' }
      ];
    }
    
    return [
      { value: 'msg.payload.count', label: 'msg.payload.count (Number)' },
      { value: 'msg.payload', label: 'msg.payload (Number)' }
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
    <div className="bg-gray-900 border-2 border-pink-600 rounded-xl shadow-lg shadow-pink-900/20 w-64 text-white overflow-hidden">
      <div className="bg-pink-600/20 p-3 flex items-center justify-between border-b border-pink-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-pink-600 p-1.5 rounded-lg">
            <Hash size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">Dashboard Metric</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Output Label (For Dashboard)
          <input 
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag text-white"
            value={data?.label || ''}
            onChange={handleLabelChange}
            placeholder="e.g. Total People Count"
          />
        </label>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Property</span>
            {upstreamNode && (
              <button
                type="button"
                onClick={() => setIsCustomMode(!showCustomInput)}
                className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1 transition-colors nodrag cursor-pointer"
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
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag text-white font-mono text-xs"
              value={data?.sourcePath || ''}
              onChange={handleCustomInputChange}
              placeholder="e.g. msg.payload.counts.Performance"
              autoFocus
            />
          ) : (
            <select
              className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag text-white cursor-pointer"
              value={data?.sourcePath || ''}
              onChange={handleSelectChange}
            >
              <option value="" disabled>-- Select Property --</option>
              {availableProperties.map(prop => (
                <option key={prop.value} value={prop.value} className="bg-gray-900 text-white">
                  {prop.label}
                </option>
              ))}
              <option value="__custom__" className="bg-gray-900 text-pink-400">
                ✏️ Custom Path...
              </option>
            </select>
          )}
        </div>

        <div className="text-[10px] text-gray-500 mt-1">
          Provides numeric data to Metric or Chart widgets.
        </div>
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-pink-500 border-2 border-gray-900"
      />
    </div>
  );
}
