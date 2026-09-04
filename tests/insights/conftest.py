"""Shared fixtures for Insights Agent tests."""

from __future__ import annotations

import os

import pytest
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("LOG_QUERIES_TO_BQ", "FALSE")
os.environ.setdefault("AGENT_TYPE", "insights")
os.environ.setdefault("DEDUPE_OPEN_ALERTS", "TRUE")


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


@pytest.fixture(autouse=True)
def _reset_alert_create_counter():
    from agents.insights.alerts import reset_create_count

    reset_create_count()
    yield
    reset_create_count()


@pytest.fixture(scope="session")
def fixture_patient_id() -> str:
    """Resolve one cohort patient_id from BigQuery."""
    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.insights.bq_client import fq, run_query

    sql = f"""
SELECT patient_id
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
def fixture_at_risk_patient_id() -> str:
    """Resolve one at-risk patient_id from mv_at_risk_patients."""
    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.insights.bq_client import fq, run_query

    sql = f"""
SELECT patient_id
FROM {fq("swiftcare_agent_cache", "mv_at_risk_patients")}
LIMIT 1
"""
    try:
        rows, _, _ = run_query(sql)
    except Exception as exc:
        pytest.skip(f"BigQuery unavailable: {exc}")
    if not rows:
        pytest.skip("No rows in mv_at_risk_patients — run Chunk 1 first")
    return rows[0]["patient_id"]


@pytest.fixture
def fixture_alert_id(fixture_patient_id: str) -> str:
    """Create an open insight alert and return its alert_id."""
    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.insights.alerts import reset_create_count
    from agents.insights.tools.insight_alerts import create_insight_alert

    reset_create_count()
    result = create_insight_alert(
        patient_id=fixture_patient_id,
        alert_type="scheduling_inefficiency",
        severity="LOW",
        message="Staff may want to review scheduling patterns for this patient.",
    )
    if result.get("error"):
        pytest.skip(f"Could not create fixture alert: {result['error']}")
    return result["alert_id"]
