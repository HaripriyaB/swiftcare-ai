"""Intent classification + ADK Runner orchestration for chat."""

from __future__ import annotations

import asyncio
import os
import re
import uuid
from functools import lru_cache
from typing import Any, Literal

from api import local_demo
from agents.display_names import display_full_name, display_person_name

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
_PATIENT_ID = re.compile(r"^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$", re.I)


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


def is_today_priority_request(message: str) -> bool:
    text = (message or "").lower()
    asks_about_today = "today" in text and any(word in text for word in ("work", "priority", "priorities", "queue", "important"))
    asks_what_to_work = any(phrase in text for phrase in ("what should i work on", "what do i work on", "work on first"))
    return asks_about_today or asks_what_to_work


def today_priority_reply() -> str:
    """Return a compact operational preview of the live Attention Queue."""
    try:
        from api.continuity import get_queue_snapshot

        snapshot = get_queue_snapshot(
            priority=None,
            action_type=None,
            status="OPEN",
            limit=3,
        )
        summary = snapshot["summary"]
        cards = snapshot["cards"]
        if not cards:
            return "Today’s priority work is clear. There are no open items in the Attention Queue."
        preview = "\n".join(
            f"• {card['patient_name']} — {card['action_label']}"
            for card in cards
        )
        return (
            f"Today’s priority work: {summary['HIGH']} high, {summary['MEDIUM']} medium, and {summary['LOW']} low.\n"
            f"Start with:\n{preview}\n\nOpen Attention Queue for the full list."
        )
    except Exception:
        return "I couldn’t load today’s priority work right now. Open Attention Queue to review it."


def is_operational_queue_request(message: str) -> bool:
    """Recognize staff requests that are answered by the live work queue."""
    text = (message or "").lower()
    has_queue_subject = bool(re.search(
        r"\b(?:follow[ -]?up|outreach|appointment|scheduling|priority|priorities|"
        r"queue|care team review|routine check[ -]?in|contact preferences?|operational action)\b",
        text,
    ))
    has_request = bool(re.search(r"\b(?:show|list|find|which|who|patients?|actions?|work)\b", text))
    return has_queue_subject and has_request


