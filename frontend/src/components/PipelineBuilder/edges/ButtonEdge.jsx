import React, { useState, useEffect, useRef } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import usePipelineStore from '../../../store/usePipelineStore';
import { X, GripHorizontal } from 'lucide-react';

export default function ButtonEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const deleteEdge = usePipelineStore((state) => state.deleteEdge);
  const advancedDebugMode = usePipelineStore((state) => state.advancedDebugMode);
  const debugData = usePipelineStore((state) => state.debugData);
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const onEdgeClick = (evt, id) => {
    evt.stopPropagation();
    deleteEdge(id);
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handlePointerUp = (e) => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  let rawPayload = null;
  if (advancedDebugMode) {
    const sourceNode = nodes.find((n) => n.id === source);
    if (sourceNode) {
      if (
        ['logicNode', 'rateLimitNode', 'flowCounterNode', 'counterNode', 'shelfSlotMonitorNode', 'forkliftZoneNode'].includes(sourceNode.type)
      ) {
        rawPayload = debugData[source];
      } else if (sourceNode.type === 'aiNode') {
        const aiIncoming = edges.find((e) => e.target === source);
        if (aiIncoming) {
          const inputNodeId = aiIncoming.source;
          const siblingAiNodeIds = edges
            .filter((e) => e.source === inputNodeId)
            .map((e) => e.target)
            .filter((tid) => nodes.find((n) => n.id === tid && n.type === 'aiNode'));

          let camId;
          if (siblingAiNodeIds.length <= 1) {
            camId = `cam_${inputNodeId}`;
          } else {
            const aiIdx = siblingAiNodeIds.indexOf(source);
            camId = `cam_${inputNodeId}_${aiIdx >= 0 ? aiIdx : 0}`;
          }
          rawPayload = debugData[camId];
        }
      } else if (sourceNode.type === 'inputNode') {
        rawPayload = debugData[`cam_${source}`];
      }
    }
  }

  // Extract the full msg envelope if available, else fallback to the raw payload
  let displayPayload = rawPayload;
  if (rawPayload && rawPayload.msg) {
    displayPayload = rawPayload.msg;
  } else if (rawPayload && rawPayload.type === "detection") {
     // Format raw detection if msg envelope is not directly attached
     displayPayload = rawPayload.msg || rawPayload;
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-110"
            onClick={(event) => onEdgeClick(event, id)}
            title="Delete connection"
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>

        {advancedDebugMode && displayPayload && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + dragOffset.x}px,${labelY + dragOffset.y}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan z-50 flex flex-col items-center"
          >
            <div className="bg-gray-900/90 backdrop-blur-md border border-gray-600 rounded shadow-xl overflow-hidden min-w-[250px] max-w-[400px]">
              <div 
                className="bg-gray-800 border-b border-gray-700 p-1 flex justify-center cursor-grab active:cursor-grabbing hover:bg-gray-700 transition-colors"
                onPointerDown={handlePointerDown}
                title="Drag to move"
              >
                <GripHorizontal size={14} className="text-gray-400" />
              </div>
              <div className="p-2 text-green-400 font-mono text-[10px] leading-tight max-h-[300px] overflow-y-auto custom-scrollbar shadow-inner">
                <pre className="whitespace-pre-wrap word-break m-0">
                  {JSON.stringify(displayPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
