import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path("/home/pi/iriv-vision-studio/backend/telemetry.db")

class TelemetryDB:
    def __init__(self):
        self._init_db()

    def _init_db(self):
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS node_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        node_id TEXT NOT NULL,
                        timestamp REAL NOT NULL,
                        payload_json TEXT NOT NULL
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_node_id ON node_history (node_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON node_history (timestamp)")
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to initialize Telemetry DB: {e}")

    def insert_history(self, node_id: str, timestamp_unix: float, payload: dict):
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO node_history (node_id, timestamp, payload_json) VALUES (?, ?, ?)",
                    (node_id, timestamp_unix, json.dumps(payload))
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to insert history for {node_id}: {e}")

    def get_history(self, node_id: str, limit: int = 300, timeframe_min: int = None, aggregate_min: int = None):
        import time
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                if timeframe_min:
                    min_ts = time.time() - (timeframe_min * 60)
                    cursor.execute(
                        "SELECT timestamp, payload_json FROM node_history WHERE node_id = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 50000",
                        (node_id, min_ts)
                    )
                else:
                    cursor.execute(
                        "SELECT timestamp, payload_json FROM node_history WHERE node_id = ? ORDER BY timestamp DESC LIMIT ?",
                        (node_id, limit)
                    )
                rows = cursor.fetchall()
                
                history = []
                for ts, payload_str in reversed(rows): # Reverse so oldest is first
                    dt_str = datetime.fromtimestamp(ts).strftime("%H:%M:%S")
                    try:
                        data = json.loads(payload_str)
                        val = data if not isinstance(data, dict) else data.get("value", data.get("total", data.get("count", 0)))
                        history.append({
                            "time": dt_str,
                            "timestamp_unix": ts,
                            "value": val,
                            "raw_payload": data
                        })
                    except:
                        pass
                
                if aggregate_min and len(history) > 0:
                    aggr_history = []
                    current_bucket = None
                    bucket_vals = []
                    bucket_ts = 0
                    bucket_raw = None
                    
                    for item in history:
                        bucket = int(item["timestamp_unix"] / (aggregate_min * 60))
                        if current_bucket is None:
                            current_bucket = bucket
                        
                        if bucket == current_bucket:
                            bucket_vals.append(item["value"])
                            bucket_ts = item["timestamp_unix"]
                            bucket_raw = item["raw_payload"]
                        else:
                            avg_val = sum(bucket_vals) / len(bucket_vals) if bucket_vals else 0
                            dt_str = datetime.fromtimestamp(bucket_ts).strftime("%H:%M")
                            aggr_history.append({
                                "time": dt_str,
                                "timestamp_unix": bucket_ts,
                                "value": round(avg_val, 2),
                                "raw_payload": bucket_raw
                            })
                            current_bucket = bucket
                            bucket_vals = [item["value"]]
                            bucket_ts = item["timestamp_unix"]
                            bucket_raw = item["raw_payload"]
                    
                    if bucket_vals:
                        avg_val = sum(bucket_vals) / len(bucket_vals)
                        dt_str = datetime.fromtimestamp(bucket_ts).strftime("%H:%M")
                        aggr_history.append({
                            "time": dt_str,
                            "timestamp_unix": bucket_ts,
                            "value": round(avg_val, 2),
                            "raw_payload": bucket_raw
                        })
                    
                    return aggr_history

                return history
        except Exception as e:
            logger.error(f"Failed to fetch history for {node_id}: {e}")
            return []

telemetry_db = TelemetryDB()
