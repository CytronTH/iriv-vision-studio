import logging
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from .websocket_manager import manager

import sys
from pathlib import Path
# Add backend root to sys.path to easily import ai_engine
sys.path.append(str(Path(__file__).resolve().parent.parent))
from ai_engine.hailo_worker import HailoPipelineWorker

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global reference to AI workers, main event loop, and background tasks
active_workers = {}
main_loop = None
background_tasks = set()

import functools
import psutil
import time


def on_metadata_received(project_id, metadata):
    """
    Callback fired by HailoPipelineWorker (which runs in a background thread).
    """
    try:
        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast_json(metadata, project_id), main_loop)
    except Exception as e:
        logger.error(f"Failed to schedule metadata broadcast for {project_id}: {e}")


async def system_monitor_task():
    """Background task to broadcast system metrics"""
    logger.info("System monitor task started!")
    while True:
        try:
            metrics = {
                "cpu_percent": psutil.cpu_percent(interval=None),
                "ram_percent": psutil.virtual_memory().percent,
                "temp_c": 0.0
            }
            # Try to read temp on Raspberry Pi
            try:
                with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                    metrics["temp_c"] = float(f.read()) / 1000.0
            except:
                pass
            
            # logger.info(f"Broadcasting metrics: {metrics}") # uncomment if needed
            await manager.broadcast_json(metrics, room_id="system")
        except Exception as e:
            logger.error(f"System monitor error: {e}")
        await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Application Startup ---
    global active_workers, main_loop
    main_loop = asyncio.get_running_loop()
    
    logger.info("Initializing System Monitor and active projects...")
    
    # Start the system monitor and keep a strong reference to prevent garbage collection
    sys_task = asyncio.create_task(system_monitor_task())
    background_tasks.add(sys_task)
    sys_task.add_done_callback(background_tasks.discard)
    
    # Define absolute paths
    base_dir = Path(__file__).resolve().parent.parent
    
    # We will let the frontend deploy pipelines, so we won't auto-start here.
    
    yield
    
    # --- Application Shutdown ---
    logger.info("Shutting down AI Pipeline Workers...")
    for worker in active_workers.values():
        worker.stop()

app = FastAPI(
    title="IRIV Vision Studio API",
    description="Backend API and WebSocket server for Edge AI Vision",
    version="1.0.0",
    lifespan=lifespan
)

# Allow CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "IRIV Vision Studio Backend is running."}

@app.websocket("/ws/metadata/{project_id}")
async def websocket_metadata_endpoint(websocket: WebSocket, project_id: str):
    """
    WebSocket endpoint for Frontend to connect and receive AI Metadata for a specific project.
    """
    await manager.connect(websocket, room_id=project_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id=project_id)
    except Exception as e:
        logger.error(f"WebSocket error in {project_id}: {e}")
        manager.disconnect(websocket, room_id=project_id)

@app.websocket("/ws/system_metrics")
async def websocket_system_endpoint(websocket: WebSocket):
    """WebSocket for global system metrics (CPU, RAM, Temp)."""
    await manager.connect(websocket, room_id="system")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id="system")
    except Exception as e:
        manager.disconnect(websocket, room_id="system")

from pathlib import Path
from ai_engine.pipeline_parser import PipelineParser

import os

# --- Entity Management APIs ---
DB_PATH = Path(__file__).resolve().parent.parent / "db" / "entities.json"
PROJECTS_DB_PATH = Path(__file__).resolve().parent.parent / "db" / "projects.json"

def read_entities():
    if not DB_PATH.exists():
        return {"cameras": [], "models": [], "integrations": [], "data_sources": []}
    with open(DB_PATH, "r") as f:
        return json.load(f)

def write_entities(data):
    with open(DB_PATH, "w") as f:
        json.dump(data, f, indent=2)

@app.get("/api/entities")
async def get_entities():
    return read_entities()

