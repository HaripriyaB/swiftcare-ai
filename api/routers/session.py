from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import CurrentUser, get_current_user
from api import session_store

router = APIRouter(tags=["session"])


class SessionPut(BaseModel):
    active_patient_id: str | None = None
    session_id: str | None = None


@router.get("/session")
def get_session(user: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
    return session_store.get_session(user_id=user.user_id)


@router.put("/session")
def put_session(
    body: SessionPut,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        existing = session_store.get_session(
            user_id=user.user_id, session_id=body.session_id
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Session belongs to another user"},
        )
    return session_store.upsert_session(
        session_id=existing.get("session_id"),
        user_id=user.user_id,
        active_patient_id=body.active_patient_id
        if body.active_patient_id is not None
        else existing.get("active_patient_id"),
    )
