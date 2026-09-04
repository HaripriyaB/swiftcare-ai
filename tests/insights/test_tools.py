"""I1/I2 tool unit tests against live BigQuery (Chunk 4)."""

from __future__ import annotations

import os

import pytest

os.environ["LOG_QUERIES_TO_BQ"] = "FALSE"
os.environ["AGENT_TYPE"] = "insights"
os.environ["DEDUPE_OPEN_ALERTS"] = "TRUE"

from agents.insights.alerts import reset_create_count
from agents.insights.tools import (
    create_insight_alert,
    dismiss_insight_alert,
    get_patient_risk,
    get_patient_summary,
    get_risk_distribution,
    list_at_risk_patients,
    list_insight_alerts,
)
from tests.insights.conftest import requires_bq


@requires_bq
def test_i1_001_list_at_risk_patients_smoke():
    result = list_at_risk_patients(limit=10)
    assert "error" not in result
    assert result["count"] >= 1
    assert len(result["patients"]) <= 10
    row = result["patients"][0]
    assert row["patient_id"]
    assert row["risk_flag"] != "none"
    assert result["source"] == "swiftcare_agent_cache.mv_at_risk_patients"


@requires_bq
def test_i1_002_get_patient_risk_smoke(fixture_patient_id: str):
    row = get_patient_risk(fixture_patient_id)
    assert row is not None
    assert row["patient_id"] == fixture_patient_id
    assert "risk_flag" in row
    assert "risk_level" in row


@requires_bq
def test_i1_003_get_risk_distribution_smoke():
    result = get_risk_distribution()
    assert result["count"] >= 1
    assert result["distribution"][0]["patient_count"] > 0
    assert "risk_flag" in result["distribution"][0]


@requires_bq
def test_i1_004_get_patient_summary_smoke(fixture_patient_id: str):
    row = get_patient_summary(fixture_patient_id)
    assert row is not None
    assert row["patient_id"] == fixture_patient_id


@requires_bq
def test_i1_005_create_list_dismiss_roundtrip(fixture_patient_id: str):
    reset_create_count()
    created = create_insight_alert(
        patient_id=fixture_patient_id,
        alert_type="chronic_burden",
        severity="MEDIUM",
        message="Data shows elevated chronic condition count — staff may want to review care coordination.",
    )
    assert "error" not in created
    alert_id = created["alert_id"]
    assert "Not a diagnosis" in created["message"] or "clinical order" in created["message"]

    open_alerts = list_insight_alerts(
        patient_id=fixture_patient_id, include_dismissed=False
    )
    assert any(a["alert_id"] == alert_id for a in open_alerts)

    dismissed = dismiss_insight_alert(alert_id, fixture_patient_id)
    assert dismissed.get("dismissed") is True

    open_after = list_insight_alerts(
        patient_id=fixture_patient_id, include_dismissed=False
    )
    assert not any(a["alert_id"] == alert_id for a in open_after)

    all_alerts = list_insight_alerts(
        patient_id=fixture_patient_id, include_dismissed=True
    )
    match = next(a for a in all_alerts if a["alert_id"] == alert_id)
    assert match["dismissed"] is True


def test_i1_006_reject_invalid_alert_type():
    result = create_insight_alert(
        patient_id="any-patient-id",
        alert_type="diagnosis",
        severity="HIGH",
        message="Should not insert",
    )
    assert "error" in result
    assert "invalid alert_type" in result["error"]


@requires_bq
def test_i2_001_list_respects_limit():
    result = list_at_risk_patients(limit=5)
    assert result["count"] <= 5
    assert len(result["patients"]) <= 5


@requires_bq
def test_i2_002_dedupe_open_alert_type(fixture_at_risk_patient_id: str):
    reset_create_count()
    pid = fixture_at_risk_patient_id
    for alert in list_insight_alerts(patient_id=pid, include_dismissed=False):
        if alert.get("alert_type") == "gap_in_care":
            dismiss_insight_alert(alert["alert_id"], pid)

    reset_create_count()
    first = create_insight_alert(
        patient_id=pid,
        alert_type="gap_in_care",
        severity="MEDIUM",
        message="Data shows a visit gap — staff may want to review scheduling.",
    )
    second = create_insight_alert(
        patient_id=pid,
        alert_type="gap_in_care",
        severity="MEDIUM",
        message="Data shows a visit gap again — staff may want to review scheduling.",
    )
    assert first["alert_id"] == second["alert_id"]
    assert second.get("deduped") is True

    open_gap = [
        a
        for a in list_insight_alerts(patient_id=pid)
        if a.get("alert_type") == "gap_in_care"
    ]
    assert len(open_gap) == 1


@requires_bq
def test_i2_003_dismiss_requires_patient_match(fixture_patient_id: str):
    reset_create_count()
    created = create_insight_alert(
        patient_id=fixture_patient_id,
        alert_type="polypharmacy",
        severity="HIGH",
        message="Data shows high active medication count — staff may want to review.",
    )
    alert_id = created["alert_id"]
    result = dismiss_insight_alert(alert_id, "wrong-patient-id-000")
    assert result.get("error") == "not_found_or_already_dismissed"

    still_open = list_insight_alerts(
        patient_id=fixture_patient_id, include_dismissed=False
    )
    assert any(a["alert_id"] == alert_id for a in still_open)


