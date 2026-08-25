import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlignLeft } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function DashboardTextNode({ id, data }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const edges = usePipelineStore((state) => state.edges);
  const nodes = usePipelineStore((state) => state.nodes);

  const handleLabelChange = (e) => {
    updateNodeData(id, { label: e.target.value });
  };

  const handleSourceChange = (e) => {
    updateNodeData(id, { sourcePath: e.target.value });
  };

  const upstreamEdge = edges.find(e => e.target === id);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;

  const getAvailableProperties = () => {
    if (!upstreamNode) return [];
    
    if (upstreamNode.type === 'aiNode' || upstreamNode.type === 'logicNode') {
      return [
        { value: 'msg.payload', label: 'msg.payload (Full Object)' },
        { value: 'msg.payload.detections', label: 'msg.payload.detections (Array)' },
        { value: 'msg.payload.count', label: 'msg.payload.count (Number)' },
        { value: 'msg.payload.labels', label: 'msg.payload.labels (Array)' },
        { value: 'msg.payload.max_confidence', label: 'msg.payload.max_confidence (Number)' }
      ];
    }
    
    return [
      { value: 'msg.payload', label: 'msg.payload (Full Object)' },
      { value: 'msg.payload.count', label: 'msg.payload.count (Number)' },
      { value: 'alerts', label: 'System Alerts (Feed)' }
    ];
  };

  const availableProperties = getAvailableProperties();

  return (
    <div className="bg-gray-900 border-2 border-pink-600 rounded-xl shadow-lg shadow-pink-900/20 w-64 text-white overflow-hidden">
      <div className="bg-pink-600/20 p-3 flex items-center justify-between border-b border-pink-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-pink-600 p-1.5 rounded-lg">
            <AlignLeft size={16} className="text-white" />
          </div>
          <div className="font-semibold text-sm">Dashboard Text</div>
        </div>
        <NodeMenu id={id} />
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Output Label (For Dashboard)
          <input 
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag"
            value={data?.label || ''}
            onChange={handleLabelChange}
            placeholder="e.g. Status"
          />
        </label>
        
        <label className="text-xs text-gray-400 flex flex-col gap-1">
          Property
          <input
            list={`properties-${id}`}
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag disabled:opacity-50"
            value={data?.sourcePath || ''}
            onChange={handleSourceChange}
            placeholder={upstreamNode ? "e.g. msg.payload" : "Connect a node first..."}
            disabled={!upstreamNode}
          />
          <datalist id={`properties-${id}`}>
            {availableProperties.map(prop => (
              <option key={prop.value} value={prop.value}>{prop.label}</option>
            ))}
          </datalist>
        </label>

        <div className="text-[10px] text-gray-500 mt-1">
          Provides the latest text or boolean value to Text widgets.
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
