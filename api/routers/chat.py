from __future__ import annotations

from typing import Any, Literal
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.auth import CurrentUser, get_current_user
from api import session_store
from api.orchestrator import handle_chat

router = APIRouter(tags=["chat"])


def _presentation_safe_reply(reply: str) -> str:
    """Keep internal view, dataset, and agent-routing names out of staff chat."""
    cleaned = re.sub(r"\s*\(?\s*source\s*:\s*[^)\n]+\)?", "", reply, flags=re.I)
    cleaned = re.sub(r"\b(?:swiftcare_[\w.]+|mv_[\w]+|v_[\w]+)\b", "", cleaned, flags=re.I)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


class ChatBody(BaseModel):
  message: str
  patient_id: str | None = None
  session_id: str | None = None
  mode: Literal["ask", "help", "learn"] = "ask"


@router.post("/chat")
async def chat(
    body: ChatBody,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    session = session_store.get_session(
        user_id=user.user_id, session_id=body.session_id
    )
    patient_id = body.patient_id or session.get("active_patient_id")
    if body.patient_id:
        session = session_store.upsert_session(
            session_id=session.get("session_id"),
            user_id=user.user_id,
            active_patient_id=body.patient_id,
        )

    response = await handle_chat(
        message=body.message,
        user_id=user.user_id,
        patient_id=patient_id,
        session_id=session.get("session_id"),
        mode=body.mode,
    )
    response["reply"] = _presentation_safe_reply(str(response.get("reply") or ""))
    return response
