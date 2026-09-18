import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, X, AlertCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import usePipelineStore from '../../store/usePipelineStore';

const getNodeBadgeColors = (type) => {
  switch(type) {
    case 'inputNode': return 'bg-slate-900/40 text-slate-300 border-slate-700/50';
    case 'aiNode': return 'bg-purple-900/40 text-purple-300 border-purple-700/50';
    case 'logicNode': return 'bg-orange-900/40 text-orange-400 border-orange-700/50';
    case 'counterNode': return 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50';
    case 'flowCounterNode': return 'bg-teal-900/40 text-teal-400 border-teal-700/50';
    case 'forkliftZoneNode': return 'bg-rose-900/40 text-rose-400 border-rose-700/50';
    case 'shelfSlotMonitorNode': return 'bg-amber-900/40 text-amber-400 border-amber-700/50';
    case 'rateLimitNode': return 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50';
    case 'functionNode': return 'bg-pink-900/40 text-pink-400 border-pink-700/50';
    case 'actionNode': return 'bg-indigo-900/40 text-indigo-400 border-indigo-700/50';
    case 'snapshotNode': return 'bg-cyan-900/40 text-cyan-400 border-cyan-700/50';
    default: return 'bg-gray-900/40 text-gray-300 border-gray-700/50';
  }
};

