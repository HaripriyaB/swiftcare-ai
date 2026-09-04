"""Population at-risk list tool."""

from __future__ import annotations

from typing import Any

from agents.display_names import with_display_names

from ..alerts import ALLOWED_SEVERITIES, default_at_risk_limit
from ..bq_client import fq, run_query
from ..logging import log_tool_call

# risk_flag values that appear on mv_at_risk_patients (excludes scheduling_inefficiency)
_RISK_FLAGS = frozenset(
    {"gap_in_care", "polypharmacy", "high_utilizer", "chronic_burden"}
)


def list_at_risk_patients(
    risk_flag: str | None = None,
    risk_level: str | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    """Population scan of at-risk patients from mv_at_risk_patients.

    Args:
        risk_flag: Optional filter — gap_in_care, polypharmacy, high_utilizer,
            chronic_burden.
        risk_level: Optional filter — HIGH, MEDIUM, LOW.
        limit: Max rows (default DEFAULT_AT_RISK_LIMIT, hard-capped).

    Returns:
        Dict with patients list, count, and applied filters.
    """
    max_limit = default_at_risk_limit()
    effective_limit = max_limit if limit is None else min(int(limit), max_limit)
    if effective_limit < 1:
        effective_limit = 1

    flag = (risk_flag or "").strip() or None
    if flag is not None and flag not in _RISK_FLAGS:
        return {
            "error": (
                f"invalid risk_flag '{risk_flag}'; "
                f"allowed: {sorted(_RISK_FLAGS)}"
            ),
            "patients": [],
            "count": 0,
        }

    level = (risk_level or "").strip().upper() or None
    if level is not None and level not in ALLOWED_SEVERITIES:
        return {
            "error": (
                f"invalid risk_level '{risk_level}'; "
                f"allowed: {sorted(ALLOWED_SEVERITIES)}"
            ),
            "patients": [],
            "count": 0,
        }

    sql = f"""
SELECT patient_id, first_name, last_name, age_years, encounters_last_90d,
       active_condition_count, active_med_count, days_since_last_visit,
       risk_flag, risk_level
FROM {fq("swiftcare_agent_cache", "mv_at_risk_patients")}
WHERE (@risk_flag IS NULL OR risk_flag = @risk_flag)
  AND (@risk_level IS NULL OR risk_level = @risk_level)
ORDER BY
  CASE risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
  days_since_last_visit DESC
LIMIT @limit
"""
    rows, row_count, latency_ms = run_query(
        sql,
        {
            "risk_flag": flag,
            "risk_level": level,
            "limit": effective_limit,
        },
    )
    patients = [with_display_names(r) for r in rows]
    log_tool_call(
        "list_at_risk_patients",
        patient_id=None,
        action="list_at_risk",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return {
        "patients": patients,
        "count": row_count,
        "limit": effective_limit,
        "risk_flag": flag,
        "risk_level": level,
        "source": "swiftcare_agent_cache.mv_at_risk_patients",
    }
