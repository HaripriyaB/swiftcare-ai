"""Synthetic local-data adapter used only when ``LOCAL_DEMO_MODE=true``.

It lets the React app exercise the real FastAPI contract without BigQuery,
Vertex, or Firebase configuration.  The data is read from the existing frontend
fixtures so the browser and API demo paths stay consistent.  Never enable this
module for real patient data or a Cloud Run deployment.
"""

from __future__ import annotations

import copy
import json
import os
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "frontend" / "src" / "mocks" / "fixtures"


def enabled() -> bool:
    return os.getenv("LOCAL_DEMO_MODE", "false").strip().lower() in {
        "1",
        "true",
        "yes",
    }


@lru_cache(maxsize=None)
def _fixture(name: str) -> Any:
    with (FIXTURES / name).open(encoding="utf-8") as handle:
        return json.load(handle)


# Mutable records intentionally last only for the local process lifetime.
_symptoms: dict[str, list[dict[str, Any]]] | None = None
_cards: dict[str, list[dict[str, Any]]] | None = None
_alerts: list[dict[str, Any]] | None = None


def _symptom_store() -> dict[str, list[dict[str, Any]]]:
    global _symptoms
    if _symptoms is None:
        _symptoms = copy.deepcopy(_fixture("symptoms.json"))
    return _symptoms


def _card_store() -> dict[str, list[dict[str, Any]]]:
    global _cards
    if _cards is None:
        _cards = copy.deepcopy(_fixture("cards.json"))
    return _cards


def _alert_store() -> list[dict[str, Any]]:
    global _alerts
    if _alerts is None:
        _alerts = copy.deepcopy(_fixture("alerts.json")["alerts"])
    return _alerts


def search_patients(query: str) -> dict[str, Any]:
    needle = (query or "").strip().lower()
    matches = []
    for patient in _fixture("patients.json"):
        names = " ".join(
            str(patient.get(key, ""))
            for key in (
                "display_first_name",
                "display_last_name",
                "first_name",
                "last_name",
            )
        ).lower()
        if not needle or needle in names:
            matches.append(copy.deepcopy(patient))
    return {
        "match_count": len(matches),
        "matches": matches,
        "results_table": None,
        "display_hint": "Select a row to open the patient workspace.",
    }


def chart_for(patient_id: str) -> dict[str, Any] | None:
    row = _fixture("chart.json").get(patient_id)
    return copy.deepcopy(row) if row else None


def conditions_for(patient_id: str) -> list[dict[str, Any]]:
    return copy.deepcopy(_fixture("conditions.json").get(patient_id, []))


def list_symptoms(patient_id: str, *, active_only: bool = True) -> list[dict[str, Any]]:
    rows = _symptom_store().get(patient_id, [])
    if active_only:
        rows = [row for row in rows if row.get("status") == "active"]
    return copy.deepcopy(rows)


def add_symptom(
    patient_id: str, *, description: str, reported_by: str, user_id: str
) -> dict[str, Any]:
    row = {
        "symptom_id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "description": description,
        "reported_by": reported_by,
        "recorded_by_user_id": user_id,
        "recorded_by_display": "dev-user@local" if user_id == "dev-user" else user_id,
        "status": "active",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
    }
    _symptom_store().setdefault(patient_id, []).append(row)
    return copy.deepcopy(row)


def resolve_symptom(patient_id: str, symptom_id: str) -> dict[str, Any] | None:
    for row in _symptom_store().get(patient_id, []):
        if row["symptom_id"] == symptom_id and row["status"] == "active":
            row["status"] = "resolved"
            row["resolved_at"] = datetime.now(timezone.utc).isoformat()
            return copy.deepcopy(row)
    return None


def list_cards(patient_id: str, *, include_dismissed: bool = False) -> list[dict[str, Any]]:
    rows = _card_store().get(patient_id, [])
    if not include_dismissed:
        rows = [row for row in rows if not row.get("dismissed")]
    return copy.deepcopy(rows)


def dismiss_card(patient_id: str, card_id: str) -> bool:
    for row in _card_store().get(patient_id, []):
        if row["card_id"] == card_id and not row.get("dismissed"):
            row["dismissed"] = True
            return True
    return False


def distribution() -> list[dict[str, Any]]:
    return copy.deepcopy(_fixture("alerts.json")["distribution"])


def at_risk(
    *, risk_flag: str | None, risk_level: str | None, limit: int
) -> list[dict[str, Any]]:
    rows = _fixture("alerts.json")["atRisk"]
    if risk_flag:
        rows = [row for row in rows if row["risk_flag"] == risk_flag]
    if risk_level:
        rows = [row for row in rows if row["risk_level"] == risk_level]
    return copy.deepcopy(rows[:limit])


def list_alerts(
    *, patient_id: str | None = None, include_dismissed: bool = False
) -> list[dict[str, Any]]:
    rows = _alert_store()
    if patient_id:
        rows = [row for row in rows if row["patient_id"] == patient_id]
    if not include_dismissed:
        rows = [row for row in rows if not row.get("dismissed")]
    return copy.deepcopy(rows)


def dismiss_alert(alert_id: str) -> bool:
    for row in _alert_store():
        if row["alert_id"] == alert_id and not row.get("dismissed"):
            row["dismissed"] = True
            return True
    return False

