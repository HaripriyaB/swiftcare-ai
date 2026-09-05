from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from agents.insights.tools.at_risk import list_at_risk_patients
from agents.insights.tools.insight_alerts import (
    create_insight_alert,
    dismiss_insight_alert,
    list_insight_alerts,
)
from agents.insights.tools.risk_distribution import get_risk_distribution

from api.auth import CurrentUser, get_current_user
from api.bq import fq, run_query

router = APIRouter(tags=["insights"])


class AlertCreate(BaseModel):
    patient_id: str
    alert_type: str
    severity: str
    message: str = ""
    days_since_last_visit: int | None = None


def _err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status,
        detail={"error": code, "message": message},
    )


@router.get("/insights/distribution")
def insights_distribution(
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    return get_risk_distribution()


@router.get("/insights/at-risk")
def insights_at_risk(
    risk_flag: str | None = None,
    risk_level: str | None = None,
    limit: int = Query(10, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    result = list_at_risk_patients(
        risk_flag=risk_flag, risk_level=risk_level, limit=limit
    )
    if result.get("error"):
        raise _err(400, "invalid_filter", str(result["error"]))
    return {
        "patients": result.get("patients", []),
        "count": result.get("count", 0),
    }


@router.get("/insights/alerts")
def insights_alerts(
    open: bool = Query(True),
    patient_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    return list_insight_alerts(
        patient_id=patient_id, include_dismissed=not open
    )


@router.post("/insights/alerts")
def create_alert(
    body: AlertCreate,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    result = create_insight_alert(
        patient_id=body.patient_id,
        alert_type=body.alert_type,
        severity=body.severity,
        message=body.message,
        days_since_last_visit=body.days_since_last_visit,
    )
    if result.get("error"):
        raise _err(400, str(result["error"]), str(result["error"]))
    return result


@router.post("/insights/alerts/{alert_id}/dismiss")
def dismiss_alert(
    alert_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    # FE does not send patient_id — look it up
    sql = f"""
SELECT patient_id FROM {fq("swiftcare_ops", "insight_alerts")}
WHERE alert_id = @alert_id
LIMIT 1
"""
    try:
        rows, _, _ = run_query(sql, {"alert_id": alert_id})
    except Exception as exc:
        raise _err(500, "lookup_failed", str(exc)) from exc
    if not rows:
        raise _err(404, "not_found", "Alert not found")
    result = dismiss_insight_alert(alert_id, rows[0]["patient_id"])
    if result.get("error"):
        raise _err(404, "not_found", str(result["error"]))
    return result
