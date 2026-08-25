import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RefreshCw, Check, Trash2, Film, Maximize2 } from 'lucide-react';

/**
 * ROIEditorModal — Visual Inspection Zone Editor
 *
 * Mounted via createPortal at document.body so it truly floats above
 * everything, bypassing ReactFlow's overflow:hidden and pointer capture.
 *
 * Props:
 *   sourceType   : 'local' | 'rtsp' | 'file'
 *   cameraId     : entity camera id (for /api/camera-snapshot)
 *   videoPath    : absolute path on server (file type only)
 *   currentRoi   : { x, y, w, h } normalized 0–1
 *   onApply(roi) : callback with new normalized roi
 *   onClose()    : callback to close modal
 */
export default function ROIEditorModal({ sourceType, cameraId, videoPath, currentRoi, onApply, onClose }) {
  const isFile = sourceType === 'file';

  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime]     = useState(0);
  const videoRef = useRef(null);

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [roi, setRoi] = useState(currentRoi || { x: 0, y: 0, w: 1, h: 1 });

  // Use refs for drawing state — avoids stale closures in pointer handlers
  const drawingRef  = useRef(false);
  const startPtRef  = useRef(null);
  const tempRectRef = useRef(null);

  // ── Snapshot ──────────────────────────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    if (!cameraId) return;
    setLoading(true); setError(null); setImageSrc(null);
    try {
      const res = await fetch(`/api/camera-snapshot?camera_id=${encodeURIComponent(cameraId)}&t=${Date.now()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setImageSrc(URL.createObjectURL(await res.blob()));
    } catch (e) {
      setError(e.message || 'Failed to capture snapshot');
    } finally {
      setLoading(false);
    }
  }, [cameraId]);

  useEffect(() => { if (!isFile) fetchSnapshot(); }, [isFile, fetchSnapshot]);

  // ── Video frame grab ──────────────────────────────────────────────────────
  const grabVideoFrame = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = vid.videoWidth; c.height = vid.videoHeight;
    c.getContext('2d').drawImage(vid, 0, 0);
    setImageSrc(c.toDataURL('image/jpeg', 0.92));
  }, []);

  const onVideoLoaded = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setVideoDuration(vid.duration); setCurrentTime(0); grabVideoFrame();
  };

  const onScrubberChange = (e) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  // ── Canvas draw ───────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const { width: W, height: H } = canvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const rect = tempRectRef.current
      ? tempRectRef.current
      : { x: roi.x * W, y: roi.y * H, w: roi.w * W, h: roi.h * H };

    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.fillRect(0, 0, W, H);
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);

    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);

    const hs = 8; ctx.fillStyle = '#a855f7';
    [[rect.x, rect.y], [rect.x + rect.w, rect.y],
     [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]
    ].forEach(([cx, cy]) => ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs));

    if (rect.w > 60 && rect.h > 20) {
      ctx.fillStyle = '#a855f7'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('Inspection Zone', rect.x + 6, rect.y + 16);
    }
  }, [roi]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { width: W, height: H } = container.getBoundingClientRect();
    if (W > 0 && H > 0) {
      canvas.width = Math.round(W);
      canvas.height = Math.round(H);
      redrawCanvas();
    }
  }, [redrawCanvas]);

  useEffect(() => {
    if (!imageSrc) return;
    const id = requestAnimationFrame(syncCanvasSize);
    return () => cancelAnimationFrame(id);
  }, [imageSrc, syncCanvasSize]);

  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  // ── Pointer events — beats ReactFlow mouse capture ────────────────────────
  const toCanvasXY = (e) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width  / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  };

  const onPointerDown = (e) => {
    if (!imageSrc) return;
    e.preventDefault(); e.stopPropagation();
    canvasRef.current.setPointerCapture(e.pointerId);
    const pos = toCanvasXY(e);
    drawingRef.current = true;
    startPtRef.current = pos;
    tempRectRef.current = { x: pos.x, y: pos.y, w: 0, h: 0 };
    redrawCanvas();
  };

  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pos = toCanvasXY(e); const sp = startPtRef.current; const c = canvasRef.current;
    const x = Math.max(0, Math.min(sp.x, pos.x));
    const y = Math.max(0, Math.min(sp.y, pos.y));
    tempRectRef.current = {
      x, y,
      w: Math.min(Math.abs(pos.x - sp.x), c.width  - x),
      h: Math.min(Math.abs(pos.y - sp.y), c.height - y),
    };
    redrawCanvas();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const c = canvasRef.current; const tr = tempRectRef.current;
    if (tr && tr.w > 4 && tr.h > 4) {
      setRoi({
        x: parseFloat((tr.x / c.width ).toFixed(4)),
        y: parseFloat((tr.y / c.height).toFixed(4)),
        w: parseFloat((tr.w / c.width ).toFixed(4)),
        h: parseFloat((tr.h / c.height).toFixed(4)),
      });
    }
    tempRectRef.current = null;
  };

  const handleApply = () => { onApply(roi); onClose(); };
  const handleReset = () => { setRoi({ x: 0, y: 0, w: 1, h: 1 }); tempRectRef.current = null; };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const videoSrc = videoPath ? `/api/video-file?path=${encodeURIComponent(videoPath)}` : null;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#111827', border: '1px solid rgba(168,85,247,0.45)',
        borderRadius: '1rem', boxShadow: '0 30px 70px rgba(88,28,135,0.55)',
        width: '92vw', maxWidth: '900px',
        display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'1rem 1.25rem', borderBottom:'1px solid #1f2937', flexShrink:0 }}>
          <div>
            <h2 style={{ margin:0, color:'#fff', fontWeight:700, fontSize:'0.95rem',
                         display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Maximize2 size={16} style={{ color:'#a855f7' }} />
              Draw Inspection Zone
            </h2>
            <p style={{ margin:'3px 0 0', color:'#6b7280', fontSize:'0.75rem' }}>
              {isFile
                ? 'Scrub the timeline to pick a frame, then drag on the image to draw the zone'
                : 'Take a snapshot, then drag on the image to draw the zone'}
            </p>
          </div>
          <button onClick={onClose} style={{
            background:'none', border:'none', color:'#6b7280', cursor:'pointer',
            padding:'4px', borderRadius:'6px', display:'flex', alignItems:'center',
          }}
            onMouseEnter={e => e.currentTarget.style.color='#fff'}
            onMouseLeave={e => e.currentTarget.style.color='#6b7280'}
          ><X size={20} /></button>
        </div>

        {/* Body */}
        <div style={{ padding:'1.25rem', display:'flex', flexDirection:'column',
                      gap:'0.75rem', overflowY:'auto', flex:1 }}>

          {/* Camera controls */}
          {!isFile && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
              <button onClick={fetchSnapshot} disabled={loading} style={{
                display:'flex', alignItems:'center', gap:'6px',
                background: loading ? '#6b21a8' : '#9333ea',
                color:'#fff', border:'none', borderRadius:'8px',
                padding:'8px 18px', fontSize:'0.85rem', fontWeight:600,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background='#a855f7'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background='#9333ea'; }}
              >
                {loading ? <RefreshCw size={14} style={{ animation:'roi-spin 1s linear infinite' }} />
                         : <Camera size={14} />}
                {loading ? 'Capturing…' : 'Take Snapshot'}
              </button>
              {imageSrc && !loading && (
                <span style={{ fontSize:'0.8rem', color:'#4ade80', display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', display:'inline-block' }} />
                  Snapshot ready — drag on image to draw zone
                </span>
              )}
              {error && <span style={{ fontSize:'0.8rem', color:'#f87171' }}>⚠ {error}</span>}
            </div>
          )}

          {/* Video scrubber */}
          {isFile && (
            <>
              {videoSrc && (
                <video ref={videoRef} src={videoSrc} style={{ display:'none' }}
                  preload="auto" crossOrigin="anonymous"
                  onLoadedData={onVideoLoaded} onSeeked={grabVideoFrame} />
              )}
              {videoDuration > 0 ? (
                <div style={{ background:'rgba(31,41,55,0.7)', border:'1px solid #374151',
                              borderRadius:'10px', padding:'10px 14px', display:'flex',
                              flexDirection:'column', gap:'6px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                                fontSize:'0.75rem', color:'#9ca3af' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                      <Film size={11} style={{ color:'#a855f7' }} /> Scrub to select frame
                    </span>
                    <span style={{ fontFamily:'monospace', color:'#c084fc' }}>
                      {fmtTime(currentTime)} / {fmtTime(videoDuration)}
                    </span>
                  </div>
                  <input type="range" min="0" max={videoDuration} step="0.05"
                    value={currentTime} onChange={onScrubberChange}
                    style={{ width:'100%', accentColor:'#9333ea', cursor:'pointer' }} />
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:'8px',
                              fontSize:'0.85rem', color:'#6b7280' }}>
                  <RefreshCw size={14} style={{ color:'#a855f7', animation:'roi-spin 1s linear infinite' }} />
                  Loading video…
                </div>
              )}
            </>
          )}

          {/* Image + canvas area */}
          <div style={{
            position:'relative', borderRadius:'10px', overflow:'hidden',
            border:'1px solid #374151', background:'#030712',
            minHeight:240, display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {!imageSrc && !loading && (
              <div style={{ textAlign:'center', color:'#4b5563', padding:'2.5rem' }}>
                <Camera size={40} style={{ opacity:0.2, display:'block', margin:'0 auto 10px' }} />
                <p style={{ margin:0, fontSize:'0.875rem' }}>
                  {isFile ? 'Waiting for video to load…' : 'Click "Take Snapshot" to capture a frame'}
                </p>
              </div>
            )}
            {loading && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                            justifyContent:'center', background:'rgba(3,7,18,0.85)', zIndex:10 }}>
                <RefreshCw size={34} style={{ color:'#a855f7', animation:'roi-spin 1s linear infinite' }} />
              </div>
            )}
            {imageSrc && (
              <div ref={containerRef} style={{ position:'relative', width:'100%', lineHeight:0 }}>
                <img src={imageSrc} alt="ROI preview"
                  style={{ width:'100%', display:'block', userSelect:'none', pointerEvents:'none' }}
                  draggable={false} onLoad={syncCanvasSize} />
                <canvas
                  ref={canvasRef}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%',
                           cursor:'crosshair', touchAction:'none' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
              </div>
            )}
          </div>

          {/* Numeric readout */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px',
            background:'rgba(31,41,55,0.5)', borderRadius:'10px',
            padding:'10px 14px', border:'1px solid rgba(55,65,81,0.5)',
          }}>
            {['x','y','w','h'].map(key => (
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                <label style={{ fontSize:'0.65rem', textTransform:'uppercase', fontWeight:700,
                                color:'#6b7280', letterSpacing:'0.08em', textAlign:'center' }}>
                  {key}
                </label>
                <input type="number" min="0" max="1" step="0.01" value={roi[key]}
                  onChange={e => setRoi(r => ({
                    ...r, [key]: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
                  }))}
                  style={{ background:'#030712', border:'1px solid #374151', borderRadius:'6px',
                           padding:'6px 4px', fontSize:'0.85rem', color:'#fff',
                           textAlign:'center', width:'100%', outline:'none' }}
                  onFocus={e  => e.target.style.borderColor='#9333ea'}
                  onBlur={e   => e.target.style.borderColor='#374151'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'0.9rem 1.25rem', borderTop:'1px solid #1f2937', flexShrink:0 }}>
          <button onClick={handleReset} style={{
            display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none',
            color:'#9ca3af', fontSize:'0.85rem', cursor:'pointer',
            padding:'6px 12px', borderRadius:'8px',
          }}
            onMouseEnter={e => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.background='rgba(127,29,29,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.background='none'; }}
          ><Trash2 size={14} /> Reset to Full Frame</button>

          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button onClick={onClose} style={{
              background:'none', border:'1px solid #374151', color:'#9ca3af',
              borderRadius:'8px', padding:'7px 18px', fontSize:'0.85rem', cursor:'pointer',
            }}
              onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6b7280'; }}
              onMouseLeave={e => { e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.borderColor='#374151'; }}
            >Cancel</button>
            <button onClick={handleApply} style={{
              display:'flex', alignItems:'center', gap:'6px', background:'#9333ea',
              border:'none', color:'#fff', borderRadius:'8px', padding:'8px 22px',
              fontSize:'0.85rem', fontWeight:700, cursor:'pointer',
            }}
              onMouseEnter={e => e.currentTarget.style.background='#a855f7'}
              onMouseLeave={e => e.currentTarget.style.background='#9333ea'}
            ><Check size={15} /> Apply Zone</button>
          </div>
        </div>
      </div>

      <style>{`@keyframes roi-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>,
    document.body
  );
}
