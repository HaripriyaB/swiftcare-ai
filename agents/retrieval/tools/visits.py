"""Visit history from v_visit_summary."""

from __future__ import annotations

import os
from typing import Any

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def get_visit_history(
    patient_id: str,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Recent visits with class, type, and chief complaint.

    Args:
        patient_id: FHIR patient identifier.
        limit: Max visits (default from DEFAULT_VISIT_LIMIT).

    Returns:
        Visit rows, newest first.
    """
    if limit is None:
        limit = int(os.getenv("DEFAULT_VISIT_LIMIT", "20"))
    sql = f"""
SELECT encounter_id, visit_date, encounter_class, visit_type,
       chief_complaint, status
FROM {fq("swiftcare_fhir_views", "v_visit_summary")}
WHERE patient_id = @patient_id
ORDER BY visit_date DESC
LIMIT @limit
"""
    rows, row_count, latency_ms = run_query(
        sql, {"patient_id": patient_id, "limit": limit}
    )
    log_tool_call(
        "get_visit_history",
        patient_id=patient_id,
        action="view_visits",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return rows
