import logging
import asyncio
import json
import yaml
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
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
    
    # Auto-resume previously running projects
    projects = read_projects()
    for p in projects:
        if p.get("is_running", False):
            logger.info(f"Restoring project {p['id']} state (Auto-starting)")
            try:
                payload = PipelinePayload(
                    project_id=p["id"],
                    nodes=p.get("pipeline", {}).get("nodes", []),
                    edges=p.get("pipeline", {}).get("edges", [])
                )
                await deploy_pipeline(payload)
            except Exception as e:
                logger.error(f"Failed to auto-start project {p['id']}: {e}")
    
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

from fastapi.staticfiles import StaticFiles
import os
snapshots_dir = "/home/pi/iriv-vision-studio/snapshots"
os.makedirs(snapshots_dir, exist_ok=True)
app.mount("/api/snapshots", StaticFiles(directory=snapshots_dir), name="snapshots")

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
from sqlmodel import Session, select
from db.database import db
from db.models import Project, Camera, AIModel, Integration

# --- Entity Management APIs ---

def read_entities():
    with Session(db.engine) as session:
        cameras = [c.model_dump() for c in session.exec(select(Camera)).all()]
        models = []
        for m in session.exec(select(AIModel)).all():
            md = m.model_dump()
            try: md["tags"] = json.loads(md["tags_json"])
            except: md["tags"] = []
            try: md["classes"] = json.loads(md["classes_json"])
            except: md["classes"] = []
            del md["tags_json"]
            del md["classes_json"]
            models.append(md)
        integrations = [i.model_dump() for i in session.exec(select(Integration)).all()]
        return {"cameras": cameras, "models": models, "integrations": integrations, "data_sources": []}

def write_entities(data):
    with Session(db.engine) as session:
        for c in session.exec(select(Camera)).all(): session.delete(c)
        for m in session.exec(select(AIModel)).all(): session.delete(m)
        for i in session.exec(select(Integration)).all(): session.delete(i)
        
        for c in data.get("cameras", []):
            session.add(Camera(id=c["id"], name=c["name"], type=c.get("type",""), path=c.get("path","")))
        for m in data.get("models", []):
            session.add(AIModel(id=m["id"], name=m["name"], type=m.get("type","model"), hardware=m.get("hardware",""), hef_path=m.get("hef_path",""), so_path=m.get("so_path",""), task=m.get("task",""), tags_json=json.dumps(m.get("tags",[])), classes_json=json.dumps(m.get("classes",[]))))
        for i in data.get("integrations", []):
            session.add(Integration(id=i["id"], name=i["name"], type=i.get("type",""), target=i.get("target","")))
        session.commit()

@app.get("/api/entities")
async def get_entities():
    return read_entities()

@app.post("/api/entities")
async def save_entities(data: Dict[str, Any]):
    write_entities(data)
    return {"status": "success"}


# ── ROI Editor helpers ──────────────────────────────────────────────────────

import subprocess
import tempfile
from fastapi.responses import Response, FileResponse
from fastapi import HTTPException

