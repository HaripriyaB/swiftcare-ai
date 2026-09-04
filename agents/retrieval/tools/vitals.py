"""Latest vitals from agent cache snapshot."""

from __future__ import annotations

from typing import Any

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def get_latest_vitals(patient_id: str) -> dict[str, Any] | None:
    """Latest vital signs from agent cache snapshot table.

    Args:
        patient_id: FHIR patient identifier.

    Returns:
        Vitals row (fields may be null), or None if no cache row.
    """
    sql = f"""
SELECT patient_id, height_cm, weight_kg, bmi,
       systolic_bp, diastolic_bp, heart_rate, respiratory_rate,
       latest_observation_date
FROM {fq("swiftcare_agent_cache", "mv_patient_latest_vitals")}
WHERE patient_id = @patient_id
LIMIT 1
"""
    rows, row_count, latency_ms = run_query(sql, {"patient_id": patient_id})
    log_tool_call(
        "get_latest_vitals",
        patient_id=patient_id,
        action="view_vitals",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return rows[0] if rows else None
