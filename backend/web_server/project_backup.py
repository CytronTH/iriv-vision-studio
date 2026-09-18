import os
import io
import re
import json
import time
import shutil
import zipfile
import logging
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlmodel import Session, select

from db.database import db
from db.models import Project, AIModel, Camera, Integration

logger = logging.getLogger("ai_engine")

router = APIRouter(prefix="/api/projects/backup", tags=["Project Backup & Migration"])

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
VIDEOS_DIR = BASE_DIR / "videos"
SNAPSHOT_DIR = Path("/home/pi/iriv-backups/projects")
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_filename(name: str) -> str:
    """Sanitizes project name to be safe for filenames."""
    s = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
    return re.sub(r'_+', '_', s).strip('_')


def is_safe_extract_path(target_base: Path, target_path: Path) -> bool:
    """
    Guards against Zip Slip directory traversal attacks.
    Ensures that target_path is strictly within target_base.
    """
    try:
        resolved_base = target_base.resolve()
        resolved_target = target_path.resolve()
        return resolved_base in resolved_target.parents or resolved_base == resolved_target
    except Exception:
        return False


def get_referenced_entities(pipeline_dict: dict) -> Tuple[set, set, set]:
    """
    Extracts referenced entity IDs from pipeline nodes.
    Returns (model_ids, camera_ids, integration_ids).
    """
    nodes = pipeline_dict.get("nodes", [])
    model_ids = set()
    camera_ids = set()
    integration_ids = set()

    for node in nodes:
        node_type = node.get("type", "")
        data = node.get("data", {})
        entity_id = data.get("entityId")

        if not entity_id:
            continue

        if node_type == "aiNode" or entity_id.startswith("model_"):
            model_ids.add(entity_id)
        elif node_type == "inputNode" or entity_id.startswith("cam_"):
            camera_ids.add(entity_id)
        elif node_type == "actionNode" or entity_id.startswith("int_"):
            integration_ids.add(entity_id)

    return model_ids, camera_ids, integration_ids