@app.get("/api/camera-snapshot")
async def camera_snapshot(camera_id: str):
    """
    Capture a single JPEG frame from a camera/RTSP/file source for the ROI editor.
    Uses ffmpeg to grab one frame and returns it as image/jpeg.
    """
    entities = read_entities()
    camera = next((c for c in entities.get("cameras", []) if c.get("id") == camera_id), None)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera entity not found")

    src_type = camera.get("type", "local")
    src_path = camera.get("path", "/dev/video0")

    # Build ffmpeg input args based on source type
    if src_type == "local":
        input_args = ["-f", "v4l2", "-i", src_path]
    elif src_type == "rtsp":
        input_args = [
            "-rtsp_transport", "tcp",
            "-i", src_path,
        ]
    elif src_type == "file":
        input_args = ["-ss", "0", "-i", src_path]
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported source type: {src_type}")

    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name

        cmd = [
            "ffmpeg", "-y",
            *input_args,
            "-frames:v", "1",
            "-q:v", "3",          # JPEG quality (2=best, 31=worst)
            "-vf", "scale=1280:-2",  # Resize to max 1280px wide, keep aspect
            tmp_path
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=10
        )
        if result.returncode != 0:
            err = result.stderr.decode(errors="replace")[-400:]
            logger.error(f"ffmpeg snapshot failed for {camera_id}: {err}")
            raise HTTPException(status_code=500, detail=f"ffmpeg error: {err}")

        with open(tmp_path, "rb") as f:
            jpeg_bytes = f.read()

        import os
        os.unlink(tmp_path)

        return Response(content=jpeg_bytes, media_type="image/jpeg")

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="ffmpeg timed out capturing frame")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Snapshot error for {camera_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/video-file")
async def serve_video_file(path: str):
    """
    Serve a video file from an absolute path on the server.
    Used by the ROI editor's scrubber so the <video> element can load and seek the file.
    Only allows files inside the videos directory or absolute paths registered in entities.
    """
    from pathlib import Path as PPath
    entities = read_entities()
    allowed_paths = {c.get("path") for c in entities.get("cameras", []) if c.get("type") == "file"}

    if path not in allowed_paths:
        raise HTTPException(status_code=403, detail="File not in allowed camera entities")

    p = PPath(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(p), media_type="video/mp4")


import shutil

HAILO_POST_PROCESS_DIR = Path("/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes")

@app.get("/api/so-files")
async def list_so_files():
    """Return list of available Hailo post-process .so files on this device."""
    try:
        if not HAILO_POST_PROCESS_DIR.exists():
            return {"status": "error", "files": [], "message": "TAPPAS post_processes directory not found"}
        so_files = sorted([
            f.name for f in HAILO_POST_PROCESS_DIR.iterdir()
            if f.is_file() and f.suffix == ".so"
        ])
        return {"status": "success", "files": so_files}
    except Exception as e:
        logger.error(f"Failed to list .so files: {e}")
        return {"status": "error", "files": [], "message": str(e)}

@app.get("/api/system/video-devices")
async def list_video_devices():
    """Return list of available video devices on the system."""
    import glob
    try:
        devices = sorted(glob.glob("/dev/video*"))
        return {"status": "success", "devices": devices}
    except Exception as e:
        logger.error(f"Failed to list video devices: {e}")
        return {"status": "error", "devices": [], "message": str(e)}

@app.post("/api/models/upload")
async def upload_model(
    name: str = Form(...),
    task: str = Form(...),
    hef_file: UploadFile = File(...),
    so_name: str = Form(...),
    metadata_file: Optional[UploadFile] = File(None),
):
    """
    Upload a custom .hef model and select a post-process .so from those
    already installed on this device (TAPPAS post_processes directory).
    Optionally accepts a metadata.yaml file to extract class names.
    """
    try:
        # Validate that the requested .so actually exists on the device
        so_full_path = HAILO_POST_PROCESS_DIR / so_name
        if not so_full_path.exists():
            return {"status": "error", "message": f".so file not found on device: {so_name}"}

        models_dir = Path(__file__).resolve().parent.parent / "models"
        models_dir.mkdir(exist_ok=True)

        hef_path = models_dir / hef_file.filename
        with open(hef_path, "wb") as f:
            shutil.copyfileobj(hef_file.file, f)

        # Parse class names from metadata.yaml if provided
        classes = []
        if metadata_file and metadata_file.filename:
            try:
                content = await metadata_file.read()
                meta = yaml.safe_load(content)
                if isinstance(meta, dict) and "names" in meta:
                    names = meta["names"]
                    if isinstance(names, dict):
                        # YOLO format: {0: 'cup', 1: 'expire_date'}
                        classes = [names[k] for k in sorted(names.keys())]
                    elif isinstance(names, list):
                        classes = names
                logger.info(f"Parsed {len(classes)} classes from metadata.yaml: {classes}")
            except Exception as e:
                logger.warning(f"Failed to parse metadata.yaml: {e}")

        entities = read_entities()
        new_model_id = f"model_{int(time.time())}"

        if "models" not in entities:
            entities["models"] = []

        entities["models"].append({
            "id": new_model_id,
            "name": name,
            "task": task,
            "hef_path": hef_file.filename,
            "so_path": so_name,
            "classes": classes
        })

        write_entities(entities)

        return {"status": "success", "model_id": new_model_id, "classes_found": len(classes)}
    except Exception as e:
        logger.error(f"Failed to upload model: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/models/{model_id}/metadata")
async def upload_model_metadata(model_id: str, metadata_file: UploadFile = File(...)):
    """
    Upload a metadata.yaml file for an existing model to set its class names.
    Parses the 'names' field from Ultralytics YOLO metadata format.
    """
    try:
        content = await metadata_file.read()
        meta = yaml.safe_load(content)
        if not isinstance(meta, dict) or "names" not in meta:
            return {"status": "error", "message": "Invalid metadata.yaml: missing 'names' field"}

        names = meta["names"]
        if isinstance(names, dict):
            classes = [names[k] for k in sorted(names.keys())]
        elif isinstance(names, list):
            classes = names
        else:
            return {"status": "error", "message": "'names' field must be a dict or list"}

        entities = read_entities()
        model = next((m for m in entities.get("models", []) if m["id"] == model_id), None)
        if not model:
            return {"status": "error", "message": f"Model {model_id} not found"}

        model["classes"] = classes
        write_entities(entities)
        logger.info(f"Updated classes for {model_id}: {classes}")
        return {"status": "success", "classes": classes}
    except Exception as e:
        logger.error(f"Failed to parse metadata: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/models/{model_id}/classes")
async def update_model_classes(model_id: str, data: Dict[str, Any]):
    """
    Manually set class names for a model.
    Body: {"classes": ["cup", "expire_date"]}
    """
    try:
        classes = data.get("classes", [])
        if not isinstance(classes, list):
            return {"status": "error", "message": "'classes' must be a list"}

        entities = read_entities()
        model = next((m for m in entities.get("models", []) if m["id"] == model_id), None)
        if not model:
            return {"status": "error", "message": f"Model {model_id} not found"}

        model["classes"] = [c.strip() for c in classes if c.strip()]
        write_entities(entities)
        return {"status": "success", "classes": model["classes"]}
    except Exception as e:
        logger.error(f"Failed to update classes: {e}")
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
            "so_path": default_so,
            "classes": []
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
    with Session(db.engine) as session:
        projects = []
        for p in session.exec(select(Project)).all():
            pd = p.model_dump()
            try: pd["pipeline"] = json.loads(pd["pipeline_json"])
            except: pd["pipeline"] = {"nodes": [], "edges": []}
            try: pd["dashboard_layout"] = json.loads(pd["dashboard_layout_json"])
            except: pd["dashboard_layout"] = {}
            try: pd["exposed_data_sources"] = json.loads(pd["exposed_data_sources_json"])
            except: pd["exposed_data_sources"] = []
            
            # Use runtime state if available, fallback to db state
            pd["is_running"] = pd["is_running"]
            del pd["pipeline_json"]
            del pd["dashboard_layout_json"]
            del pd["exposed_data_sources_json"]
            projects.append(pd)
        return projects

def write_projects(data):
    with Session(db.engine) as session:
        for p in session.exec(select(Project)).all(): session.delete(p)
        for p in data:
            session.add(Project(
                id=p["id"],
                name=p["name"],
                description=p.get("description", ""),
                pipeline_json=json.dumps(p.get("pipeline", {})),
                dashboard_layout_json=json.dumps(p.get("dashboard_layout", {})),
                exposed_data_sources_json=json.dumps(p.get("exposed_data_sources", [])),
                is_running=p.get("is_running", False)
            ))
        session.commit()

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
        config = parser.parse({"nodes": payload.nodes, "edges": payload.edges}, project_id=project_id)
        
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
                p["is_running"] = True
                break
        write_projects(projects)
            
        return {"status": "success", "message": "Pipeline deployed and engine started for project"}
    except Exception as e:
        logger.error(f"Failed to deploy pipeline for {project_id}: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/pipeline/stop/{project_id}")
async def stop_pipeline(project_id: str):
    is_stopped = False
    if project_id in active_workers:
        active_workers[project_id].stop()
        del active_workers[project_id]
        is_stopped = True
        
    projects = read_projects()
    for p in projects:
        if p["id"] == project_id:
            p["is_running"] = False
            break
    write_projects(projects)

    if is_stopped:
        return {"status": "success", "message": f"Pipeline {project_id} stopped"}
    return {"status": "error", "message": "Pipeline not running"}

@app.get("/api/projects/status")
async def get_projects_status():
    status_dict = {}
    current_time = time.time()
    for pid, worker in active_workers.items():
        if getattr(worker, 'is_running', False):
            start_time = getattr(worker, 'start_time', None)
            uptime = int(current_time - start_time) if start_time else 0
            status_dict[pid] = {
                "status": "running",
                "start_time": start_time,
                "uptime": uptime
            }
        else:
            status_dict[pid] = {"status": "stopped", "start_time": None, "uptime": 0}
    return status_dict

@app.post("/api/projects/{project_id}/start")
async def start_project(project_id: str):
    projects = read_projects()
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        return {"status": "error", "message": "Project not found"}
    
    pipeline = project.get("pipeline", {"nodes": [], "edges": []})
    
    # We can reuse the deploy_pipeline logic
    payload = PipelinePayload(
        project_id=project_id,
        nodes=pipeline.get("nodes", []),
        edges=pipeline.get("edges", [])
    )
    return await deploy_pipeline(payload)

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

@app.post("/api/system/restart")
async def restart_system():
    logger.warning("System reboot requested via API")
    import os
    os.system("sudo reboot")
    return {"status": "success", "message": "Rebooting..."}

@app.get("/api/logs")
def get_logs(limit: int = 100, node_id: str = None, event_type: str = None, camera_id: str = None, page: int = 1):
    try:
        from db.database import db
        result = db.get_logs(limit=limit, node_id=node_id, event_type=event_type, camera_id=camera_id, page=page)
        return {"status": "success", **result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/system/shutdown")
async def shutdown_system():
    logger.warning("System shutdown requested via API")
    import os
    os.system("sudo shutdown now")
    return {"status": "success", "message": "Shutting down..."}
