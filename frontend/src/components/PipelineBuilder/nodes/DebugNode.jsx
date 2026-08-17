import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bug, Pause, Play } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default memo(({ data, isConnectable, id }) => {
  const edges = usePipelineStore((state) => state.edges);
  const nodes = usePipelineStore((state) => state.nodes);
  const debugData = usePipelineStore((state) => state.debugData || {});
  const projectId = usePipelineStore((state) => state.projectId);
  const highlightedNodeIds = usePipelineStore((state) => state.highlightedNodeIds);
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  
  const [sourceNode, setSourceNode] = useState(null);
  const canvasRef = useRef(null);
  
  // Find connected source node
  useEffect(() => {
    const incomingEdge = edges.find(e => e.target === id);
    if (incomingEdge) {
      const src = nodes.find(n => n.id === incomingEdge.source);
      setSourceNode(src);
    } else {
      setSourceNode(null);
    }
  }, [edges, nodes, id]);

  // Determine what to display
  let content = null;
  let currentStreamId = null;
  
  if (!sourceNode) {
    content = <div className="text-gray-500 text-xs text-center px-2 py-4">Not Connected</div>;
  } else if (sourceNode.type === 'aiNode' || sourceNode.type === 'inputNode') {
    // Show Video Preview
    let streamId = "";
    if (sourceNode.type === 'inputNode') {
      streamId = `cam_${sourceNode.id}`;
    } else {
      // Find the input node connected to this AI node
      const aiIncomingEdge = edges.find(e => e.target === sourceNode.id);
      if (aiIncomingEdge) {
        streamId = `cam_${aiIncomingEdge.source}`;
      }
    }
    currentStreamId = streamId;
    
    content = (
      <div className="w-full h-32 bg-black overflow-hidden relative">
        {projectId && streamId ? (
          <iframe 
            src={`http://${window.location.hostname}:8889/${projectId}_${streamId}/`}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
            title="Debug Video Preview"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] text-gray-500 p-2 text-center">
            <span>No Stream ID</span>
            <span>Proj: {projectId || 'null'}</span>
            <span>Stream: {streamId || 'null'}</span>
          </div>
        )}
        <canvas 
          ref={canvasRef}
          width={640} 
          height={360}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">Live Preview</div>
      </div>
    );
  } else if (sourceNode.type === 'logicNode') {
    // Show Logic State
    const state = debugData[sourceNode.id];
    
    let displayValue = "--";
    let color = "text-gray-400";
    
    if (state !== undefined) {
      if (typeof state.value === 'boolean') {
        displayValue = state.value ? "TRUE" : "FALSE";
        color = state.value ? "text-green-400" : "text-red-400";
      } else {
        displayValue = String(state.value);
        color = "text-blue-400";
      }
    }
    
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-gray-900/50">
        <span className="text-xs text-gray-400">Logic Output</span>
        <span className={`text-xl font-bold ${color}`}>{displayValue}</span>
        {state?.details?.count !== undefined && (
          <span className="text-xs font-semibold text-gray-300 bg-gray-800 px-2 py-1 rounded-full mt-1">
            Count: {state.details.count}
          </span>
        )}
      </div>
    );
  } else {
    content = <div className="text-gray-400 text-xs text-center px-2 py-3">Raw Value / Unsupported</div>;
  }

  // Effect to draw bounding boxes when metadata updates
  const shouldDrawBoxes = sourceNode?.type === 'aiNode' && !data?.isPaused;
  
  useEffect(() => {
    if (shouldDrawBoxes && currentStreamId && debugData[currentStreamId]) {
      const data = debugData[currentStreamId];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (data && (data.data || data.detections)) {
        const items = data.data || data.detections || [];
        const taskType = data.type || "detection";

        if (taskType === "detection") {
          items.forEach(det => {
            const [xmin, ymin, xmax, ymax] = det.bbox;
            const x = xmin * canvas.width;
            const y = ymin * canvas.height;
            const width = (xmax - xmin) * canvas.width;
            const height = (ymax - ymin) * canvas.height;

            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.fillRect(x, y - 15, ctx.measureText(det.label).width + 30, 15);

            ctx.fillStyle = '#000000';
            ctx.font = '10px sans-serif';
            ctx.fontWeight = 'bold';
            ctx.fillText(`${det.label} (${det.confidence})`, x + 2, y - 4);
          });
        } else if (taskType === "pose") {
          const SKELETON_CONNECTIONS = [
            [0,1],[0,2],[1,3],[2,4],
            [5,6],
            [5,7],[7,9],[6,8],[8,10],
            [5,11],[6,12],[11,12],
            [11,13],[13,15],[12,14],[14,16]
          ];
          items.forEach(pose => {
            if (pose.type === "skeleton" && pose.points) {
              const pts = pose.points.map(pt => ({
                x: pt.x * canvas.width,
                y: pt.y * canvas.height,
                conf: pt.confidence || 0
              }));
              
              ctx.strokeStyle = '#00FFFF';
              ctx.lineWidth = 2;
              SKELETON_CONNECTIONS.forEach(([i, j]) => {
                if (pts[i] && pts[j] && pts[i].conf > 0.1 && pts[j].conf > 0.1) {
                  ctx.beginPath();
                  ctx.moveTo(pts[i].x, pts[i].y);
                  ctx.lineTo(pts[j].x, pts[j].y);
                  ctx.stroke();
                }
              });
              
              ctx.fillStyle = '#FF00FF';
              pts.forEach((pt) => {
                if (pt.conf > 0.1) {
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
            }
          });
        }
      }
    } else if (!shouldDrawBoxes && canvasRef.current) {
      // Clear canvas if it's not connected to an AI node
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [debugData, currentStreamId, shouldDrawBoxes]);

  const isHighlighted = highlightedNodeIds?.includes(id);
  const isPaused = data?.isPaused;

  const togglePause = () => {
    updateNodeData(id, { isPaused: !isPaused });
  };

  return (
    <div className={`bg-gray-800 border-2 rounded-lg shadow-xl min-w-[150px] overflow-hidden transition-all duration-300 relative ${
      isHighlighted 
        ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.8)] scale-105 z-50' 
        : 'border-gray-600'
    } ${isPaused ? 'opacity-50 grayscale' : ''}`}>
      
      {/* Pause Button */}
      <button 
        onClick={togglePause}
        className="absolute top-1 right-1 z-20 bg-gray-900/80 hover:bg-gray-700 p-1 rounded text-gray-300 shadow-md transition-colors"
        title={isPaused ? "Resume Node" : "Pause Node"}
      >
        {isPaused ? <Play size={12} className="text-green-400" /> : <Pause size={12} className="text-amber-400" />}
      </button>

      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-gray-400 border-2 border-gray-800"
      />
      
      {/* Header */}
      <div className="bg-gray-700/80 px-3 py-2 border-b border-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug size={14} className="text-gray-300" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{data.label || 'Debug Node'}</span>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="bg-gray-800 flex flex-col min-h-[40px]">
        {content}
      </div>
    </div>
  );
});
