import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, useHandleConnections, useNodesData, useReactFlow } from '@xyflow/react';
import { Bug, Pause, Play, Code, MonitorPlay, ShieldAlert, AlertTriangle, AlertOctagon } from 'lucide-react';
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

      if (!res.ok) throw new Error(`WHEP endpoint returned ${res.status}`);
      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      return true;
    } catch (err) {
      console.error('[WHEP] Connection failed:', err);
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
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);
  const debugData = usePipelineStore((state) => state.debugData || {});
  const projectId = usePipelineStore((state) => state.projectId);
  const highlightedNodeIds = usePipelineStore((state) => state.highlightedNodeIds);
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  
  const connections = useHandleConnections({ type: 'target' });
  const sourceNode = useNodesData(connections[0]?.source || 'empty-id');
  const incomingEdge = edges.find((e) => e.target === id);
  const sourceHandle = connections[0]?.sourceHandle || incomingEdge?.sourceHandle;

  const isForkliftNode = sourceNode?.type === 'forkliftZoneNode';
  const isForkliftVideoHandle = !sourceHandle || sourceHandle === 'debug' || sourceHandle === 'telemetry';

  const isDefaultVideo = sourceNode?.type === 'inputNode' || 
                         sourceNode?.type === 'aiNode' || 
                         (isForkliftNode && isForkliftVideoHandle);

  const isVideoMode = data?.outputType === 'video' 
    ? true 
    : data?.outputType === 'text' 
    ? false 
    : isDefaultVideo;

  const isHighlighted = highlightedNodeIds?.includes(id);
  const isPaused = data?.isPaused;
  const togglePause = () => updateNodeData(id, { isPaused: !isPaused });
  const toggleMode = () => updateNodeData(id, { outputType: isVideoMode ? 'text' : 'video' });

  let whepUrl = null;
  let currentStreamId = null;
  
  if (sourceNode?.type === 'inputNode') {
    const cameraId = sourceNode.data?.entityId;
    if (cameraId) {
      currentStreamId = cameraId;
      whepUrl = `http://${window.location.hostname}:8889/shared_${cameraId}/whep`;
    } else if (projectId) {
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
  } else if (sourceNode?.type === 'forkliftZoneNode') {
    // Trace backwards to find upstream aiNode and inputNode
    const incomingEdge = edges.find(e => e.target === sourceNode.id);
    let targetAiNode = null;
    if (incomingEdge) {
      targetAiNode = nodes.find(n => n.id === incomingEdge.source && n.type === 'aiNode');
    }

    if (targetAiNode && projectId) {
      const aiIncomingEdge = edges.find(e => e.target === targetAiNode.id);
      if (aiIncomingEdge) {
        const srcId = aiIncomingEdge.source;
        const allAiTargets = edges
          .filter(e => e.source === srcId)
          .map(e => e.target)
          .filter(targetId => nodes.find(n => n.id === targetId)?.type === 'aiNode');

        let streamSuffix = '';
        if (allAiTargets.length > 1) {
          const aiIdx = allAiTargets.indexOf(targetAiNode.id);
          if (aiIdx > -1) {
            streamSuffix = `_${aiIdx}`;
          }
        }
        currentStreamId = `cam_${srcId}${streamSuffix}`;
        whepUrl = `http://${window.location.hostname}:8889/${projectId}_${currentStreamId}/whep`;
      }
    } else if (projectId) {
      const anyInput = nodes.find(n => n.type === 'inputNode');
      if (anyInput) {
        currentStreamId = `cam_${anyInput.id}`;
        whepUrl = `http://${window.location.hostname}:8889/${projectId}_${currentStreamId}/whep`;
      }
    }
  }
  
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const { status, reconnect } = useWhepStream(whepUrl, videoRef);
  const [resolution, setResolution] = useState(null);

  const shouldDrawBoxes = (sourceNode?.type === 'aiNode' || (isForkliftNode && isVideoMode)) && !data?.isPaused;
  const lastBoxesRef = useRef({ items: [], time: 0 });
  const latestDataRef = useRef(null);

  useEffect(() => {
    if (debugData && currentStreamId) {
      latestDataRef.current = debugData[currentStreamId];
    }
  }, [debugData, currentStreamId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const payload = latestDataRef.current;
      
      if (shouldDrawBoxes && (currentStreamId || isForkliftNode)) {
        const W = canvas.width, H = canvas.height;

        // 1. Draw Polygon Danger Zones for Forklift Safety Monitor
        if (isForkliftNode) {
          const forkliftDebug = debugData[sourceNode.id];
          const configuredZones = sourceNode.data?.zones || [];
          const liveZonesObj = forkliftDebug?.zones || {};

          let zonesList = [];
          if (configuredZones.length > 0) {
            zonesList = configuredZones.map((z) => ({
              ...z,
              ...(liveZonesObj[z.id] || {}),
              polygon: z.polygon || liveZonesObj[z.id]?.polygon || [],
            }));
          } else {
            zonesList = Object.values(liveZonesObj);
          }

          zonesList.forEach((zone) => {
            const poly = zone.polygon || [];
            if (poly.length < 3) return;

            const isAlert = forkliftDebug?.zones?.[zone.id]?.occupied ?? zone.occupied ?? false;
            const color = zone.color || (zone.type === 'caution' ? '#f59e0b' : '#f43f5e');

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(poly[0].x * W, poly[0].y * H);
            for (let i = 1; i < poly.length; i++) {
              ctx.lineTo(poly[i].x * W, poly[i].y * H);
            }
            ctx.closePath();

            // Colored fill
            ctx.fillStyle = isAlert ? `${color}50` : `${color}20`;
            ctx.fill();

            // Border stroke
            ctx.strokeStyle = color;
            ctx.lineWidth = isAlert ? 3 : 1.5;
            if (zone.type === 'caution') {
              ctx.setLineDash([6, 4]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.stroke();

            // Zone label tag
            const cx = (poly.reduce((a, p) => a + p.x, 0) / poly.length) * W;
            const cy = (poly.reduce((a, p) => a + p.y, 0) / poly.length) * H;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            const countTag = zone.forklift_count !== undefined ? ` (${zone.forklift_count})` : '';
            const tag = `${zone.name || 'Zone'}${countTag} [${isAlert ? 'ALERT' : 'CLEAR'}]`;
            const tw = ctx.measureText(tag).width + 8;
            ctx.fillRect(cx - tw / 2, cy - 8, tw, 16);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - tw / 2, cy - 8, tw, 16);

            ctx.fillStyle = isAlert ? '#fca5a5' : '#ffffff';
            ctx.fillText(tag, cx, cy + 4);
            ctx.restore();
          });
        }

        if (payload?.roi) {
          const { x, y, w, h } = payload.roi;
          ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.strokeRect(x * W, y * H, w * W, h * H);
          ctx.setLineDash([]);
        }

        let items = payload?.data || payload?.detections || [];
        const now = Date.now();
        
        if (items.length > 0) {
          lastBoxesRef.current = { items, time: now };
        } else {
          if (now - lastBoxesRef.current.time < 300) {
            items = lastBoxesRef.current.items;
          } else {
            lastBoxesRef.current = { items: [], time: now };
          }
        }

        const taskType = payload?.type || "detection";
        const drawMode = payload?.bbox_draw_mode || "frontend";

        if (taskType === "detection") {
          items.forEach(det => {
            const [xmin, ymin, xmax, ymax] = det.bbox;
            const x = xmin * W, y = ymin * H;
            const width = (xmax - xmin) * W, height = (ymax - ymin) * H;

            const lbl = String(det.label || '').toLowerCase();
            const isFk = lbl === 'forklift' || lbl === 'folklift' || lbl.includes('fork');
            const isPerson = lbl === 'person' || lbl === 'human' || lbl === 'pedestrian';
            const boxColor = isFk ? '#f43f5e' : isPerson ? '#06b6d4' : '#FF8C00';

            if (drawMode !== 'backend') {
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, width, height);

              const lbl = `${det.label} ${(det.confidence ? Math.round(det.confidence * 100) + '%' : '')}`;
              ctx.fillStyle = boxColor;
              ctx.fillRect(x, y - 14, ctx.measureText(lbl).width + 8, 14);
              ctx.fillStyle = '#000';
              ctx.font = 'bold 10px sans-serif';
              ctx.fillText(lbl, x + 4, y - 3);

              // Draw Ground-Contact Anchor Point on floor for Forklift Safety Monitor
              if (isForkliftNode) {
                const anchorX = ((xmin + xmax) / 2) * W;
                const anchorY = ymax * H;
                ctx.beginPath();
                ctx.arc(anchorX, anchorY, 4.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#10b981';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
            }
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

        // Draw Live Hazard HUD Banner on video top
        if (isForkliftNode) {
          const forkliftDebug = debugData[sourceNode.id];
          const hLevel = forkliftDebug?.hazard_level ?? 0;

          ctx.save();
          let bannerBg = 'rgba(16, 185, 129, 0.88)'; // Green
          let bannerText = `✓ ALL CLEAR | Forklifts: ${forkliftDebug?.forklift_count || 0}  Persons: ${forkliftDebug?.person_count || 0}`;

          if (hLevel === 2) {
            bannerBg = 'rgba(225, 29, 72, 0.92)'; // Red
            bannerText = `🚨 CRITICAL RISK | Forklifts: ${forkliftDebug?.forklift_count || 0}  Persons: ${forkliftDebug?.person_count || 0}`;
          } else if (hLevel === 1) {
            bannerBg = 'rgba(217, 119, 6, 0.9)'; // Amber
            bannerText = `⚠️ CAUTION | Forklifts: ${forkliftDebug?.forklift_count || 0}  Persons: ${forkliftDebug?.person_count || 0}`;
          }

          ctx.fillStyle = bannerBg;
          ctx.fillRect(0, 0, W, 22);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(bannerText, 8, 15);

          if (forkliftDebug?.near_miss_count > 0) {
            ctx.textAlign = 'right';
            ctx.fillText(`Near-Miss: ${forkliftDebug.near_miss_count}`, W - 8, 15);
          }
          ctx.restore();
        }
      }
      
      // Draw FPS if available (only for AI nodes)
      const currentMeta = latestDataRef.current;
      if (shouldDrawBoxes && currentMeta && currentMeta.fps !== undefined) {
        const fpsStr = `AI FPS: ${currentMeta.fps}`;
        let fpsColor = '#22c55e'; // green
        if (currentMeta.fps < 10) fpsColor = '#ef4444'; // red
        else if (currentMeta.fps < 20) fpsColor = '#eab308'; // yellow
        
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(fpsStr).width + 8;
        const cw = canvas.width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cw - tw - 6, 4, tw, 16);
        ctx.fillStyle = fpsColor;
        ctx.fillText(fpsStr, cw - tw - 2, 16);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [shouldDrawBoxes, currentStreamId]);

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
  } else if (isVideoMode && (sourceNode.type === 'aiNode' || sourceNode.type === 'inputNode' || isForkliftNode)) {
    content = (
      <div className="relative w-64 aspect-video bg-black flex items-center justify-center">
        <video 
          ref={videoRef} 
          className={`w-full h-full object-contain ${isPaused ? 'opacity-50' : ''} ${(!whepUrl || status === 'error') ? 'hidden' : ''}`} 
          autoPlay 
          playsInline 
          muted 
          onLoadedMetadata={(e) => setResolution(`${e.target.videoWidth}x${e.target.videoHeight}`)}
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
        <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded flex gap-2">
          <span>{sourceNode.type === 'forkliftZoneNode' ? `Forklift Video (${sourceHandle || 'debug'})` : 'Live Preview'}</span>
          {resolution && <span className="text-gray-300 font-mono">{resolution}</span>}
        </div>
      </div>
    );
  } else if (data?.outputType === 'text' && (sourceNode?.type === 'rateLimitNode' || sourceNode?.type === 'functionNode')) {
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
  } else if (sourceNode.type === 'flowCounterNode') {
    const debugState = debugData[sourceNode.id];
    const counts = debugState?.counts || sourceNode.data?.counts || {};
    const total = debugState?.total ?? sourceNode.data?.total ?? 0;
    const entries = Object.entries(counts);

    content = (
      <div className="flex flex-col p-3 gap-2 bg-gray-900/60 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-gray-700/60 pb-1.5 text-xs text-gray-400">
          <span className="flex items-center gap-1.5 text-teal-400 font-semibold">
            <span>⇄</span> Flow Counts
          </span>
          <span className="text-white font-bold bg-teal-950 border border-teal-700 px-2 py-0.5 rounded text-xs font-mono">
            Total: {total}
          </span>
        </div>

        {entries.length > 0 ? (
          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto custom-scrollbar pr-0.5">
            {entries.map(([cls, cnt]) => (
              <div key={cls} className="flex items-center justify-between bg-gray-950/80 px-2.5 py-1.5 rounded text-xs border border-gray-800">
                <span className="text-teal-300 font-medium truncate max-w-[130px]" title={cls}>
                  {cls}
                </span>
                <span className="text-white font-bold font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-700/60">
                  {cnt}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-gray-500 italic text-center py-2">
            Waiting for objects... (Total: 0)
          </div>
        )}
      </div>
    );
  } else if (sourceNode.type === 'counterNode') {
    const debugState = debugData[sourceNode.id];
    const val = debugState?.value ?? 0;
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-gray-900/50 min-w-[160px]">
        <span className="text-xs text-gray-400">Event Counter</span>
        <span className="text-2xl font-bold text-emerald-400 font-mono">{val}</span>
      </div>
    );
  } else if (isForkliftNode) {
    const debugState = debugData[sourceNode.id];
    const isCriticalVal = debugState?.is_critical ?? false;
    const isDangerVal = debugState?.is_danger ?? false;
    const liveZones = debugState?.zones || {};

    if (sourceHandle === 'is_critical') {
      content = (
        <div className="flex flex-col items-center justify-center p-3.5 gap-2 bg-gray-900/80 min-w-[210px]">
          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
            <AlertOctagon size={15} className={isCriticalVal ? "text-red-500 animate-bounce" : "text-gray-500"} />
            <span>Critical Collision Alert</span>
          </div>
          <div className={`text-xl font-black font-mono tracking-wider px-3.5 py-1.5 rounded-lg border ${
            isCriticalVal
              ? "bg-red-950/90 text-red-200 border-red-600 animate-pulse shadow-lg shadow-red-950/80"
              : "bg-gray-950/80 text-gray-400 border-gray-800"
          }`}>
            {isCriticalVal ? "TRUE (SIREN)" : "FALSE"}
          </div>
          <span className="text-[10px] text-gray-400 font-mono text-center">
            {isCriticalVal ? "🚨 Forklift + Person / Conflict" : "Normal / No Critical Hazard"}
          </span>
        </div>
      );
    } else if (sourceHandle === 'is_danger') {
      content = (
        <div className="flex flex-col items-center justify-center p-3.5 gap-2 bg-gray-900/80 min-w-[210px]">
          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
            <AlertTriangle size={15} className={isDangerVal ? "text-amber-400 animate-pulse" : "text-gray-500"} />
            <span>Any Forklift Warning</span>
          </div>
          <div className={`text-xl font-black font-mono tracking-wider px-3.5 py-1.5 rounded-lg border ${
            isDangerVal
              ? "bg-amber-950/90 text-amber-200 border-amber-600 shadow-md shadow-amber-950/60"
              : "bg-gray-950/80 text-emerald-400 border-gray-800"
          }`}>
            {isDangerVal ? "TRUE (WARN)" : "FALSE (CLEAR)"}
          </div>
          <span className="text-[10px] text-gray-400 font-mono text-center">
            Forklifts in Area: {debugState?.forklift_count ?? 0}
          </span>
        </div>
      );
    } else if (sourceHandle && (sourceHandle.startsWith('zone_') || (sourceNode.data?.zones || []).some(z => z.id === sourceHandle))) {
      const zoneCfg = (sourceNode.data?.zones || []).find(z => z.id === sourceHandle) || liveZones[sourceHandle] || {};
      const zoneState = liveZones[sourceHandle] || {};
      const isOccupied = zoneState.occupied ?? false;
      const fkCount = zoneState.forklift_count ?? 0;
      const pCount = zoneState.person_count ?? 0;
      const zoneColor = zoneCfg.color || (zoneCfg.type === 'caution' ? '#f59e0b' : '#f43f5e');

      content = (
        <div className="flex flex-col p-3 gap-2 bg-gray-900/80 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
            <div className="flex items-center gap-1.5 truncate max-w-[140px]">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: zoneColor }} />
              <span className="text-xs font-semibold text-gray-200 truncate">{zoneCfg.name || sourceHandle}</span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              isOccupied ? "bg-rose-950 text-rose-200 border border-rose-700" : "bg-gray-950 text-gray-400 border border-gray-800"
            }`}>
              {isOccupied ? "OCCUPIED" : "CLEAR"}
            </span>
          </div>
          <div className="flex items-center justify-around bg-gray-950/90 py-1.5 px-2 rounded border border-gray-800 text-center">
            <div>
              <span className="text-[9px] text-gray-400 block">Forklifts</span>
              <span className="text-sm font-bold font-mono text-rose-400">{fkCount}</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 block">Persons</span>
              <span className="text-sm font-bold font-mono text-cyan-400">{pCount}</span>
            </div>
          </div>
        </div>
      );
    } else {
      const hazardLevel = debugState?.hazard_level ?? 0;
      const hazardText = debugState?.hazard_text ?? (hazardLevel === 2 ? "CRITICAL" : hazardLevel === 1 ? "CAUTION" : "ALL CLEAR");
      const fkCount = debugState?.forklift_count ?? 0;
      const pCount = debugState?.person_count ?? 0;
      const nearMiss = debugState?.near_miss_count ?? 0;
      const zoneEntries = Object.values(liveZones);

      const isCritical = hazardLevel === 2;
      const isCaution = hazardLevel === 1;

      content = (
        <div className="flex flex-col p-3 gap-2 bg-gray-900/80 min-w-[240px]">
          <div className="flex items-center justify-between border-b border-gray-700/60 pb-1.5">
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs">
              <ShieldAlert size={14} /> Forklift Safety Telemetry
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                isCritical
                  ? 'bg-red-950 text-red-200 border border-red-700 animate-pulse'
                  : isCaution
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }`}
            >
              {isCritical ? '🚨 CRITICAL' : isCaution ? '⚠️ CAUTION' : '✓ SAFE'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-gray-950/90 p-1.5 rounded border border-gray-800 text-center">
            <div>
              <div className="text-[9px] text-gray-400">Forklifts</div>
              <div className="text-xs font-bold font-mono text-rose-400">{fkCount}</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400">Persons</div>
              <div className="text-xs font-bold font-mono text-cyan-400">{pCount}</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400">Near-Miss</div>
              <div className="text-xs font-bold font-mono text-amber-400">{nearMiss}</div>
            </div>
          </div>

          <div className="text-[10px] font-medium text-center text-gray-300 bg-gray-950/60 py-1 px-2 rounded border border-gray-800 truncate">
            {hazardText}
          </div>

          {zoneEntries.length > 0 && (
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar pr-0.5">
              {zoneEntries.map((z) => (
                <div
                  key={z.id}
                  className={`flex items-center justify-between px-2 py-1 rounded text-[10px] border ${
                    z.occupied
                      ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                      : 'bg-gray-950/60 border-gray-800 text-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: z.color || (z.type === 'caution' ? '#f59e0b' : '#f43f5e') }}
                    />
                    <span className="truncate">{z.name}</span>
                  </div>
                  <span className="font-mono font-bold text-[9px]">
                    {z.occupied ? `ALERT (${z.forklift_count || 0})` : 'CLEAR'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
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
          <button onClick={toggleMode} className="bg-gray-900/80 hover:bg-gray-700 p-1 rounded text-gray-300 shadow-md transition-colors" title={isVideoMode ? "Switch to Card/Value Mode" : "Switch to Live Video Stream"}>
            {isVideoMode ? <Code size={12} className="text-purple-400" /> : <MonitorPlay size={12} className="text-cyan-400" />}
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
