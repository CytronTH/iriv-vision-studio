import React, { useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  ShieldAlert,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Users,
  Layers,
  Activity,
  Zap,
  Bug,
} from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';
import PolygonZoneEditorModal from './PolygonZoneEditorModal';

const TYPE_COLORS = {
  danger: { hex: '#f43f5e', border: '#e11d48', bg: 'bg-rose-950/60 text-rose-300' },
  caution: { hex: '#f59e0b', border: '#d97706', bg: 'bg-amber-950/60 text-amber-300' },
  pedestrian: { hex: '#06b6d4', border: '#0891b2', bg: 'bg-cyan-950/60 text-cyan-300' },
};

export default function ForkliftZoneNode({ id, data }) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const debugData = usePipelineStore((s) => s.debugData || {});

  const [showEditor, setShowEditor] = useState(false);
  const [cameras, setCameras] = useState([]);

  // Default node data initialization
  useEffect(() => {
    if (data?.zones === undefined) {
      updateNodeData(id, {
        label: 'Forklift Safety Monitor',
        zones: [
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
        ],
        forkliftClasses: ['forklift'],
        personClasses: ['person'],
        anchorMode: 'bottom_center',
        debounceMs: 400,
        coPresenceRadius: 0.18,
        criticalOnCoPresence: true,
        criticalOnMultiForklift: true,
        forkliftConfidence: 0.30,
        forkliftIou: 0.40,
        personConfidence: 0.30,
        personIou: 0.45,
      });
    }
  }, [id, data?.zones, updateNodeData]);

  // Load cameras for snapshot modal
  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => setCameras(json.cameras || []))
      .catch(() => {});
  }, []);

  // Resolve camera by tracing incoming edges back to inputNode
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

  const zones = data?.zones || [
    { id: 'zone_danger', name: 'Intersection Danger Zone', type: 'danger', color: '#f43f5e' },
    { id: 'zone_approach', name: 'Approach Warning Zone', type: 'caution', color: '#f59e0b' },
  ];

  // Real-time telemetry from WebSocket
  const liveTelemetry = debugData[id] || {};
  const hazardLevel = liveTelemetry?.hazard_level ?? 0;
  const isCritical = liveTelemetry?.is_critical ?? false;
  const isDanger = liveTelemetry?.is_danger ?? false;
  const forkliftCount = liveTelemetry?.forklift_count ?? 0;
  const personCount = liveTelemetry?.person_count ?? 0;
  const nearMissCount = liveTelemetry?.near_miss_count ?? 0;
  const liveZones = liveTelemetry?.zones || {};

  const handleEditorApply = (newConfig) => {
    updateNodeData(id, newConfig);
  };

  return (
    <div className="bg-gray-900 border-2 border-rose-500/80 rounded-xl shadow-xl shadow-rose-950/30 w-84 text-white flex flex-col select-none">
      {/* Target Handle from AINode */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-rose-400 !border-2 !border-gray-900"
      />

      {/* Header */}
      <div className="bg-rose-950/40 p-3 flex items-center justify-between border-b border-rose-900/50">
        <div className="flex items-center gap-2.5">
          <div className="bg-rose-600 p-1.5 rounded-lg text-white shadow-sm shadow-rose-900/50">
            <ShieldAlert size={16} />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight text-rose-200">
              {data?.label || 'Forklift Safety Monitor'}
            </div>
            <div className="text-[10px] text-rose-400/80 font-mono">Intersection & Danger Zones</div>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>

      <div className="p-3.5 flex flex-col gap-3">
        {/* Real-Time Status Banner */}
        {isCritical ? (
          <div className="bg-red-950/90 border-2 border-red-500 rounded-lg p-2.5 flex items-center justify-between text-xs text-red-100 animate-pulse shadow-lg shadow-red-950/60">
            <div className="flex items-center gap-2">
              <AlertOctagon size={18} className="text-red-400 animate-bounce" />
              <div>
                <span className="font-bold block leading-none">CRITICAL COLLISION RISK!</span>
                <span className="text-[9px] text-red-300">Forklift + Pedestrian / Intersection conflict</span>
              </div>
            </div>
            <span className="text-[10px] bg-red-800 px-2 py-1 rounded text-white font-mono font-black tracking-wider">
              SIREN
            </span>
          </div>
        ) : isDanger ? (
          <div className="bg-amber-950/80 border border-amber-500/80 rounded-lg p-2 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" />
              <div>
                <span className="font-semibold block leading-none">Caution: Forklift in Zone</span>
                <span className="text-[9px] text-amber-300/80">Active warning beacon recommended</span>
              </div>
            </div>
            <span className="text-[10px] bg-amber-800/80 px-1.5 py-0.5 rounded text-amber-200 font-mono font-bold">
              WARN
            </span>
          </div>
        ) : (
          <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-lg p-2 flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="font-medium">Intersection All Clear</span>
            </div>
            <span className="text-[10px] bg-emerald-900/80 px-1.5 py-0.5 rounded text-emerald-300 font-mono">
              SAFE
            </span>
          </div>
        )}

        {/* Real-time Metric Counts */}
        <div className="grid grid-cols-3 gap-1.5 bg-gray-950 p-2 rounded-lg border border-gray-800 text-center">
          <div>
            <div className="text-[10px] text-gray-400">Forklifts</div>
            <div className="text-sm font-bold font-mono text-rose-400">{forkliftCount}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400">Persons</div>
            <div className="text-sm font-bold font-mono text-cyan-400">{personCount}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400">Near-Miss</div>
            <div className="text-sm font-bold font-mono text-amber-400">{nearMissCount}</div>
          </div>
        </div>

        {/* Global Output Source Handles */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Global Action Outputs
          </span>

          {/* 1. Critical Siren Handle */}
          <div className="relative flex items-center justify-between p-2 rounded-lg bg-gray-950/80 border border-red-900/50 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isCritical ? 'bg-red-500 animate-ping' : 'bg-gray-700'}`} />
              <div>
                <span className="font-semibold text-red-200 block leading-tight">Critical Collision Alert</span>
                <span className="text-[9px] text-gray-500">Forklift+Person / Conflict</span>
              </div>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold mr-2 ${
                isCritical ? 'bg-red-900 text-red-200' : 'bg-gray-800 text-gray-500'
              }`}
            >
              {isCritical ? 'TRUE' : 'FALSE'}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="is_critical"
              className="!w-3 !h-3 !bg-red-500 !border-2 !border-gray-900"
              title="Outputs True during Critical Collision Risk (Siren / Emergency Stop)"
            />
          </div>

          {/* 2. Caution / Danger Handle */}
          <div className="relative flex items-center justify-between p-2 rounded-lg bg-gray-950/80 border border-amber-900/50 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isDanger ? 'bg-amber-400' : 'bg-gray-700'}`} />
              <div>
                <span className="font-semibold text-amber-200 block leading-tight">Any Forklift Warning</span>
                <span className="text-[9px] text-gray-500">Approaching or in intersection</span>
              </div>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold mr-2 ${
                isDanger ? 'bg-amber-900/80 text-amber-200' : 'bg-gray-800 text-gray-500'
              }`}
            >
              {isDanger ? 'TRUE' : 'FALSE'}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="is_danger"
              className="!w-3 !h-3 !bg-amber-400 !border-2 !border-gray-900"
              title="Outputs True when any forklift enters danger/caution zone"
            />
          </div>

          {/* 3. Debug & Telemetry Stream Handle */}
          <div className="relative flex items-center justify-between p-2 rounded-lg bg-gray-950/80 border border-purple-900/60 text-xs">
            <div className="flex items-center gap-1.5">
              <Bug size={13} className="text-purple-400" />
              <div>
                <span className="font-semibold text-purple-200 block leading-tight">Debug & Telemetry Stream</span>
                <span className="text-[9px] text-gray-500">Connect to Debug Node</span>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold mr-2 bg-purple-950/80 border border-purple-800/80 text-purple-300">
              DEBUG
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="debug"
              className="!w-3 !h-3 !bg-purple-500 !border-2 !border-gray-900 shadow-sm shadow-purple-500"
              title="Live Telemetry Stream for Debug Node"
            />
          </div>
        </div>

        {/* Configured Zones List with Per-Zone Output Handles */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Configured Zones ({zones.length})
          </span>

          <div className="flex flex-col gap-1.5">
            {zones.map((zone) => {
              const zoneTelemetry = liveZones[zone.id];
              const isOccupied = zoneTelemetry?.occupied ?? false;
              const fkCount = zoneTelemetry?.forklift_count ?? 0;
              const pCount = zoneTelemetry?.person_count ?? 0;
              const typeCfg = TYPE_COLORS[zone.type] || TYPE_COLORS.danger;
              const color = zone.color || typeCfg.hex;

              return (
                <div
                  key={zone.id}
                  className={`relative flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                    isOccupied
                      ? 'bg-rose-950/50 border-rose-700'
                      : 'bg-gray-950/70 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="truncate">
                      <p className="font-medium text-gray-200 text-xs truncate leading-tight">
                        {zone.name}
                      </p>
                      <p className="text-[9px] text-gray-500 font-mono">
                        Forklifts: {fkCount} • Persons: {pCount}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 mr-2 ${
                      isOccupied ? 'bg-rose-900/80 text-rose-200' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {isOccupied ? 'OCCUPIED' : 'CLEAR'}
                  </span>

                  {/* Per-Zone Source Handle */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={zone.id}
                    className="!w-3 !h-3 !border-2 !border-gray-900"
                    style={{ backgroundColor: color }}
                    title={`Outputs True when ${zone.name} has a forklift`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Button */}
        <button
          onClick={() => setShowEditor(true)}
          className="w-full mt-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/50 rounded-lg py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"
        >
          <Crosshair size={14} /> 📐 Edit Danger Zones (Polygon)
        </button>
      </div>

      {/* Footer Info */}
      <div className="px-3.5 py-2 bg-gray-950/80 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <Activity size={12} className="text-emerald-400" />
          Anchor: {data?.anchorMode === 'centroid' ? 'Centroid' : 'Ground Footprint (45°)'}
        </span>
        <span title="Forklift Conf / IoU Deduplication">
          FL: {Math.round((data?.forkliftConfidence ?? 0.30) * 100)}% (IoU {Math.round((data?.forkliftIou ?? 0.40) * 100)}%)
        </span>
      </div>

      {/* Visual Configuration Modal */}
      {showEditor && (
        <PolygonZoneEditorModal
          sourceType={resolvedCamera?.type || 'local'}
          cameraId={resolvedCamera?.id}
          videoPath={resolvedCamera?.path}
          initialZones={zones}
          initialForkliftClasses={data?.forkliftClasses || ['forklift']}
          initialPersonClasses={data?.personClasses || ['person']}
          initialAnchorMode={data?.anchorMode || 'bottom_center'}
          initialDebounceMs={data?.debounceMs ?? 400}
          initialCoPresenceRadius={data?.coPresenceRadius ?? 0.18}
          initialCriticalOnCoPresence={data?.criticalOnCoPresence ?? true}
          initialCriticalOnMultiForklift={data?.criticalOnMultiForklift ?? true}
          initialForkliftConfidence={data?.forkliftConfidence ?? 0.30}
          initialForkliftIou={data?.forkliftIou ?? 0.40}
          initialPersonConfidence={data?.personConfidence ?? 0.30}
          initialPersonIou={data?.personIou ?? 0.45}
          onApply={handleEditorApply}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
