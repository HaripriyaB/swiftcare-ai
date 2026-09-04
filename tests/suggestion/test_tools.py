"""S1/S2 tool unit tests against live BigQuery (Chunk 3)."""

from __future__ import annotations

import os

import pytest

os.environ["LOG_QUERIES_TO_BQ"] = "FALSE"
os.environ["AGENT_TYPE"] = "suggestion"
os.environ["DEDUPE_OPEN_CARDS"] = "TRUE"

from agents.suggestion.cards import reset_create_count
from agents.suggestion.tools import (
    create_advisory_card,
    dismiss_advisory_card,
    get_active_allergies,
    get_active_medications,
    get_patient_summary,
    get_visit_summary,
    list_advisory_cards,
    search_patients,
)
from tests.suggestion.conftest import requires_bq


@requires_bq
def test_s1_000_search_patients_smoke(fixture_patient_id: str):
    from agents.suggestion.bq_client import fq, run_query

    rows, _, _ = run_query(
        f"""
SELECT last_name, first_name
FROM {fq("swiftcare_fhir_views", "v_patient_360")}
WHERE patient_id = @patient_id
LIMIT 1
""",
        {"patient_id": fixture_patient_id},
    )
    assert rows
    result = search_patients(last_name=rows[0]["last_name"])
    assert result["match_count"] >= 1
    m = result["matches"][0]
    assert m["patient_id"]
    assert "last_name" in m
    assert "last_visit_date" in m or m.get("last_visit_date") is None
    # location fields present for disambiguation UI
    assert "city" in m and "state" in m and "location" in m


@requires_bq
def test_s1_000b_search_requires_a_name():
    result = search_patients()
    assert result.get("error") == "provide_name"
    assert result["match_count"] == 0


@requires_bq
def test_s1_000c_single_token_prefix_matches_last_or_first():
    """Synthea stores Kuhn96 — bare 'Kuhn' must find last-name prefix matches."""
    result = search_patients(name="Kuhn")
    assert result["match_count"] >= 1
    assert result["matches"][0]["match_score"] >= result["matches"][-1]["match_score"]
    assert any(
        str(m.get("last_name", "")).lower().startswith("kuhn")
        or str(m.get("first_name", "")).lower().startswith("kuhn")
        for m in result["matches"]
    )
    # Best matches should prefer last-name Kuhn* for this cohort
    top = result["matches"][0]
    assert "patient_id" in top and "location" in top and "last_visit_date" in top
    assert "results_table" in result
    assert "| First name |" in result["results_table"]
    assert "| Patient ID |" in result["results_table"]
    assert "display_hint" in result


def test_format_matches_table_unit():
    from agents.patient_lookup import format_matches_table

    table = format_matches_table(
        [
            {
                "patient_id": "abc-123",
                "first_name": "Shanice479",
                "last_name": "Kuhn96",
                "location": "Abington, Massachusetts",
                "last_visit_date": "2019-07-14",
                "matched_on": "prefix_last",
            }
        ]
    )
    assert table.startswith("| # |")
    assert "Shanice" in table
    assert "479" not in table
    assert "Kuhn" in table
    assert "Kuhn96" not in table
    assert "`abc-123`" in table
    assert "Last name" in table


def test_display_person_name_strips_synthea_suffix():
    from agents.display_names import display_person_name

    assert display_person_name("Fannie183") == "Fannie"
    assert display_person_name("Kuhn96") == "Kuhn"
    assert display_person_name("Shanice479") == "Shanice"
    assert display_person_name("Mary") == "Mary"
    assert display_person_name(None) is None


@requires_bq
def test_s1_001_get_active_medications_smoke(fixture_patient_id: str):
    rows = get_active_medications(fixture_patient_id)
    assert isinstance(rows, list)
    if rows:
        assert "medication_name" in rows[0] or "medication_id" in rows[0]


@requires_bq
def test_s1_002_get_active_allergies_smoke(fixture_patient_id: str):
    rows = get_active_allergies(fixture_patient_id)
    assert isinstance(rows, list)


@requires_bq
def test_s1_003_get_visit_summary_smoke(fixture_patient_id: str):
    rows = get_visit_summary(fixture_patient_id, limit=5)
    assert isinstance(rows, list)
    if rows:
        assert "visit_date" in rows[0]


@requires_bq
def test_s1_004_get_patient_summary_smoke(fixture_patient_id: str):
    row = get_patient_summary(fixture_patient_id)
    assert row is not None
    assert row["patient_id"] == fixture_patient_id


