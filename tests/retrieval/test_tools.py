"""R1/R2 tool unit tests against live BigQuery (Chunk 1 data)."""

from __future__ import annotations

import os

import pytest

# Keep tool tests from flooding ops tables
os.environ["LOG_QUERIES_TO_BQ"] = "FALSE"

from agents.retrieval.tools import (
    get_active_allergies,
    get_active_medications,
    get_latest_vitals,
    get_patient_summary,
    get_patient_timeline,
    get_visit_history,
    search_patients,
)
from tests.retrieval.conftest import requires_bq

VALID_EVENT_TYPES = {"encounter", "condition", "observation", "medication"}


@requires_bq
def test_r1_001_search_patients_smoke(fixture_last_name: str):
    rows = search_patients(last_name=fixture_last_name)
    assert len(rows) >= 1
    assert rows[0].get("patient_id")
    assert rows[0].get("first_name") is not None
    assert rows[0].get("last_name")


@requires_bq
def test_r1_002_get_patient_summary_smoke(fixture_patient_id: str):
    row = get_patient_summary(fixture_patient_id)
    assert row is not None
    assert row["patient_id"] == fixture_patient_id
    assert row["total_encounters"] >= 0


@requires_bq
def test_r1_003_get_patient_timeline_smoke(fixture_patient_id: str):
    rows = get_patient_timeline(fixture_patient_id, limit=5)
    assert len(rows) >= 1
    assert rows[0]["event_type"] in VALID_EVENT_TYPES


@requires_bq
def test_r1_004_get_latest_vitals_smoke(fixture_patient_id: str):
    row = get_latest_vitals(fixture_patient_id)
    assert row is not None
    assert row["patient_id"] == fixture_patient_id


@requires_bq
def test_r1_005_get_visit_history_smoke(fixture_patient_id: str):
    rows = get_visit_history(fixture_patient_id, limit=5)
    assert len(rows) >= 1
    assert "visit_date" in rows[0]


@requires_bq
def test_r1_006_get_active_medications_smoke(fixture_patient_id: str):
    rows = get_active_medications(fixture_patient_id)
    assert isinstance(rows, list)


@requires_bq
def test_r1_007_get_active_allergies_smoke(fixture_patient_id: str):
    rows = get_active_allergies(fixture_patient_id)
    assert isinstance(rows, list)


@requires_bq
def test_r2_001_name_search_limit(fixture_last_name: str):
    rows = search_patients(last_name=fixture_last_name)
    assert len(rows) <= 20


@requires_bq
def test_r2_002_case_insensitive_search(fixture_last_name: str):
    lower = search_patients(last_name=fixture_last_name.lower())
    mixed = search_patients(last_name=fixture_last_name.upper())
    assert {r["patient_id"] for r in lower} == {r["patient_id"] for r in mixed}


@requires_bq
def test_r5_003_no_hallucinated_summary():
    row = get_patient_summary("definitely-not-a-real-patient-id-000")
    assert row is None


def test_allowlist_rejects_raw_dataset():
    from agents.retrieval.bq_client import run_query

    with pytest.raises(ValueError, match="disallowed|allowlisted"):
        run_query(
            "SELECT 1 FROM `swiftcare-patchamomma.swiftcare_fhir_raw.patient` LIMIT 1"
        )
