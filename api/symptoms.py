"""patient_symptoms list / add / resolve."""

from __future__ import annotations

import uuid
from typing import Any

from api.bq import fq, run_dml, run_query


def list_symptoms(
    patient_id: str,
    *,
    active_only: bool = True,
) -> list[dict[str, Any]]:
    sql = f"""
SELECT
  symptom_id,
  patient_id,
  description,
  reported_by,
  recorded_by_user_id,
  status,
  CAST(recorded_at AS STRING) AS recorded_at,
  CAST(resolved_at AS STRING) AS resolved_at
FROM {fq("swiftcare_ops", "patient_symptoms")}
WHERE patient_id = @patient_id
  AND (@active_only = FALSE OR status = 'active')
ORDER BY recorded_at DESC
"""
    rows, _, _ = run_query(
        sql, {"patient_id": patient_id, "active_only": active_only}
    )
    for row in rows:
        uid = row.get("recorded_by_user_id")
        row["recorded_by_display"] = (
            "dev-user@local" if uid == "dev-user" else (uid or None)
        )
    return rows


def add_symptom(
    patient_id: str,
    *,
    description: str,
    reported_by: str,
    recorded_by_user_id: str,
) -> dict[str, Any]:
    desc = (description or "").strip()
    if not desc:
        raise ValueError("description_required")
    rb = (reported_by or "staff").strip().lower()
    if rb not in ("patient", "staff"):
        raise ValueError("invalid_reported_by")

    symptom_id = str(uuid.uuid4())
    sql = f"""
INSERT INTO {fq("swiftcare_ops", "patient_symptoms")}
  (symptom_id, patient_id, description, reported_by, recorded_by_user_id, status)
VALUES
  (@symptom_id, @patient_id, @description, @reported_by, @user_id, 'active')
"""
    run_dml(
        sql,
        {
            "symptom_id": symptom_id,
            "patient_id": patient_id,
            "description": desc,
            "reported_by": rb,
            "user_id": recorded_by_user_id,
        },
    )
    rows = list_symptoms(patient_id, active_only=False)
    for row in rows:
        if row["symptom_id"] == symptom_id:
            return row
    return {
        "symptom_id": symptom_id,
        "patient_id": patient_id,
        "description": desc,
        "reported_by": rb,
        "recorded_by_user_id": recorded_by_user_id,
        "recorded_by_display": recorded_by_user_id,
        "status": "active",
        "recorded_at": None,
        "resolved_at": None,
    }


def resolve_symptom(patient_id: str, symptom_id: str) -> dict[str, Any]:
    sql = f"""
UPDATE {fq("swiftcare_ops", "patient_symptoms")}
SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP()
WHERE symptom_id = @symptom_id
  AND patient_id = @patient_id
  AND status = 'active'
"""
    affected = run_dml(
        sql, {"symptom_id": symptom_id, "patient_id": patient_id}
    )
    if affected == 0:
        raise LookupError("not_found")
    rows = list_symptoms(patient_id, active_only=False)
    for row in rows:
        if row["symptom_id"] == symptom_id:
            return row
    return {
        "symptom_id": symptom_id,
        "patient_id": patient_id,
        "status": "resolved",
        "description": "",
        "reported_by": "staff",
        "resolved_at": None,
        "recorded_at": None,
    }
