import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bug, Pause, Play, Code, MonitorPlay } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeMenu from './NodeMenu';

function useWhepStream(whepUrl, videoRef) {
  const pcRef = useRef(null);
  const [status, setStatus] = useState('idle');

  const connect = useCallback(async () => {
    if (!whepUrl || !videoRef.current) return false;
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    setStatus('connecting');

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          setStatus('connected');
        }
      };
      
      pc.onconnectionstatechange = () => {
        const bad = ['failed', 'closed', 'disconnected'];
        if (bad.includes(pc.connectionState)) {
          setStatus('error');
        }
      };

      pc.addTransceiver('video', { direction: 'recvonly' });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const h = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', h);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', h);
        setTimeout(resolve, 2000);
      });

      const res = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp,
      });
      if (!res.ok) throw new Error(`WHEP ${res.status}`);
      await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
      return true;
    } catch (err) {
      console.warn('WHEP error:', err.message);
      setStatus('error');
      return false;
    }
  }, [whepUrl]);

  useEffect(() => {
    connect();
    return () => { if (pcRef.current) { pcRef.current.close(); pcRef.current = null; } };
  }, [connect]);

  useEffect(() => {
    if (status !== 'error') return;
    const t = setTimeout(connect, 2500);
    return () => clearTimeout(t);
  }, [status, connect]);

  return { status, reconnect: connect };
}

