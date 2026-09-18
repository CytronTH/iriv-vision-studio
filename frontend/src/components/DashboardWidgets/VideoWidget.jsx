import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, Maximize2, Minimize2, X } from 'lucide-react';

/**
 * WHEP (WebRTC-HTTP Egress Protocol) hook.
 * Connects directly to MediaMTX — no iframe, full CSS control.
 */
function useWhepStream(whepUrl, videoRef) {
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, error

  const connect = useCallback(async () => {
    if (!whepUrl) return false;

    // cleanup previous
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    streamRef.current = null;
    setStatus('connecting');

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (e.streams[0]) {
          const s = e.streams[0];
          streamRef.current = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
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
      if (!isActive || !whepUrl) return;
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
      streamRef.current = null;
    };
  }, [connect, whepUrl]);

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

  return { status, reconnect: connect, stream, streamRef };
}

export default function VideoWidget({ metadata, projectId, config }) {
  const canvasRef = useRef(null);
  const videoRef  = useRef(null);
  const modalCanvasRef = useRef(null);
  const modalVideoRef  = useRef(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [qualityLabel, setQualityLabel] = useState(null); // e.g. "480p", "360p"

  // ── WHEP URL ───────────────────────────────────────────────────────────────
  const whepUrl = projectId && config?.dataPath
    ? `http://${window.location.hostname}:8889/${projectId}_${config.stream_id || config.dataPath}/whep`
    : (config?.camera_id ? `http://${window.location.hostname}:8889/shared_${config.camera_id}/whep` : null);

  const { status, reconnect, stream, streamRef } = useWhepStream(whepUrl, videoRef);

  const lastBoxesRef = useRef({ items: [], time: 0 });
  const latestMetadataRef = useRef(null);

  useEffect(() => {
    latestMetadataRef.current = metadata;
  }, [metadata]);

  // Sync stream to modal video when expanded
  useEffect(() => {
    if (isExpanded) {
      const activeStream = streamRef.current || stream;
      if (modalVideoRef.current && activeStream) {
        modalVideoRef.current.srcObject = activeStream;
        modalVideoRef.current.play().catch(() => {});
      }
    }
  }, [isExpanded, stream, streamRef]);

  // Listen to Escape key to close pop-up modal
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Handle quality badge update messages
  useEffect(() => {
    if (metadata?.type === 'stream_quality_update') {
      setQualityLabel(metadata.label);
    }
  }, [metadata]);

  // ── Canvas overlay (bbox + detections + FPS) ──────────────────────────────
  useEffect(() => {
    let animationFrameId;

    const drawCanvas = (canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const W = canvas.width, H = canvas.height;
      const currentMetadata = latestMetadataRef.current;
      if (!currentMetadata) return;

      const isMatchingCamera = config?.has_ai !== false &&
        (!currentMetadata.camera_id || currentMetadata.camera_id === config?.stream_id);
      if (!isMatchingCamera) return;

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
    };

    const render = () => {
      drawCanvas(canvasRef.current);
      if (isExpanded) {
        drawCanvas(modalCanvasRef.current);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isExpanded, config]);

  const statusColor = {
    connected: '#22c55e', connecting: '#f59e0b',
    error: '#ef4444',     idle:       '#6b7280',
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
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
          {qualityLabel && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono bg-indigo-900/60 text-indigo-300 border border-indigo-700">
              {qualityLabel}
            </span>
          )}
          <button
            onClick={() => setIsExpanded(true)}
            title="ขยายเต็มจอ (Full Screen Pop-up)"
            className="flex items-center justify-center p-1.5 rounded-lg text-xs font-mono border border-gray-600 bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 transition-colors active:scale-95 shadow-sm"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Video + Canvas overlay */}
      <div className="flex-1 relative bg-black min-h-0 flex items-center justify-center">
        {!config?.dataPath && !config?.camera_id ? (
          <div className="flex flex-col items-center gap-2 text-gray-500 text-sm">
            <Camera size={32} className="text-gray-600" />
            <p>Please bind a video source in settings</p>
          </div>
        ) : (
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

            {/* Canvas: transparent overlay for bboxes */}
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

      {/* Full-Screen Pop-up Modal */}
      {isExpanded && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsExpanded(false);
          }}
        >
          <div 
            className="relative w-full h-full max-w-[96vw] max-h-[96vh] flex flex-col bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl shadow-black ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gray-900/95 px-4 py-3 flex items-center justify-between border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Camera size={16} />
                </div>
                <span className="text-sm sm:text-base font-semibold text-gray-100 truncate">
                  {config?.title || 'Live Video Stream'}
                </span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-900 border border-gray-800">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${status === 'connected' ? 'animate-pulse' : ''}`}
                    style={{ background: statusColor[status] ?? '#6b7280' }}
                  />
                  <span className="text-[11px] font-mono text-gray-300 uppercase tracking-wider">
                    {status === 'connected' ? 'LIVE' : status}
                  </span>
                </div>
                {qualityLabel && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                    {qualityLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {status === 'error' && (
                  <button
                    onClick={reconnect}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-red-900/60 text-red-300 hover:bg-red-800 border border-red-700 active:scale-95 transition-all"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(false)}
                  title="ย่อหน้าต่าง (Esc)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-850 hover:bg-gray-750 text-gray-300 hover:text-white border border-gray-700 transition-all active:scale-95 shadow-sm"
                >
                  <Minimize2 size={13} />
                  <span className="hidden sm:inline">ย่อหน้าต่าง</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-gray-950 border border-gray-700 rounded text-gray-400">ESC</kbd>
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  title="ปิด (Esc)"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-transparent transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Video Player Area */}
            <div className="flex-1 relative bg-black min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
              {!config?.dataPath && !config?.camera_id ? (
                <div className="flex flex-col items-center gap-2 text-gray-500 text-sm">
                  <Camera size={36} className="text-gray-600" />
                  <p>Please bind a video source in settings</p>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      aspectRatio: '16 / 9',
                      width: 'min(100%, calc((100vh - 140px) * 16 / 9))',
                      maxHeight: '100%',
                      maxWidth: '100%',
                    }}
                  >
                    <video
                      ref={modalVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full rounded-lg"
                      style={{ objectFit: 'contain', background: '#000' }}
                    />

                    <canvas
                      ref={modalCanvasRef}
                      width={640}
                      height={360}
                      className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
                    />

                    {status !== 'connected' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-gray-400 text-sm flex-col gap-2 pointer-events-none rounded-lg">
                        {status === 'connecting' && (
                          <><span className="animate-spin text-2xl">⟳</span><span>Connecting...</span></>
                        )}
                        {status === 'error' && (
                          <><span className="text-red-400 text-3xl">⚠</span><span>Stream unavailable</span></>
                        )}
                        {status === 'idle' && (
                          <><Camera size={32} /><span>Waiting for stream...</span></>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
