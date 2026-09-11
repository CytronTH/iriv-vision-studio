import React, { memo, useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Terminal, Trash2, Pause, Play, Plus, Minus, Code, AlignLeft } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeMenu from './NodeMenu';

export default memo(({ data, selected, isConnectable, id }) => {
  const debugMessages = usePipelineStore((state) => state.debugMessages || []);
  const clearDebugMessages = usePipelineStore((state) => state.clearDebugMessages);
  const edges = usePipelineStore((state) => state.edges);
  const highlightedNodeIds = usePipelineStore((state) => state.highlightedNodeIds);
  
  const [isPaused, setIsPaused] = useState(false);
  const [frozenMessages, setFrozenMessages] = useState([]);
  const [fontSize, setFontSize] = useState(10);
  const [isPretty, setIsPretty] = useState(true);

  // Which debug nodes are connected to this output window?
  const connectedDebugNodeIds = edges
    .filter(e => e.target === id)
    .map(e => e.source);

  // Filter messages to only show those originating from connected debug nodes
  // Limit to 20 and reverse so newest is at the top.
  let filteredMessages = debugMessages.filter(msg => {
    return msg.debugNodeIds && msg.debugNodeIds.some(dId => connectedDebugNodeIds.includes(dId));
  });
  filteredMessages = filteredMessages.slice(-20).reverse();

  const displayMessages = isPaused ? frozenMessages : filteredMessages;



  const isHighlighted = highlightedNodeIds?.includes(id);

  const increaseFont = () => setFontSize(f => Math.min(f + 2, 24));
  const decreaseFont = () => setFontSize(f => Math.max(f - 2, 8));

  const handleTogglePause = () => {
    if (!isPaused) {
      setFrozenMessages(filteredMessages);
    }
    setIsPaused(!isPaused);
  };

  // Helper to render pretty payload
  const renderPrettyPayload = (meta) => {
    if (!meta) return <span className="text-gray-500">Empty Payload</span>;
    
    // Transparent unwrap for Rate Limit Node
    if (meta.type === 'rate_limit_state') {
      if (meta.msg) {
        const innerPayload = meta.msg.payload;
        if (typeof innerPayload === 'boolean') {
           return renderPrettyPayload({ type: 'logic_state', value: innerPayload });
        } else if (meta.msg.metadata && (meta.msg.metadata.ai_task === 'detection' || meta.msg.metadata.ai_task === 'pose')) {
           let extractedData = innerPayload;
           if (innerPayload && innerPayload.detections) extractedData = innerPayload.detections;
           return renderPrettyPayload({ type: meta.msg.metadata.ai_task, data: extractedData, msg: meta.msg });
        }
      }
      // If we can't unwrap it, fallback to raw
      meta = meta.msg || meta;
    }

    // Logic Node output
    if (meta.type === 'logic_state') {
      const state = meta.value !== undefined ? meta.value : meta;
      
      let displayValue = "--", color = "text-gray-400";
      if (typeof state === 'boolean' || typeof state?.value === 'boolean') {
        const val = typeof state === 'boolean' ? state : state.value;
        displayValue = val ? "TRUE" : "FALSE";
        color = val ? "text-green-400" : "text-red-400";
      } else {
        displayValue = String(state?.value || state);
        color = "text-blue-400";
      }
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-400">🧠 Logic Output:</span>
          <span className={`font-bold ${color}`}>{displayValue}</span>
        </div>
      );
    }
    
    // AI Node (Detection) output
    if (meta.type === 'detection' || meta.type === 'pose') {
      const items = meta.data || [];
      if (!Array.isArray(items) || items.length === 0) {
        return <div className="text-gray-500 italic">No objects detected</div>;
      }
      return (
        <div className="flex flex-col gap-1">
          <div className="text-gray-400 mb-1">🎯 Detected Objects:</div>
          {items.map((det, i) => (
            <div key={i} className="flex items-center gap-2 ml-2">
              <span className="text-purple-400 font-bold">{det.label || 'object'}</span>
              <span className="text-gray-400">({Math.round((det.confidence || 0) * 100)}%)</span>
              {det.bbox && det.bbox.length === 4 && (
                <span className="text-gray-600 text-[0.85em]">
                  [{(det.bbox[0]).toFixed(2)}, {(det.bbox[1]).toFixed(2)}, {(det.bbox[2]-det.bbox[0]).toFixed(2)}, {(det.bbox[3]-det.bbox[1]).toFixed(2)}]
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Flow Counter Node output
    if (meta.type === 'flow_counter_update') {
      const counts = meta.counts || {};
      const total = meta.total || 0;
      const entries = Object.entries(counts);

      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-teal-400 font-semibold">
            <span>⇄ Flow Counter:</span>
            <span className="text-white font-bold bg-teal-950 px-2 py-0.5 rounded border border-teal-800 text-xs">
              Total: {total}
            </span>
          </div>
          {entries.length > 0 ? (
            <div className="flex flex-wrap gap-2 ml-2">
              {entries.map(([cls, cnt]) => (
                <div key={cls} className="flex items-center gap-1.5 bg-gray-950 px-2 py-0.5 rounded border border-gray-800 text-xs">
                  <span className="text-teal-300 font-medium">{cls}:</span>
                  <span className="text-white font-bold font-mono">{cnt}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic text-xs ml-2">Waiting for objects... (Total: 0)</div>
          )}
        </div>
      );
    }

    // Forklift Safety Monitor output
    if (meta.type === 'forklift_zone_update') {
      const hazardLevel = meta.hazard_level ?? 0;
      const isCritical = hazardLevel === 2;
      const isCaution = hazardLevel === 1;
      const zones = Object.values(meta.zones || {});

      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              🛡️ Forklift Safety:
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                isCritical
                  ? 'bg-red-950 text-red-200 border border-red-700 animate-pulse'
                  : isCaution
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }`}
            >
              {isCritical ? '🚨 CRITICAL' : isCaution ? '⚠️ CAUTION' : '✓ SAFE'}
            </span>
            <span className="text-gray-400 text-[11px]">
              (Forklifts: {meta.forklift_count || 0}, Persons: {meta.person_count || 0}, Near-Miss: {meta.near_miss_count || 0})
            </span>
          </div>
          {zones.length > 0 && (
            <div className="flex flex-wrap gap-1.5 ml-2">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${
                    z.occupied
                      ? 'bg-rose-950/70 border-rose-800 text-rose-200 font-bold'
                      : 'bg-gray-950 border-gray-800 text-gray-400'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: z.color || '#f43f5e' }}
                  />
                  <span>{z.name}:</span>
                  <span className="font-mono">{z.occupied ? 'ALERT' : 'CLEAR'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Default pretty JSON (fallback)
    return (
      <pre className="text-gray-300 whitespace-pre-wrap font-mono m-0" style={{ fontSize: `${fontSize}px` }}>
        {JSON.stringify(meta.msg || meta, null, 2)}
      </pre>
    );
  };

  return (
    <>
      <NodeResizer 
        color="#a855f7" 
        isVisible={selected} 
        minWidth={320} 
        minHeight={200} 
      />
      
      <div 
        className={`bg-gray-900 border-2 rounded-xl shadow-2xl overflow-hidden flex flex-col w-full h-full relative ${
          isHighlighted ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.5)] z-50' : 'border-purple-800'
        }`}
        style={{ minWidth: 320, minHeight: 200 }}
      >
        <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-purple-500 border-2 border-gray-900" />
        
        {/* Header */}
        <div className="bg-purple-900/30 px-3 py-2 border-b border-purple-800/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-purple-400" />
            <span className="text-xs font-bold text-purple-100 uppercase tracking-wider">Debug Output</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsPretty(!isPretty)} 
              className={`p-1 rounded text-gray-300 shadow-sm transition-colors ${isPretty ? 'bg-purple-800/60 hover:bg-purple-700' : 'bg-gray-800/80 hover:bg-gray-700'}`} 
              title={isPretty ? "Switch to Raw JSON" : "Switch to Pretty Format"}
            >
              {isPretty ? <AlignLeft size={12} className="text-purple-200" /> : <Code size={12} className="text-gray-400" />}
            </button>
            
            <div className="w-px h-4 bg-purple-800/50 mx-1"></div>
            
            <button onClick={decreaseFont} className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 shadow-sm" title="Decrease Font Size">
              <Minus size={12} />
            </button>
            <button onClick={increaseFont} className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 shadow-sm" title="Increase Font Size">
              <Plus size={12} />
            </button>
            
            <div className="w-px h-4 bg-purple-800/50 mx-1"></div>

            <button 
              onClick={handleTogglePause} 
              className={`p-1 rounded text-gray-300 shadow-sm transition-colors ${isPaused ? 'bg-amber-900/40 hover:bg-amber-800/60' : 'bg-gray-800/80 hover:bg-gray-700'}`} 
              title={isPaused ? "Resume Scrolling" : "Pause Scrolling"}
            >
              {isPaused ? <Play size={12} className="text-amber-400" /> : <Pause size={12} className="text-gray-400" />}
            </button>
            <button 
              onClick={() => { clearDebugMessages(); setFrozenMessages([]); }} 
              className="p-1 rounded bg-gray-800/80 hover:bg-red-900/50 text-gray-400 hover:text-red-400 shadow-sm transition-colors" 
              title="Clear Logs"
            >
              <Trash2 size={12} />
            </button>
            <NodeMenu id={id} />
          </div>
        </div>

        {/* Content */}
        <div className="p-2 flex-grow overflow-y-auto bg-[#0d1117] font-mono" style={{ fontSize: `${fontSize}px` }}>
          {connectedDebugNodeIds.length === 0 ? (
            <div className="text-gray-500 text-center mt-10 italic text-sm">
              Connect a Debug Node to view logs.
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="text-gray-600 text-center mt-10 text-sm">
              Waiting for data...
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-2">
              {displayMessages.map((msg) => {
                const rawPayload = msg.data.msg || msg.data;
                const metadata = msg.data;
                return (
                  <div key={msg.id} className="border-b border-gray-800/50 pb-2 break-words">
                    <div className="flex items-center justify-between mb-1 opacity-60">
                      <span className="text-purple-400">[{msg.timestamp}]</span>
                    </div>
                    {isPretty ? (
                      renderPrettyPayload(metadata)
                    ) : (
                      <pre className="text-gray-300 whitespace-pre-wrap font-mono m-0" style={{ fontSize: `${fontSize}px` }}>
                        {JSON.stringify(rawPayload, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
});
