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

app = FastAPI(title="IRIV Model Studio Backend", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE_DIR = Path(__file__).parent
WORKSPACE_DIR = BASE_DIR / "workspace"
DATASETS_DIR = WORKSPACE_DIR / "datasets"
MODELS_DIR = WORKSPACE_DIR / "models"
EXPORTS_DIR = WORKSPACE_DIR / "exports"
for d in [DATASETS_DIR, MODELS_DIR, EXPORTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Store active training websocket clients
training_clients: list[WebSocket] = []

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

        script = f"""
import sys
sys.stdout.reconfigure(line_buffering=True)
from ultralytics import YOLO
model = YOLO('{config.model_size}.pt')
results = model.train(
    data='{yaml_path}',
    epochs={config.epochs},
    imgsz={config.imgsz},
    batch={config.batch},
    project='{output_dir}',
    name='train',
    exist_ok=True,
    verbose=True
)
print('TRAINING_COMPLETE')
"""
        proc = subprocess.Popen(
            [sys.executable, '-c', script],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        active_training["process"] = proc

        for line in iter(proc.stdout.readline, ''):
            line = line.strip()
            if not line:
                continue
            # Parse epoch progress
            epoch_num = None
            if line.startswith('Epoch') or '/'+str(config.epochs) in line:
                try:
                    parts = line.split('/')
                    if len(parts) >= 2:
                        epoch_num = int(parts[0].split()[-1])
                        progress = int((epoch_num / config.epochs) * 90)
                        await broadcast_training_log({"type": "log", "message": line, "progress": progress})
                        continue
                except:
                    pass
            if 'TRAINING_COMPLETE' in line:
                await broadcast_training_log({"type": "status", "message": "Training complete!", "progress": 100})
            else:
                await broadcast_training_log({"type": "log", "message": line})

        proc.wait()

        # Find best.pt
        best_pt = list(Path(output_dir).rglob("best.pt"))
        if best_pt:
            await broadcast_training_log({"type": "complete", "message": "Model saved!", "pt_path": str(best_pt[0])})
        else:
            await broadcast_training_log({"type": "error", "message": "Training failed - best.pt not found"})

    except Exception as e:
        await broadcast_training_log({"type": "error", "message": str(e)})
    finally:
        active_training["running"] = False

@app.post("/api/train/stop")
async def stop_training():
    if active_training["process"]:
        active_training["process"].terminate()
        active_training["running"] = False
        return {"status": "stopped"}
    return {"status": "not_running"}

# --- EXPORT TO ONNX ---
class ExportConfig(BaseModel):
    pt_path: str
    imgsz: int = 640

@app.post("/api/export/onnx")
async def export_to_onnx(config: ExportConfig):
    """Export .pt to .onnx"""
    pt_path = Path(config.pt_path)
    if not pt_path.exists():
        raise HTTPException(404, "Model file not found")

    onnx_path = pt_path.with_suffix('.onnx')
    script = f"""
from ultralytics import YOLO
model = YOLO('{pt_path}')
model.export(format='onnx', imgsz={config.imgsz}, opset=11, simplify=True)
print('EXPORT_COMPLETE')
"""
    result = subprocess.run([sys.executable, '-c', script], capture_output=True, text=True)
    if 'EXPORT_COMPLETE' in result.stdout:
        return {"status": "success", "onnx_path": str(onnx_path)}
    return {"status": "error", "message": result.stderr}

# --- COMPILE (via IRIV Device) ---
class CompileConfig(BaseModel):
    onnx_path: str
    device_ip: str
    model_name: str
    task: str = "detection"

@app.post("/api/compile")
async def compile_on_device(config: CompileConfig):
    """Send ONNX to IRIV device for compilation to .hef"""
    onnx_path = Path(config.onnx_path)
    if not onnx_path.exists():
        raise HTTPException(404, "ONNX file not found")

    device_url = f"http://{config.device_ip}:8000/api/compile-onnx"
    try:
        with open(onnx_path, 'rb') as f:
            response = requests.post(
                device_url,
                files={"onnx_file": (onnx_path.name, f, "application/octet-stream")},
                data={"model_name": config.model_name, "task": config.task},
                timeout=300  # 5 min timeout for compilation
            )
        result = response.json()
        return result
    except requests.exceptions.ConnectionError:
        raise HTTPException(503, f"Cannot connect to IRIV device at {config.device_ip}:8000")

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

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=7654)
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
