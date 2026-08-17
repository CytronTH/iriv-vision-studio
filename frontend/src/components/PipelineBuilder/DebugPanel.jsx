import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Trash2, Pause, Play, Clock } from 'lucide-react';
import usePipelineStore from '../../store/usePipelineStore';

export default function DebugPanel({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [updateInterval, setUpdateInterval] = useState(500);
  const lastUpdateRef = useRef(0);
  const messagesEndRef = useRef(null);
  const monitoredSourcesRef = useRef({ cameras: new Set(), logics: new Set() });
  
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);
  const setDebugData = usePipelineStore((state) => state.setDebugData);
  const setHighlightedNodeIds = usePipelineStore((state) => state.setHighlightedNodeIds);

  // Keep track of which sources are actually connected to a Debug Node
  useEffect(() => {
    const cameras = new Map();
    const logics = new Map();
    
    const debugNodes = nodes.filter(n => n.type === 'debugNode');
    debugNodes.forEach(debugNode => {
      if (debugNode.data?.isPaused) return; // Skip paused nodes
      
      const incomingEdges = edges.filter(e => e.target === debugNode.id);
      incomingEdges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) return;
        
        if (sourceNode.type === 'logicNode') {
          const list = logics.get(sourceNode.id) || [];
          list.push(debugNode.id);
          logics.set(sourceNode.id, list);
        } else if (sourceNode.type === 'aiNode') {
          const aiIncoming = edges.find(e => e.target === sourceNode.id);
          if (aiIncoming) {
            const camId = `cam_${aiIncoming.source}`;
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

  // Check if there are any debug nodes
  const hasDebugNodes = nodes.some(n => n.type === 'debugNode');

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Connect to WebSocket
  useEffect(() => {
    if (!projectId || !hasDebugNodes) return;

    const wsUrl = `ws://${window.location.hostname}:8000/ws/metadata/${projectId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { cameras, logics } = monitoredSourcesRef.current;
        let isMonitored = false;
        let sourceDebugNodeIds = [];
        
        // Handle logic state updates for on-canvas debug node
        if (data.type === 'logic_state') {
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
        
        // Drop message if not monitored by any Debug Node
        if (!isMonitored) return;
        
        if (isPaused) return;

        const now = Date.now();
        if (now - lastUpdateRef.current < updateInterval) return;
        lastUpdateRef.current = now;

        // Add to log list
        setMessages(prev => {
          const newMsg = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            data: data,
            debugNodeIds: sourceDebugNodeIds
          };
          // Keep last 100 messages
          return [...prev, newMsg].slice(-100);
        });
      } catch (err) {
        console.error("Error parsing Debug WS data", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [projectId, hasDebugNodes, setDebugData, isPaused, updateInterval]);

  if (!hasDebugNodes) return null;

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 right-[270px] z-20 bg-gray-800 border border-gray-600 text-gray-300 p-2 rounded-l-lg shadow-lg hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
      >
        <Terminal size={16} />
        <span className="text-sm font-semibold">Debug</span>
      </button>
    );
  }

  return (
    <div className="absolute right-[256px] top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-700 shadow-2xl z-20 flex flex-col transition-transform duration-300 transform translate-x-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2 text-gray-200">
          <Terminal size={16} className="text-blue-400" />
          <h3 className="font-semibold text-sm uppercase tracking-wider">Debug Output</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-gray-800/50 border-b border-gray-700 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              isPaused ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            {isPaused ? 'Paused' : 'Pause'}
          </button>
          
          <div className="flex items-center gap-1 bg-gray-700 rounded px-2 py-1 text-gray-300">
            <Clock size={12} className="text-gray-400" />
            <select 
              value={updateInterval} 
              onChange={(e) => setUpdateInterval(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value={0}>Realtime</option>
              <option value={200}>200ms</option>
              <option value={500}>500ms</option>
              <option value={1000}>1 sec</option>
              <option value={2000}>2 sec</option>
            </select>
          </div>
        </div>
        
        <button 
          onClick={() => setMessages([])}
          className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors flex items-center gap-1"
          title="Clear logs"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-[11px]">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center mt-10">Waiting for debug payload...<br/>(Ensure pipeline is deployed)</div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className="bg-gray-950 p-2 rounded border border-gray-800 hover:border-blue-500 hover:shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all cursor-crosshair group"
              onMouseEnter={() => setHighlightedNodeIds(msg.debugNodeIds)}
              onMouseLeave={() => setHighlightedNodeIds([])}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500">{msg.timestamp}</span>
                <span className="text-blue-500/0 group-hover:text-blue-500/100 text-[9px] uppercase font-bold transition-colors">Highlight Node</span>
              </div>
              <pre className="text-green-400 overflow-x-auto">
                {JSON.stringify(msg.data, null, 2)}
              </pre>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
