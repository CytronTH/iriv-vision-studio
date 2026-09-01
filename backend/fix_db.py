import sqlite3
conn = sqlite3.connect('db/vision_studio.sqlite')
try:
    conn.execute('ALTER TABLE project ADD COLUMN is_running BOOLEAN NOT NULL DEFAULT 0;')
    conn.commit()
    print("Schema fixed.")
except Exception as e:
    print("Error:", e)
conn.close()