export default function DebugPanel({ isOpen, onClose }) {
  const debugData = usePipelineStore((state) => state.debugData || {});
  const nodes = usePipelineStore((state) => state.nodes || []);
  const edges = usePipelineStore((state) => state.edges || []);
  const setDebugData = usePipelineStore((state) => state.setDebugData);
  const setHighlightedNodeIds = usePipelineStore((state) => state.setHighlightedNodeIds);

  const [expandedIds, setExpandedIds] = useState({});
  const [messageHistory, setMessageHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const lastPayloadsRef = useRef({});

  const toggleExpand = (msgId) => {
    setExpandedIds(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  useEffect(() => {
    const currentInfo = [];
    const debugNodes = nodes.filter(n => n.type === 'debugNode');

    debugNodes.forEach(dNode => {
      if (dNode.data?.isPaused) return;

      const incomingEdge = edges.find(e => e.target === dNode.id);
      if (!incomingEdge) return;

      const sourceNode = nodes.find(n => n.id === incomingEdge.source);
      if (!sourceNode) return;

      const isForkliftNode = sourceNode.type === 'forkliftZoneNode';
      const sourceHandle = incomingEdge.sourceHandle;
      const isForkliftVideoHandle = !sourceHandle || sourceHandle === 'debug' || sourceHandle === 'telemetry';
      const isDefaultVideo = sourceNode.type === 'inputNode' || 
                             sourceNode.type === 'aiNode' || 
                             (isForkliftNode && isForkliftVideoHandle);
      
      const isVideoMode = dNode.data?.outputType === 'video' 
        ? true 
        : dNode.data?.outputType === 'text' 
        ? false 
        : isDefaultVideo;

      if (!isVideoMode) {
        let payload = null;
        if (sourceNode.type === 'logicNode' || sourceNode.type === 'flowCounterNode' || sourceNode.type === 'counterNode' || isForkliftNode || sourceNode.type === 'rateLimitNode' || sourceNode.type === 'functionNode') {
           payload = debugData[sourceNode.id];
        } else {
           payload = debugData[sourceNode.id] || debugData[dNode.id];
        }

        if (payload !== undefined && payload !== null) {
          currentInfo.push({
            nodeId: dNode.id,
            label: sourceNode.data?.label || sourceNode.type,
            sourceName: sourceNode.type,
            payload
          });
        }
      }
    });

    let hasNewMessages = false;
    const newMessages = [];
    
    currentInfo.forEach(info => {
      const stringified = typeof info.payload === 'object' ? JSON.stringify(info.payload) : String(info.payload);
      if (lastPayloadsRef.current[info.nodeId] !== stringified) {
        lastPayloadsRef.current[info.nodeId] = stringified;
        hasNewMessages = true;
        newMessages.push({
          msgId: `${info.nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          nodeId: info.nodeId,
          label: info.label,
          sourceName: info.sourceName,
          payload: info.payload,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      }
    });

    if (hasNewMessages) {
      setMessageHistory(prev => {
        const updated = [...newMessages, ...prev];
        return updated.slice(0, 100); // Keep last 100 messages
      });
    }
  }, [debugData, nodes, edges]);

  const handleClear = () => {
    setMessageHistory([]);
    lastPayloadsRef.current = {};
    if (setDebugData) {
      setDebugData({});
    }
  };

  const handleMouseEnter = (nodeId) => {
    if (setHighlightedNodeIds) setHighlightedNodeIds([nodeId]);
  };

  const handleMouseLeave = () => {
    if (setHighlightedNodeIds) setHighlightedNodeIds([]);
  };

  const handleCopy = (e, msg) => {
    e.stopPropagation();
    const str = typeof msg.payload === 'object' ? JSON.stringify(msg.payload, null, 2) : String(msg.payload);
    
    if (!navigator.clipboard) {
      const textArea = document.createElement("textarea");
      textArea.value = str;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedId(msg.msgId);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
      return;
    }

    navigator.clipboard.writeText(str).then(() => {
      setCopiedId(msg.msgId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => console.error('Copy failed', err));
  };

  return (
    <aside className={`bg-gray-900 border-l border-gray-800 flex flex-col h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${isOpen ? 'w-full md:w-[340px]' : 'w-0 border-l-0'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 border-b border-gray-800 bg-gray-950/50 shrink-0">
        <div className="flex items-center gap-2 text-gray-200">
          <Terminal size={16} className="text-purple-400" />
          <span className="font-semibold text-[13px] tracking-wide">Debug Panel</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleClear}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-rose-400 transition-colors"
            title="Clear Debug History"
          >
            <Trash2 size={14} />
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors md:hidden"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2">
        {messageHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-3">
            <AlertCircle size={24} className="text-gray-700" />
            <p className="text-xs text-center leading-relaxed">
              No messages recorded yet.<br/>
              Switch a Debug Node to "Code Mode"<br/>to collect history here.
            </p>
          </div>
        ) : (
          messageHistory.map((msg) => {
            const isExpanded = expandedIds[msg.msgId];
            
            return (
              <div 
                key={msg.msgId} 
                className="bg-gray-950 border border-gray-800 rounded-md overflow-hidden shadow-sm hover:border-blue-500/50 transition-colors group flex flex-col shrink-0"
                onMouseEnter={() => handleMouseEnter(msg.nodeId)}
                onMouseLeave={handleMouseLeave}
              >
                <div 
                  className="bg-gray-800/40 hover:bg-gray-700/50 px-2 py-1.5 border-b border-gray-800/80 flex items-center justify-between cursor-pointer transition-colors"
                  onClick={() => toggleExpand(msg.msgId)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isExpanded ? <ChevronUp size={13} className="text-gray-400 shrink-0" /> : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
                    <span className="text-[10px] font-mono text-gray-400 truncate">
                      {msg.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleCopy(e, msg)}
                      className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 rounded flex items-center justify-center w-4 h-4"
                      title="Copy payload"
                    >
                      {copiedId === msg.msgId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border max-w-[85px] truncate ${getNodeBadgeColors(msg.sourceName)}`} title={`src: ${msg.sourceName}`}>
                      {msg.sourceName}
                    </span>
                  </div>
                </div>
                <div className={`relative px-2 py-1.5 overflow-x-auto custom-scrollbar transition-all duration-200 ${isExpanded ? 'max-h-[400px]' : 'max-h-12 overflow-hidden'}`}>
                  <pre className="text-[9px] font-mono text-emerald-400 m-0 whitespace-pre-wrap break-all leading-tight">
                    {typeof msg.payload === 'object' 
                      ? JSON.stringify(msg.payload, null, 2) 
                      : String(msg.payload)}
                  </pre>
                  {!isExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
