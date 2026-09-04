"""Patient clinical timeline tool."""

from __future__ import annotations

import os
from typing import Any

from ..bq_client import fq, run_query
from ..logging import log_tool_call

VALID_EVENT_TYPES = frozenset({"encounter", "condition", "observation", "medication"})


def get_patient_timeline(
    patient_id: str,
    event_type: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Chronological clinical events for a patient.

    Args:
        patient_id: FHIR patient identifier.
        event_type: Optional filter: encounter|condition|observation|medication.
        limit: Max rows (default from DEFAULT_TIMELINE_LIMIT).

    Returns:
        Timeline event rows, newest first.
    """
    if limit is None:
        limit = int(os.getenv("DEFAULT_TIMELINE_LIMIT", "50"))
    has_type = bool(event_type and event_type.strip())
    if has_type and event_type not in VALID_EVENT_TYPES:
        return [
            {
                "error": f"Invalid event_type '{event_type}'. "
                f"Use one of: {', '.join(sorted(VALID_EVENT_TYPES))}"
            }
        ]

    sql = f"""
SELECT event_date, event_type, event_label, source_id, encounter_id
FROM {fq("swiftcare_fhir_views", "v_patient_timeline")}
WHERE patient_id = @patient_id
  AND (@has_event_type = FALSE OR event_type = @event_type)
ORDER BY event_date DESC
LIMIT @limit
"""
    rows, row_count, latency_ms = run_query(
        sql,
        {
            "patient_id": patient_id,
            "event_type": event_type or "",
            "has_event_type": has_type,
            "limit": limit,
        },
    )
    log_tool_call(
        "get_patient_timeline",
        patient_id=patient_id,
        action="view_timeline",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return rows
