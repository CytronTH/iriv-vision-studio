import json
import uuid
from typing import Optional, List
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Column, String, JSON
from sqlalchemy import UniqueConstraint

# --- New Models ---

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="viewer") # admin, editor, viewer
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Project(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    description: str = ""
    pipeline_json: str = Field(default="{}")
    dashboard_layout_json: str = Field(default="{}")
    exposed_data_sources_json: str = Field(default="[]")
    is_running: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)}
    )

class ProjectRevision(SQLModel, table=True):
    __tablename__ = "project_revisions"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(index=True, foreign_key="project.id", ondelete="CASCADE")
    revision_name: str = Field(default="Auto-save")
    pipeline_json: str = Field(default="{}")
    dashboard_layout_json: str = Field(default="{}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Camera(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    type: str
    path: str
    is_enabled: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIModel(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    type: str = "model"
    hardware: str = ""
    hef_path: str
    original_filename: str = Field(default="")
    file_hash: str = Field(default="")
    file_size: int = Field(default=0)
    version: str = Field(default="v1.0")
    description: str = Field(default="")
    so_path: str
    task: str
    tags_json: str = Field(default="[]")
    classes_json: str = Field(default="[]")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Integration(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    type: str
    target: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# --- Data Collections (Idea 1) ---
class ProjectCollection(SQLModel, table=True):
    __tablename__ = "project_collections"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(index=True, foreign_key="project.id", ondelete="CASCADE")
    name: str
    schema_json: str = Field(default="[]")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CollectionRecord(SQLModel, table=True):
    __tablename__ = "collection_records"
    id: Optional[int] = Field(default=None, primary_key=True)
    collection_id: str = Field(index=True, foreign_key="project_collections.id", ondelete="CASCADE")
    project_id: str = Field(index=True, foreign_key="project.id", ondelete="CASCADE")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    data_json: str = Field(default="{}")

# --- Existing Models adapted to SQLModel ---

class EventLog(SQLModel, table=True):
    __tablename__ = "event_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[str] = Field(default=None, index=True, foreign_key="project.id", ondelete="CASCADE")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    node_id: Optional[str] = Field(default=None, index=True)
    event_type: Optional[str] = Field(default=None, index=True)
    payload: Optional[str] = None
    camera_id: Optional[str] = Field(default=None, index=True, foreign_key="camera.id", ondelete="SET NULL")
    snapshot_path: Optional[str] = None

class SystemMetric(SQLModel, table=True):
    __tablename__ = "system_metrics"
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    cpu_percent: Optional[float] = None
    ram_percent: Optional[float] = None
    temp_c: Optional[float] = None

class CustomMetricLog(SQLModel, table=True):
    __tablename__ = "custom_metric_log"
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    project_id: str = Field(default="default", index=True, foreign_key="project.id", ondelete="CASCADE")
    node_id: str = Field(default="unknown", index=True)
    variable_name: str = Field(index=True)
    value: float = Field(default=0.0)

class CustomMetricHourly(SQLModel, table=True):
    __tablename__ = "custom_metric_hourly"
    id: Optional[int] = Field(default=None, primary_key=True)
    time_bucket: datetime = Field(index=True)
    project_id: str = Field(default="default", index=True, foreign_key="project.id", ondelete="CASCADE")
    node_id: str = Field(default="unknown", index=True)
    variable_name: str = Field(index=True)
    value_sum: float = Field(default=0.0)
    value_avg: float = Field(default=0.0)
    value_max: float = Field(default=0.0)
    value_min: float = Field(default=0.0)
    count: int = Field(default=0)
    
    __table_args__ = (
        UniqueConstraint("time_bucket", "project_id", "node_id", "variable_name", name="uix_metric_hourly"),
    )
