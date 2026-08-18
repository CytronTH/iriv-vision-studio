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
  const fileRef = useRef();

  const loadDatasets = async () => {
    const res = await fetch(`${API}/api/datasets`);
    const d = await res.json();
    setDatasets(d.datasets || []);
  };

  useEffect(() => { loadDatasets(); }, []);

  const handleUpload = async (file) => {
    if (!file || !file.name.endsWith('.zip')) { alert('Please select a .zip file from Roboflow'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/api/datasets/import-roboflow`, { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.status === 'success') { loadDatasets(); }
    else { alert('Import failed: ' + data.detail); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this dataset?')) return;
    await fetch(`${API}/api/datasets/${id}`, { method: 'DELETE' });
    loadDatasets();
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <SectionTitle>📁 Dataset Manager</SectionTitle>
      <SubText>Import your labeled dataset from Roboflow (YOLOv8 format ZIP export)</SubText>

      {/* Drop Zone */}
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
        {uploading ? (
          <div>
            <div style={{ color: '#818cf8', fontWeight: 600, marginBottom: 4 }}>Importing dataset...</div>
            <div className="animate-pulse" style={{ color: '#6b7280', fontSize: 13 }}>Extracting ZIP and reading labels</div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#e2e8f0' }}>Drop Roboflow ZIP here or click to browse</div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Export from Roboflow as <strong style={{ color: '#818cf8' }}>YOLOv8</strong> format → download .zip</div>
          </div>
        )}
      </div>

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
  const wsRef = useRef();
  const logRef = useRef();

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:7654/ws/training`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.progress !== undefined) setProgress(msg.progress);
      if (msg.type === 'complete') { setRunning(false); setResult(msg); }
      if (msg.type === 'error') { setRunning(false); }
      setLogs(prev => [...prev.slice(-300), { type: msg.type, text: msg.message }]);
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const startTrain = async () => {
    if (!selectedDataset) { alert('Select a dataset first (Step 1)'); return; }
    setLogs([]); setProgress(0); setResult(null); setRunning(true);
    await fetch(`${API}/api/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, dataset_id: selectedDataset.id })
    });
  };

  const stopTrain = async () => {
    await fetch(`${API}/api/train/stop`, { method: 'POST' });
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
        <div style={{ fontWeight: 600, fontSize: 13, color: '#6b7280', marginBottom: 12, marginTop: 4 }}>TRAINING LOG</div>
        <div ref={logRef} style={{
          background: '#060810', border: '1px solid #1e2130', borderRadius: 12,
          height: 500, overflowY: 'auto', padding: 16, fontFamily: 'JetBrains Mono, monospace', fontSize: 12
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#374151', textAlign: 'center', marginTop: 80 }}>Logs will appear here when training starts...</div>
          ) : logs.map((l, i) => (
            <div key={i} style={{
              color: l.type === 'error' ? '#f87171' : l.type === 'complete' ? '#34d399' : l.type === 'status' ? '#818cf8' : '#9ca3af',
              lineHeight: 1.6, paddingBottom: 2
            }}>
              {l.text}
            </div>
          ))}
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
  const [phase, setPhase] = useState('check'); // check | ready | installing | done | error | nopython
  const [pythonInfo, setPythonInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const logRef = useRef();
  const isElectron = !!window.electronAPI;

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
          setLogs(prev => [...prev, '✅ Python installed successfully!', 'Verifying installation...']);
          // Re-check Python after install
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
        setLogs(prev => [...prev.slice(-100), line.trim()]);
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
        if (line.includes('[OK] FastAPI')) { setProgress(30); setCurrentStep('fastapi'); }
        if (line.includes('[OK] Ultralytics')) { setProgress(55); setCurrentStep('yolo'); }
        if (line.includes('[OK] PyTorch')) { setProgress(80); setCurrentStep('torch'); }
        if (line.includes('[OK] ONNX')) { setProgress(95); setCurrentStep('onnx'); }
        setLogs(prev => [...prev.slice(-200), line.trim()]);
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

              {/* Log window */}
              <div ref={logRef} style={{
                background: '#060810', border: '1px solid #1e2130', borderRadius: 12,
                height: 200, overflowY: 'auto', padding: 12,
                fontFamily: 'JetBrains Mono', fontSize: 11, color: '#4b5563'
              }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ lineHeight: 1.7, color: l.includes('[OK]') ? '#10b981' : l.includes('ERROR') ? '#f87171' : '#4b5563' }}>{l}</div>
                ))}
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="card" style={{ borderColor: '#ef4444', textAlign: 'center', padding: 32 }}>
              <AlertTriangle size={40} color="#ef4444" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 12 }}>Installation Failed</div>
              <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Check your internet connection and try again.</div>
              <button className="btn-secondary" onClick={() => { setPhase('ready'); setLogs([]); setProgress(0); }} style={{ justifyContent: 'center', width: '100%' }}>
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  // Detect if we need setup (from URL param or first launch)
  const needsSetup = new URLSearchParams(window.location.search).get('setup') === '1';
  const [setupDone, setSetupDone] = useState(!needsSetup);

  const [page, setPage] = useState('dataset');
  const [sysInfo, setSysInfo] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [onnxPath, setOnnxPath] = useState(null);
  const [compileResult, setCompileResult] = useState(null);
  const [deviceIp, setDeviceIp] = useState('10.10.10.57');

  useEffect(() => {
    if (!setupDone) return;
    fetch(`${API}/api/system`).then(r => r.json()).then(setSysInfo).catch(() => {});
  }, [setupDone]);

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
            <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
              <span className={`tag ${sysInfo.cuda ? 'tag-green' : 'tag-yellow'}`}>
                {sysInfo.cuda ? `⚡ ${sysInfo.gpu}` : '⚠️ CPU only'}
              </span>
            </div>
          ) : (
            <span style={{ color: '#4b5563', fontSize: 12 }}>Connecting to backend...</span>
          )}
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
