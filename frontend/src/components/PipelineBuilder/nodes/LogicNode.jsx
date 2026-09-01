import React, { useEffect, useState, useRef } from 'react';
import { Handle, Position, useHandleConnections, useNodesData } from '@xyflow/react';
import { Filter, ChevronDown, ChevronRight, Zap, Code, LayoutList, GripVertical, Plus } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

// ── Quick-insert snippets (for Code Mode) ────────────────────────────────────
const SNIPPETS = [
  { label: 'Any object',        expr: 'len(msg["payload"]) > 0' },
  { label: 'No object',         expr: 'len(msg["payload"]) == 0' },
  { label: 'Count >=',          expr: 'len(msg["payload"]) >= 2' },
  { label: 'Has label',         expr: 'has("person")' },
  { label: 'A and B together',  expr: 'has("person") and has("car")' },
  { label: 'A or B',           expr: 'has("person") or has("car")' },
];

const VARS_REF = [
  ['msg["payload"]',           'list   — the payload object'],
  ['count',                    'int    — total detections in ROI'],
  ['has("label")',             'bool   — label exists in ROI'],
  ['label_count("label")',     'int    — count of specific label'],
  ['confidence',               'float  — max confidence (all)'],
  ['label_confidence("label")', 'float  — max confidence of label'],
];

