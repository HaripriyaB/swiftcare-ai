"""Server-side authorization boundaries for patient and population access."""

from __future__ import annotations

import os

from fastapi import HTTPException, status

from api.auth import CurrentUser
from api.bq import fq, run_query
from api import local_demo


def _production_authorization_enabled() -> bool:
    """Require grants outside the explicit synthetic local demo."""
    return not local_demo.enabled()


def _deny(message: str = "You are not authorized for this resource") -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": "forbidden", "message": message},
    )


def _has_grant(user_id: str, patient_id: str | None, action: str) -> bool:
    """Check the production grant table with parameterized SQL.

    A row for the concrete patient grants that chart; a row with a NULL patient
    grants the population capability. `can_write` is required for mutations.
    """
    sql = f"""
SELECT 1
FROM {fq("swiftcare_ops", "patient_access_grants")}
WHERE user_id = @user_id
  AND active = TRUE
  AND ((@patient_id IS NULL AND patient_id IS NULL) OR patient_id = @patient_id)
  AND (@action = 'read' OR can_write = TRUE)
LIMIT 1
"""
    try:
        rows, _, _ = run_query(
            sql,
            {"user_id": user_id, "patient_id": patient_id, "action": action},
        )
    except Exception:
        # A missing/misconfigured authorization data source must fail closed.
        return False
    return bool(rows)


def require_patient_access(
    user: CurrentUser, patient_id: str, *, action: str = "read"
) -> None:
    if _production_authorization_enabled() and not _has_grant(
        user.user_id, patient_id, action
    ):
        _deny()


def require_population_access(user: CurrentUser, *, action: str = "read") -> None:
    if _production_authorization_enabled() and not _has_grant(
        user.user_id, None, action
    ):
        _deny("You are not authorized for population data")


def audit_access(user: CurrentUser, patient_id: str, action: str) -> None:
    """Best-effort, token-free audit record for an authorized action."""
    if local_demo.enabled():
        return
    sql = f"""
INSERT INTO {fq("swiftcare_ops", "patient_access_audit")}
  (audit_id, user_id, patient_id, action)
VALUES (GENERATE_UUID(), @user_id, @patient_id, @action)
"""
    try:
        run_query(sql, {"user_id": user.user_id, "patient_id": patient_id, "action": action})
    except Exception:
        # Logging failure must be monitored operationally; it must not expose
        # the underlying database exception in an API response.
        pass
