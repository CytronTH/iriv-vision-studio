import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, Grid, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

/**
 * WHEP (WebRTC-HTTP Egress Protocol) hook.
 * Connects directly to MediaMTX — no iframe, full CSS control.
 */
function useWhepStream(whepUrl, videoRef) {
  const pcRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, error

  const connect = useCallback(async () => {
    if (!whepUrl || !videoRef.current) return false;

    // cleanup previous
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
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
        if (bad.includes(pc.connectionState))
          setStatus('error');
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')
          setStatus('error');
      };

      pc.addTransceiver('video', { direction: 'recvonly' });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // wait for ICE gathering
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

      if (!res.ok) throw new Error(`WHEP HTTP ${res.status}`);
      await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
      return true;
    } catch (err) {
      console.warn('WHEP error:', err.message);
      setStatus('error');
      return false;
    }
  }, [whepUrl, videoRef]);

  useEffect(() => {
    let timeoutId;
    let isActive = true;

    const attemptConnect = async () => {
      if (!isActive || !whepUrl || !videoRef.current) return;
      const success = await connect();
      if (!success && isActive) {
        timeoutId = setTimeout(attemptConnect, 2500);
      }
    };

    attemptConnect();

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    };
  }, [connect, whepUrl, videoRef]);

  // Auto-reconnect if video freezes
  useEffect(() => {
    if (status !== 'connected' || !videoRef.current) return;
    
    let lastTime = -1;
    let freezeCount = 0;
    
    const intervalId = setInterval(() => {
      if (!videoRef.current) return;
      const currentTime = videoRef.current.currentTime;
      
      if (currentTime === lastTime) {
        freezeCount++;
        if (freezeCount >= 3) { // Frozen for 3 seconds
          console.warn('Video froze, auto-reconnecting...');
          connect();
        }
      } else {
        freezeCount = 0;
        lastTime = currentTime;
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [status, connect, videoRef]);

  return { status, reconnect: connect };
}

export default function VideoWidget({ metadata, projectId, config }) {
  const canvasRef = useRef(null);
  const videoRef  = useRef(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [qualityLabel, setQualityLabel] = useState(null);  // e.g. "480p", "360p"

  // ── WHEP URLs ──────────────────────────────────────────────────────────────
  // Processed stream: output of AI pipeline (640×360, SAR fixed to 1:1 in SPS)
  const processedWhepUrl = projectId && config?.dataPath
    ? `http://${window.location.hostname}:8889/${projectId}_${config.stream_id || config.dataPath}/whep`
    : null;

  // Source stream: raw loop (native res, no AI, no bbox)
  // Loop naming: loop_{projectId}_{inputKey}  where inputKey = stream_id sans 'cam_' and stream index
  const rawStreamId = config?.stream_id || config?.dataPath || '';
  const inputKey    = rawStreamId.replace(/^cam_/, '').replace(/_\d+$/, '');
  const sourceWhepUrl = projectId && inputKey
    ? `http://${window.location.hostname}:8889/loop_${projectId}_${inputKey}/whep`
    : null;

  const whepUrl = showSource ? sourceWhepUrl : processedWhepUrl;
  const { status, reconnect } = useWhepStream(whepUrl, videoRef);

  const lastBoxesRef = useRef({ items: [], time: 0 });
  const latestMetadataRef = useRef(null);

  useEffect(() => {
    latestMetadataRef.current = metadata;
  }, [metadata]);

  // ── Canvas overlay (bbox + debug grid) ────────────────────────────────────
  useEffect(() => {
    // Handle quality badge update messages
    if (metadata?.type === 'stream_quality_update') {
      setQualityLabel(metadata.label);
    }
  }, [metadata]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (showSource) {
        animationFrameId = requestAnimationFrame(render);
        return; // no overlays in source view
      }

      const W = canvas.width, H = canvas.height;

      // Debug grid
      if (debugMode) {
        const cols = 4, rows = 4;
        ctx.strokeStyle = 'rgba(255,255,0,0.45)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) { const x = (c/cols)*W; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let r = 0; r <= rows; r++) { const y = (r/rows)*H; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(255,255,0,0.9)';
        ctx.fillText('(0,0)', 2, 12);
        ctx.fillText('(1,0)', W - 32, 12);
        ctx.fillText('(0.5,0.5)', W/2 - 24, H/2 + 4);
      }

      const currentMetadata = latestMetadataRef.current;
      if (!currentMetadata) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const isMatchingCamera = config?.has_ai !== false &&
        (!currentMetadata.camera_id || currentMetadata.camera_id === config?.stream_id);
      if (!isMatchingCamera) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Draw ROI if present in metadata
      if (currentMetadata.roi) {
        const { x, y, w, h } = currentMetadata.roi;
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(x * W, y * H, w * W, h * H);
      ctx.setLineDash([]);
      
      const roiLbl = "ROI ZONE";
      ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.fillRect(x * W, y * H - 16, ctx.measureText(roiLbl).width + 8, 16);
      ctx.fillStyle = '#000'; ctx.font = 'bold 10px sans-serif';
      ctx.fillText(roiLbl, x * W + 4, y * H - 4);
      }

      let items = currentMetadata.data || currentMetadata.detections || [];
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
      
      const taskType = currentMetadata.type || 'detection';
      const drawMode = currentMetadata.bbox_draw_mode || 'frontend';
      const lineThickness = currentMetadata.bbox_line_thickness || 2;
      const fontThickness = currentMetadata.bbox_font_thickness || 1;

    if (taskType === 'detection') {
      if (drawMode !== 'backend') {
        items.forEach(det => {
        const [xmin, ymin, xmax, ymax] = det.bbox;
        const x = xmin * W, y = ymin * H;
        const w = (xmax - xmin) * W, h = (ymax - ymin) * H;

        ctx.strokeStyle = '#FF8C00'; ctx.lineWidth = lineThickness;
        ctx.strokeRect(x, y, w, h);

        const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
        const fontSize = 10 + (fontThickness * 2);
        ctx.font = `bold ${fontSize}px sans-serif`;
        const tw = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(255,140,0,0.85)';
        ctx.fillRect(x, Math.max(y - (fontSize + 6), 0), tw, fontSize + 6);
        ctx.fillStyle = '#000';
        ctx.fillText(label, x + 4, Math.max(y - 4, fontSize + 2));

        if (debugMode) {
          const cx = x + w/2, cy = y + h/2;
          ctx.strokeStyle = 'rgba(255,80,80,0.9)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(cx-10,cy); ctx.lineTo(cx+10,cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx,cy-10); ctx.lineTo(cx,cy+10); ctx.stroke();
          ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,200,0,0.95)';
          ctx.fillText(
            `[${xmin.toFixed(3)},${ymin.toFixed(3)},${xmax.toFixed(3)},${ymax.toFixed(3)}]`,
            Math.max(cx - 60, 2), Math.max(cy - 14, 10)
          );
        }
        });
      }
    } else if (taskType === 'classification') {
      items.forEach((cls, idx) => {
        const yPos = 30 + idx * 24;
        const lbl = `${cls.label}: ${(cls.confidence * 100).toFixed(1)}%`;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, yPos - 18, ctx.measureText(lbl).width + 16, 22);
        ctx.fillStyle = '#00FF00'; ctx.font = 'bold 14px sans-serif';
        ctx.fillText(lbl, 18, yPos - 2);
      });

    } else if (taskType === 'pose') {
      const SKELETON = [
        [0,1],[0,2],[1,3],[2,4],[5,6],[5,7],[7,9],[6,8],[8,10],
        [5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16],
      ];
      items.forEach(pose => {
        if (pose.type !== 'skeleton' || !pose.points) return;
        const pts = pose.points.map(pt => ({ x: pt.x*W, y: pt.y*H, conf: pt.confidence }));
        ctx.strokeStyle = '#00FF7F'; ctx.lineWidth = 2;
        SKELETON.forEach(([a, b]) => {
          if (pts[a] && pts[b] && pts[a].conf > 0.3 && pts[b].conf > 0.3) {
            ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
          }
        });
        pts.forEach(pt => {
          if (pt.conf > 0.3) {
            ctx.fillStyle = pt.conf > 0.6 ? '#00FFFF' : '#888';
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, 2*Math.PI); ctx.fill();
          }
        });
      });
    }

      // Draw FPS if available
      if (currentMetadata.fps !== undefined) {
        const fpsStr = `AI FPS: ${currentMetadata.fps}`;
        let fpsColor = '#22c55e'; // green
        if (currentMetadata.fps < 10) fpsColor = '#ef4444'; // red
        else if (currentMetadata.fps < 20) fpsColor = '#eab308'; // yellow
        
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(fpsStr).width + 10;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(W - tw - 10, 10, tw, 20);
        ctx.fillStyle = fpsColor;
        ctx.fillText(fpsStr, W - tw - 5, 24);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [debugMode, showSource, config]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const statusColor = {
    connected: '#22c55e', connecting: '#f59e0b',
    error: '#ef4444',     idle:       '#6b7280',
  };

  return (
    <div className={
      isFullscreen
        ? "fixed inset-0 z-50 bg-gray-950 flex flex-col p-2 sm:p-4 animate-in fade-in duration-200"
        : "flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl"
    }>
      {/* Header */}
      <div className="bg-gray-800/80 px-3 py-2 flex items-center justify-between border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Camera size={16} className="text-blue-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-gray-200 truncate">
            {config?.title || 'Live Video Stream'}
          </span>
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: statusColor[status] ?? '#6b7280' }}
            title={`WebRTC: ${status}`}
          />
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {status === 'error' && (
            <button
              onClick={reconnect}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-900/60 text-red-300 hover:bg-red-800 border border-red-700 active:scale-95"
            >
              <RefreshCw size={11} /> Retry
            </button>
          )}
          {/* Quality tier badge */}
          {qualityLabel && !showSource && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono bg-indigo-900/60 text-indigo-300 border border-indigo-700">
              {qualityLabel}
            </span>
          )}
          <button
            onClick={() => setShowSource(s => !s)}
            title={showSource ? 'Showing raw source — click to switch to processed' : 'Show raw source stream'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors active:scale-95 ${
              showSource
                ? 'bg-blue-500 text-white border-blue-400 font-bold'
                : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
            }`}
          >
            SRC
          </button>
          <button
            onClick={() => setDebugMode(d => !d)}
            title="Toggle debug grid"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors active:scale-95 ${
              debugMode
                ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
            }`}
          >
            <Grid size={11} />
            <span className="hidden sm:inline">{debugMode ? 'DEBUG ON' : 'DEBUG'}</span>
          </button>
          <button
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="flex items-center justify-center p-1.5 rounded text-xs font-mono border border-gray-600 bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 transition-colors active:scale-95"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Video + Canvas overlay */}
      <div className="flex-1 relative bg-black min-h-0 flex items-center justify-center">
        {!config?.dataPath ? (
          <div className="flex flex-col items-center gap-2 text-gray-500 text-sm">
            <Camera size={32} className="text-gray-600" />
            <p>Please bind a video source in settings</p>
          </div>
        ) : (
          /*
            16:9 container — video + canvas share the same coordinate space.
            The processed stream now has SAR=1:1 embedded in the H.264 SPS
            (set via h264parse caps between x264enc and h264parse in the pipeline),
            so the browser renders 640×360 at correct 16:9 without stretching.
          */
          <div
            className="relative w-full"
            style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
          >
            {/* Video: fills the 16:9 box, object-fit:contain preserves ratio */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain', background: '#000' }}
            />

            {/* Canvas: transparent overlay for bboxes and debug grid */}
            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Status overlay */}
            {status !== 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-gray-400 text-sm flex-col gap-2 pointer-events-none">
                {status === 'connecting' && (
                  <><span className="animate-spin text-xl">⟳</span><span>Connecting...</span></>
                )}
                {status === 'error' && (
                  <><span className="text-red-400 text-2xl">⚠</span><span>Stream unavailable</span></>
                )}
                {status === 'idle' && (
                  <><Camera size={24} /><span>Waiting for stream...</span></>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