export default function LogicNode({ id, data }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const connections = useHandleConnections({ type: 'target' });
  const upstreamNode = useNodesData(connections[0]?.source || 'empty-id');
  
  const [showRef, setShowRef] = useState(false);
  const [models, setModels] = useState([]);
  const editorRef = useRef(null);

  // Sync initialization
  useEffect(() => {
    if (data?.expression === undefined) {
      updateNodeData(id, {
        expression: 'len(msg["payload"]) > 0',
        isAdvancedMode: false,
        equationHtml: 'len(msg["payload"]) &gt; 0', // Initial state
        debounceMs: 0,
      });
    }
  }, [id, data?.expression, updateNodeData]);

  useEffect(() => {
    fetch('/api/entities')
      .then(r => r.json())
      .then(data => setModels(data.models || []))
      .catch(e => console.warn('Failed to fetch entities', e));
  }, []);


  let availableClasses = [];
  if (upstreamNode?.type === 'aiNode' && upstreamNode.data?.entityId) {
    const aiModel = models.find(m => m.id === upstreamNode.data.entityId);
    if (aiModel?.classes) availableClasses = aiModel.classes;
  }

  const expr           = data?.expression ?? 'len(msg["payload"]) > 0';
  const isAdvancedMode = data?.isAdvancedMode ?? false;
  // Fallback to expr text if equationHtml is not yet set
  const equationHtml   = data?.equationHtml ?? expr; 
  const debounceMs     = data?.debounceMs ?? 0;

  const setExpr = v => updateNodeData(id, { expression: v });
  const setDebounce = v => updateNodeData(id, { debounceMs: isNaN(parseInt(v)) ? 0 : parseInt(v) });
  const setMode = (advanced) => updateNodeData(id, { isAdvancedMode: advanced });

  // Update expression when the contentEditable changes
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    
    // Compile to python expression
    let newExpr = '';
    Array.from(editorRef.current.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        newExpr += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        newExpr += node.getAttribute('data-code') || node.textContent;
      }
    });

    // Clean up non-breaking spaces
    newExpr = newExpr.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');

    updateNodeData(id, { 
      equationHtml: html, 
      expression: newExpr 
    });
  };

  const insertBlockAtCursor = (html) => {
    if (!editorRef.current) return;
    
    // Focus the editor if it's not focused
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
      // Move cursor to end if newly focused
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    
    document.execCommand('insertHTML', false, html + '&nbsp;');
    handleEditorInput();
  };

  const insertSnippet = (snippet) => setExpr(snippet);

  // ── Palette Block Component ───────────────────────────────────────────────
  const DraggableBlock = ({ label, code, colorClass = "bg-purple-900/40 text-purple-300 border-purple-500/50" }) => {
    const html = `<span contenteditable="false" class="inline-flex items-center px-1.5 py-0.5 mx-0.5 my-0.5 rounded text-[11px] font-mono border shadow-sm align-middle select-none ${colorClass}" data-code='${code}'>${label}</span>`;
    
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/html', html);
          e.dataTransfer.setData('text/plain', code); // Fallback
        }}
        onClick={() => insertBlockAtCursor(html)}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border shadow-sm cursor-pointer hover:brightness-125 nodrag select-none transition-all ${colorClass}`}
        title="Click to insert or Drag & Drop"
      >
        <GripVertical size={10} className="opacity-50 -ml-0.5 cursor-grab active:cursor-grabbing" title="Drag me" />
        {label}
        <button 
          onClick={(e) => { e.stopPropagation(); insertBlockAtCursor(html); }}
          className="ml-1 opacity-70 hover:opacity-100 bg-black/20 hover:bg-black/40 rounded p-0.5 transition-opacity"
          title="Click to add"
        >
          <Plus size={8} />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 border-2 border-orange-600 rounded-xl shadow-lg shadow-orange-900/20 w-80 text-white flex flex-col">
      {/* Header */}
      <div className="bg-orange-600/20 p-3 flex items-center justify-between border-b border-orange-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 p-1.5 rounded-lg">
            <Filter size={16} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">Logic Filter</div>
            <div className="text-[10px] text-orange-300/70">Equation Builder</div>
          </div>
        </div>
        <NodeMenu id={id} />
      </div>

      <div className="p-3 flex flex-col gap-3">
        
        {/* Mode Toggle */}
        <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800 shrink-0">
          <button 
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${!isAdvancedMode ? 'bg-gray-800 text-orange-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={() => setMode(false)}
          >
            <LayoutList size={12} /> Equation Builder
          </button>
          <button 
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${isAdvancedMode ? 'bg-gray-800 text-orange-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={() => setMode(true)}
          >
            <Code size={12} /> Code Editor
          </button>
        </div>

        {/* ================================================================= */}
        {/* Visual Equation Builder Mode                                      */}
        {/* ================================================================= */}
        {!isAdvancedMode && (
          <div className="flex flex-col gap-3">
            
            {/* The Equation Box */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-[10px] text-orange-300 font-bold uppercase tracking-wider flex justify-between">
                <span>Equation Box</span>
                <span className="text-[9px] text-orange-500/70 font-normal">Drag & Drop blocks here</span>
              </label>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onBlur={handleEditorInput}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const html = e.dataTransfer.getData('text/html');
                  if (html) {
                    let range;
                    if (document.caretRangeFromPoint) {
                      range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    } else if (e.rangeParent) {
                      range = document.createRange();
                      range.setStart(e.rangeParent, e.rangeOffset);
                    }
                    if (range) {
                      const sel = window.getSelection();
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }
                    document.execCommand('insertHTML', false, html + '&nbsp;');
                    handleEditorInput();
                  }
                }}
                className="nodrag w-full bg-black/60 border border-orange-900/50 shadow-inner rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-orange-500 min-h-[70px] leading-relaxed cursor-text break-words font-mono"
                dangerouslySetInnerHTML={{ __html: equationHtml }}
              />
              
              <div className="text-[9px] text-gray-500 font-mono flex items-start gap-1 p-1.5 bg-gray-950 rounded border border-gray-800 mt-1">
                <span className="text-orange-500/50 shrink-0">Output:</span> 
                <span className="break-all">{expr}</span>
              </div>
            </div>

            {/* Block Palette */}
            <div className="flex flex-col gap-2 bg-gray-800/40 p-2 rounded-lg border border-gray-700/50 max-h-[250px] overflow-y-auto nodrag styled-scrollbar">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Palette</div>
              
              {/* Operators */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-gray-500">Operators & Logic</span>
                <div className="flex flex-wrap gap-1">
                  <DraggableBlock label="==" code=" == " colorClass="bg-orange-900/40 text-orange-300 border-orange-500/50" />
                  <DraggableBlock label="!=" code=" != " colorClass="bg-orange-900/40 text-orange-300 border-orange-500/50" />
                  <DraggableBlock label=">" code=" > " colorClass="bg-orange-900/40 text-orange-300 border-orange-500/50" />
                  <DraggableBlock label="<" code=" < " colorClass="bg-orange-900/40 text-orange-300 border-orange-500/50" />
                  <DraggableBlock label=">=" code=" >= " colorClass="bg-orange-900/40 text-orange-300 border-orange-500/50" />
                  <DraggableBlock label="<=" code=" <= " colorClass="bg-orange-900/40 text-orange-300 border-orange-500/50" />
                  
                  <DraggableBlock label="AND" code=" and " colorClass="bg-indigo-900/40 text-indigo-300 border-indigo-500/50" />
                  <DraggableBlock label="OR" code=" or " colorClass="bg-indigo-900/40 text-indigo-300 border-indigo-500/50" />
                  <DraggableBlock label="NOT" code=" not " colorClass="bg-indigo-900/40 text-indigo-300 border-indigo-500/50" />
                </div>
              </div>

              {/* Data Blocks */}
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[9px] text-gray-500">General Properties</span>
                <div className="flex flex-wrap gap-1">
                  <DraggableBlock label="Total Count" code="len(msg['payload'])" colorClass="bg-emerald-900/40 text-emerald-300 border-emerald-500/50" />
                  <DraggableBlock label="Max Confidence" code="confidence" colorClass="bg-emerald-900/40 text-emerald-300 border-emerald-500/50" />
                </div>
              </div>

              {/* AI Classes */}
              {availableClasses.length > 0 ? (
                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-[9px] text-gray-500">AI Classes ({availableClasses.length})</span>
                  {availableClasses.map(cls => (
                    <div key={cls} className="flex flex-col gap-1 p-1.5 rounded border border-gray-700/60 bg-gray-900/40">
                      <span className="text-[9px] font-bold text-gray-400 capitalize px-0.5">{cls}</span>
                      <div className="flex flex-wrap gap-1">
                        <DraggableBlock label={`Has ${cls}`} code={`has("${cls}")`} colorClass="bg-blue-900/40 text-blue-300 border-blue-500/50" />
                        <DraggableBlock label={`Count ${cls}`} code={`label_count("${cls}")`} colorClass="bg-green-900/40 text-green-300 border-green-500/50" />
                        <DraggableBlock label={`Conf. ${cls}`} code={`label_confidence("${cls}")`} colorClass="bg-pink-900/40 text-pink-300 border-pink-500/50" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[9px] text-gray-500 text-center py-2 border border-dashed border-gray-700 rounded">
                  Connect to an AI Node to see class blocks
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Code Editor Mode                                                  */}
        {/* ================================================================= */}
        {isAdvancedMode && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                <span>Expression</span>
                <span className="text-orange-400 font-normal">Python</span>
              </label>
              <textarea
                className="nodrag bg-gray-950 border border-gray-700 rounded-lg p-2 text-xs font-mono text-green-300 focus:outline-none focus:border-orange-500 resize-none leading-relaxed"
                rows={3}
                value={expr}
                onChange={e => setExpr(e.target.value)}
                placeholder={'len(msg["payload"]) > 0\nhas("person") and has("car")\nlabel_count("person") >= 2'}
                spellCheck={false}
              />
            </div>

            {/* Quick-insert snippets */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Quick insert</label>
              <div className="flex flex-wrap gap-1">
                {SNIPPETS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => insertSnippet(s.expr)}
                    className="text-[9px] bg-gray-800 hover:bg-orange-900/40 border border-gray-700 hover:border-orange-600 text-gray-400 hover:text-orange-300 px-1.5 py-0.5 rounded transition-colors nodrag"
                    title={s.expr}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Variable reference */}
            <div className="border border-gray-700/60 rounded-lg overflow-hidden">
              <button
                className="nodrag w-full flex items-center justify-between px-2.5 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                onClick={() => setShowRef(r => !r)}
              >
                <span className="flex items-center gap-1.5">
                  <Zap size={11} className="text-orange-400" />
                  Available variables
                </span>
                {showRef ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {showRef && (
                <div className="bg-gray-950/80 px-2.5 py-2 flex flex-col gap-1">
                  {VARS_REF.map(([v, desc]) => (
                    <div key={v} className="flex gap-2 items-start">
                      <code
                        className="text-[9px] font-mono text-amber-300 bg-gray-800 px-1 py-0.5 rounded cursor-pointer hover:bg-orange-900/30 transition-colors shrink-0 nodrag"
                        onClick={() => setExpr(v)}
                        title="Click to insert"
                      >
                        {v}
                      </code>
                      <span className="text-[9px] text-gray-500 leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debounce */}
        <label className="text-xs text-gray-400 flex items-center justify-between mt-1 shrink-0">
          <span>Debounce (ms)</span>
          <input
            type="number" min="0" step="100"
            className="nodrag bg-gray-800 border border-gray-700 rounded p-1 text-xs focus:outline-none focus:border-orange-500 w-20 text-right"
            value={debounceMs}
            onChange={e => setDebounce(e.target.value)}
          />
        </label>

      </div>

      <Handle type="target" position={Position.Left}  className="w-3 h-3 bg-orange-500 border-2 border-gray-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500 border-2 border-gray-900" />
    </div>
  );
}
