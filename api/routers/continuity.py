"""Continuity queue API: operational actions, never clinical orders."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.access import require_population_access
from api.auth import CurrentUser, get_current_user
from api import continuity

router = APIRouter(tags=["continuity"])


class CompleteRequest(BaseModel):
    outcome: str
    note: str | None = Field(default=None, max_length=280)


class DismissRequest(BaseModel):
    reason: str
    note: str | None = Field(default=None, max_length=280)


class UpdateHistoryRequest(BaseModel):
    outcome: str
    note: str | None = Field(default=None, max_length=280)


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail={"error": "not_found", "message": "Continuity card not found or no longer open"})


@router.get("/continuity/queue")
def queue(
    priority: Literal["HIGH", "MEDIUM", "LOW"] | None = None,
    status: Literal["OPEN", "IN_PROGRESS", "COMPLETED", "DISMISSED"] | None = "OPEN",
    limit: int = Query(8, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
):
    require_population_access(user)
    return continuity.get_queue_snapshot(priority=priority, status=status, limit=limit)


@router.get("/continuity/summary")
def summary(user: CurrentUser = Depends(get_current_user)):
    require_population_access(user)
    return continuity.get_summary()


@router.get("/continuity/history")
def history(
    day: str | None = None,
    limit: int = Query(30, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    require_population_access(user)
    return {"events": continuity.list_history(day=day, limit=limit)}


@router.get("/continuity/history/{event_id}")
def history_entry(event_id: str, user: CurrentUser = Depends(get_current_user)):
    require_population_access(user)
    row = continuity.get_history_entry(event_id)
    if not row:
        raise _not_found()
    return row


@router.put("/continuity/history/{event_id}")
def update_history_entry(
    event_id: str,
    body: UpdateHistoryRequest,
    user: CurrentUser = Depends(get_current_user),
):
    require_population_access(user, action="write")
    try:
        row = continuity.update_history_entry(event_id, user.user_id, body.outcome, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_outcome", "message": str(exc)}) from exc
    if not row:
        raise _not_found()
    return row


@router.get("/continuity/cards/{card_id}")
def card(card_id: str, user: CurrentUser = Depends(get_current_user)):
    require_population_access(user)
    row = continuity.get_card(card_id)
    if not row:
        raise _not_found()
    return row


@router.post("/continuity/cards/{card_id}/start")
def start(card_id: str, user: CurrentUser = Depends(get_current_user)):
    require_population_access(user, action="write")
    row = continuity.start_card(card_id, user.user_id)
    if not row:
        raise _not_found()
    return row


@router.post("/continuity/cards/{card_id}/complete")
def complete(card_id: str, body: CompleteRequest, user: CurrentUser = Depends(get_current_user)):
    require_population_access(user, action="write")
    try:
        row = continuity.complete_card(card_id, user.user_id, body.outcome, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_outcome", "message": str(exc)}) from exc
    if not row:
        raise _not_found()
    return row


@router.post("/continuity/cards/{card_id}/dismiss")
def dismiss(card_id: str, body: DismissRequest, user: CurrentUser = Depends(get_current_user)):
    require_population_access(user, action="write")
    try:
        row = continuity.dismiss_card(card_id, user.user_id, body.reason, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_reason", "message": str(exc)}) from exc
    if not row:
        raise _not_found()
    return row
