"""Active allergies from v_active_allergies."""

from __future__ import annotations

from typing import Any

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def get_active_allergies(patient_id: str) -> list[dict[str, Any]]:
    """Active allergies for allergy_awareness / chart_completeness cards.

    Args:
        patient_id: FHIR patient identifier.

    Returns:
        Active allergy rows, highest criticality first.
    """
    # criticality is a string; CASE ranks high > low > other/null
    sql = f"""
SELECT allergy_id, allergen, criticality
FROM {fq("swiftcare_fhir_views", "v_active_allergies")}
WHERE patient_id = @patient_id
ORDER BY
  CASE LOWER(COALESCE(criticality, ''))
    WHEN 'high' THEN 3
    WHEN 'low' THEN 2
    ELSE 1
  END DESC,
  allergen
"""
    rows, row_count, latency_ms = run_query(sql, {"patient_id": patient_id})
    log_tool_call(
        "get_active_allergies",
        patient_id=patient_id,
        action="view_allergies",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return rows
