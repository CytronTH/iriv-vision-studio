import React, { useEffect, useRef } from 'react';
import usePipelineStore from '../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';

export default function DebugWebSocket() {
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);
  const setDebugData = usePipelineStore((state) => state.setDebugData);
  const addDebugMessage = usePipelineStore((state) => state.addDebugMessage);
  const projectId = usePipelineStore((state) => state.projectId);

  const monitoredSourcesRef = useRef({ cameras: new Map(), logics: new Map() });
  const lastUpdateRef = useRef(0);

  // Keep track of which sources are actually connected to a Debug Node
  useEffect(() => {
    const cameras = new Map();
    const logics = new Map();
    
    // We monitor sources connected to ANY debug node or output window
    // Actually, we just map all sources connected to any debugNode
    const debugNodes = nodes.filter(n => n.type === 'debugNode');
    debugNodes.forEach(debugNode => {
      if (debugNode.data?.isPaused) return; // Skip paused nodes
      
      const incomingEdges = edges.filter(e => e.target === debugNode.id);
      incomingEdges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) return;
        
        if (sourceNode.type === 'logicNode' || sourceNode.type === 'rateLimitNode') {
          const list = logics.get(sourceNode.id) || [];
          list.push(debugNode.id);
          logics.set(sourceNode.id, list);
        } else if (sourceNode.type === 'aiNode') {
          const aiIncoming = edges.find(e => e.target === sourceNode.id);
          if (aiIncoming) {
            const inputNodeId = aiIncoming.source;
            const siblingAiNodeIds = edges
              .filter(e => e.source === inputNodeId)
              .map(e => e.target)
              .filter(tid => nodes.find(n => n.id === tid && n.type === 'aiNode'));
            
            let camId;
            if (siblingAiNodeIds.length <= 1) {
              camId = `cam_${inputNodeId}`;
            } else {
              const aiIdx = siblingAiNodeIds.indexOf(sourceNode.id);
              camId = `cam_${inputNodeId}_${aiIdx >= 0 ? aiIdx : 0}`;
            }

            const list = cameras.get(camId) || [];
            list.push(debugNode.id);
            cameras.set(camId, list);
          }
        } else if (sourceNode.type === 'inputNode') {
          const camId = `cam_${sourceNode.id}`;
          const list = cameras.get(camId) || [];
          list.push(debugNode.id);
          cameras.set(camId, list);
        }
      });
    });
    
    monitoredSourcesRef.current = { cameras, logics };
  }, [nodes, edges]);

  // Connect to WebSocket
  useEffect(() => {
    if (!projectId) return;

    const wsUrl = `ws://${window.location.hostname}:8000/ws/metadata/${projectId}`;
    let ws;
    let retryTimer;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { cameras, logics } = monitoredSourcesRef.current;
          let isMonitored = false;
          let sourceDebugNodeIds = [];

          if (data.type === 'logic_state' || data.type === 'rate_limit_state') {
            if (data.node_id && logics.has(data.node_id)) {
              isMonitored = true;
              sourceDebugNodeIds = logics.get(data.node_id);
              if (setDebugData) setDebugData(data.node_id, data);
            }
          } else if (data.camera_id) {
            if (cameras.has(data.camera_id)) {
              isMonitored = true;
              sourceDebugNodeIds = cameras.get(data.camera_id);
              if (setDebugData) setDebugData(data.camera_id, data);
            }
          }

          if (!isMonitored) return;

          const sourceId = data.node_id || data.camera_id || 'unknown';
          const now = Date.now();
          if (typeof lastUpdateRef.current !== 'object') lastUpdateRef.current = {};
          
          if (lastUpdateRef.current[sourceId] && now - lastUpdateRef.current[sourceId] < 200) return; // Basic throttle per source
          lastUpdateRef.current[sourceId] = now;

          const newMsg = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            data,
            debugNodeIds: sourceDebugNodeIds,
          };
          addDebugMessage(newMsg);
        } catch (err) {
          console.error('Error parsing Debug WS data', err);
        }
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        retryTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      clearTimeout(retryTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [projectId, setDebugData, addDebugMessage]);

  return null; // Headless component
}