def _queue_patients(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert operational cards into the same compact patient cards used by Swify."""
    seen: set[str] = set()
    patients: list[dict[str, Any]] = []
    for card in cards:
        patient_id = str(card.get("patient_id") or "")
        if not patient_id or patient_id in seen:
            continue
        seen.add(patient_id)
        name_parts = str(card.get("patient_name") or "Patient").rsplit(" ", 1)
        patients.append(
            {
                "patient_id": patient_id,
                "display_first_name": name_parts[0],
                "display_last_name": name_parts[1] if len(name_parts) > 1 else "",
                "matched_on": f"Open action: {card.get('action_label') or 'Review work item'}",
            }
        )
    return patients


def operational_queue_reply(message: str) -> tuple[str, list[dict[str, Any]]]:
    """Return queue-filtered people for common front-desk operational questions."""
    try:
        from api.continuity import get_queue_snapshot

        snapshot = get_queue_snapshot(
            priority=None,
            action_type=None,
            status="OPEN",
            limit=50,
        )
        cards = list(snapshot.get("cards") or [])
    except Exception:
        return "I couldn’t load the Attention Queue right now. Please try again in a moment.", []

    text = (message or "").lower()
    priority = next((level for level in ("high", "medium", "low") if re.search(rf"\b{level}\b", text)), None)
    if priority:
        cards = [card for card in cards if str(card.get("priority")).lower() == priority]

    # Prefer explicit operational concepts over a generic keyword search.
    filters: list[tuple[str, tuple[str, ...]]] = [
        ("follow-up", ("follow", "up")),
        ("outreach", ("outreach",)),
        ("appointment", ("appointment",)),
        ("scheduling", ("scheduling",)),
        ("care-team review", ("care", "team", "review")),
        ("routine check-in", ("routine", "check", "in")),
        ("contact preferences", ("contact", "preferences")),
    ]
    matched_label = f"{priority}-priority" if priority else "open"
    for label, terms in filters:
        if all(term in text for term in terms):
            cards = [
                card for card in cards
                if all(term in f"{card.get('action_label', '')} {card.get('action_type', '')}".lower() for term in terms)
            ]
            matched_label = f"{priority + ' priority ' if priority else ''}{label}"
            break

    cards = cards[:12]
    patients = _queue_patients(cards)
    if not patients:
        return f"There are no open {matched_label} actions right now. Try another action or open Attention Queue to see all work.", []
    noun = "patient" if len(patients) == 1 else "patients"
    return (
        f"I found {len(patients)} {noun} with open {matched_label} work. "
        "Choose a patient below to ask a specific question or open the record.",
        patients,
    )


@lru_cache(maxsize=256)
def _patient_display_name(patient_id: str) -> str | None:
    """Resolve a compact patient name once, rather than on every follow-up."""
    try:
        if local_demo.enabled():
            summary = (local_demo.chart_for(patient_id) or {}).get("summary") or {}
        else:
            from agents.retrieval.tools.patient_360 import get_patient_summary

            summary = get_patient_summary(patient_id) or {}
        name = " ".join(
            part for part in (
                display_person_name(summary.get("display_first_name") or summary.get("first_name")),
                display_person_name(summary.get("display_last_name") or summary.get("last_name")),
            ) if part
        ).strip()
        return display_full_name(name) or None
    except Exception:
        return None


def with_patient_name(reply: str, patient_id: str | None) -> str:
    """Make the active chart identity unambiguous in every patient response."""
    if not patient_id:
        return reply
    name = _patient_display_name(patient_id)
    if not name or name.lower() in reply.lower():
        return reply
    return f"{name}\n\n{reply}"


def extract_patient_matches(reply: str) -> tuple[str, list[dict[str, Any]]]:
    """Convert a lookup-tool markdown table into safe, selectable chat data."""
    lines = reply.splitlines()
    table_start: int | None = None
    rows: list[dict[str, Any]] = []

    for index, line in enumerate(lines):
        header = [cell.strip().lower() for cell in line.strip().strip("|").split("|")]
        if header[:2] == ["#", "first name"] and "patient id" in header:
            table_start = index
            continue
        if table_start is None or index == table_start + 1 or not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip().strip("`") for cell in line.strip().strip("|").split("|")]
        if len(cells) < 7 or not _PATIENT_ID.fullmatch(cells[5]):
            continue
        location = [part.strip() for part in cells[3].split(",", 1)]
        rows.append(
            {
                "patient_id": cells[5],
                "display_first_name": display_person_name(cells[1]),
                "display_last_name": display_person_name(cells[2]),
                "city": location[0] if location else None,
                "state": location[1] if len(location) > 1 else None,
                "last_visit_date": None if cells[4] == "—" else cells[4],
                "matched_on": None if cells[6] == "—" else cells[6],
            }
        )

    if not rows or table_start is None:
        return reply, []

    # The cards hold the lookup rows, so leave staff with concise prose rather
    # than raw pipes, markdown syntax, and patient identifiers.
    prose = "\n".join(
        line for index, line in enumerate(lines)
        if line.strip() and not (index >= table_start and line.lstrip().startswith("|"))
    ).strip()
    if not prose:
        prose = f"I found {len(rows)} matching patients. Choose one to continue."
    elif "choose" not in prose.lower():
        prose = f"{prose}\n\nChoose a patient below to continue."
    return prose, rows


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
                    "display_first_name": display_person_name(
                        p.get("display_first_name") or p.get("first_name")
                    ),
                    "display_last_name": display_person_name(
                        p.get("display_last_name") or p.get("last_name")
                    ),
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
    mode: str = "ask",
) -> dict[str, Any]:
    if mode == "help":
        return {
            "reply": "Use Attention queue to work prioritized follow-ups, Find a patient to search charts, Care dashboard for operational patterns, and Work history for the audit trail. Ask me if you want help with a specific step.",
            "agent_type": "help",
            "patient_id": patient_id,
            "citations": [], "cards": [], "alerts": [], "patients": [],
        }
    if mode == "learn":
        return {
            "reply": "I can help interpret information already in SwiftCare. For general public health education, use the trusted resources shown above. Clinical decisions remain with the care team.",
            "agent_type": "learn",
            "patient_id": patient_id,
            "citations": [], "cards": [], "alerts": [], "patients": [],
        }
    if should_refuse_clinical(message):
        return {
            "reply": with_patient_name((
                "I can’t diagnose or prescribe. I can show chart data, "
                "operational next steps, or population insights for staff review."
            ), patient_id),
            "agent_type": "orchestrator",
            "patient_id": patient_id,
            "citations": [],
            "cards": [],
            "alerts": [],
            "patients": [],
        }

    if is_today_priority_request(message):
        return {
            "reply": today_priority_reply(),
            "agent_type": "queue",
            "patient_id": patient_id,
            "citations": [], "cards": [], "alerts": [], "patients": [],
        }

    if is_operational_queue_request(message):
        reply, patients = operational_queue_reply(message)
        return {
            "reply": reply,
            "agent_type": "queue",
            "patient_id": patient_id,
            "citations": [], "cards": [], "alerts": [], "patients": patients,
        }

    if local_demo.enabled():
        response = _local_demo_reply(message, patient_id)
        response["reply"] = with_patient_name(str(response["reply"]), patient_id)
        return response

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
            "reply": with_patient_name("The request timed out. Please try a shorter question.", patient_id),
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
            "reply": with_patient_name("I couldn’t complete that request. Please try again.", patient_id),
            "agent_type": agent_type,
            "patient_id": patient_id,
            "citations": [],
            "cards": [],
            "alerts": [],
            "patients": [],
            "error": "agent_error",
        }

    citations: list[dict[str, str]] = []
    reply, patients = extract_patient_matches(reply)
    if agent_type == "retrieval":
        citations = [{"view": "swiftcare_fhir_views"}]
    elif agent_type == "suggestion":
        citations = [{"view": "swiftcare_ops.advisory_cards"}]
    elif agent_type == "insights":
        citations = [{"view": "mv_at_risk_patients"}]
        if not patients and re.search(r"care gap|at.?risk|who has|list|top\s+\d", message, re.I):
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
        "reply": with_patient_name(reply, patient_id),
        "agent_type": agent_type,
        "patient_id": patient_id,
        "citations": citations,
        "cards": [],
        "alerts": [],
        "patients": patients,
    }


def _local_demo_reply(message: str, patient_id: str | None) -> dict[str, Any]:
    """Deterministic, grounded local chat for the fixture-backed API mode."""
    text = (message or "").lower()
    if any(term in text for term in ("care gap", "at risk", "at-risk", "overdue")):
        patients = local_demo.at_risk(
            risk_flag="gap_in_care", risk_level=None, limit=10
        )
        return {
            "reply": "Care-gap patients from the local fixture. These are operational scheduling flags, not diagnoses.",
            "agent_type": "insights",
            "patient_id": None,
            "citations": [{"view": "mv_at_risk_patients"}],
            "cards": [],
            "alerts": [],
            "patients": patients,
        }

    chart = local_demo.chart_for(patient_id or "")
    if any(term in text for term in ("vital", "bp", "blood pressure", "heart")):
        vitals = (chart or {}).get("vitals")
        reply = (
            f"Latest vitals: BP {vitals.get('systolic_bp')}/{vitals.get('diastolic_bp')}, "
            f"heart rate {vitals.get('heart_rate')} ({vitals.get('latest_observation_date')})."
            if vitals
            else "Open a fixture patient first to view vitals."
        )
        return _local_response(reply, patient_id, "retrieval", "mv_patient_latest_vitals")

    if "med" in text or "medication" in text:
        medications = (chart or {}).get("medications", [])
        reply = (
            "Active medications: "
            + ", ".join(row["medication_name"] for row in medications)
            if medications
            else "Open a fixture patient first to view medications."
        )
        return _local_response(reply, patient_id, "retrieval", "v_active_medications")

    return _local_response(
        "Try asking about care gaps, medications, or vitals. The local API is serving fixture data.",
        patient_id,
        "orchestrator",
        None,
    )


def _local_response(
    reply: str, patient_id: str | None, agent_type: str, view: str | None
) -> dict[str, Any]:
    return {
        "reply": reply,
        "agent_type": agent_type,
        "patient_id": patient_id,
        "citations": [{"view": view}] if view else [],
        "cards": [],
        "alerts": [],
        "patients": [],
    }
