"""Patient name lookup against v_patient_360."""

from __future__ import annotations

import os
from typing import Any

from agents.display_names import with_display_names

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def search_patients(
    last_name: str,
    first_name: str | None = None,
) -> list[dict[str, Any]]:
    """Find patients by name. Returns up to 20 matches from v_patient_360.

    Args:
        last_name: Patient family name (case-insensitive exact match).
        first_name: Optional given-name prefix (case-insensitive).

    Returns:
        List of matching patient summary rows.
    """
    limit = int(os.getenv("SEARCH_RESULT_LIMIT", "20"))
    has_first = bool(first_name and first_name.strip())
    sql = f"""
SELECT patient_id, first_name, last_name, age_years, gender, city, state,
       last_visit_date, active_conditions_count, active_medications_count
FROM {fq("swiftcare_fhir_views", "v_patient_360")}
WHERE LOWER(last_name) = LOWER(@last_name)
  AND (@has_first_name = FALSE OR LOWER(first_name) LIKE CONCAT(LOWER(@first_name), '%'))
ORDER BY last_name, first_name
LIMIT @limit
"""
    rows, row_count, latency_ms = run_query(
        sql,
        {
            "last_name": last_name,
            "first_name": first_name or "",
            "has_first_name": has_first,
            "limit": limit,
        },
    )
    log_tool_call(
        "search_patients",
        patient_id=rows[0]["patient_id"] if rows else None,
        action="search",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return [with_display_names(r) for r in rows]
