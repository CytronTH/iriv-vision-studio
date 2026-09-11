import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  RefreshCw,
  Check,
  Trash2,
  Plus,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Eye,
  Sliders,
  Maximize2,
  Compass,
  CornerDownRight,
  Info,
} from 'lucide-react';

const ZONE_TYPES = [
  { id: 'danger', name: 'Critical Danger (จุดตัดอันตราย)', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.25)', border: '#e11d48' },
  { id: 'caution', name: 'Approach / Caution (โซนระวัง)', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.25)', border: '#d97706' },
  { id: 'pedestrian', name: 'Pedestrian Walkway (ทางเดินเท้า)', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.25)', border: '#0891b2' },
];

export default function PolygonZoneEditorModal({
  sourceType,
  cameraId,
  videoPath,
  initialZones = [],
  initialForkliftClasses = ['forklift'],
  initialPersonClasses = ['person'],
  initialAnchorMode = 'bottom_center',
  initialDebounceMs = 400,
  initialCoPresenceRadius = 0.18,
  initialCriticalOnCoPresence = true,
  initialCriticalOnMultiForklift = true,
  initialForkliftConfidence = 0.30,
  initialForkliftIou = 0.40,
  initialPersonConfidence = 0.30,
  initialPersonIou = 0.45,
  onApply,
  onClose,
}) {
  const isFile = sourceType === 'file';

  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Deep copy initial zones or provide defaults
  const [zones, setZones] = useState(() => {
    if (initialZones && initialZones.length > 0) {
      return JSON.parse(JSON.stringify(initialZones));
    }
    return [
      {
        id: 'zone_danger',
        name: 'Intersection Danger Zone',
        type: 'danger',
        color: '#f43f5e',
        polygon: [
          { x: 0.25, y: 0.50 },
          { x: 0.75, y: 0.50 },
          { x: 0.90, y: 0.90 },
          { x: 0.10, y: 0.90 },
        ],
      },
      {
        id: 'zone_approach',
        name: 'Approach Warning Zone',
        type: 'caution',
        color: '#f59e0b',
        polygon: [
          { x: 0.35, y: 0.25 },
          { x: 0.65, y: 0.25 },
          { x: 0.75, y: 0.50 },
          { x: 0.25, y: 0.50 },
        ],
      },
    ];
  });

  const [selectedZoneId, setSelectedZoneId] = useState(() => zones[0]?.id || 'zone_danger');
  const [forkliftClassesStr, setForkliftClassesStr] = useState(initialForkliftClasses.join(', '));
  const [personClassesStr, setPersonClassesStr] = useState(initialPersonClasses.join(', '));
  const [anchorMode, setAnchorMode] = useState(initialAnchorMode);
  const [debounceMs, setDebounceMs] = useState(initialDebounceMs);
  const [coPresenceRadius, setCoPresenceRadius] = useState(initialCoPresenceRadius);
  const [criticalOnCoPresence, setCriticalOnCoPresence] = useState(initialCriticalOnCoPresence);
  const [criticalOnMultiForklift, setCriticalOnMultiForklift] = useState(initialCriticalOnMultiForklift);
  const [forkliftConfidence, setForkliftConfidence] = useState(initialForkliftConfidence);
  const [forkliftIou, setForkliftIou] = useState(initialForkliftIou);
  const [personConfidence, setPersonConfidence] = useState(initialPersonConfidence);
  const [personIou, setPersonIou] = useState(initialPersonIou);
  const [showGroundGuide, setShowGroundGuide] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Interaction state
  const draggingPointIdxRef = useRef(null); // index of vertex being dragged
  const draggingZoneIdRef = useRef(null);

  // ── Snapshot / Video Fetch ────────────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    if (!cameraId) return;
    setLoading(true);
    setError(null);
    setImageSrc(null);
    try {
      const res = await fetch(`/api/camera-snapshot?camera_id=${encodeURIComponent(cameraId)}&t=${Date.now()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setImageSrc(URL.createObjectURL(await res.blob()));
    } catch (e) {
      setError(e.message || 'Failed to capture snapshot from camera');
    } finally {
      setLoading(false);
    }
  }, [cameraId]);

  useEffect(() => {
    if (!isFile) fetchSnapshot();
  }, [isFile, fetchSnapshot]);

  const grabVideoFrame = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = vid.videoWidth;
    c.height = vid.videoHeight;
    c.getContext('2d').drawImage(vid, 0, 0);
    setImageSrc(c.toDataURL('image/jpeg', 0.92));
  }, []);

  // ── Redraw Canvas ─────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Dim background slightly to pop out zones
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, W, H);

    // Draw each zone polygon
    zones.forEach((zone) => {
      const poly = zone.polygon || [];
      if (poly.length < 3) return;

      const isSelected = zone.id === selectedZoneId;
      const typeInfo = ZONE_TYPES.find((t) => t.id === zone.type) || ZONE_TYPES[0];
      const color = zone.color || typeInfo.color;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(poly[0].x * W, poly[0].y * H);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x * W, poly[i].y * H);
      }
      ctx.closePath();

      // Clear the dimming over the polygon
      ctx.save();
      ctx.clip();
      ctx.clearRect(0, 0, W, H);
      // Colored fill
      ctx.fillStyle = isSelected ? `${color}44` : `${color}22`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // Border stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      if (zone.type === 'caution') {
        ctx.setLineDash([8, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();

      // Draw Zone Label
      const cx = (poly.reduce((acc, p) => acc + p.x, 0) / poly.length) * W;
      const cy = (poly.reduce((acc, p) => acc + p.y, 0) / poly.length) * H;

      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelText = `${zone.name}`;
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(cx - textWidth / 2 - 6, cy - 10, textWidth + 12, 20);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - textWidth / 2 - 6, cy - 10, textWidth + 12, 20);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, cx, cy);

      // Draw Vertices handles if selected
      if (isSelected) {
        poly.forEach((pt, idx) => {
          const px = pt.x * W;
          const py = pt.y * H;

          ctx.beginPath();
          ctx.arc(px, py, 7, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Vertex index number
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((idx + 1).toString(), px, py);
        });
      }

      ctx.restore();
    });

    // Draw Ground-Contact Footprint Anchor Demo if enabled
    if (showGroundGuide) {
      ctx.save();
      // Draw a subtle hint box at bottom right
      const demoX = W * 0.82;
      const demoY = H * 0.72;
      const demoW = 70;
      const demoH = 90;

      // Dashed bounding box simulating forklift
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(demoX - demoW / 2, demoY - demoH, demoW, demoH);
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Forklift Mast', demoX, demoY - demoH - 4);

      // Ground anchor point at bottom center
      ctx.beginPath();
      ctx.arc(demoX, demoY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('Ground Contact (cx, ymax)', demoX, demoY + 14);
      ctx.restore();
    }
  }, [zones, selectedZoneId, showGroundGuide]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Sync canvas dimensions to image size
  useEffect(() => {
    const syncCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const img = container.querySelector('img');
      if (img && img.naturalWidth) {
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
        redrawCanvas();
      }
    };

    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [redrawCanvas, imageSrc]);

  // ── Pointer Handlers for Interactive Vertex Dragging ──────────────────────
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(canvas.height, e.clientY - rect.top)),
    };
  };

  const handlePointerDown = (e) => {
    const pt = getCanvasPoint(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;

    // 1. Check if clicking on an existing vertex of the selected zone
    const currentZone = zones.find((z) => z.id === selectedZoneId);
    if (currentZone && currentZone.polygon) {
      for (let i = 0; i < currentZone.polygon.length; i++) {
        const v = currentZone.polygon[i];
        const dist = Math.hypot(v.x * W - pt.x, v.y * H - pt.y);
        if (dist <= 15) {
          draggingPointIdxRef.current = i;
          draggingZoneIdRef.current = currentZone.id;
          return;
        }
      }
    }

    // 2. Check if clicking inside another zone to switch selection
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      const poly = z.polygon || [];
      if (poly.length >= 3) {
        // Point in polygon test
        let inside = false;
        for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
          const xi = poly[j].x * W;
          const yi = poly[j].y * H;
          const xj = poly[k].x * W;
          const yj = poly[k].y * H;
          const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) {
          setSelectedZoneId(z.id);
          return;
        }
      }
    }
  };

  const handlePointerMove = (e) => {
    if (draggingPointIdxRef.current === null || !draggingZoneIdRef.current) return;
    const pt = getCanvasPoint(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const normX = Math.max(0.01, Math.min(0.99, pt.x / canvas.width));
    const normY = Math.max(0.01, Math.min(0.99, pt.y / canvas.height));

    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== draggingZoneIdRef.current) return z;
        const newPoly = [...z.polygon];
        newPoly[draggingPointIdxRef.current] = {
          x: Math.round(normX * 1000) / 1000,
          y: Math.round(normY * 1000) / 1000,
        };
        return { ...z, polygon: newPoly };
      })
    );
  };

  const handlePointerUp = () => {
    draggingPointIdxRef.current = null;
    draggingZoneIdRef.current = null;
  };

  // ── Zone Management Functions ─────────────────────────────────────────────
  const handleAddZone = (type = 'danger') => {
    const typeInfo = ZONE_TYPES.find((t) => t.id === type) || ZONE_TYPES[0];
    const newId = `zone_${Date.now()}`;
    const newZone = {
      id: newId,
      name: `Zone ${zones.length + 1} (${type === 'danger' ? 'Danger' : 'Caution'})`,
      type: type,
      color: typeInfo.color,
      polygon: [
        { x: 0.30, y: 0.40 },
        { x: 0.70, y: 0.40 },
        { x: 0.80, y: 0.80 },
        { x: 0.20, y: 0.80 },
      ],
    };
    setZones([...zones, newZone]);
    setSelectedZoneId(newId);
  };

  const handleDeleteZone = (id) => {
    if (zones.length <= 1) return;
    const remaining = zones.filter((z) => z.id !== id);
    setZones(remaining);
    if (selectedZoneId === id) {
      setSelectedZoneId(remaining[0]?.id || '');
    }
  };

  const handleAddVertex = () => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== selectedZoneId) return z;
        const poly = z.polygon || [];
        if (poly.length === 0) return z;
        // Insert a new point midway between the last point and first point
        const last = poly[poly.length - 1];
        const first = poly[0];
        const newPt = {
          x: Math.round(((last.x + first.x) / 2) * 1000) / 1000,
          y: Math.round(((last.y + first.y) / 2) * 1000) / 1000,
        };
        return { ...z, polygon: [...poly, newPt] };
      })
    );
  };

  const handleDeleteLastVertex = () => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== selectedZoneId) return z;
        if (z.polygon.length <= 3) return z; // keep minimum 3 points for a valid polygon
        return { ...z, polygon: z.polygon.slice(0, -1) };
      })
    );
  };

  const handleApplyPreset = (presetName) => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== selectedZoneId) return z;
        let newPoly = z.polygon;
        if (presetName === 'trapezoid_45') {
          // Perspective Trapezoid for 45-degree ceiling/wall camera looking at intersection
          newPoly = [
            { x: 0.25, y: 0.45 },
            { x: 0.75, y: 0.45 },
            { x: 0.90, y: 0.88 },
            { x: 0.10, y: 0.88 },
          ];
        } else if (presetName === 't_junction') {
          // T-Junction Polygon shape
          newPoly = [
            { x: 0.35, y: 0.20 },
            { x: 0.65, y: 0.20 },
            { x: 0.65, y: 0.45 },
            { x: 0.90, y: 0.45 },
            { x: 0.90, y: 0.75 },
            { x: 0.10, y: 0.75 },
            { x: 0.10, y: 0.45 },
            { x: 0.35, y: 0.45 },
          ];
        } else if (presetName === 'crossroad') {
          // Full 4-way crossroad
          newPoly = [
            { x: 0.35, y: 0.15 },
            { x: 0.65, y: 0.15 },
            { x: 0.65, y: 0.40 },
            { x: 0.92, y: 0.40 },
            { x: 0.92, y: 0.70 },
            { x: 0.65, y: 0.70 },
            { x: 0.65, y: 0.92 },
            { x: 0.35, y: 0.92 },
            { x: 0.35, y: 0.70 },
            { x: 0.08, y: 0.70 },
            { x: 0.08, y: 0.40 },
            { x: 0.35, y: 0.40 },
          ];
        }
        return { ...z, polygon: newPoly };
      })
    );
  };

  const handleApply = () => {
    const fClasses = forkliftClassesStr
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const pClasses = personClassesStr
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    onApply({
      zones,
      forkliftClasses: fClasses.length > 0 ? fClasses : ['forklift'],
      personClasses: pClasses.length > 0 ? pClasses : ['person'],
      anchorMode,
      debounceMs: Number(debounceMs) || 400,
      coPresenceRadius: Number(coPresenceRadius) || 0.18,
      criticalOnCoPresence,
      criticalOnMultiForklift,
      forkliftConfidence: Number(forkliftConfidence) || 0.30,
      forkliftIou: Number(forkliftIou) || 0.40,
      personConfidence: Number(personConfidence) || 0.30,
      personIou: Number(personIou) || 0.45,
    });
    onClose();
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center gap-3">
            <div className="bg-rose-600/30 border border-rose-500/50 p-2 rounded-xl text-rose-400">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                Intersection Danger Zone & Forklift Monitor Editor
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-700 text-rose-300">
                  Warehouse Safety
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                วาดพื้นที่อันตราย (Polygon ROI) สำหรับกล้องติดมุมเฉียง 45° และกำหนดตรรกะเตือนภัยอุบัติเหตุทางแยก
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Canvas Preview Area */}
          <div className="flex-1 flex flex-col bg-black/90 p-4 border-r border-gray-800 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3 text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSnapshot}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>Refresh Snapshot</span>
                </button>
                <button
                  onClick={() => setShowGroundGuide(!showGroundGuide)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                    showGroundGuide
                      ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                  title="แสดงไกด์จุดสัมผัสพื้นฐานล้อ (Footprint Anchor)"
                >
                  <Eye size={13} />
                  <span>Ground-Contact Guide</span>
                </button>
              </div>

              {/* Preset Shape Buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 text-[11px]">Presets:</span>
                <button
                  onClick={() => handleApplyPreset('trapezoid_45')}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-200 hover:border-gray-600 transition-colors"
                  title="คางหมูสำหรับมุมเฉียง 45 องศา"
                >
                  📐 45° Trapezoid
                </button>
                <button
                  onClick={() => handleApplyPreset('t_junction')}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-200 hover:border-gray-600 transition-colors"
                  title="ทางแยกตัว T"
                >
                  T-Junction
                </button>
                <button
                  onClick={() => handleApplyPreset('crossroad')}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-200 hover:border-gray-600 transition-colors"
                  title="สี่แยกทางตัด"
                >
                  Crossroad
                </button>
              </div>
            </div>

            {/* Interactive Canvas Container */}
            <div
              ref={containerRef}
              className="relative flex-1 bg-gray-950 rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center select-none"
            >
              {loading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 text-gray-300 gap-2">
                  <RefreshCw className="animate-spin text-rose-400" size={24} />
                  <span>Capturing camera frame...</span>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 text-rose-400 p-6 text-center gap-2">
                  <AlertTriangle size={32} />
                  <p className="font-semibold text-sm">{error}</p>
                  <button
                    onClick={fetchSnapshot}
                    className="mt-2 px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500 rounded-lg text-white text-xs"
                  >
                    Retry
                  </button>
                </div>
              )}

              {imageSrc ? (
                <div className="relative inline-block max-h-full max-w-full">
                  <img
                    src={imageSrc}
                    alt="Camera feed"
                    className="max-h-[62vh] max-w-full object-contain block pointer-events-none"
                    onLoad={() => {
                      const img = containerRef.current?.querySelector('img');
                      const canvas = canvasRef.current;
                      if (img && canvas) {
                        canvas.width = img.clientWidth;
                        canvas.height = img.clientHeight;
                        redrawCanvas();
                      }
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="absolute inset-0 cursor-crosshair touch-none"
                  />
                </div>
              ) : (
                <div className="text-gray-500 text-xs flex flex-col items-center gap-2">
                  <Camera size={36} className="text-gray-600" />
                  <span>Waiting for camera snapshot...</span>
                </div>
              )}
            </div>

            {/* Instructions Footer */}
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 bg-gray-950/60 px-3 py-2 rounded-lg border border-gray-800">
              <span className="flex items-center gap-1.5">
                <Info size={13} className="text-rose-400" />
                <span>คลิกและลากที่จุดมุม (Vertex Circle 1, 2, 3...) เพื่อปรับองศาให้แนบกับแนวเส้นพื้นทางแยก</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddVertex}
                  className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 text-[10px]"
                >
                  + Add Point
                </button>
                <button
                  onClick={handleDeleteLastVertex}
                  className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 text-[10px]"
                >
                  - Remove Point
                </button>
              </div>
            </div>
          </div>

          {/* Right Configuration Sidebar */}
          <div className="w-88 bg-gray-950/80 p-5 flex flex-col gap-4 overflow-y-auto border-l border-gray-800">
            {/* Zones List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Layers size={14} className="text-rose-400" />
                  Safety Zones ({zones.length})
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAddZone('danger')}
                    className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-600/60 rounded text-[10px] font-semibold flex items-center gap-1"
                    title="เพิ่มพื้นที่อันตรายวิกฤต"
                  >
                    <Plus size={12} /> Danger
                  </button>
                  <button
                    onClick={() => handleAddZone('caution')}
                    className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/60 rounded text-[10px] font-semibold flex items-center gap-1"
                    title="เพิ่มพื้นที่เตือนระวังเข้าใกล้"
                  >
                    <Plus size={12} /> Caution
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {zones.map((zone) => {
                  const isSel = zone.id === selectedZoneId;
                  const typeInfo = ZONE_TYPES.find((t) => t.id === zone.type) || ZONE_TYPES[0];
                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSel
                          ? 'bg-gray-800/90 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                          : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: zone.color || typeInfo.color }}
                        />
                        <div className="truncate">
                          <p className="font-semibold text-gray-200 truncate">{zone.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {typeInfo.name.split(' ')[0]} • {zone.polygon?.length || 0} vertices
                          </p>
                        </div>
                      </div>

                      {zones.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone.id);
                          }}
                          className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-gray-800 transition-colors"
                          title="ลบโซนนี้"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Zone Edit Card */}
            {selectedZone && (
              <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3 flex flex-col gap-2.5">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                  Edit Zone: {selectedZone.name}
                </span>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400">Zone Name</label>
                  <input
                    type="text"
                    value={selectedZone.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setZones((prev) =>
                        prev.map((z) => (z.id === selectedZone.id ? { ...z, name: val } : z))
                      );
                    }}
                    className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400">Hazard Type</label>
                    <select
                      value={selectedZone.type}
                      onChange={(e) => {
                        const val = e.target.value;
                        const tInfo = ZONE_TYPES.find((t) => t.id === val);
                        setZones((prev) =>
                          prev.map((z) =>
                            z.id === selectedZone.id
                              ? { ...z, type: val, color: tInfo?.color || z.color }
                              : z
                          )
                        );
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value="danger">Critical Danger (แดง)</option>
                      <option value="caution">Caution / Approach (เหลือง)</option>
                      <option value="pedestrian">Walkway (ฟ้า)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400">Color</label>
                    <input
                      type="color"
                      value={selectedZone.color || '#f43f5e'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setZones((prev) =>
                          prev.map((z) => (z.id === selectedZone.id ? { ...z, color: val } : z))
                        );
                      }}
                      className="w-full h-8 bg-gray-950 border border-gray-700 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Warehouse Safety & Model Rules */}
            <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3 flex flex-col gap-3">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                <Sliders size={13} className="text-rose-400" />
                AI Model & Collision Logic
              </span>

              {/* Forklift Configuration Section */}
              <div className="bg-gray-950/60 border border-rose-950/60 rounded-lg p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wide">
                    🚜 Forklift Settings
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400">
                    Target Forklift Class (เช่น forklift, truck)
                  </label>
                  <input
                    type="text"
                    value={forkliftClassesStr}
                    onChange={(e) => setForkliftClassesStr(e.target.value)}
                    placeholder="forklift, truck"
                    className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Forklift Min Confidence:</span>
                    <span className="font-mono text-rose-300 font-bold">{Math.round(forkliftConfidence * 100)}% ({Number(forkliftConfidence).toFixed(2)})</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.05"
                    value={forkliftConfidence}
                    onChange={(e) => setForkliftConfidence(parseFloat(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Forklift NMS / Duplicate IoU:</span>
                    <span className="font-mono text-amber-300 font-bold">{Math.round(forkliftIou * 100)}% ({Number(forkliftIou).toFixed(2)})</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.80"
                    step="0.05"
                    value={forkliftIou}
                    onChange={(e) => setForkliftIou(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <span className="text-[9px] text-gray-400 leading-tight">
                    💡 ตัด BBox ซ้อนคันเดียวกัน (ยิ่งค่าน้อย ยิ่งตัดกรอบซ้อนเข้มงวดขึ้น)
                  </span>
                </div>
              </div>

              {/* Person Configuration Section */}
              <div className="bg-gray-950/60 border border-cyan-950/60 rounded-lg p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wide">
                    🚶 Person / Pedestrian Settings
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400">
                    Person Class (เช่น person, human)
                  </label>
                  <input
                    type="text"
                    value={personClassesStr}
                    onChange={(e) => setPersonClassesStr(e.target.value)}
                    placeholder="person"
                    className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Person Min Confidence:</span>
                    <span className="font-mono text-cyan-300 font-bold">{Math.round(personConfidence * 100)}% ({Number(personConfidence).toFixed(2)})</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.05"
                    value={personConfidence}
                    onChange={(e) => setPersonConfidence(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Person NMS / Duplicate IoU:</span>
                    <span className="font-mono text-amber-300 font-bold">{Math.round(personIou * 100)}% ({Number(personIou).toFixed(2)})</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.80"
                    step="0.05"
                    value={personIou}
                    onChange={(e) => setPersonIou(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Anchor Mode Selection (Crucial for 45-degree angle) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400">
                  Detection Anchor Point (จุดคำนวณบนตัวรถ)
                </label>
                <select
                  value={anchorMode}
                  onChange={(e) => setAnchorMode(e.target.value)}
                  className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-rose-500 font-medium"
                >
                  <option value="bottom_center">
                    ⭐ Bottom-Center (จุดสัมผัสพื้นล้อ - แนะนำสำหรับมุมเฉียง 45°)
                  </option>
                  <option value="centroid">Centroid (จุดกึ่งกลาง BBox รวมเสา)</option>
                </select>
                <span className="text-[9px] text-emerald-400 leading-tight">
                  ✓ ป้องกันยอดเสา Forklift ลอยเข้าไปในโซนแล้วเกิด False Alarm
                </span>
              </div>

              {/* Co-Presence Critical Alarm Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs text-gray-200 font-medium">Forklift + Person Hazard</p>
                  <p className="text-[10px] text-gray-400">ไซเรนเตือนวิกฤตเมื่อมีคนและรถพร้อมกัน</p>
                </div>
                <input
                  type="checkbox"
                  checked={criticalOnCoPresence}
                  onChange={(e) => setCriticalOnCoPresence(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-rose-600 focus:ring-rose-500"
                />
              </div>

              {/* Multi-Forklift Intersection Conflict Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-200 font-medium">Multi-Forklift Conflict</p>
                  <p className="text-[10px] text-gray-400">เตือนวิกฤตเมื่อรถ 2 คันเข้าตัดหน้ากัน</p>
                </div>
                <input
                  type="checkbox"
                  checked={criticalOnMultiForklift}
                  onChange={(e) => setCriticalOnMultiForklift(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-rose-600 focus:ring-rose-500"
                />
              </div>

              {/* Debounce Filter */}
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Debounce Verification:</span>
                  <span className="font-mono text-gray-200">{debounceMs} ms</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={debounceMs}
                  onChange={(e) => setDebounceMs(e.target.value)}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-2 flex items-center gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/30 active:scale-95"
              >
                <Check size={15} /> Save & Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
