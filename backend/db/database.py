import json
import logging
from pathlib import Path
from queue import Queue, Full
import threading
import time
from datetime import datetime, timedelta
from typing import Generator, List, Dict, Any, Optional
from sqlalchemy import event, text
from sqlmodel import SQLModel, create_engine, Session, select, func, delete
# Import models to ensure they are registered with SQLModel before create_all
from .models import *

logger = logging.getLogger("ai_engine")

class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            base_dir = Path(__file__).resolve().parent
            db_path = str(base_dir / "vision_studio.sqlite")
        
        self.db_path = db_path
        sqlite_url = f"sqlite:///{self.db_path}"
        
        connect_args = {"check_same_thread": False}
        self.engine = create_engine(sqlite_url, connect_args=connect_args)
        
        # Configure SQLite Pragmas for performance and concurrency resilience
        @event.listens_for(self.engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA busy_timeout=5000;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()
        
        self._init_db()
        
        # Bounded queue to avoid Out-Of-Memory (OOM) on Raspberry Pi
        self.log_queue = Queue(maxsize=10000)
        self.running = True
        self.writer_thread = threading.Thread(target=self._background_writer, daemon=True)
        self.writer_thread.start()
        
    def _init_db(self):
        try:
            # Create all tables (safe to call multiple times)
            SQLModel.metadata.create_all(self.engine)
            
            # Ensure indexes are explicitly created for existing tables
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_camera_id ON event_logs(camera_id);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_node_id ON event_logs(node_id);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_type_time ON event_logs(event_type, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_cam_time ON event_logs(camera_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_node_time ON event_logs(node_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);",
            ]
            with self.engine.connect() as conn:
                for idx_sql in indexes:
                    conn.execute(text(idx_sql))
                conn.commit()
                
            logger.info(f"Database initialized successfully with indexes at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            
    def get_session(self) -> Generator[Session, None, None]:
        """Provides a database session for FastAPI dependencies."""
        with Session(self.engine) as session:
            yield session
            
    def _background_writer(self):
        """Background thread for high-frequency logs using batch commits to minimize disk I/O."""
        batch_size = 50
        batch_timeout = 0.5  # seconds
        
        while self.running:
            entries = []
            start_time = time.time()
            
            # Collect items up to batch_size or until batch_timeout expires
            while len(entries) < batch_size and (time.time() - start_time) < batch_timeout:
                try:
                    remaining_timeout = max(0.05, batch_timeout - (time.time() - start_time))
                    entry = self.log_queue.get(timeout=remaining_timeout)
                    if entry is None:
                        # Termination signal received
                        break
                    entries.append(entry)
                except Exception:
                    # Timeout on log_queue.get, break out to commit whatever collected
                    break
                    
            if not entries:
                continue
                
            with Session(self.engine) as session:
                try:
                    for log_entry in entries:
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
                    session.rollback()
                    logger.error(f"Error writing batch to database ({len(entries)} items): {e}")
                finally:
                    for _ in entries:
                        self.log_queue.task_done()

    def log_event(self, node_id: str, event_type: str, payload: dict, camera_id: str = None, snapshot_path: str = None):
        try:
            self.log_queue.put_nowait({
                'table': 'event_logs',
                'node_id': node_id,
                'event_type': event_type,
                'payload': payload,
                'camera_id': camera_id,
                'snapshot_path': snapshot_path
            })
        except Full:
            logger.warning("Database log_queue is full (max 10000). Dropping log event to prevent memory exhaustion.")
        
    def log_metric(self, cpu_percent: float, ram_percent: float, temp_c: float):
        try:
            self.log_queue.put_nowait({
                'table': 'system_metrics',
                'cpu_percent': cpu_percent,
                'ram_percent': ram_percent,
                'temp_c': temp_c
            })
        except Full:
            logger.warning("Database log_queue is full (max 10000). Dropping metric to prevent memory exhaustion.")
        
    def get_logs(self, limit: int = 100, node_id: str = None, event_type: str = None, camera_id: str = None, page: int = 1):
        """Helper to get raw dict logs for backwards compatibility, with pagination and filters."""
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
                if d.get('timestamp'):
                    d['timestamp'] = d['timestamp'].isoformat()
                out.append(d)
            return {"data": out, "total": total, "page": page, "limit": limit}

    def purge_old_logs(self, days: int = 30, max_records: int = 50000, delete_files: bool = True) -> Dict[str, Any]:
        """
        Cleans up old logs and optional snapshot image files to prevent disk bloat.
        1. Removes logs older than `days`.
        2. If record count still exceeds `max_records`, trims oldest records to reach `max_records`.
        3. If `delete_files` is True, deletes matching snapshot image files from disk.
        """
        deleted_rows = 0
        deleted_files = 0
        errors = []

        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        with Session(self.engine) as session:
            try:
                total_count = session.exec(select(func.count(EventLog.id))).one()
                
                # Query IDs to delete by age
                old_logs_stmt = select(EventLog.id, EventLog.snapshot_path).where(EventLog.timestamp < cutoff_date)
                old_logs = session.exec(old_logs_stmt).all()
                
                ids_to_delete = {log_id for log_id, _ in old_logs}
                files_to_delete = [snap for _, snap in old_logs if snap]
                
                # Check if count after age purge still exceeds max_records
                remaining_count = total_count - len(ids_to_delete)
                if remaining_count > max_records:
                    overflow = remaining_count - max_records
                    excess_stmt = (
                        select(EventLog.id, EventLog.snapshot_path)
                        .where(EventLog.id.not_in(ids_to_delete) if ids_to_delete else True)
                        .order_by(EventLog.timestamp.asc())
                        .limit(overflow)
                    )
                    excess_logs = session.exec(excess_stmt).all()
                    for eid, snap in excess_logs:
                        ids_to_delete.add(eid)
                        if snap:
                            files_to_delete.append(snap)
                            
                if ids_to_delete:
                    # Delete snapshot files from disk
                    if delete_files:
                        for fpath_str in files_to_delete:
                            try:
                                fpath = Path(fpath_str)
                                if fpath.is_file() and fpath.exists():
                                    fpath.unlink()
                                    deleted_files += 1
                            except Exception as fe:
                                errors.append(f"Failed to delete {fpath_str}: {fe}")
                                
                    # Delete rows in chunks to prevent locking SQLite
                    id_list = list(ids_to_delete)
                    chunk_size = 500
                    for i in range(0, len(id_list), chunk_size):
                        chunk = id_list[i:i + chunk_size]
                        del_stmt = delete(EventLog).where(EventLog.id.in_(chunk))
                        session.exec(del_stmt)
                        session.commit()
                        deleted_rows += len(chunk)
                        
                logger.info(f"Purged {deleted_rows} logs and {deleted_files} snapshot files.")
            except Exception as e:
                session.rollback()
                logger.error(f"Error during purge_old_logs: {e}")
                errors.append(str(e))
                
        return {
            "deleted_rows": deleted_rows,
            "deleted_files": deleted_files,
            "errors": errors
        }

    def get_db_stats(self) -> Dict[str, Any]:
        """Returns database size, record counts, and snapshot disk usage."""
        stats = {}
        try:
            db_file = Path(self.db_path)
            stats["db_file_size_bytes"] = db_file.stat().st_size if db_file.exists() else 0
            stats["db_file_size_mb"] = round(stats["db_file_size_bytes"] / (1024 * 1024), 2)
            
            wal_file = Path(f"{self.db_path}-wal")
            stats["wal_file_size_bytes"] = wal_file.stat().st_size if wal_file.exists() else 0
            stats["wal_file_size_mb"] = round(stats["wal_file_size_bytes"] / (1024 * 1024), 2)

            with Session(self.engine) as session:
                stats["total_event_logs"] = session.exec(select(func.count(EventLog.id))).one()
                stats["total_projects"] = session.exec(select(func.count(Project.id))).one()
                stats["total_cameras"] = session.exec(select(func.count(Camera.id))).one()
                stats["total_models"] = session.exec(select(func.count(AIModel.id))).one()
                stats["total_metrics"] = session.exec(select(func.count(SystemMetric.id))).one()
                
            snapshot_dir = Path("/home/pi/iriv-vision-studio/snapshots")
            snap_count = 0
            snap_size = 0
            if snapshot_dir.exists() and snapshot_dir.is_dir():
                for f in snapshot_dir.iterdir():
                    if f.is_file():
                        snap_count += 1
                        snap_size += f.stat().st_size
                        
            stats["snapshot_count"] = snap_count
            stats["snapshot_size_bytes"] = snap_size
            stats["snapshot_size_mb"] = round(snap_size / (1024 * 1024), 2)
            
        except Exception as e:
            logger.error(f"Error getting DB stats: {e}")
            stats["error"] = str(e)
            
        return stats

    def stop(self):
        self.running = False
        self.log_queue.put(None)
        self.writer_thread.join(timeout=3.0)

# Global instance
db = DatabaseManager()