@app.post("/api/entities")
async def save_entities(data: Dict[str, Any]):
    write_entities(data)
    return {"status": "success"}

import shutil

@app.post("/api/models/upload")
async def upload_model(
    name: str = Form(...),
    task: str = Form(...),
    hef_file: UploadFile = File(...),
    so_file: UploadFile = File(...)
):
    try:
        models_dir = Path(__file__).resolve().parent.parent / "models"
        models_dir.mkdir(exist_ok=True)
        post_process_dir = models_dir / "post_processes"
        post_process_dir.mkdir(exist_ok=True)
        
        hef_path = models_dir / hef_file.filename
        so_path = post_process_dir / so_file.filename
        
        with open(hef_path, "wb") as f:
            shutil.copyfileobj(hef_file.file, f)
            
        with open(so_path, "wb") as f:
            shutil.copyfileobj(so_file.file, f)
            
        entities = read_entities()
        new_model_id = f"model_{int(time.time())}"
        
        if "models" not in entities:
            entities["models"] = []
            
        entities["models"].append({
            "id": new_model_id,
            "name": name,
            "task": task,
            "hef_path": hef_file.filename,
            "so_path": so_file.filename
        })
        
        write_entities(entities)
        
        return {"status": "success", "model_id": new_model_id}
    except Exception as e:
        logger.error(f"Failed to upload model: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/upload-hef")
async def upload_hef_only(
    hef_file: UploadFile = File(...),
    name: str = Form(...),
    task: str = Form("detection")
):
    """
    Simplified .hef upload from IRIV Model Studio (local Docker compile).
    Accepts only the .hef file — automatically assigns the correct post-process .so
    based on task type.
    """
    try:
        models_dir = Path(__file__).resolve().parent.parent / "models"
        models_dir.mkdir(exist_ok=True)

        hef_path = models_dir / hef_file.filename
        with open(hef_path, "wb") as f:
            shutil.copyfileobj(hef_file.file, f)

        # Map task → default post-process shared library
        so_map = {
            "detection": "libyolo_hailortpp_post.so",
            "classification": "libclassification_post.so",
            "pose": "libyolo_hailortpp_post.so",
        }
        default_so = so_map.get(task, "libyolo_hailortpp_post.so")

        entities = read_entities()
        new_model_id = f"model_{int(time.time())}"
        if "models" not in entities:
            entities["models"] = []

        entities["models"].append({
            "id": new_model_id,
            "name": name,
            "task": task,
            "hef_path": hef_file.filename,
            "so_path": default_so
        })
        write_entities(entities)

        logger.info(f"HEF uploaded and registered: {name} ({task})")
        return {
            "status": "success",
            "model_id": new_model_id,
            "message": f"Model '{name}' uploaded and registered successfully"
        }
    except Exception as e:
        logger.error(f"Failed to upload HEF: {e}")
        return {"status": "error", "message": str(e)}

# --- Video File Upload APIs ---
VIDEOS_DIR = Path(__file__).resolve().parent.parent / "videos"
VIDEOS_DIR.mkdir(exist_ok=True)
MAX_VIDEO_SIZE = 1 * 1024 * 1024 * 1024  # 1 GB
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mkv", ".mov", ".webm"}

@app.post("/api/videos/upload")
async def upload_video(video_file: UploadFile = File(...)):
    try:
        suffix = Path(video_file.filename).suffix.lower()
        if suffix not in ALLOWED_VIDEO_EXTENSIONS:
            return {"status": "error", "message": f"Unsupported format. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"}
        
        save_path = VIDEOS_DIR / video_file.filename
        size = 0
        with open(save_path, "wb") as f:
            while chunk := await video_file.read(1024 * 1024):  # 1MB chunks
                size += len(chunk)
                if size > MAX_VIDEO_SIZE:
                    f.close()
                    save_path.unlink(missing_ok=True)
                    return {"status": "error", "message": "File exceeds 1GB limit"}
                f.write(chunk)
        
        # Register as a camera entity of type "file"
        entities = read_entities()
        new_cam_id = f"cam_file_{int(time.time())}"
        if "cameras" not in entities:
            entities["cameras"] = []
        
        entities["cameras"].append({
            "id": new_cam_id,
            "name": video_file.filename,
            "type": "file",
            "path": str(save_path)
        })
        write_entities(entities)
        
        return {"status": "success", "camera_id": new_cam_id, "filename": video_file.filename, "size_bytes": size}
    except Exception as e:
        logger.error(f"Failed to upload video: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/videos")
