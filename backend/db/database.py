import json
import logging
from pathlib import Path
from queue import Queue, Full
import threading
import time
from datetime import datetime, timedelta
from typing import Generator, List, Dict, Any, Optional
from sqlalchemy import event, text
import hashlib
import shutil
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
        self._reconcile_existing_models()
        
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
                "CREATE INDEX IF NOT EXISTS idx_class_count_time ON class_count_summary(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_class_count_proj_time ON class_count_summary(project_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_class_count_class ON class_count_summary(class_name, timestamp DESC);",
            ]
            with self.engine.connect() as conn:
                for idx_sql in indexes:
                    conn.execute(text(idx_sql))
                conn.commit()
                
                # Schema migrations for newly added columns
                try:
                    conn.execute(text("ALTER TABLE camera ADD COLUMN is_enabled BOOLEAN DEFAULT 1;"))
                    conn.commit()
                except Exception:
                    pass  # Column already exists

                # AIModel schema migrations
                for col_sql in [
                    "ALTER TABLE aimodel ADD COLUMN original_filename VARCHAR DEFAULT '';",
                    "ALTER TABLE aimodel ADD COLUMN file_hash VARCHAR DEFAULT '';",
                    "ALTER TABLE aimodel ADD COLUMN file_size INTEGER DEFAULT 0;",
                    "ALTER TABLE aimodel ADD COLUMN version VARCHAR DEFAULT 'v1.0';",
                    "ALTER TABLE aimodel ADD COLUMN description VARCHAR DEFAULT '';",
                ]:
                    try:
                        conn.execute(text(col_sql))
                        conn.commit()
                    except Exception:
                        pass
                
            logger.info(f"Database initialized successfully with indexes at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")

    def _reconcile_existing_models(self):
        """Populate missing metadata (hash, size, version) for existing models and resolve file collisions."""
        try:
            models_dir = Path(__file__).resolve().parent.parent / "models"
            with Session(self.engine) as session:
                models = session.exec(select(AIModel)).all()
                modified = False
                for m in models:
                    needs_update = False
                    if not m.original_filename:
                        m.original_filename = Path(m.hef_path).name if m.hef_path else ""
                        needs_update = True
                    if not m.version:
                        m.version = "v1.0"
                        needs_update = True
                    
                    # Specific resolution for known collision: Gallon Detector (model_1788861629)
                    if m.id == "model_1788861629" and m.hef_path == "best.hef":
                        src_best = models_dir / "best.hef"
                        dest_best = models_dir / "model_1788861629_best.hef"
                        if src_best.exists() and not dest_best.exists():
                            shutil.copy2(src_best, dest_best)
                            logger.info(f"Copied Gallon Detector model from {src_best} to {dest_best}")
                        m.hef_path = "model_1788861629_best.hef"
                        needs_update = True

                    # Calculate hash and size if file exists on disk
                    if m.hef_path:
                        file_path = models_dir / m.hef_path
                        if file_path.exists() and file_path.is_file():
                            if not m.file_size or m.file_size == 0:
                                m.file_size = file_path.stat().st_size
                                needs_update = True
                            if not m.file_hash:
                                h = hashlib.sha256()
                                with open(file_path, "rb") as f:
                                    while chunk := f.read(65536):
                                        h.update(chunk)
                                m.file_hash = h.hexdigest()
                                needs_update = True
                    
                    if needs_update:
                        session.add(m)
                        modified = True
                
                if modified:
                    session.commit()
                    logger.info("AIModel reconciliation and metadata population completed.")
        except Exception as e:
            logger.warning(f"Failed to reconcile existing models: {e}")
            
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
                                project_id=log_entry.get('project_id'),
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
                        elif log_entry['table'] == 'class_count_summary':
                            summary = ClassCountSummary(
                                timestamp=log_entry.get('timestamp') or datetime.utcnow(),
                                project_id=log_entry.get('project_id', 'default'),
                                camera_id=log_entry.get('camera_id'),
                                node_id=log_entry.get('node_id'),
                                class_name=log_entry.get('class_name'),
                                count=log_entry.get('count', 0),
                                cumulative_total=log_entry.get('cumulative_total', 0)
                            )
                            session.add(summary)
                    session.commit()
                except Exception as e:
                    session.rollback()
                    logger.error(f"Error writing batch to database ({len(entries)} items): {e}")
                finally:
                    for _ in entries:
                        self.log_queue.task_done()

    def log_event(self, node_id: str, event_type: str, payload: dict, camera_id: str = None, snapshot_path: str = None, project_id: str = None):
        try:
            self.log_queue.put_nowait({
                'table': 'event_logs',
                'node_id': node_id,
                'project_id': project_id,
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
        
    def get_logs(self, limit: int = 100, node_id: str = None, event_type: str = None, camera_id: str = None, page: int = 1, project_id: str = None):
        """Helper to get raw dict logs for backwards compatibility, with pagination and filters."""
        with Session(self.engine) as session:
            statement = select(EventLog)
            count_statement = select(func.count(EventLog.id))
            
            if project_id:
                statement = statement.where(EventLog.project_id == project_id)
                count_statement = count_statement.where(EventLog.project_id == project_id)
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

    def get_db_stats(self, project_id: str = None) -> Dict[str, Any]:
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
                if project_id:
                    stats["total_event_logs"] = session.exec(select(func.count(EventLog.id)).where(EventLog.project_id == project_id)).one()
                else:
                    stats["total_event_logs"] = session.exec(select(func.count(EventLog.id))).one()
                    stats["total_projects"] = session.exec(select(func.count(Project.id))).one()
                    stats["total_cameras"] = session.exec(select(func.count(Camera.id))).one()
                    stats["total_models"] = session.exec(select(func.count(AIModel.id))).one()
                    stats["total_metrics"] = session.exec(select(func.count(SystemMetric.id))).one()
                    stats["total_class_counts"] = session.exec(select(func.count(ClassCountSummary.id))).one()
                
            snap_count = 0
            snap_size = 0
            
            if project_id:
                with Session(self.engine) as session:
                    snapshot_paths = session.exec(select(EventLog.snapshot_path).where(EventLog.project_id == project_id, EventLog.snapshot_path != None)).all()
                    for p in snapshot_paths:
                        f = Path(p)
                        if f.exists() and f.is_file():
                            snap_count += 1
                            snap_size += f.stat().st_size
            else:
                snapshot_dir = Path("/home/pi/iriv-vision-studio/snapshots")
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

    def log_class_count(self, project_id: str, camera_id: str, node_id: str, class_counts: dict, cumulative_totals: dict, timestamp: datetime = None):
        if timestamp is None:
            timestamp = datetime.utcnow().replace(second=0, microsecond=0)
        for cls, count in class_counts.items():
            if count > 0 or cumulative_totals.get(cls, 0) > 0:
                try:
                    self.log_queue.put_nowait({
                        'table': 'class_count_summary',
                        'timestamp': timestamp,
                        'project_id': project_id,
                        'camera_id': camera_id,
                        'node_id': node_id,
                        'class_name': cls,
                        'count': count,
                        'cumulative_total': cumulative_totals.get(cls, 0)
                    })
                except Full:
                    logger.warning("Database log_queue full, dropping class count log")

    def get_class_count_history(self, project_id: str = "default", camera_id: str = None, start_time: str = None, end_time: str = None, interval: str = "hour") -> dict:
        """
        Query time-aggregated class counts for charts.
        interval can be: 'minute' (1-min), 'hour' (hourly), 'day' (daily).
        """
        fmt = '%Y-%m-%d %H:00:00'
        if interval == 'minute':
            fmt = '%Y-%m-%d %H:%M:00'
        elif interval == 'day':
            fmt = '%Y-%m-%d'

        with Session(self.engine) as session:
            filters = ["project_id = :project_id"]
            params = {"project_id": project_id}

            if camera_id:
                filters.append("camera_id = :camera_id")
                params["camera_id"] = camera_id

            if start_time:
                filters.append("timestamp >= :start_time")
                params["start_time"] = start_time

            if end_time:
                filters.append("timestamp <= :end_time")
                params["end_time"] = end_time

            where_clause = " AND ".join(filters)
            sql = f"""
                SELECT 
                    strftime('{fmt}', timestamp) AS time_bucket,
                    class_name,
                    SUM(count) AS count_sum,
                    MAX(cumulative_total) AS max_total
                FROM class_count_summary
                WHERE {where_clause}
                GROUP BY time_bucket, class_name
                ORDER BY time_bucket ASC
            """
            rows = session.exec(text(sql), params=params).all()

            buckets = {}
            all_classes = set()
            for time_bucket, class_name, count_sum, max_total in rows:
                if time_bucket not in buckets:
                    buckets[time_bucket] = {"time": time_bucket, "total": 0}
                buckets[time_bucket][class_name] = count_sum or 0
                buckets[time_bucket]["total"] += (count_sum or 0)
                all_classes.add(class_name)

            data = list(buckets.values())
            for item in data:
                for cls in all_classes:
                    if cls not in item:
                        item[cls] = 0

            return {
                "classes": sorted(list(all_classes)),
                "data": data,
                "interval": interval
            }

    def export_class_count_csv(self, project_id: str = "default", camera_id: str = None, start_time: str = None, end_time: str = None) -> str:
        """Generates CSV string of class count logs."""
        import io
        import csv

        with Session(self.engine) as session:
            statement = select(ClassCountSummary).where(ClassCountSummary.project_id == project_id)
            if camera_id:
                statement = statement.where(ClassCountSummary.camera_id == camera_id)
            if start_time:
                statement = statement.where(ClassCountSummary.timestamp >= start_time)
            if end_time:
                statement = statement.where(ClassCountSummary.timestamp <= end_time)

            statement = statement.order_by(ClassCountSummary.timestamp.desc())
            records = session.exec(statement).all()

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Timestamp", "Project ID", "Camera ID", "Node ID", "Class Name", "Count in Interval", "Cumulative Total"])

            for r in records:
                writer.writerow([
                    r.timestamp.strftime("%Y-%m-%d %H:%M:%S") if r.timestamp else "",
                    r.project_id or "",
                    r.camera_id or "",
                    r.node_id or "",
                    r.class_name or "",
                    r.count,
                    r.cumulative_total
                ])

            return output.getvalue()

    def stop(self):
        self.running = False
        self.log_queue.put(None)
        self.writer_thread.join(timeout=3.0)

# Global instance
db = DatabaseManager()
