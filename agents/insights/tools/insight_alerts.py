"""Insight alert create / list / dismiss tools."""

from __future__ import annotations

import uuid
from typing import Any

from ..alerts import (
    build_operational_insight_message,
    bump_create_count,
    dedupe_open_alerts,
    ensure_disclaimer,
    get_create_count,
    max_alerts_per_turn,
    normalize_severity,
    validate_alert_type,
    validate_message_language,
    validate_severity,
)
from ..bq_client import fq, run_dml, run_query
from ..logging import log_tool_call


def create_insight_alert(
    patient_id: str,
    alert_type: str,
    severity: str,
    message: str = "",
    days_since_last_visit: int | None = None,
) -> dict[str, Any]:
    """Persist a dismissible insight alert. Returns alert_id + fields.

    Args:
        patient_id: FHIR patient identifier.
        alert_type: One of gap_in_care, polypharmacy, high_utilizer,
            chronic_burden, scheduling_inefficiency.
        severity: HIGH, MEDIUM, or LOW.
        message: Operational (non-clinical-order) alert message. If empty,
            a standard ops template is built from alert_type/severity.
        days_since_last_visit: Optional days for the standard template.
    """
    err = validate_alert_type(alert_type)
    if err:
        return {"error": err}

    sev = normalize_severity(severity)
    err = validate_severity(sev)
    if err:
        return {"error": err}

    body = (message or "").strip()
    if not body:
        body = build_operational_insight_message(
            risk_flag=alert_type,
            risk_level=sev,
            days_since_last_visit=days_since_last_visit,
        )

    err = validate_message_language(body)
    if err:
        return {"error": err}

    if get_create_count() >= max_alerts_per_turn():
        return {
            "error": "max_alerts_per_turn_exceeded",
            "max": max_alerts_per_turn(),
        }

    if dedupe_open_alerts():
        existing = _find_open_alert(patient_id, alert_type)
        if existing:
            return {
                "alert_id": existing["alert_id"],
                "deduped": True,
                "patient_id": existing["patient_id"],
                "alert_type": existing["alert_type"],
                "severity": existing["severity"],
                "message": existing["message"],
                "dismissed": False,
            }

    alert_id = str(uuid.uuid4())
    final_message = ensure_disclaimer(body)

    sql = f"""
INSERT INTO {fq("swiftcare_ops", "insight_alerts")}
  (alert_id, patient_id, alert_type, severity, message, dismissed)
VALUES
  (@alert_id, @patient_id, @alert_type, @severity, @message, FALSE)
"""
    affected = run_dml(
        sql,
        {
            "alert_id": alert_id,
            "patient_id": patient_id,
            "alert_type": alert_type,
            "severity": sev,
            "message": final_message,
        },
    )
    bump_create_count()
    log_tool_call(
        "create_insight_alert",
        patient_id=patient_id,
        action="create_insight_alert",
        row_count=affected,
        latency_ms=0,
    )
    return {
        "alert_id": alert_id,
        "deduped": False,
        "patient_id": patient_id,
        "alert_type": alert_type,
        "severity": sev,
        "message": final_message,
        "dismissed": False,
    }


def list_insight_alerts(
    patient_id: str | None = None,
    include_dismissed: bool = False,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List insight alerts (default: open only; optional patient filter)."""
    effective_limit = max(1, min(int(limit), 200))
    sql = f"""
SELECT alert_id, patient_id, alert_type, severity, message, dismissed, created_at
FROM {fq("swiftcare_ops", "insight_alerts")}
WHERE (@patient_id IS NULL OR patient_id = @patient_id)
  AND (@include_dismissed = TRUE OR dismissed = FALSE)
ORDER BY created_at DESC
LIMIT @limit
"""
    rows, row_count, latency_ms = run_query(
        sql,
        {
            "patient_id": patient_id or None,
            "include_dismissed": include_dismissed,
            "limit": effective_limit,
        },
    )
    log_tool_call(
        "list_insight_alerts",
        patient_id=patient_id,
        action="list_insight_alerts",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    return rows


def dismiss_insight_alert(alert_id: str, patient_id: str) -> dict[str, Any]:
    """Soft-dismiss an alert. Requires matching patient_id for safety."""
    sql = f"""
UPDATE {fq("swiftcare_ops", "insight_alerts")}
SET dismissed = TRUE
WHERE alert_id = @alert_id
  AND patient_id = @patient_id
  AND dismissed = FALSE
"""
    affected = run_dml(
        sql,
        {"alert_id": alert_id, "patient_id": patient_id},
    )
    log_tool_call(
        "dismiss_insight_alert",
        patient_id=patient_id,
        action="dismiss_insight_alert",
        row_count=affected,
        latency_ms=0,
    )
    if affected == 0:
        return {"error": "not_found_or_already_dismissed", "alert_id": alert_id}
    return {"alert_id": alert_id, "dismissed": True}


def _find_open_alert(patient_id: str, alert_type: str) -> dict[str, Any] | None:
    """Return an open alert of the same alert_type if one exists."""
    sql = f"""
SELECT alert_id, patient_id, alert_type, severity, message, dismissed, created_at
FROM {fq("swiftcare_ops", "insight_alerts")}
WHERE patient_id = @patient_id
  AND dismissed = FALSE
  AND alert_type = @alert_type
ORDER BY created_at DESC
LIMIT 1
"""
    rows, _, _ = run_query(
        sql, {"patient_id": patient_id, "alert_type": alert_type}
    )
    return rows[0] if rows else None
