import React, { useState, useEffect, useRef } from 'react';
import {
  Database, BrainCircuit, Cpu, PackageOpen, CheckCircle2,
  Upload, Trash2, Play, Square, Zap, Wifi, RefreshCw,
  ChevronRight, FolderOpen, FileCode, Server, AlertTriangle,
  Download, Terminal, ExternalLink, ShieldCheck
} from 'lucide-react';

const API = 'http://localhost:7654';

// ── Sidebar steps ──────────────────────────────────────────────────
const STEPS = [
  { id: 'dataset',  label: 'Dataset',      icon: Database,     desc: 'Import from Roboflow' },
  { id: 'train',    label: 'Train Model',  icon: BrainCircuit, desc: 'YOLOv8 + CUDA' },
  { id: 'export',   label: 'Export ONNX',  icon: FileCode,     desc: 'Convert to ONNX' },
  { id: 'compile',  label: 'Compile .hef', icon: Cpu,          desc: 'Via IRIV device' },
  { id: 'deploy',   label: 'Deploy',       icon: PackageOpen,  desc: 'Push to device' },
];

// ── Shared components ──────────────────────────────────────────────
function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>{children}</h2>;
}
function SubText({ children }) {
  return <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>{children}</p>;
}

// ── Step 1: Dataset ────────────────────────────────────────────────
function DatasetPage({ onDatasetSelected }) {
  const [datasets, setDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);       // 0–100 upload %
  const [processProgress, setProcessProgress] = useState(0);     // 0–100 extract %
  const [uploadStep, setUploadStep] = useState('');              // current status text
  const [uploadLog, setUploadLog] = useState([]);                // log lines
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const fileRef = useRef();
  const logRef = useRef();

  const addLog = (msg, type = 'info') => {
    const icon = type === 'ok' ? '✅' : type === 'err' ? '❌' : type === 'step' ? '⏳' : 'ℹ️';
    setUploadLog(prev => [...prev, `${icon} ${msg}`]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [uploadLog]);

  const loadDatasets = async () => {
    try {
      const res = await fetch(`${API}/api/datasets`);
      const d = await res.json();
      setDatasets(d.datasets || []);
    } catch {}
  };

  useEffect(() => { loadDatasets(); }, []);

  const handleUpload = (file) => {
    if (!file || !file.name.endsWith('.zip')) {
      alert('Please select a .zip file from Roboflow');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setProcessProgress(0);
    setUploadLog([]);
    setUploadedBytes(0);
    setTotalBytes(file.size);

    addLog(`ไฟล์: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
    addLog('เชื่อมต่อ backend...', 'step');

    const fd = new FormData();
    fd.append('file', file);

    const xhr = new XMLHttpRequest();

    // Upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
        setUploadedBytes(e.loaded);
        if (pct === 100) {
          setUploadStep('กำลัง extract และอ่าน labels...');
          addLog('อัพโหลดสำเร็จ! กำลัง extract ZIP...', 'ok');
        } else {
          setUploadStep(`กำลังอัพโหลด... ${pct}%`);
        }
      }
    });

    // Simulate extract progress while waiting for server response
    let extractInterval = null;
    xhr.upload.addEventListener('load', () => {
      let p = 0;
      extractInterval = setInterval(() => {
        p = Math.min(p + Math.random() * 8, 92);
        setProcessProgress(Math.round(p));
        if (p > 30 && p < 35) addLog('กำลัง extract ไฟล์รูปภาพ...', 'step');
        if (p > 60 && p < 65) addLog('กำลังอ่าน labels และ class names...', 'step');
        if (p > 80 && p < 85) addLog('กำลังบันทึก dataset info...', 'step');
      }, 300);
    });

    xhr.addEventListener('load', () => {
      clearInterval(extractInterval);
      setProcessProgress(100);
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.status === 'success') {
          addLog(`Dataset "${data.name || file.name}" import สำเร็จ!`, 'ok');
          addLog(`พบ ${data.image_count || '?'} รูป, ${(data.classes || []).length} classes`, 'ok');
          setUploadStep('✅ Import สำเร็จ!');
          setTimeout(() => {
            setUploading(false);
            loadDatasets();
          }, 1200);
        } else {
          addLog('Import ล้มเหลว: ' + (data.detail || xhr.responseText), 'err');
          setUploadStep('❌ Import ล้มเหลว');
          setTimeout(() => setUploading(false), 2000);
        }
      } catch {
        addLog('Server ตอบกลับผิดปกติ: ' + xhr.responseText.slice(0, 100), 'err');
        setUploadStep('❌ เกิดข้อผิดพลาด');
        setTimeout(() => setUploading(false), 2000);
      }
    });

    xhr.addEventListener('error', () => {
      clearInterval(extractInterval);
      addLog('ไม่สามารถเชื่อมต่อ backend ได้ — ตรวจสอบว่าโปรแกรมทำงานอยู่', 'err');
      setUploadStep('❌ Connection error');
      setTimeout(() => setUploading(false), 2000);
    });

    xhr.open('POST', `${API}/api/datasets/import-roboflow`);
    xhr.send(fd);
    setUploadStep('กำลังส่งไฟล์...');
    addLog('เริ่มส่งไฟล์ไปยัง backend...', 'step');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this dataset?')) return;
    await fetch(`${API}/api/datasets/${id}`, { method: 'DELETE' });
    loadDatasets();
  };

  const fmtBytes = (b) => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <SectionTitle>📁 Dataset Manager</SectionTitle>
      <SubText>Import your labeled dataset from Roboflow (YOLOv8 format ZIP export)</SubText>

      {/* Drop Zone / Upload UI */}
      {!uploading ? (
        <div
          className={`drop-zone ${dragging ? 'drag-over' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleUpload(e.dataTransfer.files[0]); }}
          style={{ marginBottom: 32 }}
        >
          <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
          <Upload size={40} color="#6366f1" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#e2e8f0' }}>Drop Roboflow ZIP here or click to browse</div>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Export from Roboflow as <strong style={{ color: '#818cf8' }}>YOLOv8</strong> format → download .zip</div>
        </div>
      ) : (
        /* ── Upload Progress Card ── */
        <div className="card" style={{ marginBottom: 32, border: '1px solid #3730a3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Upload size={18} color="#818cf8" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Importing Dataset</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{uploadStep}</div>
            </div>
          </div>

          {/* Upload progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
              <span>อัพโหลด</span>
              <span>{uploadProgress < 100 ? `${fmtBytes(uploadedBytes)} / ${fmtBytes(totalBytes)}` : 'เสร็จแล้ว'}</span>
            </div>
            <div style={{ height: 6, background: '#1e2130', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                width: `${uploadProgress}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Extract / process progress bar */}
          {uploadProgress === 100 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                <span>ประมวลผล</span>
                <span>{processProgress}%</span>
              </div>
              <div style={{ height: 6, background: '#1e2130', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  width: `${processProgress}%`,
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>
          )}

          {/* Log output */}
          <div ref={logRef} style={{
            background: '#060810', border: '1px solid #1e2130', borderRadius: 8,
            padding: '10px 12px', maxHeight: 140, overflowY: 'auto',
            fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.8
          }}>
            {uploadLog.map((line, i) => (
              <div key={i} style={{
                color: line.startsWith('✅') ? '#10b981'
                     : line.startsWith('❌') ? '#f87171'
                     : line.startsWith('⏳') ? '#818cf8'
                     : '#4b5563'
              }}>{line}</div>
            ))}
            {uploadLog.length === 0 && <div style={{ color: '#374151' }}>รอการเชื่อมต่อ...</div>}
          </div>
        </div>
      )}

      {/* Dataset list */}
      <div style={{ fontWeight: 600, fontSize: 14, color: '#9ca3af', marginBottom: 12 }}>
        IMPORTED DATASETS ({datasets.length})
      </div>
      {datasets.length === 0 ? (
        <div style={{ color: '#4b5563', textAlign: 'center', padding: '32px', border: '1px solid #1e2130', borderRadius: 12 }}>
          No datasets yet — import one above
        </div>
      ) : datasets.map(ds => (
        <div key={ds.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: '#111521', border: '1px solid #1e2130', borderRadius: 12, marginBottom: 10 }}>
          <Database size={20} color="#6366f1" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{ds.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="tag tag-blue">{ds.image_count} images</span>
              {ds.classes?.map(c => <span key={c} className="tag tag-green">{c}</span>)}
              {ds.source && <span className="tag tag-yellow">{ds.source}</span>}
            </div>
          </div>
          <button className="btn-primary no-drag" onClick={() => onDatasetSelected(ds)} style={{ fontSize: 13, padding: '8px 16px' }}>
            Use This <ChevronRight size={14} />
          </button>
          <button className="btn-danger no-drag" onClick={() => handleDelete(ds.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {/* Roboflow instructions */}
      <div className="card" style={{ marginTop: 32, borderColor: '#1e2130' }}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: '#818cf8', fontSize: 14 }}>
          🔗 How to export from Roboflow
        </div>
        <ol style={{ paddingLeft: 20, color: '#9ca3af', fontSize: 13, lineHeight: 2 }}>
          <li>ไปที่โปรเจ็กต์ของคุณใน <strong style={{ color: '#e2e8f0' }}>Roboflow.com</strong></li>
          <li>เลือก <strong style={{ color: '#e2e8f0' }}>Versions → Export Dataset</strong></li>
          <li>เลือก Format: <strong style={{ color: '#6366f1' }}>YOLOv8 (PyTorch)</strong></li>
          <li>คลิก <strong style={{ color: '#e2e8f0' }}>Download zip to computer</strong></li>
          <li>ลาก .zip มาวางในช่องด้านบน</li>
        </ol>
      </div>
    </div>
  );
}


// ── Step 2: Train ──────────────────────────────────────────────────
function TrainPage({ selectedDataset }) {
  const [config, setConfig] = useState({ model_size: 'yolov8s', epochs: 50, imgsz: 640, batch: 16, project_name: 'my_model' });
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting | open | closed | error
  const [debugLog, setDebugLog] = useState([]); // raw debug events
  const wsRef = useRef();
  const logRef = useRef();
  const debugRef = useRef();

  const addDebug = (msg, color = '#6b7280') => {
    const ts = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-100), { ts, msg, color }]);
  };

  useEffect(() => {
    addDebug('TrainPage mounted — connecting WebSocket...', '#818cf8');
    const wsUrl = `ws://localhost:7654/ws/training`;
    addDebug(`WS URL: ${wsUrl}`, '#6b7280');

    let ws;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch (err) {
      addDebug(`❌ WebSocket constructor failed: ${err.message}`, '#f87171');
      setWsStatus('error');
      return;
    }

    ws.onopen = () => {
      setWsStatus('open');
      addDebug('✅ WebSocket connected to /ws/training', '#34d399');
    };
    ws.onerror = (e) => {
      setWsStatus('error');
      addDebug(`❌ WebSocket error — backend may not be running`, '#f87171');
    };
    ws.onclose = (e) => {
      setWsStatus('closed');
      addDebug(`⚠️ WebSocket closed (code=${e.code} reason=${e.reason || 'none'})`, '#fbbf24');
    };
    ws.onmessage = (e) => {
      addDebug(`📨 WS message: ${e.data.slice(0, 120)}`, '#4ade80');
      try {
        const msg = JSON.parse(e.data);
        if (msg.progress !== undefined) setProgress(msg.progress);
        if (msg.type === 'complete') { setRunning(false); setResult(msg); }
        if (msg.type === 'error') { setRunning(false); }
        setLogs(prev => [...prev.slice(-300), { type: msg.type, text: msg.message }]);
      } catch (err) {
        addDebug(`❌ JSON parse error: ${err.message}`, '#f87171');
      }
    };
    return () => { ws.close(); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    if (debugRef.current) debugRef.current.scrollTop = debugRef.current.scrollHeight;
  }, [logs, debugLog]);

  const startTrain = async () => {
    if (!selectedDataset) { alert('Select a dataset first (Step 1)'); return; }
    addDebug('▶️ Start Training clicked', '#818cf8');
    addDebug(`WS status: ${wsRef.current?.readyState} (0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED)`, '#6b7280');

    setLogs([]); setProgress(0); setResult(null); setRunning(true);

    const body = { ...config, dataset_id: selectedDataset.id };
    addDebug(`POST /api/train: ${JSON.stringify(body)}`, '#6b7280');

    try {
      const res = await fetch(`${API}/api/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      addDebug(`✅ POST /api/train → ${res.status}: ${JSON.stringify(data)}`, res.ok ? '#34d399' : '#f87171');
      if (!res.ok) {
        setRunning(false);
        setLogs([{ type: 'error', text: `API error ${res.status}: ${JSON.stringify(data)}` }]);
      }
    } catch (err) {
      addDebug(`❌ fetch /api/train failed: ${err.message}`, '#f87171');
      setRunning(false);
      setLogs([{ type: 'error', text: `Network error: ${err.message}` }]);
    }
  };

  const stopTrain = async () => {
    addDebug('⏹️ Stop Training clicked', '#fbbf24');
    try {
      await fetch(`${API}/api/train/stop`, { method: 'POST' });
      addDebug('✅ Stop request sent', '#34d399');
    } catch (err) {
      addDebug(`❌ Stop failed: ${err.message}`, '#f87171');
    }
    setRunning(false);
  };

  const MODEL_SIZES = [
    { value: 'yolov8n', label: 'Nano (3.2M params) — fastest, less accurate' },
    { value: 'yolov8s', label: 'Small (11.2M params) — recommended for Hailo' },
    { value: 'yolov8m', label: 'Medium (25.9M params) — more accurate, slower' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Config panel */}
      <div style={{ width: 320, flexShrink: 0 }}>
        <SectionTitle>🧠 Train Model</SectionTitle>
        <SubText>Configure and start YOLOv8 training with CUDA acceleration</SubText>

        {selectedDataset ? (
          <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, marginBottom: 20, fontSize: 13, color: '#818cf8' }}>
            📁 Dataset: <strong>{selectedDataset.name}</strong>
            <div style={{ color: '#6b7280', marginTop: 4 }}>
              {selectedDataset.image_count} images · {selectedDataset.classes?.join(', ')}
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 20, fontSize: 13, color: '#ef4444' }}>
            ⚠️ No dataset selected — go to Step 1 first
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">Model Size</label>
            <select className="input-field" value={config.model_size} onChange={e => setConfig(c => ({ ...c, model_size: e.target.value }))}>
              {MODEL_SIZES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="input-label">Epochs</label>
              <input className="input-field" type="number" min={10} max={500} value={config.epochs} onChange={e => setConfig(c => ({ ...c, epochs: +e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Batch Size</label>
              <input className="input-field" type="number" min={4} max={64} value={config.batch} onChange={e => setConfig(c => ({ ...c, batch: +e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Image Size</label>
              <select className="input-field" value={config.imgsz} onChange={e => setConfig(c => ({ ...c, imgsz: +e.target.value }))}>
                <option value={416}>416</option>
                <option value={640}>640 (recommended)</option>
                <option value={800}>800</option>
              </select>
            </div>
            <div>
              <label className="input-label">Project Name</label>
              <input className="input-field" value={config.project_name} onChange={e => setConfig(c => ({ ...c, project_name: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Progress */}
        {(running || progress > 0) && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#9ca3af' }}>
              <span>Training Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {!running ? (
            <button className="btn-primary no-drag" onClick={startTrain} disabled={!selectedDataset} style={{ flex: 1, justifyContent: 'center' }}>
              <Play size={16} /> Start Training
            </button>
          ) : (
            <button className="btn-danger no-drag" onClick={stopTrain} style={{ flex: 1, padding: '10px', borderRadius: 10 }}>
              <Square size={16} style={{ marginRight: 8 }} /> Stop
            </button>
          )}
        </div>

        {result && (
          <div style={{ marginTop: 16, padding: 14, background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 10 }}>
            <div style={{ color: '#10b981', fontWeight: 600, marginBottom: 4 }}>✅ Training Complete!</div>
            <div style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all' }}>{result.pt_path}</div>
          </div>
        )}
      </div>

      {/* Log panel */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#6b7280' }}>TRAINING LOG</div>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 20, fontFamily: 'JetBrains Mono',
            background: wsStatus === 'open' ? 'rgba(5,150,105,0.15)' : wsStatus === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)',
            color: wsStatus === 'open' ? '#10b981' : wsStatus === 'error' ? '#f87171' : '#9ca3af',
            border: `1px solid ${wsStatus === 'open' ? '#166534' : wsStatus === 'error' ? '#7f1d1d' : '#374151'}`
          }}>
            WS: {wsStatus}
          </span>
        </div>
        <div ref={logRef} style={{
          background: '#060810', border: '1px solid #1e2130', borderRadius: 12,
          height: 340, overflowY: 'auto', padding: 16, fontFamily: 'JetBrains Mono, monospace', fontSize: 12
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#374151', textAlign: 'center', marginTop: 60 }}>Logs will appear here when training starts...</div>
          ) : logs.map((l, i) => (
            <div key={i} style={{
              color: l.type === 'error' ? '#f87171' : l.type === 'complete' ? '#34d399' : l.type === 'status' ? '#818cf8' : '#9ca3af',
              lineHeight: 1.6, paddingBottom: 2
            }}>
              {l.text}
            </div>
          ))}
        </div>

        {/* Debug panel */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: '#4b5563', marginBottom: 6 }}>🔧 DEBUG LOG</div>
          <div ref={debugRef} style={{
            background: '#080a0f', border: '1px solid #1a2030', borderRadius: 8,
            height: 130, overflowY: 'auto', padding: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 11
          }}>
            {debugLog.map((d, i) => (
              <div key={i} style={{ color: d.color, lineHeight: 1.5 }}>
                <span style={{ color: '#374151', marginRight: 6 }}>[{d.ts}]</span>{d.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Export ONNX ────────────────────────────────────────────
function ExportPage({ onExported }) {
  const [models, setModels] = useState([]);
  const [exporting, setExporting] = useState(null);
  const [results, setResults] = useState({});

  useEffect(() => {
    fetch(`${API}/api/models`).then(r => r.json()).then(d => setModels(d.models || []));
  }, []);

  const handleExport = async (model) => {
    setExporting(model.name);
    const res = await fetch(`${API}/api/export/onnx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pt_path: model.pt_path, imgsz: 640 })
    });
    const data = await res.json();
    setExporting(null);
    if (data.status === 'success') {
      setResults(r => ({ ...r, [model.name]: data.onnx_path }));
      onExported(data.onnx_path);
    } else {
      alert('Export failed: ' + data.message);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 700 }}>
      <SectionTitle>📄 Export to ONNX</SectionTitle>
      <SubText>Convert your trained .pt model to ONNX format for Hailo compilation</SubText>

      {models.length === 0 ? (
        <div style={{ color: '#4b5563', textAlign: 'center', padding: 32, border: '1px solid #1e2130', borderRadius: 12 }}>
          No trained models found — complete training first (Step 2)
        </div>
      ) : models.map(m => (
        <div key={m.name} style={{ padding: 16, background: '#111521', border: '1px solid #1e2130', borderRadius: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
          <FileCode size={24} color={m.has_onnx || results[m.name] ? '#10b981' : '#6366f1'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {m.has_pt && <span className="tag tag-blue">.pt ready</span>}
              {(m.has_onnx || results[m.name]) && <span className="tag tag-green">.onnx ready</span>}
            </div>
          </div>
          {m.has_pt && !m.has_onnx && !results[m.name] && (
            <button className="btn-primary no-drag" onClick={() => handleExport(m)} disabled={exporting === m.name}>
              {exporting === m.name ? (
                <><RefreshCw size={14} className="animate-spin" /> Exporting...</>
              ) : (
                <><Zap size={14} /> Export ONNX</>
              )}
            </button>
          )}
          {(m.has_onnx || results[m.name]) && (
            <button className="btn-secondary no-drag" onClick={() => onExported(results[m.name] || m.onnx_path)}>
              Use This →
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 4: Compile ────────────────────────────────────────────────
function CompilePage({ onnxPath, onCompiled }) {
  const [deviceIp, setDeviceIp] = useState('10.10.10.57');
  const [modelName, setModelName] = useState('my_detector');
  const [task, setTask] = useState('detection');
  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState(null);

  const handleCompile = async () => {
    if (!onnxPath) { alert('No ONNX model selected — complete Step 3 first'); return; }
    setCompiling(true); setResult(null);
    try {
      const res = await fetch(`${API}/api/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onnx_path: onnxPath, device_ip: deviceIp, model_name: modelName, task })
      });
      const data = await res.json();
      setResult(data);
      if (data.status === 'success') onCompiled(data);
    } catch (e) {
      setResult({ status: 'error', message: e.message });
    }
    setCompiling(false);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 600 }}>
      <SectionTitle>⚙️ Compile to .hef</SectionTitle>
      <SubText>Send your ONNX model to the IRIV device for Hailo compilation. The device has Hailo SDK pre-installed.</SubText>

      {onnxPath ? (
        <div style={{ padding: '10px 14px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 10, marginBottom: 24, fontSize: 13, color: '#10b981' }}>
          ✅ ONNX: {onnxPath.split('\\').pop().split('/').pop()}
        </div>
      ) : (
        <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 10, marginBottom: 24, fontSize: 13, color: '#eab308' }}>
          ⚠️ No ONNX model selected — complete Step 3 first
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label">IRIV Device IP Address</label>
          <input className="input-field" value={deviceIp} onChange={e => setDeviceIp(e.target.value)} placeholder="e.g. 192.168.1.100" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="input-label">Model Name (in system)</label>
            <input className="input-field" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="e.g. expiry_detector" />
          </div>
          <div>
            <label className="input-label">Task Type</label>
            <select className="input-field" value={task} onChange={e => setTask(e.target.value)}>
              <option value="detection">Object Detection</option>
              <option value="classification">Classification</option>
              <option value="pose">Pose Estimation</option>
            </select>
          </div>
        </div>

        <button className="btn-primary no-drag" onClick={handleCompile} disabled={compiling || !onnxPath} style={{ justifyContent: 'center' }}>
          {compiling ? (
            <><RefreshCw size={16} className="animate-spin" /> Compiling on device... (may take 3-5 min)</>
          ) : (
            <><Cpu size={16} /> Compile on IRIV Device</>
          )}
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 20, padding: 16, borderRadius: 12,
          background: result.status === 'success' ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${result.status === 'success' ? 'rgba(5,150,105,0.3)' : 'rgba(239,68,68,0.3)'}`
        }}>
          <div style={{ fontWeight: 600, color: result.status === 'success' ? '#10b981' : '#ef4444', marginBottom: 6 }}>
            {result.status === 'success' ? '✅ Compilation successful!' : '❌ Compilation failed'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{result.message}</div>
        </div>
      )}

      <div className="card" style={{ marginTop: 24, borderColor: '#1e2130' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#818cf8', marginBottom: 10 }}>ℹ️ How it works</div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8 }}>
          เมื่อกด Compile บน PC → ไฟล์ .onnx จะถูกส่งไปยัง IRIV Device ผ่าน Network → Device จะใช้ Hailo Dataflow Compiler รัน Quantization และ Compile เป็น .hef → ไฟล์ .hef จะถูกลงทะเบียนอัตโนมัติใน IRIV Vision Studio พร้อมใช้งานทันที
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Deploy ─────────────────────────────────────────────────
function DeployPage({ compileResult, deviceIp }) {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 600 }}>
      <SectionTitle>🚀 Deploy & Done!</SectionTitle>
      <SubText>Your model is compiled and registered on the IRIV device automatically.</SubText>

      {compileResult?.status === 'success' ? (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 20px' }} />
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Model Ready! 🎉</div>
          <div style={{ color: '#6b7280', marginBottom: 32 }}>
            โมเดลของคุณถูก Compile และลงทะเบียนบน IRIV Vision Studio เรียบร้อยแล้ว
          </div>

          <div className="card" style={{ textAlign: 'left', marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: '#818cf8' }}>ขั้นตอนต่อไป</div>
            <ol style={{ paddingLeft: 20, color: '#9ca3af', fontSize: 14, lineHeight: 2.2 }}>
              <li>เปิด <strong style={{ color: '#e2e8f0' }}>IRIV Vision Studio</strong> บน Device (<code style={{ color: '#818cf8' }}>{deviceIp}:5173</code>)</li>
              <li>ไปที่ <strong style={{ color: '#e2e8f0' }}>Settings → Models</strong> จะเห็นโมเดลใหม่ปรากฏขึ้น</li>
              <li>สร้าง Pipeline: <strong style={{ color: '#e2e8f0' }}>Input → AI Node → Logic Node → Output</strong></li>
              <li>ใน AI Node เลือกโมเดลที่เพิ่งสร้าง แล้วกด Deploy!</li>
            </ol>
          </div>
        </div>
      ) : (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 48 }}>
          <PackageOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          Complete Step 4 (Compile) first
        </div>
      )}
    </div>
  );
}

// ── Setup Wizard ───────────────────────────────────────────────────
const INSTALL_STEPS = [
  { id: 'python',  label: 'Python 3.10+',              desc: 'Runtime environment' },
  { id: 'venv',   label: 'Virtual Environment',        desc: 'Isolated package space' },
  { id: 'fastapi',label: 'FastAPI & Web Server',       desc: 'Backend API' },
  { id: 'yolo',   label: 'Ultralytics YOLOv8',        desc: 'AI training framework' },
  { id: 'torch',  label: 'PyTorch + CUDA',             desc: 'GPU acceleration' },
  { id: 'onnx',   label: 'ONNX Tools',                 desc: 'Model export' },
];

function SetupWizard({ onComplete }) {
  const [phase, setPhase] = useState('check');
  const [pythonInfo, setPythonInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [logCopied, setLogCopied] = useState(false);
  const logRef = useRef();
  const isElectron = !!window.electronAPI;

  // Helper: add a timestamped log line
  const addLog = (line) => {
    if (!line || !line.trim()) return;
    const ts = new Date().toLocaleTimeString('th-TH', { hour12: false });
    setLogs(prev => [...prev.slice(-300), `[${ts}] ${line.trim()}`]);
  };

  const copyLog = () => {
    navigator.clipboard.writeText(logs.join('\n')).then(() => {
      setLogCopied(true);
      setTimeout(() => setLogCopied(false), 2000);
    });
  };

  // Classify log line for color
  const logColor = (line) => {
    const l = line.toLowerCase();
    if (l.includes('[ok]') || l.includes('success') || l.includes('✅') || l.includes('installed')) return '#10b981';
    if (l.includes('error') || l.includes('failed') || l.includes('❌') || l.includes('fatal')) return '#f87171';
    if (l.includes('warn') || l.includes('warning') || l.includes('⚠')) return '#fbbf24';
    if (l.includes('[setup]') || l.includes('⏳') || l.includes('downloading') || l.includes('installing')) return '#818cf8';
    return '#4b5563';
  };

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.checkPython().then(info => {
        setPythonInfo(info);
        if (info.found) {
          setPhase('ready');
        } else {
          // Auto-trigger Python install immediately — no user action needed
          setPhase('installing-python');
          setLogs(['Python not found. Starting automatic installation...']);
          window.electronAPI.installPython();
        }
      });

      // Listen to Python install logs
      window.electronAPI.onPythonInstallLog((line) => {
        if (line === '__PYTHON_INSTALLED__') {
          addLog('✅ Python installed successfully!');
          addLog('Verifying installation...');
          setTimeout(() => {
            window.electronAPI.checkPython().then(info => {
              if (info.found) {
                setPythonInfo(info);
                setPhase('ready');
                setLogs([]);
              } else {
                setPhase('python-failed');
              }
            });
          }, 1500);
          return;
        }
        if (line.startsWith('__PYTHON_FAILED__')) {
          setPhase('python-failed');
          return;
        }
        addLog(line);
      });

      // Listen to dependency install logs
      window.electronAPI.onSetupLog((line) => {
        if (line === '__SETUP_COMPLETE__') {
          setPhase('done');
          setProgress(100);
          return;
        }
        if (line.startsWith('__SETUP_FAILED__')) {
          setPhase('error');
          return;
        }
        if (line.includes('[OK] FastAPI'))     { setProgress(30); setCurrentStep('fastapi'); }
        if (line.includes('[OK] Ultralytics')) { setProgress(55); setCurrentStep('yolo'); }
        if (line.includes('[OK] PyTorch'))     { setProgress(80); setCurrentStep('torch'); }
        if (line.includes('[OK] ONNX'))        { setProgress(95); setCurrentStep('onnx'); }
        addLog(line);
      });
    } else {
      setPhase('done');
    }
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const startInstall = async () => {
    setPhase('installing');
    setProgress(10);
    setCurrentStep('venv');
    setLogs([]);
    addLog('Starting dependency installation...');
    await window.electronAPI.runSetup();
  };

  if (phase === 'done') {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, #0d1424 0%, #0a0c12 100%)'
      }}>
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #059669, #10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 0 60px rgba(16,185,129,0.4)'
          }}>
            <CheckCircle2 size={40} color="white" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Ready to Go! 🎉</div>
          <div style={{ color: '#6b7280', marginBottom: 32 }}>All dependencies installed successfully</div>
          <button className="btn-primary" onClick={onComplete} style={{ fontSize: 16, padding: '14px 40px', borderRadius: 14 }}>
            Launch IRIV Model Studio →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Titlebar */}
      <div className="titlebar" style={{
        height: 44, background: '#060810', borderBottom: '1px solid #1e2130',
        display: 'flex', alignItems: 'center', paddingLeft: 80, paddingRight: 16, flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BrainCircuit size={14} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>IRIV Model Studio</span>
          <span style={{ color: '#374151', fontSize: 13 }}>— First Time Setup</span>
        </div>
        <div className="no-drag" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {['−','□','✕'].map((sym, i) => (
            <button key={i} onClick={() => [window.electronAPI?.minimize(), window.electronAPI?.maximize(), window.electronAPI?.close()][i]}
              style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', width: 28, height: 28, borderRadius: 6, fontSize: 14, display:'flex',alignItems:'center',justifyContent:'center' }}
              onMouseEnter={e => e.target.style.background='#1e2130'} onMouseLeave={e => e.target.style.background='none'}>
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 32 }}>
        <div style={{ maxWidth: 620, width: '100%' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', boxShadow: '0 8px 40px rgba(99,102,241,0.4)'
            }}>
              <Download size={32} color="white" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Welcome to IRIV Model Studio</div>
            <div style={{ color: '#6b7280', fontSize: 14 }}>We need to install a few things before you can start training models.</div>
          </div>

          {/* Auto-installing Python */}
          {phase === 'installing-python' && (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
              }}>
                <RefreshCw size={24} color="#818cf8" className="animate-spin" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Installing Python 3.12</div>
              <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
                กำลังติดตั้ง Python อัตโนมัติ — ไม่ต้องทำอะไรเพิ่มเติม
              </div>
              <div style={{
                background: '#060810', border: '1px solid #1e2130', borderRadius: 10,
                padding: 12, maxHeight: 160, overflowY: 'auto', textAlign: 'left',
                fontFamily: 'JetBrains Mono', fontSize: 11
              }} ref={logRef}>
                {logs.map((l, i) => (
                  <div key={i} style={{ lineHeight: 1.7, color: l.includes('✅') ? '#10b981' : '#4b5563' }}>{l}</div>
                ))}
              </div>
            </div>
          )}

          {/* Python install failed — fallback */}
          {phase === 'python-failed' && (
            <div className="card" style={{ borderColor: '#f59e0b', background: 'rgba(245,158,11,0.05)', textAlign: 'center', padding: 32 }}>
              <AlertTriangle size={36} color="#f59e0b" style={{ margin: '0 auto 14px' }} />
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: '#fbbf24' }}>Auto-install Failed</div>
              <div style={{ color: '#9ca3af', marginBottom: 20, fontSize: 13 }}>
                ไม่สามารถติดตั้ง Python อัตโนมัติได้<br />
                กรุณาดาวน์โหลดและติดตั้งเอง แล้วกด "Check Again"
              </div>
              <div style={{ background: '#0a0c12', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#f59e0b', textAlign: 'left' }}>
                ⚠️ ขณะติดตั้ง ให้เลือก <strong style={{ color: '#fbbf24' }}>"Add Python to PATH"</strong>
              </div>
              <button className="btn-primary" onClick={() => window.electronAPI?.openExternal('https://www.python.org/downloads/')} style={{ justifyContent: 'center', width: '100%', padding: '13px', marginBottom: 10 }}>
                <ExternalLink size={15} /> Download Python 3.12 (Official)
              </button>
              <button className="btn-secondary" onClick={() => window.location.reload()} style={{ justifyContent: 'center', width: '100%' }}>
                <RefreshCw size={14} /> ติดตั้งแล้ว — Check Again
              </button>
            </div>
          )}

          {/* Ready to install */}
          {phase === 'ready' && (
            <div>
              <div className="card" style={{ marginBottom: 20, background: 'rgba(5,150,105,0.05)', borderColor: 'rgba(5,150,105,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Python detected: {pythonInfo?.version}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Ready to install dependencies</div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>WILL INSTALL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {INSTALL_STEPS.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#374151' }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{s.label}</span>
                        <span style={{ color: '#4b5563', fontSize: 12, marginLeft: 8 }}>{s.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#0a0c12', borderRadius: 10, fontSize: 12, color: '#6b7280' }}>
                  ⏱️ Estimated time: <strong style={{ color: '#9ca3af' }}>5–15 minutes</strong> (depends on internet speed)
                </div>
              </div>

              <button className="btn-primary" onClick={startInstall} style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 16, borderRadius: 14 }}>
                <Download size={18} /> Install Now — One Click Setup
              </button>
            </div>
          )}

          {/* Installing */}
          {phase === 'installing' && (
            <div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#9ca3af' }}>
                  <span className="animate-pulse">Installing dependencies...</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                  {INSTALL_STEPS.map(s => {
                    const idx = INSTALL_STEPS.findIndex(x => x.id === s.id);
                    const curIdx = INSTALL_STEPS.findIndex(x => x.id === currentStep);
                    const isDone = idx < curIdx;
                    const isCur = s.id === currentStep;
                    return (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                        color: isDone ? '#10b981' : isCur ? '#818cf8' : '#374151'
                      }}>
                        {isDone ? <CheckCircle2 size={12} /> : isCur ? <RefreshCw size={12} className="animate-spin" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid #374151' }} />}
                        {s.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Log window with debug output */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6
                }}>
                  <span style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono' }}>
                    DEBUG LOG ({logs.length} lines)
                  </span>
                  <button
                    onClick={copyLog}
                    style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 6,
                      border: '1px solid #1e2130', background: logCopied ? '#10b981' : 'transparent',
                      color: logCopied ? 'white' : '#6b7280', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {logCopied ? '✅ Copied!' : '📋 Copy Log'}
                  </button>
                </div>
                <div ref={logRef} style={{
                  background: '#020408', border: '1px solid #1e2130', borderRadius: 10,
                  height: 260, overflowY: 'auto', padding: '10px 14px',
                  fontFamily: 'JetBrains Mono', fontSize: 11,
                  scrollBehavior: 'smooth'
                }}>
                  {logs.length === 0 ? (
                    <div style={{ color: '#1f2937' }}>Waiting for output...</div>
                  ) : logs.map((l, i) => {
                    const ts = l.match(/^\[\d+:\d+:\d+\]/)?.[0] || '';
                    const msg = ts ? l.slice(ts.length + 1) : l;
                    return (
                      <div key={i} style={{ lineHeight: 1.8, display: 'flex', gap: 8 }}>
                        <span style={{ color: '#1f2937', flexShrink: 0, userSelect: 'none' }}>{ts}</span>
                        <span style={{ color: logColor(l), wordBreak: 'break-all' }}>{msg}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="card" style={{ borderColor: '#ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <AlertTriangle size={28} color="#ef4444" />
                <div>
                  <div style={{ fontWeight: 700, color: '#f87171', fontSize: 16 }}>Installation Failed</div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>ดู log ด้านล่างเพื่อหาสาเหตุ</div>
                </div>
              </div>

              {/* Show actual logs so user can diagnose */}
              {logs.length > 0 && (
                <div style={{
                  background: '#060810', border: '1px solid #1e2130', borderRadius: 10,
                  padding: 12, maxHeight: 200, overflowY: 'auto', marginBottom: 16,
                  fontFamily: 'JetBrains Mono', fontSize: 11
                }}>
                  {logs.slice(-50).map((l, i) => (
                    <div key={i} style={{
                      lineHeight: 1.7,
                      color: l.includes('[OK]') ? '#10b981'
                           : l.includes('error') || l.includes('Error') || l.includes('FAILED') ? '#f87171'
                           : '#4b5563'
                    }}>{l}</div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" onClick={() => { setPhase('ready'); setLogs([]); setProgress(0); }} style={{ flex: 1, justifyContent: 'center' }}>
                  <RefreshCw size={14} /> Try Again
                </button>
                <button className="btn-secondary" onClick={() => window.electronAPI?.openExternal('https://github.com/CytronTH/iriv-vision-studio/issues')} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
                  <ExternalLink size={12} /> Report Issue
                </button>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}

// ── Update Notification Banner ─────────────────────────────────────
function UpdateNotification({ status, onInstall, onDismiss }) {
  if (!status || ['not-available', 'checking', 'error'].includes(status.type)) return null;
  const fmtBytes = (b) => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#111521', border: '1px solid #3730a3',
      borderRadius: 14, padding: '16px 20px', maxWidth: 360,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeIn 0.3s ease'
    }}>
      {status.type === 'available' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>🆕 มีอัพเดทใหม่ v{status.version}</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>กำลังดาวน์โหลดในพื้นหลัง...</div>
          </div>
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>
      )}
      {status.type === 'downloading' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>⬇️ ดาวน์โหลดอัพเดท</span>
            <span style={{ color: '#6b7280' }}>{status.percent}%</span>
          </div>
          <div style={{ height: 4, background: '#1e2130', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', width: `${status.percent}%`, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: '#4b5563' }}>{fmtBytes(status.transferred)} / {fmtBytes(status.total)} • {(status.bytesPerSecond / 1024).toFixed(0)} KB/s</div>
        </div>
      )}
      {status.type === 'downloaded' && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>✅ อัพเดท v{status.version} พร้อมแล้ว</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>ติดตั้งและรีสตาร์ทเพื่ออัพเดทได้เลย</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onInstall} style={{ flex: 2, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 600, fontSize: 13 }}>🔄 Restart & Update</button>
            <button onClick={onDismiss} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #1e2130', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>ทีหลัง</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const needsSetup = new URLSearchParams(window.location.search).get('setup') === '1';
  const [setupDone, setSetupDone] = useState(!needsSetup);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    window.electronAPI.onUpdateStatus((status) => {
      setUpdateStatus(status);
      if (['available', 'downloading', 'downloaded'].includes(status.type)) setUpdateDismissed(false);
    });
  }, []);

  const [page, setPage] = useState('dataset');
  const [sysInfo, setSysInfo] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [onnxPath, setOnnxPath] = useState(null);
  const [compileResult, setCompileResult] = useState(null);
  const [deviceIp, setDeviceIp] = useState('10.10.10.57');
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [backendError, setBackendError] = useState(null);

  // Poll /api/system every 3s until connected
  useEffect(() => {
    if (!setupDone) return;
    const poll = () => {
      fetch(`${API}/api/system`).then(r => r.json()).then(info => {
        setSysInfo(info);
        setBackendError(null);
      }).catch(() => {});
    };
    poll();
    const t = setInterval(() => { if (!sysInfo) poll(); }, 3000);
    return () => clearInterval(t);
  }, [setupDone, sysInfo]);

  // Listen for backend crash events
  useEffect(() => {
    if (!window.electronAPI?.onBackendError) return;
    window.electronAPI.onBackendError((msg) => setBackendError(msg));
  }, []);

  const openDebug = async () => {
    if (window.electronAPI?.getDebugInfo) {
      const info = await window.electronAPI.getDebugInfo();
      setDebugInfo(info);
    }
    setShowDebug(true);
  };

  if (!setupDone) {
    return <SetupWizard onComplete={() => setSetupDone(true)} />;
  }

  const handleDatasetSelected = (ds) => {
    setSelectedDataset(ds);
    setPage('train');
  };

  const completedSteps = {
    dataset: !!selectedDataset,
    train: false,
    export: !!onnxPath,
    compile: compileResult?.status === 'success',
    deploy: false
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Update notification floating banner */}
      {!updateDismissed && (
        <UpdateNotification
          status={updateStatus}
          onInstall={() => window.electronAPI?.installUpdate()}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}
      {/* Debug Modal */}
      {showDebug && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowDebug(false)}>
          <div style={{
            background: '#0d1117', border: '1px solid #1e2130', borderRadius: 16,
            padding: 24, maxWidth: 680, width: '90%', maxHeight: '80vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🔍 Debug Info</div>
            {backendError && (
              <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#f87171', fontFamily: 'JetBrains Mono' }}>
                ⚠️ Backend Error: {backendError}
              </div>
            )}
            {/* PyTorch / CUDA info from backend */}
            {sysInfo && (
              <div style={{ background: sysInfo.cuda ? '#0a1a0f' : '#1a0f0a', border: `1px solid ${sysInfo.cuda ? '#166534' : '#7c2d12'}`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: sysInfo.cuda ? '#10b981' : '#f87171' }}>
                  {sysInfo.cuda ? '⚡ CUDA OK' : '⚠️ CUDA Not Available'}
                </div>
                {[
                  ['torch_version', sysInfo.torch_version],
                  ['cuda_build', sysInfo.cuda_build],
                  ['gpu', sysInfo.gpu],
                  ['device_count', sysInfo.device_count],
                  ['cuda_reason', sysInfo.cuda_reason],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <span style={{ color: '#6b7280', minWidth: 110 }}>{k}:</span>
                    <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {debugInfo ? (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                {Object.entries(debugInfo).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #1e2130' }}>
                    <td style={{ padding: '6px 8px', color: '#6b7280', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono' }}>{k}</td>
                    <td style={{ padding: '6px 8px', color: typeof v === 'boolean' ? (v ? '#10b981' : '#f87171') : '#e2e8f0', wordBreak: 'break-all', fontFamily: 'JetBrains Mono' }}>
                      {typeof v === 'boolean' ? (v ? '✅ YES' : '❌ NO') : String(v)}
                    </td>
                  </tr>
                ))}
              </table>
            ) : <div style={{ color: '#4b5563' }}>ข้อมูล debug ไม่พร้อมใช้งาน (รันบน browser)</div>}
            <div style={{ marginTop: 16, fontSize: 11, color: '#374151' }}>
              💡 กด <strong>F12</strong> เพื่อเปิด DevTools แล้วดู Console tab สำหรับ log เพิ่มเติม
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#374151' }}>
              📄 Log file: <code style={{ color: '#818cf8' }}>{debugInfo?.logFile || 'N/A'}</code>
            </div>
            {window.electronAPI?.resetAndReinstall && (
              <button
                onClick={async () => {
                  if (confirm('จะลบ venv เก่าและติดตั้ง dependencies ใหม่ทั้งหมด ใช้เวลา ~5 นาที ดำเนินการต่อ?')) {
                    await window.electronAPI.resetAndReinstall();
                  }
                }}
                style={{
                  marginTop: 12, width: '100%', padding: '10px', borderRadius: 8,
                  border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.1)',
                  color: '#fbbf24', cursor: 'pointer', fontWeight: 600, fontSize: 13
                }}
              >
                🔄 Reinstall Dependencies (fix CPU only / CUDA issues)
              </button>
            )}
            <button onClick={() => setShowDebug(false)} style={{
              marginTop: 16, width: '100%', padding: '8px', borderRadius: 8,
              border: '1px solid #1e2130', background: 'transparent', color: '#6b7280', cursor: 'pointer'
            }}>Close</button>
          </div>
        </div>
      )}
      {/* Titlebar */}
      <div className="titlebar" style={{
        height: 44, background: '#060810', borderBottom: '1px solid #1e2130',
        display: 'flex', alignItems: 'center', paddingLeft: 80, paddingRight: 16,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BrainCircuit size={14} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>IRIV Model Studio</span>
        </div>

        <div className="no-drag" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {sysInfo ? (
            <div style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'center' }}>
              <span
                className={`tag ${sysInfo.cuda ? 'tag-green' : 'tag-yellow'}`}
                title={sysInfo.cuda
                  ? `Torch: ${sysInfo.torch_version} | CUDA build: ${sysInfo.cuda_build}`
                  : `${sysInfo.cuda_reason || 'CUDA not available'} | Torch: ${sysInfo.torch_version}`
                }
                onClick={!sysInfo.cuda ? openDebug : undefined}
                style={!sysInfo.cuda ? { cursor: 'pointer' } : {}}
              >
                {sysInfo.cuda ? `⚡ ${sysInfo.gpu}` : '⚠️ CPU only (คลิกดูสาเหตุ)'}
              </span>
            </div>
          ) : (
            <span
              style={{ color: backendError ? '#f87171' : '#4b5563', fontSize: 12, cursor: 'pointer' }}
              onClick={openDebug}
              title="คลิกเพื่อดู debug info"
            >
              {backendError ? '❌ Backend Error' : '⏳ Connecting to backend...'}
            </span>
          )}
          {/* Debug button */}
          <button
            onClick={openDebug}
            title="Debug Info (F12 for DevTools)"
            style={{
              background: 'none', border: '1px solid #1e2130', color: '#374151',
              cursor: 'pointer', width: 28, height: 28, borderRadius: 6,
              fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2130'}
          >🔍</button>
          {/* Window buttons (for frameless on Windows) */}
          {window.electronAPI && ['−','□','✕'].map((sym, i) => (
            <button key={i} onClick={() => [window.electronAPI?.minimize(), window.electronAPI?.maximize(), window.electronAPI?.close()][i]}
              style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', width: 28, height: 28, borderRadius: 6, fontSize: 14, display:'flex',alignItems:'center',justifyContent:'center' }}
              onMouseEnter={e => e.target.style.background='#1e2130'} onMouseLeave={e => e.target.style.background='none'}>
              {sym}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: '#060810', borderRight: '1px solid #1e2130', padding: '20px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', letterSpacing: '0.1em', marginBottom: 12, paddingLeft: 16 }}>
            WORKFLOW
          </div>
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = completedSteps[step.id];
            return (
              <div key={step.id} style={{ marginBottom: 2 }}>
                <div
                  className={`sidebar-item ${page === step.id ? 'active' : ''} no-drag`}
                  onClick={() => setPage(step.id)}
                >
                  <div className={`step-badge ${page === step.id ? 'active' : isDone ? 'done' : 'inactive'}`}>
                    {isDone ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{step.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1 }}>{step.desc}</div>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 1, height: 8, background: '#1e2130', margin: '2px 0 2px 27px' }} />
                )}
              </div>
            );
          })}

          {/* Device IP quick set */}
          <div style={{ marginTop: 32, paddingLeft: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', letterSpacing: '0.1em', marginBottom: 10 }}>
              <Wifi size={12} style={{ display: 'inline', marginRight: 6 }} />DEVICE IP
            </div>
            <input
              className="input-field no-drag"
              value={deviceIp}
              onChange={e => setDeviceIp(e.target.value)}
              placeholder="192.168.x.x"
              style={{ fontSize: 12, padding: '7px 10px' }}
            />
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          {page === 'dataset' && <DatasetPage onDatasetSelected={handleDatasetSelected} />}
          {page === 'train' && <TrainPage selectedDataset={selectedDataset} />}
          {page === 'export' && <ExportPage onExported={(p) => { setOnnxPath(p); setPage('compile'); }} />}
          {page === 'compile' && <CompilePage onnxPath={onnxPath} onCompiled={(r) => { setCompileResult(r); setPage('deploy'); }} />}
          {page === 'deploy' && <DeployPage compileResult={compileResult} deviceIp={deviceIp} />}
        </div>
      </div>
    </div>
  );
}
