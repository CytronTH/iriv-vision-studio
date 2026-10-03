import sqlite3
import json
from datetime import datetime, timezone
import os

old_db_path = "/home/pi/pido-ai/backend/telemetry.db"
new_db_path = "/home/pi/pido-ai/backend/db/telemetry_logs.sqlite"

if not os.path.exists(old_db_path) or not os.path.exists(new_db_path):
    print("Databases not found.")
    exit(1)

conn_old = sqlite3.connect(old_db_path)
conn_new = sqlite3.connect(new_db_path)
cursor_old = conn_old.cursor()
cursor_new = conn_new.cursor()

try:
    print("Migrating node_history to custom_metric_log...")
    cursor_old.execute("SELECT node_id, timestamp, payload_json FROM node_history")
    rows = cursor_old.fetchall()
    
    count = 0
    for node_id, ts, payload_str in rows:
        try:
            data = json.loads(payload_str)
            val = data if not isinstance(data, dict) else data.get("value", data.get("total", data.get("count", 0.0)))
            val = float(val)
            
            dt = datetime.fromtimestamp(ts, timezone.utc).isoformat(sep=" ")
            # SQLite datetime format: 'YYYY-MM-DD HH:MM:SS.SSS'
            dt_sqlite = dt.replace("T", " ")[:23]
            if "+" in dt_sqlite:
                dt_sqlite = dt_sqlite.split("+")[0]
            
            cursor_new.execute("""
                INSERT INTO custom_metric_log (timestamp, project_id, node_id, variable_name, value)
                VALUES (?, ?, ?, ?, ?)
            """, (dt_sqlite, "default", node_id, "value", val))
            count += 1
            if count % 10000 == 0:
                print(f"Migrated {count} rows...")
        except Exception as e:
            pass
            
    conn_new.commit()
    print(f"Migration completed successfully! Total rows migrated: {count}")

except Exception as e:
    print(f"Error during migration: {e}")

finally:
    conn_old.close()
    conn_new.close()