@requires_bq
def test_s1_005_create_list_dismiss_roundtrip(fixture_patient_id: str):
    reset_create_count()
    created = create_advisory_card(
        patient_id=fixture_patient_id,
        card_type="follow_up_scheduling",
        title="Scheduling review",
        body="Data shows a visit gap — staff may want to review scheduling.",
        severity="info",
    )
    assert "error" not in created
    card_id = created["card_id"]
    assert created["content"]["disclaimer"]

    open_cards = list_advisory_cards(fixture_patient_id, include_dismissed=False)
    assert any(c["card_id"] == card_id for c in open_cards)

    dismissed = dismiss_advisory_card(card_id, fixture_patient_id)
    assert dismissed.get("dismissed") is True

    open_after = list_advisory_cards(fixture_patient_id, include_dismissed=False)
    assert not any(c["card_id"] == card_id for c in open_after)

    all_cards = list_advisory_cards(fixture_patient_id, include_dismissed=True)
    match = next(c for c in all_cards if c["card_id"] == card_id)
    assert match["dismissed"] is True


def test_s1_006_reject_invalid_card_type():
    result = create_advisory_card(
        patient_id="any-patient-id",
        card_type="diagnosis",
        title="Bad",
        body="Should not insert",
    )
    assert "error" in result
    assert "invalid card_type" in result["error"]


@requires_bq
def test_s2_001_dedupe_open_card_type(fixture_patient_id: str):
    reset_create_count()
    # Use a unique-ish type for this test; dismiss any open medication_review first
    for card in list_advisory_cards(fixture_patient_id, include_dismissed=False):
        content = card.get("content") or {}
        if isinstance(content, dict) and content.get("card_type") == "medication_review":
            dismiss_advisory_card(card["card_id"], fixture_patient_id)

    reset_create_count()
    first = create_advisory_card(
        patient_id=fixture_patient_id,
        card_type="medication_review",
        title="Med review",
        body="Staff may want to review the active medication list.",
        severity="attention",
    )
    second = create_advisory_card(
        patient_id=fixture_patient_id,
        card_type="medication_review",
        title="Med review again",
        body="Staff may want to review the active medication list again.",
        severity="attention",
    )
    assert first["card_id"] == second["card_id"]
    assert second.get("deduped") is True

    open_med = [
        c
        for c in list_advisory_cards(fixture_patient_id)
        if (c.get("content") or {}).get("card_type") == "medication_review"
    ]
    assert len(open_med) == 1


@requires_bq
def test_s2_002_dismiss_requires_patient_match(fixture_patient_id: str):
    reset_create_count()
    created = create_advisory_card(
        patient_id=fixture_patient_id,
        card_type="allergy_awareness",
        title="Allergy awareness",
        body="Documented allergies require staff awareness before scheduling.",
        severity="attention",
    )
    card_id = created["card_id"]
    result = dismiss_advisory_card(card_id, "wrong-patient-id-000")
    assert result.get("error") == "not_found_or_already_dismissed"

    still_open = list_advisory_cards(fixture_patient_id, include_dismissed=False)
    assert any(c["card_id"] == card_id for c in still_open)


def test_s5_003_cards_include_disclaimer_unit():
    from agents.suggestion.cards import build_content
    import json

    raw = build_content(
        title="t",
        body="b",
        severity="info",
        card_type="chart_completeness",
    )
    content = json.loads(raw)
    assert content["disclaimer"]


def test_s5_prompt_shares_patient_resolution_rules():
    from agents.suggestion.prompt import SYSTEM_INSTRUCTION

    text = SYSTEM_INSTRUCTION.lower()
    assert "do not ask whether the name is first or last" in text
    assert "results_table" in text or "display_hint" in text
    assert "search_patients" in text


def test_allowlist_rejects_raw_and_cache():
    from agents.suggestion.bq_client import run_query

    with pytest.raises(ValueError, match="disallowed|allowlisted|cache"):
        run_query(
            "SELECT 1 FROM `swiftcare-patchamomma.swiftcare_fhir_raw.patient` LIMIT 1"
        )

    with pytest.raises(ValueError, match="cache|allowlisted"):
        run_query(
            "SELECT 1 FROM "
            "`swiftcare-patchamomma.swiftcare_agent_cache.mv_at_risk_patients` LIMIT 1"
        )


def test_reject_clinical_body_language():
    from agents.suggestion.cards import validate_body_language

    assert validate_body_language("I prescribe antibiotics") is not None
    assert validate_body_language("Staff may want to review documented allergies.") is None
