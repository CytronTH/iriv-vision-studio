import React from 'react';
import { Handle, Position, useHandleConnections, useNodesData } from '@xyflow/react';
import { AlignLeft } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function DashboardTextNode({ id, data }) {
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  const connections = useHandleConnections({ type: 'target' });
  const upstreamNode = useNodesData(connections[0]?.source || 'empty-id');

  const handleLabelChange = (e) => {
    updateNodeData(id, { label: e.target.value });
  };

  const handleSourceChange = (e) => {
    updateNodeData(id, { sourcePath: e.target.value });
  };



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
  const [isCustomMode, setIsCustomMode] = React.useState(false);

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
            className="bg-gray-800 border border-gray-700 rounded-md p-1.5 text-sm focus:outline-none focus:border-pink-500 nodrag text-white"
            value={data?.label || ''}
            onChange={handleLabelChange}
            placeholder="e.g. Status"
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
                {showCustomInput ? "Select from list" : "Custom"}
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
              placeholder="e.g. msg.payload.count"
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
