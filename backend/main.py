import sys
import logging
import argparse
import asyncio
import json
import os
import shutil
import subprocess
import zipfile
from pathlib import Path

import aiofiles
import requests
import uvicorn
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── Embedded compile_hailo.py — written to disk if file is missing (older install) ──
_COMPILE_HAILO_SCRIPT = r'''#!/usr/bin/env python3
"""IRIV Model Studio — Hailo Compilation Script (embedded fallback copy)"""
import subprocess, re, sys, os, glob

def run_streaming(cmd):
    print(f"[CMD] {' '.join(cmd)}", flush=True)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in proc.stdout:
        print(line, end='', flush=True)
    proc.wait()
    return proc.returncode

def run_capture(cmd, stdin_input=''):
    result = subprocess.run(cmd, capture_output=True, text=True, input=stdin_input)
    return result.returncode, result.stdout + result.stderr

def main():
    if len(sys.argv) < 3:
        print("Usage: compile_hailo.py <model_name> <hw_arch>"); sys.exit(1)
    model_name, hw_arch = sys.argv[1], sys.argv[2]
    os.chdir('/workspace')

    print('STEP_PARSE', flush=True)
    base_cmd = ['hailo', 'parser', 'onnx', 'model.onnx', '--net-name', model_name, '--hw-arch', hw_arch]
    code, out = run_capture(base_cmd, stdin_input='n\n')
    print(out, flush=True)
    if code != 0:
        m = re.search(r'end node names:\s*([/\w,\s\.\-]+?)(?:\n|$)', out, re.IGNORECASE)
        if not m:
            m2 = re.search(r'end node names:\s*\[([^\]]+)\]', out)
            nodes = [n.strip().strip("'\"") for n in m2.group(1).split(',')] if m2 else None
        else:
            nodes = [n.strip() for n in re.split(r'[,\s]+', m.group(1)) if n.strip().startswith('/')]
        if nodes:
            print(f'[IRIV] Auto-retry with end nodes: {nodes}', flush=True)
            code = run_streaming(base_cmd + ['--end-node-names'] + nodes)
        if code != 0:
            print(f'[IRIV] Parse failed (exit {code})', flush=True); sys.exit(code)

    print('STEP_OPTIMIZE', flush=True)
    hn_files = sorted(glob.glob('/workspace/*.hn'))
    if not hn_files:
        print('[IRIV] ERROR: No .hn file found!', flush=True); sys.exit(1)
    code = run_streaming(['hailo', 'optimize', hn_files[-1], '--hw-arch', hw_arch, '--calib-set-path', '/calib'])
    if code != 0:
        print(f'[IRIV] Optimize failed (exit {code})', flush=True); sys.exit(code)

    print('STEP_COMPILE', flush=True)
    har_files = sorted(glob.glob('/workspace/*.har'))
    input_file = har_files[-1] if har_files else (sorted(glob.glob('/workspace/*.hn')) or [None])[-1]
    if not input_file:
        print('[IRIV] ERROR: No .har/.hn file found!', flush=True); sys.exit(1)
    code = run_streaming(['hailo', 'compiler', input_file, '--hw-arch', hw_arch, '-o', f'/workspace/{model_name}.hef'])
    if code != 0:
        print(f'[IRIV] Compile failed (exit {code})', flush=True); sys.exit(code)

    print('COMPILE_DONE', flush=True)

if __name__ == '__main__':
    main()
'''

