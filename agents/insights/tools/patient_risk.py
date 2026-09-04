"""Single-patient risk lookup from v_risk_flags."""

from __future__ import annotations

from typing import Any

from agents.display_names import with_display_names

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def get_patient_risk(patient_id: str) -> dict[str, Any] | None:
    """Single-patient risk row from v_risk_flags (includes risk_flag='none').

    Args:
        patient_id: FHIR patient identifier.

    Returns:
        One risk row, or None if not found.
    """
    sql = f"""
SELECT patient_id, first_name, last_name, age_years, total_encounters,
       last_visit_date, days_since_last_visit, encounters_last_90d,
       active_med_count, active_condition_count, risk_flag, risk_level
FROM {fq("swiftcare_fhir_views", "v_risk_flags")}
WHERE patient_id = @patient_id
LIMIT 1
"""
    rows, row_count, latency_ms = run_query(sql, {"patient_id": patient_id})
    log_tool_call(
        "get_patient_risk",
        patient_id=patient_id,
        action="view_patient_risk",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    if not rows:
        return None
    result = with_display_names(rows[0])
    result["source"] = "swiftcare_fhir_views.v_risk_flags"
    return result
