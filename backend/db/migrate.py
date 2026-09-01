import json
import logging
import shutil
from pathlib import Path
from sqlmodel import Session, select
from .database import db
from .models import Project, Camera, AIModel, Integration

logger = logging.getLogger("ai_engine")
logging.basicConfig(level=logging.INFO)

def migrate_data():
    base_dir = Path(__file__).resolve().parent
    projects_file = base_dir / "projects.json"
    entities_file = base_dir / "entities.json"
    
    with Session(db.engine) as session:
        # Migrate Projects
        if projects_file.exists():
            try:
                with open(projects_file, 'r') as f:
                    projects = json.load(f)
                
                logger.info(f"Migrating {len(projects)} projects...")
                for p in projects:
                    # Check if exists
                    existing = session.exec(select(Project).where(Project.id == p['id'])).first()
                    if not existing:
                        proj = Project(
                            id=p['id'],
                            name=p['name'],
                            description=p.get('description', ''),
                            pipeline_json=json.dumps(p.get('pipeline', {})),
                            dashboard_layout_json=json.dumps(p.get('dashboard_layout', {})),
                            exposed_data_sources_json=json.dumps(p.get('exposed_data_sources', []))
                        )
                        session.add(proj)
                session.commit()
                logger.info("Project migration successful.")
                
                # Backup projects.json
                shutil.move(projects_file, base_dir / "projects.json.backup")
            except Exception as e:
                logger.error(f"Error migrating projects: {e}")
                session.rollback()
                
        # Migrate Entities
        if entities_file.exists():
            try:
                with open(entities_file, 'r') as f:
                    entities = json.load(f)
                
                # Cameras
                cameras = entities.get('cameras', [])
                logger.info(f"Migrating {len(cameras)} cameras...")
                for c in cameras:
                    existing = session.exec(select(Camera).where(Camera.id == c['id'])).first()
                    if not existing:
                        cam = Camera(
                            id=c['id'],
                            name=c['name'],
                            type=c.get('type', ''),
                            path=c.get('path', '')
                        )
                        session.add(cam)
                        
                # AI Models
                models = entities.get('models', [])
                logger.info(f"Migrating {len(models)} models...")
                for m in models:
                    existing = session.exec(select(AIModel).where(AIModel.id == m['id'])).first()
                    if not existing:
                        aimodel = AIModel(
                            id=m['id'],
                            name=m['name'],
                            type=m.get('type', 'model'),
                            hardware=m.get('hardware', ''),
                            hef_path=m.get('hef_path', ''),
                            so_path=m.get('so_path', ''),
                            task=m.get('task', ''),
                            tags_json=json.dumps(m.get('tags', [])),
                            classes_json=json.dumps(m.get('classes', []))
                        )
                        session.add(aimodel)
                        
                # Integrations
                integrations = entities.get('integrations', [])
                logger.info(f"Migrating {len(integrations)} integrations...")
                for i in integrations:
                    existing = session.exec(select(Integration).where(Integration.id == i['id'])).first()
                    if not existing:
                        integ = Integration(
                            id=i['id'],
                            name=i['name'],
                            type=i.get('type', ''),
                            target=i.get('target', '')
                        )
                        session.add(integ)
                        
                session.commit()
                logger.info("Entities migration successful.")
                
                # Backup entities.json
                shutil.move(entities_file, base_dir / "entities.json.backup")
            except Exception as e:
                logger.error(f"Error migrating entities: {e}")
                session.rollback()
                
if __name__ == "__main__":
    migrate_data()
