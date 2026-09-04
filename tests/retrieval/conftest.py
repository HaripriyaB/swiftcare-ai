"""Shared fixtures for Retrieval Agent tests."""

from __future__ import annotations

import os

import pytest
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("LOG_QUERIES_TO_BQ", "FALSE")


def _bq_available() -> bool:
    try:
        import google.auth

        google.auth.default()
        return True
    except Exception:
        return False


requires_bq = pytest.mark.skipif(
    not _bq_available(),
    reason="GCP Application Default Credentials not configured "
    "(run: gcloud auth application-default login)",
)


@pytest.fixture(scope="session")
def fixture_patient_id() -> str:
    """Resolve one cohort patient_id from BigQuery."""
    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.retrieval.bq_client import fq, run_query

    sql = f"""
SELECT patient_id, last_name
FROM {fq("swiftcare_fhir_views", "v_patient_360")}
WHERE last_name IS NOT NULL
LIMIT 1
"""
    try:
        rows, _, _ = run_query(sql)
    except Exception as exc:
        pytest.skip(f"BigQuery unavailable: {exc}")
    if not rows:
        pytest.skip("No patients in v_patient_360 — run Chunk 1 first")
    return rows[0]["patient_id"]


@pytest.fixture(scope="session")
def fixture_last_name(fixture_patient_id: str) -> str:
    from agents.retrieval.bq_client import fq, run_query

    sql = f"""
SELECT last_name
FROM {fq("swiftcare_fhir_views", "v_patient_360")}
WHERE patient_id = @patient_id
LIMIT 1
"""
    rows, _, _ = run_query(sql, {"patient_id": fixture_patient_id})
    return rows[0]["last_name"]
