import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, applyNodeChanges, applyEdgeChanges, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Camera, BrainCircuit, Filter, Bell, Tv, List } from 'lucide-react';
import { nodeTypes, edgeTypes } from '../PipelineBuilder/nodeTypes';

const MiniPipelineDiagram = forwardRef(({ nodeType, supportedInputs = [], supportedOutputs = [], nodeTutorials, onReady }, ref) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Local update function to prevent mutating the global store
  const updateNodeData = useCallback((id, newData) => {
    // Calculate new nodes synchronously to avoid side effects in state updater
    let changed = false;
    const nextNodes = nodes.map((n) => {
      if (n.id === id) {
        changed = true;
        return { ...n, data: { ...n.data, ...newData } };
      }
      return n;
    });

    if (changed) {
      setNodes(nextNodes);
      
      if (onReadyRef.current) {
        const exportNodes = nextNodes.map(n => ({ id: n.id, type: n.type, data: n.data }));
        // Debounce slightly to prevent rapid consecutive deploys
        setTimeout(() => onReadyRef.current({ nodes: exportNodes, edges }), 300);
      }
    }
  }, [nodes, edges]);

  // Wrap node data with local onUpdate
  const wrappedNodes = nodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      onUpdate: updateNodeData
    }
  }));

  // Generate unique IDs
  const getNextId = (type) => `${type}_${Date.now()}_${Math.floor(Math.random() * 100)}`;

  // Provide access to getPipeline via ref
  useImperativeHandle(ref, () => ({
    getPipeline: () => {
      const exportNodes = nodes.map(n => {
        const { onUpdate, ...cleanData } = n.data;
        return {
          id: n.id,
          type: n.type,
          data: cleanData
        };
      });
      return { nodes: exportNodes, edges };
    }
  }));

  // Keep latest onReady in a ref to avoid infinite loops in useEffect
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Initialize all nodes and edges
  useEffect(() => {
    const title = nodeTutorials[nodeType]?.title || nodeType;
    const centerDefaultData = { label: title, isWikiMode: true };
    if (nodeType === 'aiNode') centerDefaultData.entityId = 'yolov8s';
    if (nodeType === 'inputNode') centerDefaultData.entityId = 'wiki_mock_obj_det';

    const centerNode = {
      id: 'center_node',
      type: nodeType,
      position: { x: 400, y: Math.max(supportedInputs.length, supportedOutputs.length) * 150 / 2 },
      data: centerDefaultData,
    };

    const newNodes = [centerNode];
    const newEdges = [];

    // Inputs
    supportedInputs.forEach((type, index) => {
      const id = `${type}_${index}`;
      const typeTitle = nodeTutorials[type]?.title || type;
      const defaultData = { label: typeTitle, isWikiMode: true };
      if (type === 'aiNode') defaultData.entityId = 'yolov8s';
      if (type === 'inputNode') defaultData.entityId = 'wiki_mock_obj_det';

      newNodes.push({
        id,
        type: type,
        position: { x: 50, y: 50 + (index * 150) },
        data: defaultData,
      });

      newEdges.push({
        id: `e-${id}-center`,
        source: id,
        target: 'center_node',
        type: 'buttonEdge',
        animated: true,
        style: { stroke: '#6b7280', strokeWidth: 2 }
      });
    });

    // Outputs
    supportedOutputs.forEach((type, index) => {
      const id = `${type}_${index}`;
      const typeTitle = nodeTutorials[type]?.title || type;
      const defaultData = { label: typeTitle, isWikiMode: true };
      if (type === 'aiNode') defaultData.entityId = 'yolov8s';
      if (type === 'inputNode') defaultData.entityId = 'wiki_mock_obj_det';

      newNodes.push({
        id,
        type: type,
        position: { x: 800, y: 50 + (index * 150) },
        data: defaultData,
      });

      newEdges.push({
        id: `e-center-${id}`,
        source: 'center_node',
        target: id,
        type: 'buttonEdge',
        animated: true,
        style: { stroke: '#6b7280', strokeWidth: 2 }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);

    if (onReadyRef.current) {
      // Create payload immediately for onReady
      const exportNodes = newNodes.map(n => ({
        id: n.id,
        type: n.type,
        data: n.data
      }));
      // setTimeout to ensure state clears out old renders before deploying
      setTimeout(() => onReadyRef.current({ nodes: exportNodes, edges: newEdges }), 100);
    }
  }, [nodeType, nodeTutorials, supportedInputs, supportedOutputs]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes.filter(c => c.id !== 'center_node' || c.type !== 'remove'), nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, type: 'buttonEdge', animated: true, style: { stroke: '#6b7280', strokeWidth: 2 } }, eds)),
    []
  );

  return (
    <div style={{ width: '100%', height: '600px' }} className="rounded-xl overflow-hidden border border-gray-800 bg-gray-950/80 shadow-inner relative">
      <ReactFlow 
        nodes={wrappedNodes} 
        edges={edges} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView 
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={16} />
        <Controls className="bg-gray-800 border-gray-700 fill-gray-300" />
      </ReactFlow>
      
      {/* Legend / Tip */}
      <div className="absolute bottom-3 left-3 bg-gray-900/80 border border-gray-700 px-3 py-1.5 rounded-lg text-xs text-gray-400 backdrop-blur pointer-events-none">
        ลากเส้นเชื่อม หรือกดลบโหนดได้ (ยกเว้นโหนดหลัก)
      </div>
    </div>
  );
});

export default MiniPipelineDiagram;