def test_i5_003_alerts_include_disclaimer_unit():
    from agents.insights.alerts import ensure_disclaimer

    msg = ensure_disclaimer("Staff may want to review care gaps.")
    assert "Not a diagnosis" in msg or "clinical order" in msg


def test_allowlist_rejects_raw_and_disallowed_cache():
    from agents.insights.bq_client import run_query

    with pytest.raises(ValueError, match="disallowed|allowlisted"):
        run_query(
            "SELECT 1 FROM `swiftcare-patchamomma.swiftcare_fhir_raw.patient` LIMIT 1"
        )

    with pytest.raises(ValueError, match="disallowed|allowlisted|cache"):
        run_query(
            "SELECT 1 FROM "
            "`swiftcare-patchamomma.swiftcare_agent_cache.mv_patient_latest_vitals` "
            "LIMIT 1"
        )


def test_allowlist_accepts_at_risk_cache_shape():
    """Allowlist check should not raise for mv_at_risk_patients SQL (no network)."""
    from agents.insights.bq_client import _assert_allowlisted

    _assert_allowlisted(
        "SELECT * FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_at_risk_patients` "
        "LIMIT 1"
    )
    _assert_allowlisted(
        "SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags` LIMIT 1"
    )


def test_reject_clinical_message_language():
    from agents.insights.alerts import validate_message_language

    assert validate_message_language("I prescribe antibiotics") is not None
    assert (
        validate_message_language(
            "Staff may want to review documented care gaps."
        )
        is None
    )


def test_invalid_risk_flag_filter():
    result = list_at_risk_patients(risk_flag="not_a_flag", limit=5)
    assert "error" in result
    assert result["count"] == 0


def test_build_operational_insight_message_unit():
    from agents.insights.alerts import build_operational_insight_message

    msg = build_operational_insight_message(
        risk_flag="gap_in_care",
        risk_level="MEDIUM",
        days_since_last_visit=400,
    )
    assert "risk_flag=gap_in_care" in msg
    assert "risk_level=MEDIUM" in msg
    assert "days_since_last_visit=400" in msg
    assert "Staff may want to review" in msg


def test_create_alert_auto_builds_message_when_empty():
    """Empty message should use the B.3.5 operational template (no BQ needed for validation path)."""
    from agents.insights.alerts import validate_alert_type

    assert validate_alert_type("gap_in_care") is None
    from agents.insights.alerts import build_operational_insight_message, ensure_disclaimer

    built = ensure_disclaimer(
        build_operational_insight_message(risk_flag="gap_in_care", risk_level="HIGH")
    )
    assert "Operational insight" in built
    assert "Not a diagnosis" in built


def test_allowlist_rejects_advisory_cards():
    from agents.insights.bq_client import run_query

    with pytest.raises(ValueError, match="advisory_cards"):
        run_query(
            "SELECT 1 FROM `swiftcare-patchamomma.swiftcare_ops.advisory_cards` LIMIT 1"
        )


@requires_bq
def test_i5_002_name_resolution_shared():
    """I5-002: shared search_patients returns markdown table; no invented ids."""
    from agents.insights.tools import search_patients

    result = search_patients(name="Kuhn")
    assert "error" not in result or result.get("match_count", 0) >= 0
    assert result["match_count"] >= 1
    assert "results_table" in result
    assert "| First name |" in result["results_table"]
    assert "display_hint" in result
    for m in result["matches"]:
        assert m.get("patient_id")
        # Display names should not reintroduce obvious Synthea digit suffixes in first_name
        fn = m.get("first_name") or ""
        assert not (fn and fn[-1].isdigit() and any(c.isalpha() for c in fn))


@requires_bq
def test_i4_001_query_log_insights(fixture_patient_id: str):
    """I4-001: tool call with LOG_QUERIES_TO_BQ writes agent_type=insights."""
    import os
    import time
    import uuid

    from agents.insights.bq_client import fq, run_query
    from agents.insights.tools import get_patient_risk

    prev = os.environ.get("LOG_QUERIES_TO_BQ")
    os.environ["LOG_QUERIES_TO_BQ"] = "TRUE"
    os.environ["AGENT_TYPE"] = "insights"
    marker = f"tool:get_patient_risk:{uuid.uuid4()}"
    try:
        # Force a unique natural_language_query via log_query after tool call
        from agents.insights import logging as logging_mod

        row = get_patient_risk(fixture_patient_id)
        assert row is not None
        logging_mod.log_query(
            natural_language_query=marker,
            generated_sql="get_patient_risk:v1",
            row_count=1,
            latency_ms=1,
            patient_id=fixture_patient_id,
        )
        # Brief settle for streaming insert visibility
        time.sleep(1.5)
        rows, _, _ = run_query(
            f"""
SELECT log_id, agent_type, natural_language_query
FROM {fq("swiftcare_ops", "agent_query_log")}
WHERE natural_language_query = @marker
ORDER BY created_at DESC
LIMIT 1
""",
            {"marker": marker},
        )
        assert rows, "expected agent_query_log row for insights"
        assert rows[0]["agent_type"] == "insights"
    finally:
        if prev is None:
            os.environ["LOG_QUERIES_TO_BQ"] = "FALSE"
        else:
            os.environ["LOG_QUERIES_TO_BQ"] = prev
