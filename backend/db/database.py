from datetime import timezone
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
        
        self.db_path_telemetry = str(base_dir / "telemetry_logs.sqlite")
        sqlite_url_telemetry = f"sqlite:///{self.db_path_telemetry}"
        
        connect_args = {"check_same_thread": False}
        self.engine = create_engine(sqlite_url, connect_args=connect_args)
        self.engine_telemetry = create_engine(sqlite_url_telemetry, connect_args=connect_args)
        
        # Configure SQLite Pragmas for performance and concurrency resilience
        def setup_pragmas(engine):
            @event.listens_for(engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA journal_mode=WAL;")
                cursor.execute("PRAGMA synchronous=NORMAL;")
                cursor.execute("PRAGMA busy_timeout=5000;")
                cursor.execute("PRAGMA foreign_keys=ON;")
                cursor.close()
                
        setup_pragmas(self.engine)
        setup_pragmas(self.engine_telemetry)
        
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
            SQLModel.metadata.create_all(self.engine_telemetry)
            
            # Ensure indexes are explicitly created for existing tables
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_camera_id ON event_logs(camera_id);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_node_id ON event_logs(node_id);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_type_time ON event_logs(event_type, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_cam_time ON event_logs(camera_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_node_time ON event_logs(node_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_proj_time ON event_logs(project_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_time ON custom_metric_log(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_proj_time ON custom_metric_log(project_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_full ON custom_metric_log(project_id, node_id, variable_name, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_var ON custom_metric_log(variable_name, timestamp DESC);",
            ]
            with self.engine_telemetry.connect() as conn:
                for idx_sql in indexes:
                    conn.execute(text(idx_sql))
                conn.commit()
                
            with self.engine.connect() as conn:
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
                
            from db.auth import get_password_hash
            from sqlmodel import Session, select
            from db.models import User
            
            with Session(self.engine) as session:
                admin_user = session.exec(select(User).where(User.username == "admin")).first()
                if not admin_user:
                    admin_user = User(
                        username="admin",
                        hashed_password=get_password_hash("admin"),
                        role="admin",
                        is_active=True
                    )
                    session.add(admin_user)
                    session.commit()
                    logger.info("Created default admin user (admin/admin).")

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
        batch_size = 500
        batch_timeout = 5.0  # seconds (increased to save SD card wear)
        last_rollup_check = time.time()
        
        while self.running:
            # Check for cleanup every hour (3600 seconds)
            if not hasattr(self, 'last_cleanup_check'):
                self.last_cleanup_check = time.time()
                
            if time.time() - self.last_cleanup_check > 3600:
                self.run_data_retention_cleanup()
                self.last_cleanup_check = time.time()
                
            # Check for rollup every 5 minutes
            if time.time() - last_rollup_check > 300:
                self.run_hourly_rollup()
                last_rollup_check = time.time()
                
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
                
            with Session(self.engine_telemetry) as session:
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
                        elif log_entry['table'] == 'custom_metric_log':
                            from db.models import CustomMetricLog
                            metric = CustomMetricLog(
                                timestamp=log_entry.get('data', {}).get('timestamp') or datetime.now(timezone.utc),
                                project_id=log_entry.get('data', {}).get('project_id', 'default'),
                                node_id=log_entry.get('data', {}).get('node_id', 'unknown'),
                                variable_name=log_entry.get('data', {}).get('variable_name'),
                                value=log_entry.get('data', {}).get('value', 0.0)
                            )
                            session.add(metric)
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
            

    def get_metric_history(self, node_id: str, limit: int = 300, timeframe_min: int = None, aggregate_min: int = None):
        from sqlmodel import Session, select
        from .models import CustomMetricLog
        from datetime import datetime, timezone
        import time

        try:
            with Session(self.engine_telemetry) as session:
                stmt = select(CustomMetricLog).where(CustomMetricLog.node_id == node_id).order_by(CustomMetricLog.timestamp.desc())
                if timeframe_min:
                    min_ts = datetime.fromtimestamp(time.time() - (timeframe_min * 60), timezone.utc)
                    stmt = stmt.where(CustomMetricLog.timestamp >= min_ts)
                    stmt = stmt.limit(50000)
                else:
                    stmt = stmt.limit(limit)
                
                rows = session.exec(stmt).all()
                
                history = []
                for row in reversed(rows):
                    ts = row.timestamp.timestamp()
                    dt_str = datetime.fromtimestamp(ts).strftime("%H:%M:%S")
                    history.append({
                        "time": dt_str,
                        "timestamp_unix": ts,
                        "value": row.value,
                        "variable_name": row.variable_name
                    })
                
                if aggregate_min and len(history) > 0:
                    aggr_history = []
                    current_bucket = None
                    bucket_vals = []
                    bucket_ts = 0
                    
                    for item in history:
                        bucket = int(item["timestamp_unix"] / (aggregate_min * 60))
                        if current_bucket is None:
                            current_bucket = bucket
                        
                        if bucket == current_bucket:
                            bucket_vals.append(item["value"])
                            bucket_ts = item["timestamp_unix"]
                        else:
                            max_val = max(bucket_vals) if bucket_vals else 0
                            dt_str = datetime.fromtimestamp(bucket_ts).strftime("%H:%M")
                            aggr_history.append({
                                "time": dt_str,
                                "timestamp_unix": bucket_ts,
                                "value": max_val
                            })
                            current_bucket = bucket
                            bucket_vals = [item["value"]]
                            bucket_ts = item["timestamp_unix"]
                    
                    if bucket_vals:
                        max_val = max(bucket_vals)
                        dt_str = datetime.fromtimestamp(bucket_ts).strftime("%H:%M")
                        aggr_history.append({
                            "time": dt_str,
                            "timestamp_unix": bucket_ts,
                            "value": max_val
                        })
                    
                    return aggr_history

                return history
        except Exception as e:
            logger.error(f"Failed to fetch metric history for {node_id}: {e}")
            return []

    def run_hourly_rollup(self):
        """Aggregates custom metrics into hourly buckets."""
        try:
            with Session(self.engine_telemetry) as session:
                # Custom Metric Rollup
                pass
        except Exception as e:
            logger.error(f"Error running hourly rollup: {e}")
            
    def run_data_retention_cleanup(self):
        """Deletes raw data older than the retention period (default 7 days) to prevent disk bloat."""
        from sqlmodel import Session, text
        from datetime import datetime, timedelta, timezone
        import os
        
        retention_days = 7
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
        cutoff_str = cutoff_date.strftime("%Y-%m-%d %H:%M:%S")
        
        try:
            with Session(self.engine_telemetry) as session:
                # 1. Find and delete physical snapshot files
                # Using text() since we are running raw SQL execution
                old_events = session.execute(
                    text(f"SELECT snapshot_path FROM event_logs WHERE timestamp < '{cutoff_str}' AND snapshot_path IS NOT NULL")
                ).fetchall()
                
                deleted_files_count = 0
                for row in old_events:
                    snap_path = row[0]
                    if snap_path and os.path.exists(snap_path):
                        try:
                            os.remove(snap_path)
                            deleted_files_count += 1
                        except Exception as e:
                            logger.error(f"Failed to delete old snapshot file {snap_path}: {e}")

                # 2. Clean up CustomMetricLog
                res1 = session.execute(text(f"DELETE FROM custom_metric_log WHERE timestamp < '{cutoff_str}'"))
                # 3. Clean up EventLog
                res2 = session.execute(text(f"DELETE FROM event_logs WHERE timestamp < '{cutoff_str}'"))
                # 4. Clean up SystemMetric
                res3 = session.execute(text(f"DELETE FROM system_metrics WHERE timestamp < '{cutoff_str}'"))
                
                session.commit()
                
                deleted_total = res1.rowcount + res2.rowcount + res3.rowcount
                if deleted_total > 0 or deleted_files_count > 0:
                    logger.info(f"Data retention cleanup completed. Deleted {deleted_total} old rows and {deleted_files_count} snapshot files.")
        except Exception as e:
            logger.error(f"Error running data retention cleanup: {e}")
        
    def get_logs(self, limit: int = 100, node_id: str = None, event_type: str = None, camera_id: str = None, page: int = 1, project_id: str = None):
        """Helper to get raw dict logs for backwards compatibility, with pagination and filters."""
        with Session(self.engine_telemetry) as session:
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

    def purge_old_logs(self, days: int = 30, max_records: int = 500000, delete_files: bool = True, project_id: str = None) -> Dict[str, Any]:
        """
        Cleans up old logs and optional snapshot image files to prevent disk bloat.
        1. Removes logs older than `days`.
        2. If record count still exceeds `max_records`, trims oldest records to reach `max_records`.
        3. If `delete_files` is True, deletes matching snapshot image files from disk.
        """
        deleted_rows = 0
        deleted_files = 0
        errors = []

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        with Session(self.engine_telemetry) as session:
            try:
                base_query = select(EventLog)
                count_query = select(func.count(EventLog.id))
                old_logs_stmt = select(EventLog.id, EventLog.snapshot_path).where(EventLog.timestamp < cutoff_date)
                
                if project_id:
                    count_query = count_query.where(EventLog.project_id == project_id)
                    old_logs_stmt = old_logs_stmt.where(EventLog.project_id == project_id)
                
                total_count = session.exec(count_query).one()
                
                # Query IDs to delete by age
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
                    )
                    if project_id:
                        excess_stmt = excess_stmt.where(EventLog.project_id == project_id)
                    
                    excess_stmt = excess_stmt.order_by(EventLog.timestamp.asc()).limit(overflow)
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
            
            tel_file = Path(self.db_path_telemetry)
            stats["telemetry_file_size_bytes"] = tel_file.stat().st_size if tel_file.exists() else 0
            stats["telemetry_file_size_mb"] = round(stats["telemetry_file_size_bytes"] / (1024 * 1024), 2)
            
            wal_file = Path(f"{self.db_path}-wal")
            tel_wal_file = Path(f"{self.db_path_telemetry}-wal")
            wal_size = (wal_file.stat().st_size if wal_file.exists() else 0) + (tel_wal_file.stat().st_size if tel_wal_file.exists() else 0)
            stats["wal_file_size_bytes"] = wal_size
            stats["wal_file_size_mb"] = round(wal_size / (1024 * 1024), 2)
            
            # Disk Usage
            import shutil
            total, used, free = shutil.disk_usage("/")
            stats["disk_total_gb"] = round(total / (1024**3), 2)
            stats["disk_used_gb"] = round(used / (1024**3), 2)
            stats["disk_free_gb"] = round(free / (1024**3), 2)
            stats["disk_usage_percent"] = round((used / total) * 100, 1) if total > 0 else 0
            
            # Queue Health
            stats["log_queue_size"] = self.log_queue.qsize()
            stats["log_queue_max"] = self.log_queue.maxsize

            with Session(self.engine_telemetry) as session:
                if project_id:
                    stats["total_event_logs"] = session.exec(select(func.count(EventLog.id)).where(EventLog.project_id == project_id)).one()
                    stats["total_metrics"] = session.exec(select(func.count(SystemMetric.id)).where(SystemMetric.project_id == project_id)).one()
                    stats["total_class_counts"] = session.exec(select(func.count(ClassCountSummary.id)).where(ClassCountSummary.project_id == project_id)).one()
                    stats["total_hourly_rollups"] = session.exec(select(func.count(ClassCountHourly.id)).where(ClassCountHourly.project_id == project_id)).one()
                else:
                    stats["total_event_logs"] = session.exec(select(func.count(EventLog.id))).one()
                    stats["total_metrics"] = session.exec(select(func.count(SystemMetric.id))).one()
                    stats["total_class_counts"] = session.exec(select(func.count(ClassCountSummary.id))).one()
                    stats["total_hourly_rollups"] = session.exec(select(func.count(ClassCountHourly.id))).one()
                    
            with Session(self.engine) as session:
                if not project_id:
                    stats["total_projects"] = session.exec(select(func.count(Project.id))).one()
                    stats["total_cameras"] = session.exec(select(func.count(Camera.id))).one()
                    stats["total_models"] = session.exec(select(func.count(AIModel.id))).one()
                
            snap_count = 0
            snap_size = 0
            
            if project_id:
                with Session(self.engine_telemetry) as session:
                    snapshot_paths = session.exec(select(EventLog.snapshot_path).where(EventLog.project_id == project_id, EventLog.snapshot_path != None)).all()
                    for p in snapshot_paths:
                        f = Path(p)
                        if f.exists() and f.is_file():
                            snap_count += 1
                            snap_size += f.stat().st_size
            else:
                snapshot_dir = Path("/home/pi/pido-ai/snapshots")
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

    def log_custom_metric(self, project_id: str, node_id: str, variable_name: str, value: float):
        """Asynchronously log a custom numeric metric to SQLite."""
        try:
            self.log_queue.put_nowait({
                'table': 'custom_metric_log',
                'data': {
                    'timestamp': datetime.now(timezone.utc),
                    'project_id': project_id,
                    'node_id': node_id,
                    'variable_name': variable_name,
                    'value': float(value)
                }
            })
        except Full:
            logger.warning("Database log_queue full, dropping custom metric log")
    def clear_project_logs(self, project_id: str) -> Dict[str, Any]:
        """Deletes all event logs, metrics, and associated snapshot files for a specific project."""
        deleted_rows = 0
        deleted_files = 0
        
        with Session(self.engine_telemetry) as session:
            # 1. Get snapshot paths first
            statement = select(EventLog.snapshot_path).where(EventLog.project_id == project_id).where(EventLog.snapshot_path != None)
            snapshot_paths = session.exec(statement).all()
            
            # 2. Count rows to be deleted
            count_statement = select(func.count(EventLog.id)).where(EventLog.project_id == project_id)
            deleted_rows = session.exec(count_statement).one()
            
            # 3. Delete the actual rows in the DB
            session.exec(delete(EventLog).where(EventLog.project_id == project_id))
            session.exec(delete(CustomMetricLog).where(CustomMetricLog.project_id == project_id))
            
            session.commit()
            
            # 4. Delete files on disk
            for spath in snapshot_paths:
                try:
                    p = Path(spath)
                    if p.exists() and p.is_file():
                        p.unlink()
                        deleted_files += 1
                except Exception as e:
                    logger.error(f"Failed to delete snapshot file {spath}: {e}")
                    
        return {"status": "success", "deleted_rows": deleted_rows, "deleted_files": deleted_files}

    def stop(self):
        self.running = False
        self.log_queue.put(None)
        self.writer_thread.join(timeout=3.0)

# Global instance
db = DatabaseManager()

def get_db():
    from sqlmodel import Session
    with Session(db.engine) as session:
        yield session
