import json
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, String

# --- New Models ---

class Project(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    pipeline_json: str = "{}"
    dashboard_layout_json: str = "{}"
    exposed_data_sources_json: str = "[]"
    is_running: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Camera(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    type: str
    path: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AIModel(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    type: str = "model"
    hardware: str = ""
    hef_path: str
    so_path: str
    task: str
    tags_json: str = "[]"
    classes_json: str = "[]"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Integration(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    type: str
    target: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# --- Existing Models adapted to SQLModel ---

class EventLog(SQLModel, table=True):
    __tablename__ = "event_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    node_id: Optional[str] = Field(default=None, index=True)
    event_type: Optional[str] = Field(default=None, index=True)
    payload: Optional[str] = None
    camera_id: Optional[str] = Field(default=None, index=True)
    snapshot_path: Optional[str] = None

class SystemMetric(SQLModel, table=True):
    __tablename__ = "system_metrics"
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    cpu_percent: Optional[float] = None
    ram_percent: Optional[float] = None
    temp_c: Optional[float] = None
