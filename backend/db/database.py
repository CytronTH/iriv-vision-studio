import json
import logging
from pathlib import Path
from queue import Queue
import threading
import time
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
# Import models to ensure they are registered with SQLModel before create_all
from .models import *

logger = logging.getLogger("ai_engine")

class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            base_dir = Path(__file__).resolve().parent
            db_path = str(base_dir / "vision_studio.sqlite")
        
        self.db_path = db_path
        # sqlite:/// requires an absolute path or relative, 
        # using absolute path here
        sqlite_url = f"sqlite:///{self.db_path}"
        
        connect_args = {"check_same_thread": False}
        self.engine = create_engine(sqlite_url, connect_args=connect_args)
        
        self._init_db()
        
        self.log_queue = Queue()
        self.running = True
        self.writer_thread = threading.Thread(target=self._background_writer, daemon=True)
        self.writer_thread.start()
        
    def _init_db(self):
        try:
            # Create all tables (this is safe to call multiple times)
            SQLModel.metadata.create_all(self.engine)
            logger.info(f"Database initialized successfully at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            
    def get_session(self) -> Generator[Session, None, None]:
        """Provides a database session for FastAPI dependencies."""
        with Session(self.engine) as session:
            yield session
            
    def _background_writer(self):
        """Background thread for high-frequency logs to avoid locking main threads."""
        while self.running:
            try:
                # Wait for logs to process
                log_entry = self.log_queue.get(timeout=1.0)
                if log_entry is None:
                    break
                    
                with Session(self.engine) as session:
                    try:
                        if log_entry['table'] == 'event_logs':
                            event = EventLog(
                                node_id=log_entry.get('node_id'),
                                event_type=log_entry.get('event_type'),
                                payload=json.dumps(log_entry.get('payload')) if log_entry.get('payload') else None,
                                camera_id=log_entry.get('camera_id'),
                                snapshot_path=log_entry.get('snapshot_path')
                            )
                            session.add(event)
                        elif log_entry['table'] == 'system_metrics':
                            metric = SystemMetric(
                                cpu_percent=log_entry.get('cpu_percent'),
                                ram_percent=log_entry.get('ram_percent'),
                                temp_c=log_entry.get('temp_c')
                            )
                            session.add(metric)
                        session.commit()
                    except Exception as e:
                        logger.error(f"Error writing to database: {e}")
                
                self.log_queue.task_done()
            except Exception:
                # Timeout on queue, loop continues
                pass

    def log_event(self, node_id: str, event_type: str, payload: dict, camera_id: str = None, snapshot_path: str = None):
        self.log_queue.put({
            'table': 'event_logs',
            'node_id': node_id,
            'event_type': event_type,
            'payload': payload,
            'camera_id': camera_id,
            'snapshot_path': snapshot_path
        })
        
    def log_metric(self, cpu_percent: float, ram_percent: float, temp_c: float):
        self.log_queue.put({
            'table': 'system_metrics',
            'cpu_percent': cpu_percent,
            'ram_percent': ram_percent,
            'temp_c': temp_c
        })
        
    def get_logs(self, limit: int = 100, node_id: str = None, event_type: str = None, camera_id: str = None, page: int = 1):
        """Helper to get raw dict logs for backwards compatibility, with pagination and filters."""
        from sqlmodel import select, func
        with Session(self.engine) as session:
            statement = select(EventLog)
            count_statement = select(func.count(EventLog.id))
            
            if node_id:
                statement = statement.where(EventLog.node_id == node_id)
                count_statement = count_statement.where(EventLog.node_id == node_id)
            if event_type:
                statement = statement.where(EventLog.event_type == event_type)
                count_statement = count_statement.where(EventLog.event_type == event_type)
            if camera_id:
                statement = statement.where(EventLog.camera_id == camera_id)
                count_statement = count_statement.where(EventLog.camera_id == camera_id)
                
            total = session.exec(count_statement).one()
            
            offset = (page - 1) * limit
            statement = statement.order_by(EventLog.timestamp.desc()).offset(offset).limit(limit)
            
            results = session.exec(statement).all()
            
            out = []
            for r in results:
                d = r.model_dump()
                if d.get('payload'):
                    try:
                        d['payload'] = json.loads(d['payload'])
                    except:
                        pass
                # ensure timestamp is string for old API clients if necessary
                if d.get('timestamp'):
                    d['timestamp'] = d['timestamp'].isoformat()
                out.append(d)
            return {"data": out, "total": total, "page": page, "limit": limit}
        
    def stop(self):
        self.running = False
        self.log_queue.put(None)
        self.writer_thread.join(timeout=2.0)

# Global instance
db = DatabaseManager()