async def list_videos():
    try:
        files = []
        for f in VIDEOS_DIR.iterdir():
            if f.is_file() and f.suffix.lower() in ALLOWED_VIDEO_EXTENSIONS:
                files.append({"filename": f.name, "size_bytes": f.stat().st_size, "path": str(f)})
        return {"status": "success", "files": files}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/api/videos/{filename}")
async def delete_video(filename: str):
    try:
        file_path = VIDEOS_DIR / filename
        if not file_path.exists() or not file_path.is_file():
            return {"status": "error", "message": "File not found"}
        file_path.unlink()
        # Remove matching camera entity
        entities = read_entities()
        entities["cameras"] = [c for c in entities.get("cameras", []) if c.get("path") != str(file_path)]
        write_entities(entities)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/data-sources")
async def get_data_sources(project_id: str = None):
    # Base data sources that are always available (e.g. system metrics)
    base_sources = [
        { "id": "system.cpu_percent", "name": "CPU Usage (%)", "dataType": "number" },
        { "id": "system.ram_percent", "name": "RAM Usage (%)", "dataType": "number" },
        { "id": "alerts", "name": "System Alerts (Feed)", "dataType": "array_text" }
    ]
    
    if not project_id:
        return base_sources
        
    projects = read_projects()
    project = next((p for p in projects if p.get("id") == project_id), None)
    
    if project and "exposed_data_sources" in project:
        # Merge project specific data sources with base sources
        return project["exposed_data_sources"] + base_sources
        
    return base_sources

# --- Project Management APIs ---
def read_projects():
    if not PROJECTS_DB_PATH.exists():
        return []
    with open(PROJECTS_DB_PATH, "r") as f:
        return json.load(f)

def write_projects(data):
    with open(PROJECTS_DB_PATH, "w") as f:
        json.dump(data, f, indent=2)

@app.get("/api/projects")
async def get_projects():
    return read_projects()

@app.post("/api/projects")
async def save_projects(data: List[Dict[str, Any]]):
    write_projects(data)
    return {"status": "success"}

# --- Pipeline APIs ---
class PipelinePayload(BaseModel):
    project_id: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

@app.post("/api/pipeline/deploy")
async def deploy_pipeline(payload: PipelinePayload):
    project_id = payload.project_id
    logger.info(f"Received pipeline deployment for {project_id}: {len(payload.nodes)} nodes")
    
    try:
        base_dir = Path(__file__).resolve().parent.parent
        parser = PipelineParser(base_dir)
        config = parser.parse({"nodes": payload.nodes, "edges": payload.edges})
        
        # Stop existing worker for this project if any
        if project_id in active_workers:
            active_workers[project_id].stop()
            
        # Create and start a new worker, passing project_id to the callback
        callback = functools.partial(on_metadata_received, project_id)
        # Assuming hailo_worker accepts project_id (we need to modify it next)
        new_worker = HailoPipelineWorker(config=config, metadata_callback=callback, project_id=project_id)
        new_worker.start()
        active_workers[project_id] = new_worker
        
        # Update projects.json with the new pipeline state
        projects = read_projects()
        for p in projects:
            if p["id"] == project_id:
                p["pipeline"] = {"nodes": payload.nodes, "edges": payload.edges}
                p["exposed_data_sources"] = config.dashboard_nodes
                break
        write_projects(projects)
            
        return {"status": "success", "message": "Pipeline deployed and engine started for project"}
    except Exception as e:
        logger.error(f"Failed to deploy pipeline for {project_id}: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/pipeline/stop/{project_id}")
