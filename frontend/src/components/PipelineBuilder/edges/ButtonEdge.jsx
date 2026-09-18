import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import usePipelineStore from '../../../store/usePipelineStore';
import { X } from 'lucide-react';

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

  const onEdgeClick = (evt, id) => {
    evt.stopPropagation();
    deleteEdge(id);
  };

  let payload = null;
  if (advancedDebugMode) {
    const sourceNode = nodes.find((n) => n.id === source);
    if (sourceNode) {
      if (
        ['logicNode', 'rateLimitNode', 'flowCounterNode', 'counterNode', 'shelfSlotMonitorNode', 'forkliftZoneNode'].includes(sourceNode.type)
      ) {
        payload = debugData[source];
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
          payload = debugData[camId];
        }
      } else if (sourceNode.type === 'inputNode') {
        payload = debugData[`cam_${source}`];
      }
    }
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
          
          {advancedDebugMode && payload && (
            <div className="bg-gray-900/85 backdrop-blur-sm border border-gray-700 rounded p-2 text-green-400 font-mono text-[10px] leading-tight max-w-[300px] overflow-hidden shadow-lg shadow-black/50">
              <pre className="whitespace-pre-wrap word-break">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
