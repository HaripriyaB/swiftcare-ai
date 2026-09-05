"""Intent classification + ADK Runner orchestration for chat."""

from __future__ import annotations

import asyncio
import os
import re
import uuid
from typing import Any, Literal

AgentType = Literal["retrieval", "suggestion", "insights"]

_INSIGHTS = (
    "care gap",
    "care gaps",
    "at risk",
    "at-risk",
    "high utilizer",
    "risk distribution",
    "insight alert",
    "cohort",
    "huddle",
    "gap in care",
)
_SUGGESTION = (
    "advisory card",
    "allergy awareness",
    "next step card",
    "recommend card",
    "next steps card",
)
_RETRIEVAL = (
    "meds",
    "medication",
    "medications",
    "vitals",
    "timeline",
    "last visit",
    "chart",
    "summar",
    "allerg",
    "visit history",
)
_REFUSE = re.compile(r"\b(diagnos\w*|prescrib\w*|antibiotic|treatment plan)\b", re.I)


def classify_intent(message: str, *, has_active_patient: bool) -> AgentType:
    text = (message or "").lower()
    if any(k in text for k in _INSIGHTS):
        return "insights"
    if any(k in text for k in _SUGGESTION):
        return "suggestion"
    if any(k in text for k in _RETRIEVAL):
        return "retrieval"
    if has_active_patient:
        return "retrieval"
    return "insights"


def should_refuse_clinical(message: str) -> bool:
    return bool(_REFUSE.search(message or ""))


async def _run_agent(
    agent_type: AgentType,
    message: str,
    *,
    user_id: str,
    patient_id: str | None,
) -> str:
    os.environ["AGENT_TYPE"] = agent_type
    os.environ.setdefault(
        "AGENT_NAME",
        {
            "retrieval": "swiftcare_retrieval_agent",
            "suggestion": "swiftcare_suggestion_agent",
            "insights": "swiftcare_insights_agent",
        }[agent_type],
    )

    if agent_type == "retrieval":
        from agents.retrieval.agent import root_agent
    elif agent_type == "suggestion":
        from agents.suggestion.agent import root_agent
    else:
        from agents.insights.agent import root_agent

    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="swiftcare",
        session_service=session_service,
    )
    session = await session_service.create_session(
        app_name="swiftcare",
        user_id=user_id,
        session_id=str(uuid.uuid4()),
    )
    prefix = ""
    if patient_id:
        prefix = f"active_patient_id={patient_id}\n\n"
    content = types.Content(
        role="user", parts=[types.Part(text=f"{prefix}{message}")]
    )
    texts: list[str] = []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    texts.append(part.text)
    return "\n".join(texts).strip() or "No response from agent."


def _extract_patients_from_insights(limit: int = 10) -> list[dict[str, Any]]:
    try:
        from agents.insights.tools.at_risk import list_at_risk_patients

        result = list_at_risk_patients(risk_flag="gap_in_care", limit=limit)
        patients = result.get("patients") or []
        out: list[dict[str, Any]] = []
        for p in patients:
            out.append(
                {
                    "patient_id": p.get("patient_id"),
                    "display_first_name": p.get("display_first_name")
                    or p.get("first_name"),
                    "display_last_name": p.get("display_last_name")
                    or p.get("last_name"),
                    "risk_flag": p.get("risk_flag"),
                    "risk_level": p.get("risk_level"),
                    "days_since_last_visit": p.get("days_since_last_visit"),
                    "age_years": p.get("age_years"),
                    "city": p.get("city"),
                    "state": p.get("state"),
                }
            )
        return out
    except Exception:
        return []


async def handle_chat(
    *,
    message: str,
    user_id: str,
    patient_id: str | None,
    session_id: str | None = None,
) -> dict[str, Any]:
    if should_refuse_clinical(message):
        return {
            "reply": (
                "I can’t diagnose or prescribe. I can show chart data, "
                "operational next steps, or population insights for staff review."
            ),
            "agent_type": "orchestrator",
            "patient_id": patient_id,
            "citations": [],
            "cards": [],
            "alerts": [],
            "patients": [],
        }

    agent_type = classify_intent(message, has_active_patient=bool(patient_id))
    timeout_s = float(os.getenv("CHAT_TIMEOUT_SECONDS", "90"))

    try:
        reply = await asyncio.wait_for(
            _run_agent(
                agent_type,
                message,
                user_id=user_id,
                patient_id=patient_id,
            ),
            timeout=timeout_s,
        )
    except asyncio.TimeoutError:
        return {
            "reply": "The agent timed out. Please try a shorter question.",
            "agent_type": agent_type,
            "patient_id": patient_id,
            "citations": [],
            "cards": [],
            "alerts": [],
            "patients": [],
            "error": "timeout",
        }
    except Exception as exc:
        return {
            "reply": f"Agent error: {exc}",
            "agent_type": agent_type,
            "patient_id": patient_id,
            "citations": [],
            "cards": [],
            "alerts": [],
            "patients": [],
            "error": "agent_error",
        }

    citations: list[dict[str, str]] = []
    patients: list[dict[str, Any]] = []
    if agent_type == "retrieval":
        citations = [{"view": "swiftcare_fhir_views"}]
    elif agent_type == "suggestion":
        citations = [{"view": "swiftcare_ops.advisory_cards"}]
    elif agent_type == "insights":
        citations = [{"view": "mv_at_risk_patients"}]
        if re.search(r"care gap|at.?risk|who has|list|top\s+\d", message, re.I):
            patients = _extract_patients_from_insights()

    # Best-effort ops log
    try:
        from agents.retrieval.logging import log_query

        os.environ["AGENT_TYPE"] = agent_type
        log_query(
            session_id=session_id,
            patient_id=patient_id,
            natural_language_query=message,
            generated_sql=f"orchestrator:{agent_type}",
            row_count=len(patients),
            latency_ms=0,
        )
    except Exception:
        pass

    return {
        "reply": reply,
        "agent_type": agent_type,
        "patient_id": patient_id,
        "citations": citations,
        "cards": [],
        "alerts": [],
        "patients": patients,
    }
