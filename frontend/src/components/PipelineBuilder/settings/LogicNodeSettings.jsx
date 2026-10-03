import React, { useState, useEffect, useRef } from 'react';
import { Zap, Code, LayoutList, GripVertical, Plus, ChevronDown, ChevronRight, Radio, Trash2 } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';

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

export default function LogicNodeSettings({ nodeId, data, onChange }) {
  const [showRef, setShowRef] = useState(false);
  const [models, setModels] = useState([]);
  const editorRef = useRef(null);

  const { edges, nodes } = usePipelineStore(useShallow((state) => ({
    edges: state.edges,
    nodes: state.nodes
  })));

  // Find upstream node for AI classes
  const upstreamEdge = edges.find(e => e.target === nodeId);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;

  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setModels(d.models || []))
      .catch(e => console.warn('Failed to fetch entities', e));
  }, []);

  let availableClasses = [];
  if (upstreamNode?.type === 'aiNode' && upstreamNode.data?.entityId) {
    const aiModel = models.find(m => m.id === upstreamNode.data.entityId);
    if (aiModel?.classes) availableClasses = aiModel.classes;
  }

  const expr           = data?.expression ?? 'len(msg["payload"]) > 0';
  const isAdvancedMode = data?.isAdvancedMode ?? false;
  const equationHtml   = data?.equationHtml ?? expr; 
  const debounceMs     = data?.debounceMs ?? 0;
  const outputMode     = data?.outputMode ?? 'on_change';
  const cooldownMs     = data?.cooldownMs ?? 0;

  const setExpr = v => onChange({ expression: v });
  const setDebounce = v => onChange({ debounceMs: isNaN(parseInt(v)) ? 0 : Math.max(0, parseInt(v)) });
  const setOutputMode = v => onChange({ outputMode: v });
  const setCooldown = v => onChange({ cooldownMs: isNaN(parseInt(v)) ? 0 : Math.max(0, parseInt(v)) });
  const setMode = (advanced) => onChange({ isAdvancedMode: advanced });

  const initialHtml = useRef(data?.equationHtml ?? expr).current;

  // Sync from props ONLY when switching nodes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = data?.equationHtml ?? expr;
    }
  }, [nodeId]);

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    
    let newExpr = '';
    Array.from(editorRef.current.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        newExpr += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        newExpr += node.getAttribute('data-code') || node.textContent;
      }
    });

    newExpr = newExpr.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');

    onChange({ 
      equationHtml: html, 
      expression: newExpr 
    });
  };

  const insertBlockAtCursor = (html) => {
    if (!editorRef.current) return;
    
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
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

  const DraggableBlock = ({ label, code, colorClass = "bg-purple-900/40 text-purple-300 border-purple-500/50" }) => {
    const html = `<span contenteditable="false" class="inline-flex items-center px-1.5 py-0.5 mx-0.5 my-0.5 rounded text-[11px] font-mono border shadow-sm align-middle select-none ${colorClass}" data-code='${code}'>${label}</span>`;
    
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/html', html);
          e.dataTransfer.setData('text/plain', code);
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
    <div className="flex flex-col gap-4">
      {/* Mode Toggle */}
      <div className="flex bg-gray-50 dark:bg-gray-950 rounded-lg p-1 border border-gray-200 dark:border-gray-800 shrink-0">
        <button 
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${!isAdvancedMode ? 'bg-gray-200 dark:bg-gray-800 text-orange-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-700 dark:text-gray-300'}`}
          onClick={() => setMode(false)}
        >
          <LayoutList size={12} /> Equation Builder
        </button>
        <button 
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${isAdvancedMode ? 'bg-gray-200 dark:bg-gray-800 text-orange-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-700 dark:text-gray-300'}`}
          onClick={() => setMode(true)}
        >
          <Code size={12} /> Code Editor
        </button>
      </div>

      {!isAdvancedMode && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 relative">
            <label className="text-[10px] text-orange-300 font-bold uppercase tracking-wider flex justify-between items-center">
              <span>Equation Box</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-orange-500/70 font-normal">Drag & Drop blocks here</span>
                <button 
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML = '';
                      handleEditorInput();
                    }
                  }}
                  className="bg-red-900/30 hover:bg-red-800/60 text-red-400 p-1 rounded transition-colors"
                  title="Clear Equation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
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
              onClick={(e) => {
                if (e.target === editorRef.current) {
                  const range = document.createRange();
                  range.selectNodeContents(editorRef.current);
                  range.collapse(false);
                  const sel = window.getSelection();
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              }}
              className="w-full bg-black/60 border border-orange-900/50 shadow-inner rounded-lg p-3 text-sm text-gray-800 outline-none focus:border-orange-500 min-h-[90px] leading-relaxed cursor-text break-words font-mono dark:text-gray-200"
            />
            
            <div className="text-[10px] text-gray-600 font-mono flex items-start gap-1 p-2 bg-gray-50 dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-800 mt-1 dark:text-gray-400">
              <span className="text-orange-500/50 shrink-0">Output:</span> 
              <span className="break-all">{expr}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 bg-gray-200/40 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-300/50 dark:border-gray-700/50 max-h-[350px] overflow-y-auto styled-scrollbar">
            <div className="text-xs text-gray-600 font-bold uppercase dark:text-gray-400">Palette</div>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-500 dark:text-gray-500">Operators & Logic</span>
              <div className="flex flex-wrap gap-1.5">
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

            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-500">General Properties</span>
              <div className="flex flex-wrap gap-1.5">
                <DraggableBlock label="Total Count" code="len(msg['payload'])" colorClass="bg-emerald-900/40 text-emerald-300 border-emerald-500/50" />
                <DraggableBlock label="Max Confidence" code="confidence" colorClass="bg-emerald-900/40 text-emerald-300 border-emerald-500/50" />
                <DraggableBlock label="Flow: New Count" code="payload.get('newly_counted', 0)" colorClass="bg-teal-900/40 text-teal-300 border-teal-500/50" />
                <DraggableBlock label="Flow: Total" code="payload.get('total', 0)" colorClass="bg-teal-900/40 text-teal-300 border-teal-500/50" />
              </div>
            </div>

            {availableClasses.length > 0 ? (
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">AI Classes ({availableClasses.length})</span>
                {availableClasses.map(cls => (
                  <div key={cls} className="flex flex-col gap-1 p-2 rounded border border-gray-300/60 dark:border-gray-700/60 bg-gray-100/40 dark:bg-gray-900/40">
                    <span className="text-[10px] font-bold text-gray-700 capitalize px-0.5 dark:text-gray-300">{cls}</span>
                    <div className="flex flex-wrap gap-1.5">
                      <DraggableBlock label={`Has ${cls}`} code={`has("${cls}")`} colorClass="bg-blue-900/40 text-blue-300 border-blue-500/50" />
                      <DraggableBlock label={`Count ${cls}`} code={`label_count("${cls}")`} colorClass="bg-green-900/40 text-green-300 border-green-500/50" />
                      <DraggableBlock label={`Conf. ${cls}`} code={`label_confidence("${cls}")`} colorClass="bg-pink-900/40 text-pink-300 border-pink-500/50" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-[10px] text-gray-500 text-center py-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg dark:text-gray-500">
                Connect to an AI Node to see class blocks
              </div>
            )}
          </div>
        </div>
      )}

      {isAdvancedMode && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600 font-bold uppercase tracking-wider flex justify-between dark:text-gray-400">
              <span>Expression</span>
              <span className="text-orange-400 font-normal">Python</span>
            </label>
            <textarea
              className="bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-green-300 focus:outline-none focus:border-orange-500 resize-none leading-relaxed w-full"
              rows={4}
              value={expr}
              onChange={e => setExpr(e.target.value)}
              placeholder={'len(msg["payload"]) > 0\nhas("person") and has("car")\nlabel_count("person") >= 2'}
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider dark:text-gray-500">Quick insert</label>
            <div className="flex flex-wrap gap-1.5">
              {SNIPPETS.map(s => (
                <button
                  key={s.label}
                  onClick={() => insertSnippet(s.expr)}
                  className="text-[10px] bg-gray-200 dark:bg-gray-800 hover:bg-orange-900/40 border border-gray-300 dark:border-gray-700 hover:border-orange-600 text-gray-700 hover:text-orange-300 px-2 py-1 rounded transition-colors dark:text-gray-300"
                  title={s.expr}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-gray-300/60 dark:border-gray-700/60 rounded-lg overflow-hidden mt-2">
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-200/50 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 hover:text-gray-900 transition-colors dark:text-gray-300 dark:hover:text-gray-100"
              onClick={() => setShowRef(r => !r)}
            >
              <span className="flex items-center gap-2">
                <Zap size={14} className="text-orange-400" />
                Available variables
              </span>
              {showRef ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {showRef && (
              <div className="bg-gray-50/80 dark:bg-gray-950/80 px-3 py-3 flex flex-col gap-2">
                {VARS_REF.map(([v, desc]) => (
                  <div key={v} className="flex gap-2 items-start">
                    <code
                      className="text-[10px] font-mono text-amber-300 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded cursor-pointer hover:bg-orange-900/30 transition-colors shrink-0"
                      onClick={() => setExpr(v)}
                      title="Click to insert"
                    >
                      {v}
                    </code>
                    <span className="text-[10px] text-gray-500 leading-relaxed dark:text-gray-500">{desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output Trigger & Flow Control */}
      <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 mt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
            <Radio size={13} /> Output Trigger Mode
          </span>
          <span className="text-[10px] text-gray-500 font-mono dark:text-gray-500">Anti-Flood</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <select
            value={outputMode}
            onChange={e => setOutputMode(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:border-orange-500/70 focus:border-orange-500 rounded p-1.5 text-xs text-gray-900 focus:outline-none transition-colors font-medium dark:text-white"
          >
            <option value="on_change">🔄 On Change (ส่งเฉพาะเมื่อสถานะเปลี่ยน)</option>
            <option value="rising_edge">⚡ Rising Edge (ส่งเมื่อเป็นจริงครั้งแรก)</option>
            <option value="continuous">🌊 Continuous (ส่งทุกเฟรม - 30 FPS)</option>
          </select>
          <p className="text-[10px] text-gray-600 leading-tight dark:text-gray-400">
            {outputMode === 'on_change' && '🛡️ แนะนำ: ส่งสัญญาณเฉพาะเมื่อเงื่อนไขเปลี่ยน (False ↔ True) ช่วยลดข้อมูลซ้ำซ้อน'}
            {outputMode === 'rising_edge' && '⚡ เหมาะสำหรับแจ้งเตือน/ถ่ายภาพ: ส่งออกเพียง 1 ครั้งเมื่อเริ่มตรวจพบวัตถุ'}
            {outputMode === 'continuous' && '⚠️ ส่งข้อมูลต่อเนื่องทุกเฟรม: อาจทำให้โหนดปลายทางทำงานหนักหากรับข้อมูล 30Hz'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-gray-200/80 dark:border-gray-800/80">
          <div>
            <label className="text-[11px] text-gray-700 flex flex-col dark:text-gray-300">
              <span className="font-medium">Debounce (ms)</span>
              <span className="text-[9px] text-gray-500 dark:text-gray-500">หน่วงกันสัญญาณกะพริบ</span>
            </label>
            <input
              type="number" min="0" step="100"
              className="mt-1 w-full bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-xs text-gray-900 focus:outline-none focus:border-orange-500 text-right font-mono dark:text-white"
              value={debounceMs}
              onChange={e => setDebounce(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-700 flex flex-col dark:text-gray-300">
              <span className="font-medium">Cooldown (ms)</span>
              <span className="text-[9px] text-gray-500 dark:text-gray-500">ระยะพักป้องกันยิงซ้ำ</span>
            </label>
            <input
              type="number" min="0" step="500"
              className="mt-1 w-full bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-xs text-gray-900 focus:outline-none focus:border-orange-500 text-right font-mono dark:text-white"
              value={cooldownMs}
              onChange={e => setCooldown(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
