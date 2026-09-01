from sqlmodel import Session, select
from db.database import db
from db.models import Project

with Session(db.engine) as session:
    for p in session.exec(select(Project)).all():
        if "congee" in p.name.lower():
            print(p.pipeline_json)