async def stop_pipeline(project_id: str):
    if project_id in active_workers:
        active_workers[project_id].stop()
        del active_workers[project_id]
        return {"status": "success", "message": f"Pipeline {project_id} stopped"}
    return {"status": "error", "message": "Pipeline not running"}

# --- IRIV Model Studio: Remote ONNX Compilation API ---
@app.post("/api/compile-onnx")
async def compile_onnx(
    onnx_file: UploadFile = File(...),
    model_name: str = Form(...),
    task: str = Form("detection")
):
    """
    Receives an ONNX file from IRIV Model Studio (PC) and compiles it to .hef
    using Hailo Dataflow Compiler installed on this device.
    The compiled model is automatically registered in entities.json.
    """
    import subprocess
    
    base_dir = Path(__file__).resolve().parent.parent
    models_dir = base_dir / "models"
    models_dir.mkdir(exist_ok=True)
    
    # Save the uploaded ONNX
    onnx_path = models_dir / onnx_file.filename
    with open(onnx_path, "wb") as f:
        shutil.copyfileobj(onnx_file.file, f)
    
    hef_path = models_dir / f"{model_name}.hef"
    
    # Use hailo SDK to compile ONNX → HEF
    # This requires hailo_sdk_client (Hailo Dataflow Compiler) installed on the device
    compile_script = f"""
import sys
try:
    from hailo_sdk_client import ClientRunner
    runner = ClientRunner()
    runner.translate_onnx_model(
        '{onnx_path}',
        '{model_name}',
        net_input_shapes=None
    )
    runner.optimize_full_precision(calib_dataset=None)
    runner.compile()
    runner.save_hef('{hef_path}')
    print('COMPILE_SUCCESS')
except ImportError:
    # Fallback: try hailo_model_zoo CLI
    import subprocess
    result = subprocess.run([
        'hailomz', 'compile', '--ckpt', '{onnx_path}',
        '--hw-arch', 'hailo8l', '--output-dir', '{models_dir}'
    ], capture_output=True, text=True)
    print(result.stdout)
    if result.returncode == 0:
        print('COMPILE_SUCCESS')
    else:
        print('COMPILE_FAILED:', result.stderr)
except Exception as e:
    print('COMPILE_FAILED:', str(e))
"""
    
    result = subprocess.run(
        [sys.executable, "-c", compile_script],
        capture_output=True, text=True, timeout=600
    )
    
    combined_output = result.stdout + result.stderr
    
    if "COMPILE_SUCCESS" in combined_output and hef_path.exists():
        # Auto-register compiled model in entities.json
        entities = read_entities()
        new_model_id = f"model_{int(time.time())}"
        if "models" not in entities:
            entities["models"] = []
        
        entities["models"].append({
            "id": new_model_id,
            "name": model_name,
            "task": task,
            "hef_path": hef_path.name,
            "so_path": "libyolo_hailortpp_post.so" if task == "detection" else "libclassification_post.so"
        })
        write_entities(entities)
        
        logger.info(f"Model compiled and registered: {model_name}")
        return {
            "status": "success",
            "message": f"Model '{model_name}' compiled and registered successfully",
            "model_id": new_model_id,
            "hef_path": hef_path.name
        }
    else:
        logger.error(f"Compilation failed: {combined_output}")
        # Clean up failed ONNX
        onnx_path.unlink(missing_ok=True)
        return {
            "status": "error",
            "message": "Hailo compilation failed. Make sure Hailo Dataflow Compiler (hailo_sdk_client) is installed.",
            "log": combined_output[-2000:]  # Last 2000 chars of log
        }
