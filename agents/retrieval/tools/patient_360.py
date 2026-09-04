"""Patient 360 summary tool."""

from __future__ import annotations

from typing import Any

from agents.display_names import with_display_names

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def get_patient_summary(patient_id: str) -> dict[str, Any] | None:
    """Full Patient 360 summary for a single patient_id.

    Args:
        patient_id: FHIR patient identifier.

    Returns:
        One summary row, or None if not found.
    """
    sql = f"""
SELECT patient_id, first_name, last_name, birth_date, age_years, gender,
       city, state, is_deceased,
       last_encounter_class, last_encounter_desc, last_visit_date,
       active_conditions_count, active_medications_count, active_allergies_count,
       total_encounters
FROM {fq("swiftcare_fhir_views", "v_patient_360")}
WHERE patient_id = @patient_id
LIMIT 1
"""
    rows, row_count, latency_ms = run_query(sql, {"patient_id": patient_id})
    log_tool_call(
        "get_patient_summary",
        patient_id=patient_id,
        action="view_summary",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return with_display_names(rows[0]) if rows else None
