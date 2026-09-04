"""Advisory card create / list / dismiss tools."""

from __future__ import annotations

import os
import uuid
from typing import Any

from ..bq_client import fq, run_dml, run_query
from ..cards import (
    build_content,
    build_source_refs,
    bump_create_count,
    dedupe_open_cards,
    default_severity,
    get_create_count,
    max_cards_per_turn,
    parse_json_field,
    validate_body_language,
    validate_card_type,
    validate_severity,
)
from ..logging import log_tool_call

_DEFAULT_VIEW_BY_TYPE = {
    "allergy_awareness": "swiftcare_fhir_views.v_active_allergies",
    "medication_review": "swiftcare_fhir_views.v_active_medications",
    "follow_up_scheduling": "swiftcare_fhir_views.v_visit_summary",
    "chart_completeness": "swiftcare_fhir_views.v_active_allergies",
}


def _coerce_source_refs(
    source_refs: list[dict[str, Any]] | str | None,
) -> list[dict[str, Any]] | None:
    """Accept list[dict] or JSON string (ADK-friendly)."""
    if source_refs is None or source_refs == "":
        return None
    if isinstance(source_refs, str):
        parsed = parse_json_field(source_refs)
        if isinstance(parsed, list):
            return [r for r in parsed if isinstance(r, dict)]
        return None
    if isinstance(source_refs, list):
        return [r for r in source_refs if isinstance(r, dict)]
    return None


def create_advisory_card(
    patient_id: str,
    card_type: str,
    title: str,
    body: str,
    severity: str | None = None,
    session_id: str | None = None,
    source_refs: str | None = None,
) -> dict[str, Any]:
    """Persist a dismissible advisory card. Returns card_id + content.

    Args:
        patient_id: FHIR patient identifier.
        card_type: One of allergy_awareness, medication_review,
            follow_up_scheduling, chart_completeness.
        title: Short advisory title.
        body: Operational (non-clinical-order) advisory body.
        severity: info or attention (default from CARD_DEFAULT_SEVERITY).
        session_id: Optional session id.
        source_refs: Optional JSON string of source reference objects.
    """
    err = validate_card_type(card_type)
    if err:
        return {"error": err}

    sev = (severity or default_severity()).strip().lower()
    err = validate_severity(sev)
    if err:
        return {"error": err}

    err = validate_body_language(body)
    if err:
        return {"error": err}

    if get_create_count() >= max_cards_per_turn():
        return {
            "error": "max_cards_per_turn_exceeded",
            "max": max_cards_per_turn(),
        }

    if dedupe_open_cards():
        existing = _find_open_card(patient_id, card_type)
        if existing:
            return {
                "card_id": existing["card_id"],
                "deduped": True,
                "content": parse_json_field(existing.get("content")),
                "source_refs": parse_json_field(existing.get("source_refs")),
                "dismissed": False,
            }

    card_id = str(uuid.uuid4())
    content = build_content(
        title=title,
        body=body,
        severity=sev,
        card_type=card_type,
    )
    refs = build_source_refs(
        _coerce_source_refs(source_refs),
        patient_id=patient_id,
        default_view=_DEFAULT_VIEW_BY_TYPE.get(card_type),
    )
    agent_type = os.getenv("AGENT_TYPE", "suggestion")

    sql = f"""
INSERT INTO {fq("swiftcare_ops", "advisory_cards")}
  (card_id, session_id, patient_id, agent_type, content, source_refs, dismissed)
VALUES
  (@card_id, @session_id, @patient_id, @agent_type, @content, @source_refs, FALSE)
"""
    affected = run_dml(
        sql,
        {
            "card_id": card_id,
            "session_id": session_id,
            "patient_id": patient_id,
            "agent_type": agent_type,
            "content": content,
            "source_refs": refs,
        },
    )
    bump_create_count()
    log_tool_call(
        "create_advisory_card",
        patient_id=patient_id,
        action="create_advisory",
        row_count=affected,
        latency_ms=0,
        session_id=session_id,
    )
    return {
        "card_id": card_id,
        "deduped": False,
        "content": parse_json_field(content),
        "source_refs": parse_json_field(refs),
        "dismissed": False,
    }


def list_advisory_cards(
    patient_id: str,
    include_dismissed: bool = False,
    session_id: str | None = None,
) -> list[dict[str, Any]]:
    """List advisory cards for a patient (default: open only)."""
    sql = f"""
SELECT card_id, session_id, patient_id, agent_type, content, source_refs,
       dismissed, created_at
FROM {fq("swiftcare_ops", "advisory_cards")}
WHERE patient_id = @patient_id
  AND (@include_dismissed = TRUE OR dismissed = FALSE)
  AND (@session_id IS NULL OR session_id = @session_id)
ORDER BY created_at DESC
"""
    rows, row_count, latency_ms = run_query(
        sql,
        {
            "patient_id": patient_id,
            "include_dismissed": include_dismissed,
            "session_id": session_id,
        },
    )
    for row in rows:
        row["content"] = parse_json_field(row.get("content"))
        row["source_refs"] = parse_json_field(row.get("source_refs"))

    log_tool_call(
        "list_advisory_cards",
        patient_id=patient_id,
        action="list_advisory",
        row_count=row_count,
        latency_ms=latency_ms,
        session_id=session_id,
    )
    return rows


def dismiss_advisory_card(card_id: str, patient_id: str) -> dict[str, Any]:
    """Soft-dismiss a card. Requires matching patient_id for safety."""
    sql = f"""
UPDATE {fq("swiftcare_ops", "advisory_cards")}
SET dismissed = TRUE
WHERE card_id = @card_id
  AND patient_id = @patient_id
  AND dismissed = FALSE
"""
    affected = run_dml(
        sql,
        {"card_id": card_id, "patient_id": patient_id},
    )
    log_tool_call(
        "dismiss_advisory_card",
        patient_id=patient_id,
        action="dismiss_advisory",
        row_count=affected,
        latency_ms=0,
    )
    if affected == 0:
        return {"error": "not_found_or_already_dismissed", "card_id": card_id}
    return {"card_id": card_id, "dismissed": True}


def _find_open_card(patient_id: str, card_type: str) -> dict[str, Any] | None:
    """Return an open card of the same card_type if one exists."""
    # content is JSON string; extract card_type via JSON_VALUE
    sql = f"""
SELECT card_id, session_id, patient_id, agent_type, content, source_refs,
       dismissed, created_at
FROM {fq("swiftcare_ops", "advisory_cards")}
WHERE patient_id = @patient_id
  AND dismissed = FALSE
  AND JSON_VALUE(content, '$.card_type') = @card_type
ORDER BY created_at DESC
LIMIT 1
"""
    rows, _, _ = run_query(
        sql, {"patient_id": patient_id, "card_type": card_type}
    )
    return rows[0] if rows else None
