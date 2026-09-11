import React, { useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, Crosshair, UserX, UserCheck, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';
import ShelfSlotEditorModal from './ShelfSlotEditorModal';

const SLOT_PALETTE = [
  { hex: '#f59e0b', border: '#d97706' },
  { hex: '#10b981', border: '#059669' },
  { hex: '#06b6d4', border: '#0891b2' },
  { hex: '#a855f7', border: '#9333ea' },
  { hex: '#f43f5e', border: '#e11d48' },
  { hex: '#3b82f6', border: '#2563eb' },
];

export default function ShelfSlotMonitorNode({ id, data }) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const debugData = usePipelineStore((s) => s.debugData || {});

  const [showEditor, setShowEditor] = useState(false);
  const [cameras, setCameras] = useState([]);

  // Initialize default node data
  useEffect(() => {
    if (data?.slots === undefined) {
      updateNodeData(id, {
        label: 'Shelf Slot Monitor',
        slots: [
          { id: 'slot_0', name: 'Slot 1 (Left)', roi: { x: 0.05, y: 0.15, w: 0.28, h: 0.70 }, targetClasses: [], minCount: 1 },
          { id: 'slot_1', name: 'Slot 2 (Center)', roi: { x: 0.36, y: 0.15, w: 0.28, h: 0.70 }, targetClasses: [], minCount: 1 },
          { id: 'slot_2', name: 'Slot 3 (Right)', roi: { x: 0.67, y: 0.15, w: 0.28, h: 0.70 }, targetClasses: [], minCount: 1 },
        ],
        personSuppression: true,
        personClass: 'person',
        debounceMs: 3000,
        personCooldownMs: 2000,
      });
    }
  }, [id, data?.slots, updateNodeData]);

  // Load cameras to feed snapshot modal
  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => setCameras(json.cameras || []))
      .catch(() => {});
  }, []);

  // Resolve camera by walking edges backwards
  const resolvedCamera = useMemo(() => {
    if (!cameras || cameras.length === 0) return null;
    let currId = id;
    const visited = new Set();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const inEdge = edges.find((e) => e.target === currId);
      if (!inEdge) break;
      const src = nodes.find((n) => n.id === inEdge.source);
      if (!src) break;
      if (src.type === 'inputNode' && src.data?.entityId) {
        const cam = cameras.find((c) => c.id === src.data.entityId);
        if (cam) return cam;
      }
      currId = src.id;
    }
    const anyInput = nodes.find((n) => n.type === 'inputNode' && n.data?.entityId);
    if (anyInput) {
      const cam = cameras.find((c) => c.id === anyInput.data.entityId);
      if (cam) return cam;
    }
    return cameras.find((c) => c.is_enabled) || cameras[0] || null;
  }, [id, nodes, edges, cameras]);

  const slots = data?.slots || [
    { id: 'slot_0', name: 'Slot 1 (Left)', roi: { x: 0.05, y: 0.15, w: 0.28, h: 0.70 }, minCount: 1 },
    { id: 'slot_1', name: 'Slot 2 (Center)', roi: { x: 0.36, y: 0.15, w: 0.28, h: 0.70 }, minCount: 1 },
    { id: 'slot_2', name: 'Slot 3 (Right)', roi: { x: 0.67, y: 0.15, w: 0.28, h: 0.70 }, minCount: 1 },
  ];

  // Real-time telemetry from WebSocket
  const liveTelemetry = debugData[id] || {};
  const isPaused = liveTelemetry?.is_paused ?? false;
  const hasPerson = liveTelemetry?.has_person ?? false;
  const anyEmpty = liveTelemetry?.any_empty ?? false;
  const liveSlots = liveTelemetry?.slots || {};

  const handleEditorApply = (newConfig) => {
    updateNodeData(id, newConfig);
  };

  return (
    <div className="bg-gray-900 border-2 border-amber-500 rounded-xl shadow-xl shadow-amber-900/20 w-80 text-white flex flex-col select-none">
      {/* Target Handle from AINode */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-amber-400 !border-2 !border-gray-900"
      />

      {/* Header */}
      <div className="bg-amber-500/20 p-3 flex items-center justify-between border-b border-amber-800/50">
        <div className="flex items-center gap-2.5">
          <div className="bg-amber-600 p-1.5 rounded-lg text-white shadow-sm">
            <Layers size={16} />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight text-amber-200">
              {data?.label || 'Shelf Slot Monitor'}
            </div>
            <div className="text-[10px] text-amber-400/80 font-mono">Retail Slot Occupancy</div>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>

      <div className="p-3.5 flex flex-col gap-3">
        {/* Real-time Status Banner */}
        {isPaused ? (
          <div className="bg-amber-950/70 border border-amber-700/70 rounded-lg p-2 flex items-center justify-between text-xs text-amber-200 animate-pulse">
            <div className="flex items-center gap-2">
              <UserX size={15} className="text-amber-400" />
              <span className="font-medium">Person in view (Paused)</span>
            </div>
            <span className="text-[10px] bg-amber-900/80 px-1.5 py-0.5 rounded text-amber-300 font-mono">HOLD</span>
          </div>
        ) : anyEmpty ? (
          <div className="bg-red-950/70 border border-red-700/70 rounded-lg p-2 flex items-center justify-between text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-400" />
              <span className="font-medium">Slot Needs Refill!</span>
            </div>
            <span className="text-[10px] bg-red-900/80 px-1.5 py-0.5 rounded text-red-300 font-mono font-bold">EMPTY</span>
          </div>
        ) : (
          <div className="bg-emerald-950/70 border border-emerald-700/70 rounded-lg p-2 flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span className="font-medium">All Slots In Stock</span>
            </div>
            <span className="text-[10px] bg-emerald-900/80 px-1.5 py-0.5 rounded text-emerald-300 font-mono">OK</span>
          </div>
        )}

        {/* Global Output Row */}
        <div className="relative flex items-center justify-between p-2 rounded-lg bg-gray-950 border border-gray-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${anyEmpty ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className="font-semibold text-gray-200">Any Slot Empty (Global)</span>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${anyEmpty ? 'bg-red-900/60 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
            {anyEmpty ? 'TRUE' : 'FALSE'}
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id="any_empty"
            className="!w-3 !h-3 !bg-amber-400 !border-2 !border-gray-900"
            title="Outputs True if ANY slot is empty"
          />
        </div>

        {/* Slots List with Per-Slot Output Handles */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Configured Slots ({slots.length})
          </span>

          <div className="flex flex-col gap-1.5">
            {slots.map((slot, idx) => {
              const color = SLOT_PALETTE[idx % SLOT_PALETTE.length];
              const slotTelemetry = liveSlots[slot.id];
              const isSlotEmpty = slotTelemetry?.is_empty ?? false;
              const slotCount = slotTelemetry?.count ?? '-';

              return (
                <div
                  key={slot.id}
                  className={`relative flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                    isSlotEmpty
                      ? 'bg-red-950/40 border-red-800/80'
                      : 'bg-gray-950/70 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div className="truncate">
                      <p className="font-medium text-gray-200 text-xs truncate leading-tight">
                        {slot.name}
                      </p>
                      <p className="text-[9px] text-gray-500 font-mono">
                        Count: {slotCount} (Min: {slot.minCount || 1})
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                      isSlotEmpty
                        ? 'bg-red-900/80 text-red-200'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                    }`}
                  >
                    {isSlotEmpty ? 'EMPTY' : 'IN STOCK'}
                  </span>

                  {/* Per-Slot Source Handle */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={slot.id}
                    className="!w-3 !h-3 !border-2 !border-gray-900"
                    style={{ backgroundColor: color.hex }}
                    title={`Outputs True when ${slot.name} is empty`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Button */}
        <button
          onClick={() => setShowEditor(true)}
          className="w-full mt-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/50 rounded-lg py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"
        >
          <Crosshair size={14} /> Edit Slots & Zones
        </button>
      </div>

      {/* Footer Info */}
      <div className="px-3.5 py-2 bg-gray-950/80 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <ShieldAlert size={12} className={data?.personSuppression !== false ? 'text-cyan-400' : 'text-gray-600'} />
          Person check: {data?.personSuppression !== false ? 'Active' : 'Disabled'}
        </span>
        <span>Debounce: {(data?.debounceMs || 3000) / 1000}s</span>
      </div>

      {/* Visual Configuration Modal */}
      {showEditor && (
        <ShelfSlotEditorModal
          sourceType={resolvedCamera?.type || 'local'}
          cameraId={resolvedCamera?.id}
          videoPath={resolvedCamera?.path}
          initialSlots={slots}
          initialPersonSuppression={data?.personSuppression ?? true}
          initialPersonClass={data?.personClass || 'person'}
          initialDebounceMs={data?.debounceMs ?? 3000}
          initialPersonCooldownMs={data?.personCooldownMs ?? 2000}
          onApply={handleEditorApply}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
