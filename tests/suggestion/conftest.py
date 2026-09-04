"""Shared fixtures for Suggestion Agent tests."""

from __future__ import annotations

import os

import pytest
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("LOG_QUERIES_TO_BQ", "FALSE")
os.environ.setdefault("AGENT_TYPE", "suggestion")
os.environ.setdefault("DEDUPE_OPEN_CARDS", "TRUE")


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
def _reset_card_create_counter():
    from agents.suggestion.cards import reset_create_count

    reset_create_count()
    yield
    reset_create_count()


@pytest.fixture(scope="session")
def fixture_patient_id() -> str:
    """Resolve one cohort patient_id from BigQuery."""
    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.suggestion.bq_client import fq, run_query

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


@pytest.fixture
def fixture_card_id(fixture_patient_id: str) -> str:
    """Create an open advisory card and return its card_id (for G005 / dismiss)."""
    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.suggestion.cards import reset_create_count
    from agents.suggestion.tools.advisory_cards import create_advisory_card

    reset_create_count()
    result = create_advisory_card(
        patient_id=fixture_patient_id,
        card_type="chart_completeness",
        title="Test fixture card",
        body="Staff may want to review chart completeness for this patient.",
        severity="info",
    )
    if result.get("error"):
        pytest.skip(f"Could not create fixture card: {result['error']}")
    return result["card_id"]
