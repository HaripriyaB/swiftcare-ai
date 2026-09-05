"""Server-side patient export + audit."""

from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from agents.retrieval.tools.allergies import get_active_allergies
from agents.retrieval.tools.medications import get_active_medications
from agents.retrieval.tools.patient_360 import get_patient_summary
from agents.retrieval.tools.timeline import get_patient_timeline
from agents.retrieval.tools.visits import get_visit_history
from agents.retrieval.tools.vitals import get_latest_vitals
from agents.suggestion.tools.advisory_cards import list_advisory_cards
from agents.insights.tools.insight_alerts import list_insight_alerts

from api.bq import fq, run_query
from api.bq_conditions import list_conditions
from api.symptoms import list_symptoms

_DISCLAIMER = (
    "Operational export for staff use. Not a clinical order or legal medical "
    "record substitute."
)


def _audit(user_id: str, patient_id: str, action: str) -> None:
    sql = f"""
INSERT INTO {fq("swiftcare_ops", "patient_access_audit")}
  (audit_id, user_id, patient_id, action)
VALUES
  (@audit_id, @user_id, @patient_id, @action)
"""
    try:
        run_query(
            sql,
            {
                "audit_id": str(uuid.uuid4()),
                "user_id": user_id,
                "patient_id": patient_id,
                "action": action,
            },
        )
    except Exception:
        pass


def build_export_envelope(patient_id: str, user_id: str) -> dict[str, Any]:
    summary = get_patient_summary(patient_id) or {}
    envelope = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "patient_id": patient_id,
        "disclaimer": _DISCLAIMER,
        "summary": summary,
        "symptoms": list_symptoms(patient_id, active_only=False),
        "diagnostic_outcomes": list_conditions(patient_id, active_only=False),
        "recommended_next_steps": list_advisory_cards(
            patient_id, include_dismissed=False
        ),
        "medications": get_active_medications(patient_id),
        "allergies": get_active_allergies(patient_id),
        "visits": get_visit_history(patient_id),
        "timeline": get_patient_timeline(patient_id),
        "vitals": get_latest_vitals(patient_id) or {},
        "insight_alerts_open": list_insight_alerts(
            patient_id=patient_id, include_dismissed=False
        ),
    }
    _audit(user_id, patient_id, "export_patient")
    return envelope


def envelope_to_csv(envelope: dict[str, Any]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["section", "key", "value"])
    for section, payload in envelope.items():
        if section in ("exported_at", "patient_id", "disclaimer"):
            writer.writerow([section, "", payload])
            continue
        if isinstance(payload, list):
            for i, row in enumerate(payload):
                writer.writerow([section, str(i), json.dumps(row, default=str)])
        else:
            writer.writerow([section, "", json.dumps(payload, default=str)])
    return buf.getvalue()
