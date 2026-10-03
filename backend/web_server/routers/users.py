from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
import uuid

from db.database import get_db
from db.models import User
from db.auth import get_password_hash
from .auth import get_current_admin

router = APIRouter(prefix="/api/users", tags=["users"])

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer" # admin, editor, viewer

class UserUpdate(BaseModel):
    role: str = None
    is_active: bool = None
    password: str = None

@router.post("")
def create_user(user_in: UserCreate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    existing_user = db.exec(select(User).where(User.username == user_in.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    if user_in.role not in ["admin", "editor", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, editor, or viewer")

    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        id=user_id,
        username=user_in.username,
        hashed_password=hashed_password,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"id": new_user.id, "username": new_user.username, "role": new_user.role, "is_active": new_user.is_active}

@router.get("")
def read_users(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    users = db.exec(select(User)).all()
    return [{"id": u.id, "username": u.username, "role": u.role, "is_active": u.is_active, "created_at": u.created_at} for u in users]

@router.put("/{user_id}")
def update_user(user_id: str, user_in: UserUpdate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_in.role is not None:
        if user_in.role not in ["admin", "editor", "viewer"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password is not None:
        user.hashed_password = get_password_hash(user_in.password)
        
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"id": user.id, "username": user.username, "role": user.role, "is_active": user.is_active}

@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    db.delete(user)
    db.commit()
    return {"ok": True}
