"""Active medications from v_active_medications."""

from __future__ import annotations

from typing import Any

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def get_active_medications(patient_id: str) -> list[dict[str, Any]]:
    """Active medications for medication_review advisory context.

    Args:
        patient_id: FHIR patient identifier.

    Returns:
        Active medication rows.
    """
    sql = f"""
SELECT medication_id, medication_code, medication_name, prescribed_date, status
FROM {fq("swiftcare_fhir_views", "v_active_medications")}
WHERE patient_id = @patient_id
ORDER BY prescribed_date DESC
"""
    rows, row_count, latency_ms = run_query(sql, {"patient_id": patient_id})
    log_tool_call(
        "get_active_medications",
        patient_id=patient_id,
        action="view_medications",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return rows
