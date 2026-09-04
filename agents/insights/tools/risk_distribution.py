"""Cohort risk distribution aggregate."""

from __future__ import annotations

from typing import Any

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def get_risk_distribution() -> dict[str, Any]:
    """Aggregate counts by risk_flag and risk_level for cohort overview.

    Returns:
        Dict with rows list and source citation.
    """
    sql = f"""
SELECT risk_flag, risk_level, COUNT(*) AS patient_count
FROM {fq("swiftcare_fhir_views", "v_risk_flags")}
GROUP BY risk_flag, risk_level
ORDER BY patient_count DESC
"""
    rows, row_count, latency_ms = run_query(sql)
    log_tool_call(
        "get_risk_distribution",
        patient_id=None,
        action="view_risk_distribution",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return {
        "distribution": rows,
        "count": row_count,
        "source": "swiftcare_fhir_views.v_risk_flags",
    }