export default memo(({ data, isConnectable, id }) => {
  const edges = usePipelineStore((state) => state.edges);
  const nodes = usePipelineStore((state) => state.nodes);
  const debugData = usePipelineStore((state) => state.debugData || {});
  const projectId = usePipelineStore((state) => state.projectId);
  const highlightedNodeIds = usePipelineStore((state) => state.highlightedNodeIds);
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  
  const [sourceNode, setSourceNode] = useState(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  
  useEffect(() => {
    const incomingEdge = edges.find(e => e.target === id);
    if (incomingEdge) {
      const src = nodes.find(n => n.id === incomingEdge.source);
      setSourceNode(src);
    } else {
      setSourceNode(null);
    }
  }, [edges, nodes, id]);

  const isHighlighted = highlightedNodeIds?.includes(id);
  const isPaused = data?.isPaused;
  const togglePause = () => updateNodeData(id, { isPaused: !isPaused });
  const toggleMode = () => updateNodeData(id, { outputType: data?.outputType === 'text' ? 'auto' : 'text' });

  let whepUrl = null;
  let currentStreamId = null;
  
  if (sourceNode?.type === 'inputNode') {
    if (projectId) {
      currentStreamId = `cam_${sourceNode.id}`;
      whepUrl = `http://${window.location.hostname}:8889/${projectId}_${currentStreamId}/whep`;
    }
  } else if (sourceNode?.type === 'aiNode') {
    const aiIncomingEdge = edges.find(e => e.target === sourceNode.id);
    if (aiIncomingEdge && projectId) {
      const srcId = aiIncomingEdge.source;
      
      // Find all AI nodes connected to this input node in the exact order they appear in edges
      const allAiTargets = edges
        .filter(e => e.source === srcId)
        .map(e => e.target)
        .filter(targetId => nodes.find(n => n.id === targetId)?.type === 'aiNode');
        
      let streamSuffix = '';
      if (allAiTargets.length > 1) {
        const aiIdx = allAiTargets.indexOf(sourceNode.id);
        if (aiIdx > -1) {
          streamSuffix = `_${aiIdx}`;
        }
      }
      
      currentStreamId = `cam_${srcId}${streamSuffix}`;
      whepUrl = `http://${window.location.hostname}:8889/${projectId}_${currentStreamId}/whep`;
    }
  }
  
  const { status, reconnect } = useWhepStream(whepUrl, videoRef);

  const shouldDrawBoxes = sourceNode?.type === 'aiNode' && !data?.isPaused;
  const lastBoxesRef = useRef({ items: [], time: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (shouldDrawBoxes && currentStreamId && debugData[currentStreamId]) {
      const payload = debugData[currentStreamId];
      const W = canvas.width, H = canvas.height;
      
      if (payload?.roi) {
        const { x, y, w, h } = payload.roi;
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(x * W, y * H, w * W, h * H);
        ctx.setLineDash([]);
      }

      let items = payload.data || payload.detections || [];
      const now = Date.now();
      
      if (items.length > 0) {
        lastBoxesRef.current = { items, time: now };
      } else {
        if (now - lastBoxesRef.current.time < 300) {
          // Keep old boxes for 300ms to prevent flickering
          items = lastBoxesRef.current.items;
        } else {
          lastBoxesRef.current = { items: [], time: now };
        }
      }

      const taskType = payload.type || "detection";

      if (taskType === "detection") {
        items.forEach(det => {
          const [xmin, ymin, xmax, ymax] = det.bbox;
          const x = xmin * W, y = ymin * H;
          const width = (xmax - xmin) * W, height = (ymax - ymin) * H;

          ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);

          const lbl = `${det.label} ${det.confidence}`;
          ctx.fillStyle = 'rgba(0,255,0,0.7)';
          ctx.fillRect(x, y - 14, ctx.measureText(lbl).width + 8, 14);
          ctx.fillStyle = '#000'; ctx.font = '10px sans-serif';
          ctx.fillText(lbl, x + 4, y - 3);
        });
      } else if (taskType === "pose") {
        const SKEL = [[0,1],[0,2],[1,3],[2,4],[5,6],[5,7],[7,9],[6,8],[8,10],
                      [5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16]];
        items.forEach(pose => {
          if (pose.type !== "skeleton" || !pose.points) return;
          const pts = pose.points.map(pt => ({ x: pt.x * W, y: pt.y * H, c: pt.confidence || 0 }));
          ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2;
          SKEL.forEach(([i, j]) => {
            if (pts[i] && pts[j] && pts[i].c > 0.1 && pts[j].c > 0.1) {
              ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
            }
          });
          ctx.fillStyle = '#FF00FF';
          pts.forEach((pt) => { if (pt.c > 0.1) { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, 2*Math.PI); ctx.fill(); } });
        });
      }
    }
  }, [debugData, currentStreamId, shouldDrawBoxes]);

  let content = null;
  
  if (!sourceNode) {
    content = <div className="text-gray-500 text-xs text-center px-2 py-4">Not Connected</div>;
  } else if (data?.outputType === 'text' || sourceNode?.type === 'rateLimitNode' || sourceNode?.type === 'functionNode') {
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-gray-900/50">
        <span className="text-xs text-gray-400">JSON Mode</span>
        <span className="text-[10px] text-gray-500 text-center leading-tight mt-1">Connect to Output Window<br/>to view logs</span>
      </div>
    );
  } else if (sourceNode.type === 'logicNode') {
    const state = debugData[sourceNode.id];
    let displayValue = "--", color = "text-gray-400";
    if (state !== undefined) {
      if (typeof state === 'boolean' || typeof state?.value === 'boolean') {
        const val = typeof state === 'boolean' ? state : state.value;
        displayValue = val ? "TRUE" : "FALSE";
        color = val ? "text-green-400" : "text-red-400";
      } else {
        displayValue = String(state?.value || state);
        color = "text-blue-400";
      }
    }
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-gray-900/50">
        <span className="text-xs text-gray-400">Logic Output</span>
        <span className={`text-xl font-bold ${color}`}>{displayValue}</span>
      </div>
    );
  } else if (sourceNode.type === 'aiNode' || sourceNode.type === 'inputNode') {
    content = (
      <div className="relative w-64 aspect-video bg-black flex items-center justify-center">
        <video 
          ref={videoRef} 
          className={`w-full h-full object-contain ${isPaused ? 'opacity-50' : ''} ${(!whepUrl || status === 'error') ? 'hidden' : ''}`} 
          autoPlay 
          playsInline 
          muted 
        />
        
        {!whepUrl && (
          <div className="absolute text-xs text-gray-500">Initializing stream...</div>
        )}
        
        {whepUrl && status === 'error' && (
          <div className="absolute flex flex-col items-center gap-2">
            <div className="text-red-500 text-[10px]">Stream Error</div>
            <button onClick={reconnect} className="text-[10px] bg-red-900/30 text-red-300 px-2 py-1 rounded hover:bg-red-900/50">Retry</button>
          </div>
        )}
        
        <canvas ref={canvasRef} width={640} height={360} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">Live Preview</div>
      </div>
    );
  } else {
    content = <div className="text-gray-400 text-xs text-center px-2 py-3">Unsupported Node</div>;
  }

  return (
    <div className={`bg-gray-800 border-2 rounded-lg shadow-xl min-w-[150px] overflow-hidden transition-all duration-300 relative ${
      isHighlighted ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.8)] scale-105 z-50' : 'border-gray-600'
    } ${isPaused ? 'opacity-50 grayscale' : ''}`}>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-gray-400 border-2 border-gray-800" />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-purple-400 border-2 border-gray-800" />
      <div className="bg-gray-700/80 px-3 py-2 border-b border-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug size={14} className="text-gray-300" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Debug Node</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleMode} className="bg-gray-900/80 hover:bg-gray-700 p-1 rounded text-gray-300 shadow-md transition-colors" title={data?.outputType === 'text' ? "Switch to Video Mode" : "Switch to Text Mode"}>
            {data?.outputType === 'text' ? <MonitorPlay size={12} className="text-cyan-400" /> : <Code size={12} className="text-purple-400" />}
          </button>
          <button onClick={togglePause} className="bg-gray-900/80 hover:bg-gray-700 p-1 rounded text-gray-300 shadow-md transition-colors" title={isPaused ? "Resume Node" : "Pause Node"}>
            {isPaused ? <Play size={12} className="text-green-400" /> : <Pause size={12} className="text-amber-400" />}
          </button>
          <NodeMenu id={id} />
        </div>
      </div>
      <div className="bg-gray-800 flex flex-col min-h-[40px]">
        {content}
      </div>
    </div>
  );
});
