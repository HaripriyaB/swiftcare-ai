from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from agents.retrieval.tools.allergies import get_active_allergies
from agents.retrieval.tools.medications import get_active_medications
from agents.retrieval.tools.patient_360 import get_patient_summary
from agents.retrieval.tools.patient_lookup import search_patients
from agents.retrieval.tools.timeline import get_patient_timeline
from agents.retrieval.tools.visits import get_visit_history
from agents.retrieval.tools.vitals import get_latest_vitals
from agents.suggestion.tools.advisory_cards import (
    create_advisory_card,
    dismiss_advisory_card,
    list_advisory_cards,
)

from api.auth import CurrentUser, get_current_user
from api.bq_conditions import list_conditions
from api.export_builder import build_export_envelope, envelope_to_csv
from api import symptoms as symptoms_mod

router = APIRouter(tags=["patients"])


class SymptomCreate(BaseModel):
    description: str
    reported_by: str = "staff"


class AdvisoryCreate(BaseModel):
    card_type: str
    title: str
    body: str
    severity: str | None = None
    session_id: str | None = None
    source_refs: list[dict[str, Any]] | None = None


def _err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status,
        detail={"error": code, "message": message},
    )


@router.get("/patients/search")
def patients_search(
    q: str = Query(""),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    result = search_patients(name=q)
    if "error" in result and result.get("match_count", 0) == 0 and not q.strip():
        return result
    return {
        "match_count": result.get("match_count", 0),
        "matches": result.get("matches", []),
        "results_table": result.get("results_table"),
        "display_hint": result.get("display_hint")
        or result.get("message")
        or "Select a row to open the patient workspace.",
    }


@router.get("/patients/{patient_id}/summary")
def patient_summary(
    patient_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    row = get_patient_summary(patient_id)
    if not row:
        raise _err(404, "not_found", "Patient not found")
    return row


@router.get("/patients/{patient_id}/conditions")
def patient_conditions(
    patient_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    return list_conditions(patient_id)


@router.get("/patients/{patient_id}/medications")
def patient_medications(
    patient_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    return get_active_medications(patient_id)


@router.get("/patients/{patient_id}/allergies")
def patient_allergies(
    patient_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    return get_active_allergies(patient_id)


@router.get("/patients/{patient_id}/visits")
def patient_visits(
    patient_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    return get_visit_history(patient_id)


@router.get("/patients/{patient_id}/timeline")
def patient_timeline(
    patient_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    return get_patient_timeline(patient_id)


@router.get("/patients/{patient_id}/vitals")
def patient_vitals(
    patient_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    row = get_latest_vitals(patient_id)
    return row or {"patient_id": patient_id}


@router.get("/patients/{patient_id}/symptoms")
def patient_symptoms(
    patient_id: str,
    active: bool = Query(True),
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    try:
        return symptoms_mod.list_symptoms(patient_id, active_only=active)
    except Exception as exc:
        raise _err(500, "symptoms_error", str(exc)) from exc


@router.post("/patients/{patient_id}/symptoms")
def add_patient_symptom(
    patient_id: str,
    body: SymptomCreate,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return symptoms_mod.add_symptom(
            patient_id,
            description=body.description,
            reported_by=body.reported_by,
            recorded_by_user_id=user.user_id,
        )
    except ValueError as exc:
        raise _err(400, str(exc), str(exc)) from exc
    except Exception as exc:
        raise _err(500, "symptoms_error", str(exc)) from exc


@router.post("/patients/{patient_id}/symptoms/{symptom_id}/resolve")
def resolve_patient_symptom(
    patient_id: str,
    symptom_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    try:
        return symptoms_mod.resolve_symptom(patient_id, symptom_id)
    except LookupError as exc:
        raise _err(404, "not_found", "Symptom not found") from exc
    except Exception as exc:
        raise _err(500, "symptoms_error", str(exc)) from exc


@router.get("/patients/{patient_id}/advisory-cards")
def patient_advisory_cards(
    patient_id: str,
    open: bool = Query(True),
    user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    _ = user
    return list_advisory_cards(
        patient_id, include_dismissed=not open
    )


@router.post("/patients/{patient_id}/advisory-cards")
def create_patient_advisory_card(
    patient_id: str,
    body: AdvisoryCreate,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    refs = None
    if body.source_refs is not None:
        refs = json.dumps(body.source_refs)
    result = create_advisory_card(
        patient_id=patient_id,
        card_type=body.card_type,
        title=body.title,
        body=body.body,
        severity=body.severity,
        session_id=body.session_id,
        source_refs=refs,
    )
    if result.get("error"):
        raise _err(400, str(result["error"]), str(result["error"]))
    return result


@router.post("/patients/{patient_id}/advisory-cards/{card_id}/dismiss")
def dismiss_patient_advisory_card(
    patient_id: str,
    card_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = user
    result = dismiss_advisory_card(card_id, patient_id)
    if result.get("error"):
        raise _err(404, "not_found", str(result["error"]))
    return result


@router.get("/patients/{patient_id}/export")
def export_patient(
    patient_id: str,
    format: str = Query("json"),
    user: CurrentUser = Depends(get_current_user),
) -> Response:
    envelope = build_export_envelope(patient_id, user.user_id)
    if format.lower() == "csv":
        return Response(
            content=envelope_to_csv(envelope),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="patient-{patient_id}.csv"'
            },
        )
    return Response(
        content=json.dumps(envelope, default=str),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="patient-{patient_id}.json"'
        },
    )