# ─────────────────────────────────────────────────────────────────────────────
# 1. EXPORT SINGLE PROJECT (.irivproj or .json)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/export/{project_id}")
async def export_project(
    project_id: str,
    bundle_type: str = Query("full", description="'full' (with AI models) or 'config_only'"),
    include_videos: bool = Query(True, description="Whether to bundle sample video files if referenced"),
    format: str = Query("zip", description="'zip' (.irivproj) or 'json'")
):
    """
    Exports a project as a deployable .irivproj package (ZIP) or standalone JSON.
    Full bundle includes .hef models and post-processing files so it can be deployed
    on another board immediately.
    """
    with Session(db.engine) as session:
        project = session.exec(select(Project).where(Project.id == project_id)).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        try:
            pipeline_data = json.loads(project.pipeline_json)
        except Exception:
            pipeline_data = {"nodes": [], "edges": []}

        try:
            dashboard_data = json.loads(project.dashboard_layout_json)
        except Exception:
            dashboard_data = {}

        try:
            exposed_sources = json.loads(project.exposed_data_sources_json)
        except Exception:
            exposed_sources = []

        model_ids, camera_ids, integration_ids = get_referenced_entities(pipeline_data)

        # Retrieve referenced entities
        models = session.exec(select(AIModel).where(AIModel.id.in_(model_ids))).all() if model_ids else []
        cameras = session.exec(select(Camera).where(Camera.id.in_(camera_ids))).all() if camera_ids else []
        integrations = session.exec(select(Integration).where(Integration.id.in_(integration_ids))).all() if integration_ids else []

        models_list = []
        for m in models:
            md = m.model_dump()
            try: md["tags"] = json.loads(md["tags_json"])
            except: md["tags"] = []
            try: md["classes"] = json.loads(md["classes_json"])
            except: md["classes"] = []
            del md["tags_json"]
            del md["classes_json"]
            if md.get("created_at"):
                md["created_at"] = md["created_at"].isoformat()
            models_list.append(md)

        cameras_list = []
        for c in cameras:
            cd = c.model_dump()
            if cd.get("created_at"):
                cd["created_at"] = cd["created_at"].isoformat()
            cameras_list.append(cd)

        integrations_list = []
        for i in integrations:
            idict = i.model_dump()
            if idict.get("created_at"):
                idict["created_at"] = idict["created_at"].isoformat()
            integrations_list.append(idict)

    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    clean_name = sanitize_filename(project.name)

    # ── Config-Only JSON Export ──
    if format == "json" and bundle_type == "config_only":
        export_payload = {
            "format": "irivproj_json",
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "project": {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "pipeline": pipeline_data,
                "dashboard_layout": dashboard_data,
                "exposed_data_sources": exposed_sources
            },
            "entities": {
                "models": models_list,
                "cameras": cameras_list,
                "integrations": integrations_list
            }
        }
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        with open(temp_file.name, "w", encoding="utf-8") as f:
            json.dump(export_payload, f, indent=2, ensure_ascii=False)
        filename = f"{clean_name}_config_{timestamp_str}.json"
        return FileResponse(temp_file.name, filename=filename, media_type="application/json")

    # ── Full / Standard .irivproj (ZIP) Export ──
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".irivproj")
    temp_zip.close()

    models_manifest = []
    videos_manifest = []

    with zipfile.ZipFile(temp_zip.name, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. Project definition
        project_def = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "pipeline": pipeline_data,
            "dashboard_layout": dashboard_data,
            "exposed_data_sources": exposed_sources,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "updated_at": project.updated_at.isoformat() if project.updated_at else None
        }
        zf.writestr("project.json", json.dumps(project_def, indent=2, ensure_ascii=False, default=str))

        # 2. Associated entities metadata
        entities_def = {
            "models": models_list,
            "cameras": cameras_list,
            "integrations": integrations_list
        }
        zf.writestr("entities.json", json.dumps(entities_def, indent=2, ensure_ascii=False, default=str))

        # 3. Model binaries (.hef and custom .so)
        if bundle_type == "full":
            for m in models_list:
                hef_fname = m.get("hef_path")
                hef_size = 0
                if hef_fname:
                    hef_file = MODELS_DIR / hef_fname
                    if hef_file.exists() and hef_file.is_file():
                        hef_size = hef_file.stat().st_size
                        zf.write(hef_file, arcname=f"models/{hef_fname}")
                        logger.info(f"Bundled HEF model: {hef_fname} ({hef_size} bytes)")

                so_fname = m.get("so_path")
                if so_fname and (MODELS_DIR / so_fname).exists():
                    so_file = MODELS_DIR / so_fname
                    zf.write(so_file, arcname=f"models/{so_fname}")

                models_manifest.append({
                    "id": m.get("id"),
                    "name": m.get("name"),
                    "task": m.get("task", ""),
                    "hef_file": hef_fname,
                    "original_filename": m.get("original_filename", hef_fname or ""),
                    "file_hash": m.get("file_hash", ""),
                    "version": m.get("version", "v1.0"),
                    "description": m.get("description", ""),
                    "so_file": so_fname,
                    "file_size": hef_size,
                    "classes": m.get("classes", [])
                })

            # 4. Sample video files if camera is file-based and requested
            if include_videos:
                for c in cameras_list:
                    cam_path = c.get("path", "")
                    if cam_path:
                        video_file = None
                        if Path(cam_path).is_file() and Path(cam_path).exists():
                            video_file = Path(cam_path)
                        elif (VIDEOS_DIR / Path(cam_path).name).exists():
                            video_file = VIDEOS_DIR / Path(cam_path).name

                        if video_file and video_file.exists():
                            zf.write(video_file, arcname=f"videos/{video_file.name}")
                            videos_manifest.append({
                                "camera_id": c.get("id"),
                                "filename": video_file.name,
                                "size_bytes": video_file.stat().st_size
                            })
                            logger.info(f"Bundled video: {video_file.name}")

        # 5. Manifest file
        manifest = {
            "format": "irivproj",
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "project_id": project.id,
            "project_name": project.name,
            "description": project.description,
            "bundle_type": bundle_type,
            "nodes_count": len(pipeline_data.get("nodes", [])),
            "node_types": sorted(list(set(n.get("type", "") for n in pipeline_data.get("nodes", [])))),
            "models": models_manifest,
            "cameras": [{"id": c.get("id"), "name": c.get("name"), "type": c.get("type"), "path": c.get("path")} for c in cameras_list],
            "integrations": [{"id": i.get("id"), "name": i.get("name"), "type": i.get("type")} for i in integrations_list],
            "videos": videos_manifest
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False, default=str))

    filename = f"{clean_name}_{bundle_type}_{timestamp_str}.irivproj"
    return FileResponse(
        temp_zip.name,
        filename=filename,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. INSPECT BACKUP PACKAGE (PREVIEW BEFORE IMPORT)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/inspect")
async def inspect_backup_file(package_file: UploadFile = File(...)):
    """
    Inspects an uploaded .irivproj or .json backup package without saving.
    Returns preview summary: project details, models, size, conflict check on this board.
    """
    try:
        content = await package_file.read()
        fname = package_file.filename.lower()

        # Handle JSON format
        if fname.endswith(".json"):
            try:
                data = json.loads(content.decode("utf-8"))
            except Exception as e:
                return {"status": "error", "message": f"Invalid JSON file: {e}"}

            project_info = data.get("project", {})
            pipeline = project_info.get("pipeline", {})
            nodes = pipeline.get("nodes", [])
            entities = data.get("entities", {})
            models = entities.get("models", [])
            cameras = entities.get("cameras", [])

            return _build_inspection_response(
                project_id=project_info.get("id", f"proj_{int(time.time())}"),
                project_name=project_info.get("name", "Imported Project"),
                description=project_info.get("description", ""),
                nodes=nodes,
                models=models,
                cameras=cameras,
                integrations=entities.get("integrations", []),
                bundle_type="config_only",
                models_dir=MODELS_DIR,
                file_size=len(content)
            )

        # Handle ZIP (.irivproj) format
        try:
            zf = zipfile.ZipFile(io.BytesIO(content))
        except Exception as e:
            return {"status": "error", "message": f"Invalid .irivproj or ZIP package: {e}"}

        namelist = zf.namelist()
        manifest_data = {}
        project_data = {}
        entities_data = {}

        if "manifest.json" in namelist:
            try:
                manifest_data = json.loads(zf.read("manifest.json").decode("utf-8"))
            except:
                pass

        if "project.json" in namelist:
            try:
                project_data = json.loads(zf.read("project.json").decode("utf-8"))
            except:
                pass

        if "entities.json" in namelist:
            try:
                entities_data = json.loads(zf.read("entities.json").decode("utf-8"))
            except:
                pass

        pid = manifest_data.get("project_id") or project_data.get("id", f"proj_{int(time.time())}")
        pname = manifest_data.get("project_name") or project_data.get("name", "Imported Project")
        pdesc = manifest_data.get("description") or project_data.get("description", "")
        pipeline = project_data.get("pipeline", {})
        nodes = pipeline.get("nodes", [])
        models = entities_data.get("models", manifest_data.get("models", []))
        cameras = entities_data.get("cameras", manifest_data.get("cameras", []))
        integrations = entities_data.get("integrations", manifest_data.get("integrations", []))

        # Check binary files contained inside zip
        models_in_zip = [n.replace("models/", "") for n in namelist if n.startswith("models/") and not n.endswith("/")]
        videos_in_zip = [n.replace("videos/", "") for n in namelist if n.startswith("videos/") and not n.endswith("/")]

        return _build_inspection_response(
            project_id=pid,
            project_name=pname,
            description=pdesc,
            nodes=nodes,
            models=models,
            cameras=cameras,
            integrations=integrations,
            bundle_type=manifest_data.get("bundle_type", "full" if models_in_zip else "config_only"),
            models_dir=MODELS_DIR,
            file_size=len(content),
            models_in_zip=models_in_zip,
            videos_in_zip=videos_in_zip
        )

    except Exception as e:
        logger.error(f"Error inspecting package: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


def _build_inspection_response(
    project_id: str,
    project_name: str,
    description: str,
    nodes: list,
    models: list,
    cameras: list,
    integrations: list,
    bundle_type: str,
    models_dir: Path,
    file_size: int,
    models_in_zip: list = None,
    videos_in_zip: list = None
) -> dict:
    """Helper to format inspection result and compute target board conflict status."""
    if models_in_zip is None: models_in_zip = []
    if videos_in_zip is None: videos_in_zip = []

    # Check database conflicts on this device
    with Session(db.engine) as session:
        existing_by_id = session.exec(select(Project).where(Project.id == project_id)).first()
        existing_by_name = session.exec(select(Project).where(Project.name == project_name)).first()

    models_preview = []
    for m in models:
        hef_fname = m.get("hef_path") or m.get("hef_file", "")
        exists_on_device = (models_dir / hef_fname).exists() if hef_fname else False
        is_bundled = hef_fname in models_in_zip

        models_preview.append({
            "id": m.get("id"),
            "name": m.get("name"),
            "task": m.get("task", "detection"),
            "hef_file": hef_fname,
            "classes_count": len(m.get("classes", [])),
            "classes": m.get("classes", []),
            "exists_on_device": exists_on_device,
            "is_bundled": is_bundled
        })

    node_types = sorted(list(set(n.get("type", "") for n in nodes if n.get("type"))))

    return {
        "status": "success",
        "project": {
            "id": project_id,
            "name": project_name,
            "description": description,
            "nodes_count": len(nodes),
            "node_types": node_types,
            "bundle_type": bundle_type,
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2)
        },
        "models": models_preview,
        "cameras": [{"id": c.get("id"), "name": c.get("name"), "type": c.get("type"), "path": c.get("path")} for c in cameras],
        "integrations": [{"id": i.get("id"), "name": i.get("name"), "type": i.get("type")} for i in integrations],
        "videos_bundled": videos_in_zip,
        "conflicts": {
            "id_exists": existing_by_id is not None,
            "name_exists": existing_by_name is not None,
            "existing_id_project_name": existing_by_id.name if existing_by_id else None,
            "existing_name_project_id": existing_by_name.id if existing_by_name else None
        }
    }


def str_to_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes", "on")
    return bool(val)

# ─────────────────────────────────────────────────────────────────────────────
# 3. IMPORT / DEPLOY PROJECT PACKAGE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/import")
async def import_project(
    package_file: UploadFile = File(...),
    mode: str = Form("new", description="'new' (create new ID/name) or 'overwrite' (replace existing)"),
    custom_name: Optional[str] = Form(None),
    overwrite_models: Any = Form(False),
    auto_start: Any = Form(False)
):
    """
    Imports and deploys a project into IRIV Vision Studio:
    1. Extracts models (.hef) to backend/models/ safely (preventing zip slip).
    2. Registers AIModel, Camera, and Integration entities in DB.
    3. Saves Project in DB.
    4. Optionally starts pipeline immediately.
    """
    try:
        overwrite_models_bool = str_to_bool(overwrite_models)
        auto_start_bool = str_to_bool(auto_start)

        content = await package_file.read()
        fname = package_file.filename.lower()

        project_data = None
        entities_data = None
        models_to_extract = []
        videos_to_extract = []

        # ── Branch A: Standalone JSON ──
        if fname.endswith(".json"):
            try:
                data = json.loads(content.decode("utf-8"))
            except Exception as e:
                return {"status": "error", "message": f"Invalid JSON content: {e}"}

            project_data = data.get("project", {})
            entities_data = data.get("entities", {})

        # ── Branch B: .irivproj (ZIP) ──
        else:
            try:
                zf = zipfile.ZipFile(io.BytesIO(content))
            except Exception as e:
                return {"status": "error", "message": f"Cannot open ZIP archive: {e}"}

            namelist = zf.namelist()

            if "project.json" not in namelist:
                return {"status": "error", "message": "Missing 'project.json' inside package"}

            project_data = json.loads(zf.read("project.json").decode("utf-8"))

            if "entities.json" in namelist:
                try:
                    entities_data = json.loads(zf.read("entities.json").decode("utf-8"))
                except:
                    entities_data = {}
            else:
                entities_data = {}

            # Extract model binaries safely
            for name in namelist:
                if name.startswith("models/") and not name.endswith("/"):
                    rel_name = name[len("models/"):]
                    # Path traversal check
                    target_file = MODELS_DIR / rel_name
                    if is_safe_extract_path(MODELS_DIR, target_file):
                        zip_info = zf.getinfo(name)
                        # Skip extract if already present with identical file size
                        if target_file.exists() and target_file.stat().st_size == zip_info.file_size and not overwrite_models_bool:
                            logger.info(f"Model file already exists with same size, skipping extract: {target_file.name}")
                            models_to_extract.append(rel_name)
                        elif not target_file.exists() or overwrite_models_bool:
                            tmp_dest = target_file.with_suffix(f".tmp_{int(time.time())}")
                            with open(tmp_dest, "wb") as f_out:
                                f_out.write(zf.read(name))
                            tmp_dest.replace(target_file)
                            models_to_extract.append(rel_name)
                            logger.info(f"Extracted model file: {target_file}")
                    else:
                        logger.warning(f"Prevented unsafe path extraction: {name}")

                elif name.startswith("videos/") and not name.endswith("/"):
                    rel_name = name[len("videos/"):]
                    target_file = VIDEOS_DIR / rel_name
                    if is_safe_extract_path(VIDEOS_DIR, target_file):
                        if not target_file.exists():
                            with open(target_file, "wb") as f_out:
                                f_out.write(zf.read(name))
                            videos_to_extract.append(rel_name)
                            logger.info(f"Extracted sample video: {target_file}")


        if not project_data:
            return {"status": "error", "message": "No valid project data found to import"}

        orig_id = project_data.get("id", f"proj_{int(time.time()*1000)}")
        orig_name = project_data.get("name", "Imported Project")

        with Session(db.engine) as session:
            existing_projects = session.exec(select(Project)).all()
            existing_ids = {p.id for p in existing_projects}
            existing_names = {p.name for p in existing_projects}

            if mode == "new":
                # Generate new unique ID
                final_id = f"proj_{int(time.time()*1000)}"
                # Resolve name
                if custom_name and custom_name.strip():
                    final_name = custom_name.strip()
                elif orig_name in existing_names:
                    final_name = f"{orig_name} (Imported)"
                else:
                    final_name = orig_name
            else:
                # Overwrite mode
                final_id = orig_id
                final_name = custom_name.strip() if (custom_name and custom_name.strip()) else orig_name

            # 1. Upsert Entities (AIModel, Camera, Integration)
            if entities_data:
                # Models
                for m in entities_data.get("models", []):
                    mid = m.get("id")
                    if not mid: continue
                    tags_str = json.dumps(m.get("tags", []))
                    classes_str = json.dumps(m.get("classes", []))
                    existing_m = session.exec(select(AIModel).where(AIModel.id == mid)).first()
                    if existing_m:
                        existing_m.name = m.get("name", existing_m.name)
                        existing_m.task = m.get("task", existing_m.task)
                        existing_m.hef_path = m.get("hef_path", existing_m.hef_path)
                        existing_m.original_filename = m.get("original_filename", getattr(existing_m, "original_filename", "") or "")
                        existing_m.file_hash = m.get("file_hash", getattr(existing_m, "file_hash", "") or "")
                        existing_m.file_size = m.get("file_size", getattr(existing_m, "file_size", 0) or 0)
                        existing_m.version = m.get("version", getattr(existing_m, "version", "v1.0") or "v1.0")
                        existing_m.description = m.get("description", getattr(existing_m, "description", "") or "")
                        existing_m.so_path = m.get("so_path", existing_m.so_path)
                        existing_m.tags_json = tags_str
                        existing_m.classes_json = classes_str
                        session.add(existing_m)
                    else:
                        session.add(AIModel(
                            id=mid,
                            name=m.get("name", mid),
                            type=m.get("type", "model"),
                            hardware=m.get("hardware", ""),
                            hef_path=m.get("hef_path", ""),
                            original_filename=m.get("original_filename", ""),
                            file_hash=m.get("file_hash", ""),
                            file_size=m.get("file_size", 0),
                            version=m.get("version", "v1.0"),
                            description=m.get("description", ""),
                            so_path=m.get("so_path", ""),
                            task=m.get("task", "detection"),
                            tags_json=tags_str,
                            classes_json=classes_str
                        ))

                # Cameras
                for c in entities_data.get("cameras", []):
                    cid = c.get("id")
                    if not cid: continue
                    existing_c = session.exec(select(Camera).where(Camera.id == cid)).first()
                    if existing_c:
                        existing_c.name = c.get("name", existing_c.name)
                        existing_c.type = c.get("type", existing_c.type)
                        existing_c.path = c.get("path", existing_c.path)
                        existing_c.is_enabled = c.get("is_enabled", existing_c.is_enabled)
                        session.add(existing_c)
                    else:
                        session.add(Camera(
                            id=cid,
                            name=c.get("name", cid),
                            type=c.get("type", "rtsp"),
                            path=c.get("path", ""),
                            is_enabled=c.get("is_enabled", True)
                        ))

                # Integrations
                for i in entities_data.get("integrations", []):
                    iid = i.get("id")
                    if not iid: continue
                    existing_i = session.exec(select(Integration).where(Integration.id == iid)).first()
                    if existing_i:
                        existing_i.name = i.get("name", existing_i.name)
                        existing_i.type = i.get("type", existing_i.type)
                        existing_i.target = i.get("target", existing_i.target)
                        session.add(existing_i)
                    else:
                        session.add(Integration(
                            id=iid,
                            name=i.get("name", iid),
                            type=i.get("type", ""),
                            target=i.get("target", "")
                        ))

            # 2. Upsert Project
            pipe_json = json.dumps(project_data.get("pipeline", {"nodes": [], "edges": []}))
            dash_json = json.dumps(project_data.get("dashboard_layout", {}))
            ds_json = json.dumps(project_data.get("exposed_data_sources", []))
            now = datetime.utcnow()

            target_proj = session.exec(select(Project).where(Project.id == final_id)).first()
            if target_proj:
                target_proj.name = final_name
                target_proj.description = project_data.get("description", "")
                target_proj.pipeline_json = pipe_json
                target_proj.dashboard_layout_json = dash_json
                target_proj.exposed_data_sources_json = ds_json
                target_proj.is_running = False
                target_proj.updated_at = now
                session.add(target_proj)
            else:
                session.add(Project(
                    id=final_id,
                    name=final_name,
                    description=project_data.get("description", ""),
                    pipeline_json=pipe_json,
                    dashboard_layout_json=dash_json,
                    exposed_data_sources_json=ds_json,
                    is_running=False,
                    created_at=now,
                    updated_at=now
                ))

            session.commit()

        # 3. Optional Auto Start
        if auto_start_bool:
            try:
                from .main import start_project as run_start_project
                await run_start_project(final_id)
            except Exception as se:
                logger.error(f"Failed to auto-start pipeline {final_id}: {se}")

        return {
            "status": "success",
            "message": f"Project '{final_name}' successfully imported and ready!",
            "project_id": final_id,
            "project_name": final_name,
            "models_installed": len(models_to_extract),
            "videos_installed": len(videos_to_extract)
        }

    except Exception as e:
        logger.error(f"Error importing project: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# 4. EXPORT ALL PROJECTS (MASTER ARCHIVE)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/export-all")
async def export_all_projects(include_models: bool = Query(False, description="Bundle all HEF model files")):
    """
    Exports all projects and complete entity definitions as a single master archive.
    """
    with Session(db.engine) as session:
        projects = session.exec(select(Project)).all()
        models = session.exec(select(AIModel)).all()
        cameras = session.exec(select(Camera)).all()
        integrations = session.exec(select(Integration)).all()

        if not projects:
            raise HTTPException(status_code=404, detail="No projects to export")

        projects_list = []
        for p in projects:
            pd = p.model_dump()
            try: pd["pipeline"] = json.loads(pd["pipeline_json"])
            except: pd["pipeline"] = {"nodes": [], "edges": []}
            try: pd["dashboard_layout"] = json.loads(pd["dashboard_layout_json"])
            except: pd["dashboard_layout"] = {}
            try: pd["exposed_data_sources"] = json.loads(pd["exposed_data_sources_json"])
            except: pd["exposed_data_sources"] = []
            del pd["pipeline_json"]
            del pd["dashboard_layout_json"]
            del pd["exposed_data_sources_json"]
            pd["created_at"] = pd["created_at"].isoformat() if pd.get("created_at") else None
            pd["updated_at"] = pd["updated_at"].isoformat() if pd.get("updated_at") else None
            projects_list.append(pd)

        models_list = []
        for m in models:
            md = m.model_dump()
            try: md["tags"] = json.loads(md["tags_json"])
            except: md["tags"] = []
            try: md["classes"] = json.loads(md["classes_json"])
            except: md["classes"] = []
            del md["tags_json"]
            del md["classes_json"]
            md["created_at"] = md["created_at"].isoformat() if md.get("created_at") else None
            models_list.append(md)

        cameras_list = []
        for c in cameras:
            cd = c.model_dump()
            cd["created_at"] = cd["created_at"].isoformat() if cd.get("created_at") else None
            cameras_list.append(cd)

        integrations_list = []
        for i in integrations:
            idict = i.model_dump()
            idict["created_at"] = idict["created_at"].isoformat() if idict.get("created_at") else None
            integrations_list.append(idict)

    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_zip.close()

    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    with zipfile.ZipFile(temp_zip.name, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "format": "iriv_all_projects",
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "projects_count": len(projects_list),
            "include_models": include_models
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        zf.writestr("projects.json", json.dumps(projects_list, indent=2, ensure_ascii=False))
        zf.writestr("entities.json", json.dumps({
            "models": models_list,
            "cameras": cameras_list,
            "integrations": integrations_list
        }, indent=2, ensure_ascii=False))

        if include_models:
            for m in models_list:
                hef_fname = m.get("hef_path")
                if hef_fname and (MODELS_DIR / hef_fname).exists():
                    zf.write(MODELS_DIR / hef_fname, arcname=f"models/{hef_fname}")

    filename = f"iriv_all_projects_{timestamp_str}.zip"
    return FileResponse(
        temp_zip.name,
        filename=filename,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. LOCAL SNAPSHOTS & RECOVERY (/home/pi/iriv-backups/projects/)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/snapshots")
async def list_local_snapshots():
    """Lists local project snapshots on the board."""
    snapshots = []
    if SNAPSHOT_DIR.exists():
        for f in sorted(SNAPSHOT_DIR.glob("*.irivsnap"), key=os.path.getmtime, reverse=True):
            stat = f.stat()
            # Read header
            proj_count = 0
            try:
                with zipfile.ZipFile(f, 'r') as zf:
                    if "manifest.json" in zf.namelist():
                        m = json.loads(zf.read("manifest.json").decode('utf-8'))
                        proj_count = m.get("projects_count", 0)
            except:
                pass

            snapshots.append({
                "filename": f.name,
                "size_bytes": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "projects_count": proj_count
            })
    return {"status": "success", "snapshots": snapshots}


@router.post("/snapshots/create")
async def create_local_snapshot(name: Optional[str] = Form(None)):
    """Creates an instant local snapshot of all projects and entities on the board."""
    try:
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        clean_tag = sanitize_filename(name) if name else "manual"
        snapshot_filename = f"snapshot_{clean_tag}_{timestamp_str}.irivsnap"
        target_path = SNAPSHOT_DIR / snapshot_filename

        with Session(db.engine) as session:
            projects = session.exec(select(Project)).all()
            models = session.exec(select(AIModel)).all()
            cameras = session.exec(select(Camera)).all()
            integrations = session.exec(select(Integration)).all()

            projects_list = [p.model_dump() for p in projects]
            models_list = [m.model_dump() for m in models]
            cameras_list = [c.model_dump() for c in cameras]
            integrations_list = [i.model_dump() for i in integrations]

        with zipfile.ZipFile(target_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            manifest = {
                "format": "iriv_local_snapshot",
                "version": "1.0",
                "tag": name or "manual",
                "created_at": datetime.utcnow().isoformat(),
                "projects_count": len(projects_list)
            }
            zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
            zf.writestr("projects.json", json.dumps(projects_list, default=str, indent=2))
            zf.writestr("entities.json", json.dumps({
                "models": models_list,
                "cameras": cameras_list,
                "integrations": integrations_list
            }, default=str, indent=2))

        # Rotate: keep last 10 snapshots
        all_snaps = sorted(SNAPSHOT_DIR.glob("*.irivsnap"), key=os.path.getmtime)
        while len(all_snaps) > 10:
            oldest = all_snaps.pop(0)
            try: oldest.unlink()
            except: pass

        return {
            "status": "success",
            "message": f"Snapshot created: {snapshot_filename}",
            "filename": snapshot_filename,
            "projects_count": len(projects_list)
        }
    except Exception as e:
        logger.error(f"Failed to create snapshot: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@router.post("/snapshots/restore/{filename}")
async def restore_local_snapshot(filename: str):
    """Restores projects and entities from a local snapshot file."""
    try:
        target_file = SNAPSHOT_DIR / filename
        if not target_file.exists() or not is_safe_extract_path(SNAPSHOT_DIR, target_file):
            return {"status": "error", "message": "Snapshot file not found"}

        with zipfile.ZipFile(target_file, "r") as zf:
            projects_data = json.loads(zf.read("projects.json").decode("utf-8"))
            entities_data = json.loads(zf.read("entities.json").decode("utf-8"))

        with Session(db.engine) as session:
            # Restore projects
            for p in projects_data:
                pid = p.get("id")
                if not pid: continue
                existing = session.exec(select(Project).where(Project.id == pid)).first()
                if existing:
                    existing.name = p.get("name", existing.name)
                    existing.description = p.get("description", existing.description)
                    existing.pipeline_json = p.get("pipeline_json", existing.pipeline_json)
                    existing.dashboard_layout_json = p.get("dashboard_layout_json", existing.dashboard_layout_json)
                    existing.exposed_data_sources_json = p.get("exposed_data_sources_json", existing.exposed_data_sources_json)
                    existing.updated_at = datetime.utcnow()
                    session.add(existing)
                else:
                    session.add(Project(
                        id=pid,
                        name=p.get("name", pid),
                        description=p.get("description", ""),
                        pipeline_json=p.get("pipeline_json", "{}"),
                        dashboard_layout_json=p.get("dashboard_layout_json", "{}"),
                        exposed_data_sources_json=p.get("exposed_data_sources_json", "[]"),
                        is_running=False,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    ))
            session.commit()

        return {"status": "success", "message": f"Successfully restored {len(projects_data)} projects from {filename}"}
    except Exception as e:
        logger.error(f"Failed to restore snapshot: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