app = FastAPI(title="IRIV Model Studio Backend", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE_DIR = Path(__file__).parent
WORKSPACE_DIR = BASE_DIR / "workspace"
DATASETS_DIR = WORKSPACE_DIR / "datasets"
MODELS_DIR = WORKSPACE_DIR / "models"
EXPORTS_DIR = WORKSPACE_DIR / "exports"
COMPILED_DIR = WORKSPACE_DIR / "compiled"
for d in [DATASETS_DIR, MODELS_DIR, EXPORTS_DIR, COMPILED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Store active websocket clients per operation
training_clients: list[WebSocket] = []
export_clients: list[WebSocket] = []
compile_clients: list[WebSocket] = []

# --- SYSTEM ---
@app.get("/api/system")
async def system_info():
    import torch
    cuda_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if cuda_available else "N/A"
    device_count = torch.cuda.device_count() if cuda_available else 0

    # Diagnose why CUDA might not be available
    cuda_reason = "OK"
    if not cuda_available:
        torch_ver = torch.__version__
        if "+cpu" in torch_ver:
            cuda_reason = "PyTorch is CPU-only build (+cpu). Need to reinstall with cu124."
        else:
            try:
                import subprocess
                r = subprocess.run(["nvidia-smi"], capture_output=True, text=True, timeout=5)
                cuda_reason = "Driver OK but CUDA init failed. Try: reinstall PyTorch." if r.returncode == 0 else "No NVIDIA driver found."
            except Exception as e:
                cuda_reason = f"nvidia-smi check failed: {e}"

    return {
        "cuda": cuda_available,
        "gpu": gpu_name,
        "device_count": device_count,
        "torch_version": torch.__version__,
        "cuda_build": torch.version.cuda or "N/A",
        "cuda_reason": cuda_reason,
        "python": sys.version,
        "workspace": str(WORKSPACE_DIR)
    }


# --- DATASET ---
@app.get("/api/datasets")
async def list_datasets():
    datasets = []
    for d in DATASETS_DIR.iterdir():
        if d.is_dir():
            meta_file = d / "dataset_info.json"
            if meta_file.exists():
                with open(meta_file) as f:
                    meta = json.load(f)
            else:
                images = list(d.rglob("*.jpg")) + list(d.rglob("*.png")) + list(d.rglob("*.jpeg"))
                meta = {"name": d.name, "image_count": len(images), "classes": []}
            datasets.append({"id": d.name, **meta})
    return {"datasets": datasets}

@app.post("/api/datasets/import-roboflow")
async def import_roboflow_zip(file: UploadFile = File(...)):
    """Import a Roboflow ZIP export (YOLOv8 format)"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(400, "Only .zip files are accepted")

    dataset_name = Path(file.filename).stem.replace(" ", "_")
    dataset_dir = DATASETS_DIR / dataset_name
    dataset_dir.mkdir(exist_ok=True)

    zip_path = dataset_dir / file.filename
    async with aiofiles.open(zip_path, 'wb') as f:
        content = await file.read()
        await f.write(content)

    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(dataset_dir)
    zip_path.unlink()

    # Find data.yaml
    yaml_files = list(dataset_dir.rglob("data.yaml"))
    classes = []
    if yaml_files:
        import re
        with open(yaml_files[0]) as f:
            content = f.read()
            match = re.search(r"names:\s*\[([^\]]+)\]", content)
            if match:
                classes = [c.strip().strip("'\"") for c in match.group(1).split(",")]

    # Count images
    images = list(dataset_dir.rglob("*.jpg")) + list(dataset_dir.rglob("*.png")) + list(dataset_dir.rglob("*.jpeg"))

    meta = {
        "name": dataset_name,
        "image_count": len(images),
        "classes": classes,
        "yaml_path": str(yaml_files[0]) if yaml_files else "",
        "source": "roboflow"
    }
    with open(dataset_dir / "dataset_info.json", "w") as f:
        json.dump(meta, f, indent=2)

    return {"status": "success", "dataset": meta}

@app.delete("/api/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str):
    dataset_dir = DATASETS_DIR / dataset_id
    if not dataset_dir.exists():
        raise HTTPException(404, "Dataset not found")
    shutil.rmtree(dataset_dir)
    return {"status": "success"}

# --- TRAINING ---
class TrainConfig(BaseModel):
    dataset_id: str
    model_size: str = "yolov8s"  # n, s, m, l, x
    epochs: int = 50
    imgsz: int = 640
    batch: int = 16
    project_name: str = "my_model"

@app.websocket("/ws/training")
async def training_websocket(ws: WebSocket):
    await ws.accept()
    training_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        training_clients.remove(ws)

async def broadcast_training_log(message: dict):
    dead = []
    for client in training_clients:
        try:
            await client.send_json(message)
        except:
            dead.append(client)
    for d in dead:
        training_clients.remove(d)

# --- EXPORT WEBSOCKET ---
@app.websocket("/ws/export")
async def export_websocket(ws: WebSocket):
    await ws.accept()
    export_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in export_clients:
            export_clients.remove(ws)

async def broadcast_export_log(message: dict):
    dead = []
    for client in export_clients:
        try:
            await client.send_json(message)
        except:
            dead.append(client)
    for d in dead:
        if d in export_clients:
            export_clients.remove(d)

# --- COMPILE WEBSOCKET ---
@app.websocket("/ws/compile")
async def compile_websocket(ws: WebSocket):
    await ws.accept()
    compile_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in compile_clients:
            compile_clients.remove(ws)

async def broadcast_compile_log(message: dict):
    dead = []
    for client in compile_clients:
        try:
            await client.send_json(message)
        except:
            dead.append(client)
    for d in dead:
        if d in compile_clients:
            compile_clients.remove(d)

@app.post("/api/train")
async def start_training(config: TrainConfig, background_tasks=None):
    """Start YOLOv8 training in background"""
    dataset_dir = DATASETS_DIR / config.dataset_id
    if not dataset_dir.exists():
        raise HTTPException(404, "Dataset not found")

    # Find data.yaml
    yaml_files = list(dataset_dir.rglob("data.yaml"))
    if not yaml_files:
        raise HTTPException(400, "data.yaml not found in dataset")
    yaml_path = str(yaml_files[0])

    output_dir = MODELS_DIR / config.project_name
    output_dir.mkdir(exist_ok=True)

    asyncio.create_task(run_training(config, yaml_path, str(output_dir)))
    return {"status": "started", "project": config.project_name}

active_training = {"running": False, "process": None}

async def run_training(config: TrainConfig, yaml_path: str, output_dir: str):
    active_training["running"] = True
    try:
        await broadcast_training_log({"type": "status", "message": "Starting training...", "progress": 0})

        # Build the training script
        # IMPORTANT: On Windows, PyTorch DataLoader uses multiprocessing spawn.
        # The script MUST have if __name__ == '__main__': guard + freeze_support()
        # to prevent recursive worker spawning. We also set workers=0 to be safe
        # since we're already inside a subprocess.
        script = f"""
import sys, os, multiprocessing
multiprocessing.freeze_support()

sys.stdout.reconfigure(line_buffering=True)

def main():
    print("Loading YOLO model (may download weights ~20MB on first run)...", flush=True)
    from ultralytics import YOLO
    print("Model loaded. Starting training...", flush=True)
    model = YOLO(r'{config.model_size}.pt')
    results = model.train(
        data=r'{yaml_path}',
        epochs={config.epochs},
        imgsz={config.imgsz},
        batch={config.batch},
        project=r'{output_dir}',
        name='train',
        exist_ok=True,
        verbose=True,
        workers=0,
    )
    print('TRAINING_COMPLETE', flush=True)

if __name__ == '__main__':
    main()
"""

        # Use the same venv python that's running this server
        python_exe = sys.executable

        # Write script to temp file to avoid -c quoting issues on Windows
        import tempfile, os
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
            f.write(script)
            script_path = f.name

        await broadcast_training_log({"type": "log", "message": f"Python: {python_exe}", "progress": 0})
        await broadcast_training_log({"type": "log", "message": f"Dataset: {yaml_path}", "progress": 0})

        # Use asyncio subprocess — non-blocking, won't stall the event loop
        proc = await asyncio.create_subprocess_exec(
            python_exe, script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        active_training["process"] = proc

        # Read output line-by-line without blocking the event loop
        async for raw_line in proc.stdout:
            line = raw_line.decode('utf-8', errors='replace').rstrip()
            if not line:
                continue

            # Parse epoch progress e.g. "Epoch 1/50"
            epoch_num = None
            if '/' + str(config.epochs) in line:
                try:
                    parts = line.split('/')
                    epoch_num = int(parts[0].strip().split()[-1])
                    progress = int((epoch_num / config.epochs) * 90)
                    await broadcast_training_log({"type": "log", "message": line, "progress": progress})
                    continue
                except Exception:
                    pass

            if 'TRAINING_COMPLETE' in line:
                await broadcast_training_log({"type": "status", "message": "Training complete!", "progress": 100})
            else:
                await broadcast_training_log({"type": "log", "message": line})

        await proc.wait()

        # Clean up temp script
        try:
            os.unlink(script_path)
        except Exception:
            pass

        # Find best.pt
        best_pt = list(Path(output_dir).rglob("best.pt"))
        if best_pt:
            await broadcast_training_log({"type": "complete", "message": "Model saved!", "pt_path": str(best_pt[0])})
        else:
            await broadcast_training_log({"type": "error", "message": "Training finished but best.pt not found"})

    except Exception as e:
        import traceback
        await broadcast_training_log({"type": "error", "message": f"Training error: {e}\n{traceback.format_exc()}"})
    finally:
        active_training["running"] = False


@app.post("/api/train/stop")
async def stop_training():
    if active_training["process"]:
        active_training["process"].terminate()
        active_training["running"] = False
        return {"status": "stopped"}
    return {"status": "not_running"}

# --- EXPORT TO ONNX (async streaming) ---
class ExportConfig(BaseModel):
    pt_path: str
    imgsz: int = 640

@app.post("/api/export/onnx")
async def export_to_onnx(config: ExportConfig):
    """Start async ONNX export — streams logs via /ws/export"""
    pt_path = Path(config.pt_path)
    if not pt_path.exists():
        raise HTTPException(404, "Model file not found")
    asyncio.create_task(run_export(config, str(pt_path)))
    return {"status": "started"}

async def run_export(config: ExportConfig, pt_path_str: str):
    """Async ONNX export with WebSocket log streaming"""
    import tempfile
    pt_path = Path(pt_path_str)
    onnx_path = pt_path.with_suffix('.onnx')
    pt_path_repr = repr(str(pt_path))

    await broadcast_export_log({"type": "status", "message": "Starting ONNX export...", "progress": 0})

    script = f"""
import sys, multiprocessing
multiprocessing.freeze_support()
sys.stdout.reconfigure(line_buffering=True)

def main():
    print("Loading model weights...", flush=True)
    from ultralytics import YOLO
    print("Model loaded. Exporting to ONNX...", flush=True)
    model = YOLO({pt_path_repr})
    model.export(format='onnx', imgsz={config.imgsz}, opset=11, simplify=True)
    print("EXPORT_COMPLETE", flush=True)

if __name__ == '__main__':
    main()
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(script)
        script_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        progress_map = {
            "Loading model": 10,
            "Model loaded": 30,
            "Exporting": 50,
            "DFL": 70,
            "simplify": 85,
            "EXPORT_COMPLETE": 100,
        }

        async for raw in proc.stdout:
            line = raw.decode(errors='replace').strip()
            if not line:
                continue
            progress = 50
            for keyword, pct in progress_map.items():
                if keyword.lower() in line.lower():
                    progress = pct
                    break
            await broadcast_export_log({"type": "log", "message": line, "progress": progress})

        await proc.wait()

        if proc.returncode == 0 and onnx_path.exists():
            await broadcast_export_log({
                "type": "done", "status": "success",
                "message": "Export complete!", "progress": 100,
                "onnx_path": str(onnx_path)
            })
        else:
            await broadcast_export_log({
                "type": "done", "status": "error",
                "message": "Export failed — check logs above", "progress": 0
            })
    except Exception as e:
        await broadcast_export_log({"type": "done", "status": "error", "message": str(e), "progress": 0})
    finally:
        try:
            os.unlink(script_path)
        except Exception:
            pass

# --- COMPILE TO .HEF (local Docker) ---
class LocalCompileConfig(BaseModel):
    onnx_path: str
    dataset_id: str           # to find calibration images
    model_name: str
    hailo_arch: str = "hailo8l"   # hailo8 or hailo8l
    docker_image: str = "iriv-hailo-compiler:latest"
    task: str = "detection"

@app.post("/api/compile/local")
async def compile_local(config: LocalCompileConfig):
    """Start local Hailo compilation via Docker — streams logs via /ws/compile"""
    onnx_path = Path(config.onnx_path)
    if not onnx_path.exists():
        raise HTTPException(404, "ONNX file not found")

    # Check calibration images exist
    dataset_dir = DATASETS_DIR / config.dataset_id
    train_img_dir = dataset_dir / "train" / "images"
    if not train_img_dir.exists() or not any(train_img_dir.iterdir()):
        raise HTTPException(400,
            f"No calibration images found at {train_img_dir}. "
            "Please ensure the dataset is imported correctly. "
            "Tip: The 'train/images' folder inside your dataset must contain images for Hailo quantization calibration."
        )

    asyncio.create_task(run_local_compile(config, str(onnx_path), str(train_img_dir)))
    return {"status": "started"}

async def run_local_compile(config: LocalCompileConfig, onnx_path_str: str, calib_dir_str: str):
    """Run Hailo compilation in Docker, stream logs via WebSocket"""
    onnx_path = Path(onnx_path_str)
    calib_dir = Path(calib_dir_str)
    output_dir = COMPILED_DIR / config.model_name
    output_dir.mkdir(parents=True, exist_ok=True)

    # Copy ONNX to output workspace
    shutil.copy2(onnx_path, output_dir / "model.onnx")

    # Docker paths must use forward slashes on Windows
    def docker_path(p: Path) -> str:
        return str(p).replace('\\', '/')

    workspace_docker = docker_path(output_dir)
    calib_docker = docker_path(calib_dir)

    # Check Docker image exists (with timeout so it never hangs)
    await broadcast_compile_log({"type": "status", "message": "Checking Docker image...", "progress": 2})
    docker_ok = False
    try:
        check = await asyncio.create_subprocess_exec(
            "docker", "image", "inspect", config.docker_image,
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        await asyncio.wait_for(check.wait(), timeout=8.0)
        docker_ok = (check.returncode == 0)
    except asyncio.TimeoutError:
        try: check.kill()
        except: pass
        docker_ok = False
    except Exception:
        docker_ok = False

    if not docker_ok:
        await broadcast_compile_log({
            "type": "done", "status": "error",
            "message": (
                f"Docker image '{config.docker_image}' not found.\n\n"
                "To build the minimal Hailo compiler image (~2-3 GB):\n"
                "1. Download hailo_dataflow_compiler-*.whl from https://hailo.ai/developer-zone/\n"
                "2. Place the .whl file next to Dockerfile.hailo in the IRIV Model Studio folder\n"
                f"3. Run: docker build -f Dockerfile.hailo -t {config.docker_image} .\n\n"
                "Or to use the full Hailo SW Suite (~12 GB):\n"
                "   docker pull hailo/hailo_sw_suite_2024-10:latest"
            ),
            "progress": 0
        })
        return

    # Locate compile script (works both in dev and packaged/asar.unpacked)
    compile_script = Path(__file__).parent / "compile_hailo.py"

    # Self-heal: if file is missing (older installation), write it now so
    # Docker can mount it. Avoids requiring a full reinstall.
    if not compile_script.exists():
        await broadcast_compile_log({
            "type": "status",
            "message": "[IRIV] compile_hailo.py not found locally — writing embedded copy...",
            "progress": 3
        })
        compile_script.write_text(_COMPILE_HAILO_SCRIPT, encoding="utf-8")

    compile_script_docker = docker_path(compile_script)

    await broadcast_compile_log({"type": "status", "message": "Starting Docker compilation...", "progress": 5})

    proc = await asyncio.create_subprocess_exec(
        "docker", "run", "--rm",
        f"--name=iriv-compile-{int(asyncio.get_event_loop().time())}",
        "-v", f"{workspace_docker}:/workspace",
        "-v", f"{calib_docker}:/calib:ro",
        "-v", f"{compile_script_docker}:/compile_hailo.py:ro",
        config.docker_image,
        "python3", "/compile_hailo.py", config.model_name, config.hailo_arch,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )

    step_progress = {"STEP_PARSE": 20, "STEP_OPTIMIZE": 50, "STEP_COMPILE": 80, "COMPILE_DONE": 100}
    current_progress = 5

    async for raw in proc.stdout:
        line = raw.decode(errors='replace').strip()
        if not line:
            continue
        for keyword, pct in step_progress.items():
            if keyword in line:
                current_progress = pct
        await broadcast_compile_log({"type": "log", "message": line, "progress": current_progress})

    await proc.wait()
    hef_path = output_dir / f"{config.model_name}.hef"

    if proc.returncode == 0 and hef_path.exists():
        await broadcast_compile_log({
            "type": "done", "status": "success",
            "message": f"Compilation complete! .hef saved to: {hef_path}",
            "progress": 100,
            "hef_path": str(hef_path),
            "model_name": config.model_name,
            "task": config.task
        })
    else:
        await broadcast_compile_log({
            "type": "done", "status": "error",
            "message": f"Compilation failed (Docker exit code {proc.returncode}). Check logs above.",
            "progress": 0
        })

# --- DEPLOY .HEF TO IRIV EDGEAI ---
class DeployHefConfig(BaseModel):
    hef_path: str
    device_ip: str
    model_name: str
    task: str = "detection"

@app.post("/api/deploy/hef")
async def deploy_hef(config: DeployHefConfig):
    """Upload compiled .hef to IRIV EdgeAI device"""
    hef_path = Path(config.hef_path)
    if not hef_path.exists():
        raise HTTPException(404, "HEF file not found")

    device_url = f"http://{config.device_ip}:8000/api/upload-hef"
    try:
        with open(hef_path, 'rb') as f:
            response = requests.post(
                device_url,
                files={"hef_file": (hef_path.name, f, "application/octet-stream")},
                data={"name": config.model_name, "task": config.task},
                timeout=60
            )
        result = response.json()
        return result
    except requests.exceptions.ConnectionError:
        raise HTTPException(503, f"Cannot connect to IRIV EdgeAI at {config.device_ip}:8000")
    except Exception as e:
        raise HTTPException(500, str(e))

# --- LIST MODELS ---
@app.get("/api/models")
async def list_models():
    models = []
    for d in MODELS_DIR.iterdir():
        if d.is_dir():
            pt_files = list(d.rglob("best.pt"))
            onnx_files = list(d.rglob("*.onnx"))
            models.append({
                "name": d.name,
                "has_pt": len(pt_files) > 0,
                "has_onnx": len(onnx_files) > 0,
                "pt_path": str(pt_files[0]) if pt_files else None,
                "onnx_path": str(onnx_files[0]) if onnx_files else None
            })
    return {"models": models}

# --- IMPORT EXTERNAL ONNX ---
class ImportOnnxRequest(BaseModel):
    onnx_path: str          # Source path on Windows (selected by user)
    model_name: str = ""    # Optional display name; defaults to filename stem

@app.post("/api/import/onnx")
async def import_onnx(req: ImportOnnxRequest):
    try:
        src = Path(req.onnx_path)
        if not src.exists():
            return {"status": "error", "message": f"File not found: {req.onnx_path}"}
        if src.suffix.lower() != ".onnx":
            return {"status": "error", "message": "File must be a .onnx file"}

        model_name = req.model_name.strip() or src.stem
        # Sanitize name
        model_name = "".join(c if c.isalnum() or c in "_-" else "_" for c in model_name)
        model_name = model_name or "imported_model"

        model_dir = MODELS_DIR / model_name
        model_dir.mkdir(parents=True, exist_ok=True)

        dest = model_dir / src.name
        if str(src) != str(dest):
            shutil.copy2(str(src), str(dest))

        return {
            "status": "success",
            "model_name": model_name,
            "onnx_path": str(dest)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- COPY FILE (used for ONNX download to user-chosen path) ---
class CopyFileRequest(BaseModel):
    src: str   # source path (inside workspace)
    dest: str  # destination path (chosen by user via Save dialog)

@app.post("/api/copy-file")
async def copy_file(req: CopyFileRequest):
    try:
        src_path  = Path(req.src)
        dest_path = Path(req.dest)
        if not src_path.exists():
            return {"status": "error", "message": f"Source file not found: {req.src}"}
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(src_path), str(dest_path))
        return {"status": "success", "dest": str(dest_path)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=7654)
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
