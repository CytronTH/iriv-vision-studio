import sqlite3
import json
import logging
from pathlib import Path
from queue import Queue
import threading
import time

logger = logging.getLogger("ai_engine")

class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            base_dir = Path(__file__).resolve().parent
            db_path = str(base_dir / "vision_studio.sqlite")
        
        self.db_path = db_path
        self._init_db()
        
        self.log_queue = Queue()
        self.running = True
        self.writer_thread = threading.Thread(target=self._background_writer, daemon=True)
        self.writer_thread.start()
        
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
        
    def _init_db(self):
        conn = self._get_connection()
        try:
            # Enable WAL mode for better concurrency
            conn.execute('PRAGMA journal_mode=WAL;')
            
            # Create event_logs table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS event_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    node_id TEXT,
                    event_type TEXT,
                    payload TEXT,
                    camera_id TEXT,
                    snapshot_path TEXT
                )
            ''')
            
            # Create system_metrics table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS system_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    cpu_percent REAL,
                    ram_percent REAL,
                    temp_c REAL
                )
            ''')
            
            conn.commit()
            logger.info(f"Database initialized successfully at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
        finally:
            conn.close()
            
    def _background_writer(self):
        while self.running:
            try:
                # Wait for logs to process
                log_entry = self.log_queue.get(timeout=1.0)
                if log_entry is None:
                    break
                    
                conn = self._get_connection()
                try:
                    if log_entry['table'] == 'event_logs':
                        conn.execute(
                            '''INSERT INTO event_logs (node_id, event_type, payload, camera_id, snapshot_path) 
                               VALUES (?, ?, ?, ?, ?)''',
                            (
                                log_entry.get('node_id'), 
                                log_entry.get('event_type'),
                                json.dumps(log_entry.get('payload')) if log_entry.get('payload') else None,
                                log_entry.get('camera_id'),
                                log_entry.get('snapshot_path')
                            )
                        )
                    elif log_entry['table'] == 'system_metrics':
                        conn.execute(
                            '''INSERT INTO system_metrics (cpu_percent, ram_percent, temp_c) 
                               VALUES (?, ?, ?)''',
                            (
                                log_entry.get('cpu_percent'), 
                                log_entry.get('ram_percent'),
                                log_entry.get('temp_c')
                            )
                        )
                    conn.commit()
                except Exception as e:
                    logger.error(f"Error writing to database: {e}")
                finally:
                    conn.close()
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
        
    def get_logs(self, limit: int = 100, node_id: str = None):
        conn = self._get_connection()
        try:
            query = "SELECT * FROM event_logs"
            params = []
            if node_id:
                query += " WHERE node_id = ?"
                params.append(node_id)
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            results = []
            for row in cursor:
                d = dict(row)
                if d['payload']:
                    try:
                        d['payload'] = json.loads(d['payload'])
                    except:
                        pass
                results.append(d)
            return results
        finally:
            conn.close()
        
    def stop(self):
        self.running = False
        self.log_queue.put(None)
        self.writer_thread.join(timeout=2.0)

# Global instance
db = DatabaseManager()
