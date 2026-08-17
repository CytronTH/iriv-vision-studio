import logging
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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
