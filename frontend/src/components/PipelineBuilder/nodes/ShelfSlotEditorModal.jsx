import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RefreshCw, Check, Trash2, Plus, Sliders, ShieldAlert, Layers, Eye } from 'lucide-react';

const SLOT_PALETTE = [
  { name: 'Amber', hex: '#f59e0b', border: '#d97706', bg: 'rgba(245, 158, 11, 0.25)' },
  { name: 'Emerald', hex: '#10b981', border: '#059669', bg: 'rgba(16, 185, 129, 0.25)' },
  { name: 'Cyan', hex: '#06b6d4', border: '#0891b2', bg: 'rgba(6, 182, 212, 0.25)' },
  { name: 'Purple', hex: '#a855f7', border: '#9333ea', bg: 'rgba(168, 85, 247, 0.25)' },
  { name: 'Rose', hex: '#f43f5e', border: '#e11d48', bg: 'rgba(244, 63, 94, 0.25)' },
  { name: 'Blue', hex: '#3b82f6', border: '#2563eb', bg: 'rgba(59, 130, 246, 0.25)' },
];

export default function ShelfSlotEditorModal({
  sourceType,
  cameraId,
  videoPath,
  initialSlots = [],
  initialPersonSuppression = true,
  initialPersonClass = 'person',
  initialDebounceMs = 3000,
  initialPersonCooldownMs = 2000,
  availableClasses = [],
  onApply,
  onClose,
}) {
  const isFile = sourceType === 'file';

  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [slots, setSlots] = useState(() => {
    if (initialSlots && initialSlots.length > 0) {
      return JSON.parse(JSON.stringify(initialSlots));
    }
    return [
      { id: 'slot_0', name: 'Slot 1 (Left)', roi: { x: 0.05, y: 0.15, w: 0.28, h: 0.70 }, targetClasses: [], minCount: 1 },
      { id: 'slot_1', name: 'Slot 2 (Center)', roi: { x: 0.36, y: 0.15, w: 0.28, h: 0.70 }, targetClasses: [], minCount: 1 },
      { id: 'slot_2', name: 'Slot 3 (Right)', roi: { x: 0.67, y: 0.15, w: 0.28, h: 0.70 }, targetClasses: [], minCount: 1 },
    ];
  });

  const [selectedSlotId, setSelectedSlotId] = useState(() => slots[0]?.id || 'slot_0');
  const [personSuppression, setPersonSuppression] = useState(initialPersonSuppression);
  const [personClass, setPersonClass] = useState(initialPersonClass);
  const [debounceSec, setDebounceSec] = useState(initialDebounceMs / 1000);
  const [cooldownSec, setCooldownSec] = useState(initialPersonCooldownMs / 1000);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Interaction state
  const draggingModeRef = useRef(null); // 'create' | 'move' | 'handle_nw' etc.
  const startPtRef = useRef(null);
  const initialRectRef = useRef(null);
  const tempRectRef = useRef(null);

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

    // Dim background slightly
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, W, H);

    // Draw each slot
    slots.forEach((slot, idx) => {
      const color = SLOT_PALETTE[idx % SLOT_PALETTE.length];
      const isSelected = slot.id === selectedSlotId;

      let r = slot.roi;
      if (isSelected && tempRectRef.current) {
        r = {
          x: tempRectRef.current.x / W,
          y: tempRectRef.current.y / H,
          w: tempRectRef.current.w / W,
          h: tempRectRef.current.h / H,
        };
      }

      const px = r.x * W;
      const py = r.y * H;
      const pw = r.w * W;
      const ph = r.h * H;

      // Fill slot
      ctx.fillStyle = isSelected ? color.bg.replace('0.25', '0.40') : color.bg;
      ctx.fillRect(px, py, pw, ph);

      // Border
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeStyle = color.hex;
      if (isSelected) {
        ctx.setLineDash([8, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(px, py, pw, ph);
      ctx.setLineDash([]);

      // Label Tag Badge on top
      const labelText = slot.name || `Slot ${idx + 1}`;
      ctx.font = 'bold 12px Inter, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const tagW = textMetrics.width + 16;
      const tagH = 22;

      ctx.fillStyle = color.hex;
      ctx.fillRect(px, Math.max(0, py - tagH), tagW, tagH);

      ctx.fillStyle = '#000000';
      ctx.fillText(labelText, px + 8, Math.max(15, py - 6));

      // If selected, draw 8 resize handles
      if (isSelected) {
        const hs = 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color.hex;
        ctx.lineWidth = 2;

        const handles = [
          [px, py],
          [px + pw / 2, py],
          [px + pw, py],
          [px + pw, py + ph / 2],
          [px + pw, py + ph],
          [px + pw / 2, py + ph],
          [px, py + ph],
          [px, py + ph / 2],
        ];

        handles.forEach(([hx, hy]) => {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
          ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
      }
    });
  }, [slots, selectedSlotId]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle Resize of Canvas to match displayed Image
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

  // ── Pointer Handlers for Interactive Drawing ──────────────────────────────
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

    // Check if clicked inside an existing slot to select or move
    let clickedSlot = null;
    for (let i = slots.length - 1; i >= 0; i--) {
      const s = slots[i];
      const px = s.roi.x * W;
      const py = s.roi.y * H;
      const pw = s.roi.w * W;
      const ph = s.roi.h * H;
      if (pt.x >= px && pt.x <= px + pw && pt.y >= py && pt.y <= py + ph) {
        clickedSlot = s;
        break;
      }
    }

    if (clickedSlot) {
      setSelectedSlotId(clickedSlot.id);
      draggingModeRef.current = 'move';
      startPtRef.current = pt;
      initialRectRef.current = {
        x: clickedSlot.roi.x * W,
        y: clickedSlot.roi.y * H,
        w: clickedSlot.roi.w * W,
        h: clickedSlot.roi.h * H,
      };
      tempRectRef.current = { ...initialRectRef.current };
    } else {
      // Start drawing a new rectangle for current active slot
      draggingModeRef.current = 'create';
      startPtRef.current = pt;
      tempRectRef.current = { x: pt.x, y: pt.y, w: 0, h: 0 };
    }
  };

  const handlePointerMove = (e) => {
    if (!draggingModeRef.current) return;
    const pt = getCanvasPoint(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;

    if (draggingModeRef.current === 'create') {
      const x = Math.min(startPtRef.current.x, pt.x);
      const y = Math.min(startPtRef.current.y, pt.y);
      const w = Math.abs(pt.x - startPtRef.current.x);
      const h = Math.abs(pt.y - startPtRef.current.y);
      tempRectRef.current = { x, y, w, h };
      redrawCanvas();
    } else if (draggingModeRef.current === 'move') {
      const dx = pt.x - startPtRef.current.x;
      const dy = pt.y - startPtRef.current.y;
      const init = initialRectRef.current;
      const newX = Math.max(0, Math.min(W - init.w, init.x + dx));
      const newY = Math.max(0, Math.min(H - init.h, init.y + dy));
      tempRectRef.current = { x: newX, y: newY, w: init.w, h: init.h };
      redrawCanvas();
    }
  };

  const handlePointerUp = () => {
    if (!draggingModeRef.current) return;
    const canvas = canvasRef.current;
    if (canvas && tempRectRef.current) {
      const W = canvas.width;
      const H = canvas.height;
      if (tempRectRef.current.w > 10 && tempRectRef.current.h > 10) {
        const newRoi = {
          x: Math.round((tempRectRef.current.x / W) * 1000) / 1000,
          y: Math.round((tempRectRef.current.y / H) * 1000) / 1000,
          w: Math.round((tempRectRef.current.w / W) * 1000) / 1000,
          h: Math.round((tempRectRef.current.h / H) * 1000) / 1000,
        };

        setSlots((prev) =>
          prev.map((s) => (s.id === selectedSlotId ? { ...s, roi: newRoi } : s))
        );
      }
    }

    draggingModeRef.current = null;
    startPtRef.current = null;
    initialRectRef.current = null;
    tempRectRef.current = null;
    redrawCanvas();
  };

  // ── Slot List Operations ──────────────────────────────────────────────────
  const handleAddSlot = () => {
    const nextIdx = slots.length;
    const newId = `slot_${Date.now() % 10000}`;
    const newSlot = {
      id: newId,
      name: `Slot ${nextIdx + 1}`,
      roi: {
        x: Math.min(0.7, 0.1 + (nextIdx % 3) * 0.25),
        y: 0.2,
        w: 0.25,
        h: 0.6,
      },
      targetClasses: [],
      minCount: 1,
    };
    setSlots((prev) => [...prev, newSlot]);
    setSelectedSlotId(newId);
  };

  const handleDeleteSlot = (idToDelete, e) => {
    e.stopPropagation();
    if (slots.length <= 1) return;
    const nextSlots = slots.filter((s) => s.id !== idToDelete);
    setSlots(nextSlots);
    if (selectedSlotId === idToDelete) {
      setSelectedSlotId(nextSlots[0]?.id || '');
    }
  };

  const handleUpdateSlotField = (slotId, field, value) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, [field]: value } : s))
    );
  };

  // ── Save & Apply ──────────────────────────────────────────────────────────
  const handleSave = () => {
    onApply({
      slots,
      personSuppression,
      personClass,
      debounceMs: Math.round(debounceSec * 1000),
      personCooldownMs: Math.round(cooldownSec * 1000),
    });
    onClose();
  };

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) || slots[0];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6 select-none animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden text-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/70">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/20 border border-amber-500/40 p-2 rounded-xl text-amber-400">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Shelf Slot & Zone Configuration
                <span className="text-xs font-normal text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-full">
                  {slots.length} Slots
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                ลากกรอบสี่เหลี่ยมแบ่งช่องวางสินค้าบนชั้นวาง กำหนดเงื่อนไข และระบบตรวจจับคนเพื่อระงับการแจ้งเตือน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isFile && (
              <button
                onClick={fetchSnapshot}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium text-gray-200 transition-colors"
                title="Refresh Camera Frame"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-amber-400' : ''} />
                Snapshot
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Main Visual Canvas (8 cols) */}
          <div className="lg:col-span-8 bg-black/90 p-4 flex flex-col items-center justify-center relative overflow-auto border-b lg:border-b-0 lg:border-r border-gray-800 min-h-[350px]">
            {loading && !imageSrc && (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <RefreshCw size={28} className="animate-spin text-amber-400" />
                <span className="text-sm">Capturing frame from camera...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 p-4 rounded-xl text-center max-w-md">
                <p className="font-semibold text-sm">Failed to grab camera snapshot</p>
                <p className="text-xs text-red-400/80 mt-1">{error}</p>
                <button
                  onClick={fetchSnapshot}
                  className="mt-3 px-3 py-1.5 bg-red-900/60 hover:bg-red-800/80 border border-red-700 rounded-lg text-xs font-medium text-white"
                >
                  Retry Snapshot
                </button>
              </div>
            )}

            {imageSrc && (
              <div
                ref={containerRef}
                className="relative inline-block border border-gray-800 rounded-lg overflow-hidden shadow-2xl"
              >
                <img
                  src={imageSrc}
                  alt="Shelf Live View"
                  className="block max-h-[60vh] max-w-full object-contain pointer-events-none"
                  onLoad={(e) => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                      canvas.width = e.target.clientWidth;
                      canvas.height = e.target.clientHeight;
                      redrawCanvas();
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 cursor-crosshair touch-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                />
              </div>
            )}

            {isFile && videoPath && (
              <video
                ref={videoRef}
                src={`/api/videos/stream?path=${encodeURIComponent(videoPath)}`}
                className="hidden"
                crossOrigin="anonymous"
                onLoadedData={grabVideoFrame}
              />
            )}

            <div className="absolute bottom-2 left-4 text-[11px] text-gray-500 bg-gray-950/80 px-2.5 py-1 rounded-md border border-gray-800">
              💡 คลิกและลากบนภาพเพื่อตีกรอบช่องวางที่เลือก | คลิกลากข้างในเพื่อย้ายตำแหน่ง
            </div>
          </div>

          {/* Right Control & Slot Management Panel (4 cols) */}
          <div className="lg:col-span-4 bg-gray-900/95 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 gap-5">
            {/* Slot List Section */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Layers size={14} className="text-amber-400" />
                  Shelf Slots ({slots.length})
                </span>
                <button
                  onClick={handleAddSlot}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  <Plus size={14} /> Add Slot
                </button>
              </div>

              {/* Slot Cards List */}
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {slots.map((slot, idx) => {
                  const color = SLOT_PALETTE[idx % SLOT_PALETTE.length];
                  const isSelected = slot.id === selectedSlotId;

                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-gray-800 border-amber-500 shadow-md'
                          : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-gray-200 truncate">{slot.name}</p>
                          <p className="text-[10px] text-gray-500">
                            Min: {slot.minCount || 1} |{' '}
                            {slot.targetClasses?.length > 0 ? slot.targetClasses.join(', ') : 'All Products'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {slots.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteSlot(slot.id, e)}
                            className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                            title="Delete Slot"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Slot Settings */}
            {selectedSlot && (
              <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex flex-col gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Edit: {selectedSlot.name}
                </span>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Slot Name / Label</label>
                  <input
                    type="text"
                    value={selectedSlot.name || ''}
                    onChange={(e) => handleUpdateSlotField(selectedSlot.id, 'name', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                    placeholder="e.g. Eco 5W-30 (Left)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Target Class</label>
                    <input
                      type="text"
                      value={selectedSlot.targetClasses?.join(', ') || ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
                        handleUpdateSlotField(selectedSlot.id, 'targetClasses', arr);
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500 placeholder:text-gray-600"
                      placeholder="e.g. Eco"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Min In-Stock Count</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedSlot.minCount ?? 1}
                      onChange={(e) =>
                        handleUpdateSlotField(selectedSlot.id, 'minCount', Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Occlusion & Person Suppression Settings */}
            <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-cyan-400" />
                  Person Occlusion Suppression
                </span>
                <input
                  type="checkbox"
                  checked={personSuppression}
                  onChange={(e) => setPersonSuppression(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-700 text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>

              {personSuppression && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-0.5">Person Class Name</label>
                    <input
                      type="text"
                      value={personClass}
                      onChange={(e) => setPersonClass(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
                      placeholder="person"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-gray-400 block mb-0.5">Empty Debounce (s)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={debounceSec}
                        onChange={(e) => setDebounceSec(parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 block mb-0.5">Person Cooldown (s)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={cooldownSec}
                        onChange={(e) => setCooldownSec(parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-end gap-2.5">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/30 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Check size={14} /> Save & Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
