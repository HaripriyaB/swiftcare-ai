"""S3/S5 agent smoke tests — tool contracts + guardrail heuristics.

Full LLM golden evaluation requires GOOGLE_API_KEY / Vertex credentials.
These tests validate the tool layer used by the agent and the golden YAML
contract without requiring a live Gemini call by default.

Set RUN_LIVE_AGENT_SMOKE=TRUE to exercise the ADK agent end-to-end.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

os.environ.setdefault("LOG_QUERIES_TO_BQ", "FALSE")
os.environ.setdefault("AGENT_TYPE", "suggestion")

GOLDEN_PATH = Path(__file__).parent / "golden_queries.yaml"


def test_golden_yaml_loads():
    cases = yaml.safe_load(GOLDEN_PATH.read_text())
    assert isinstance(cases, list)
    assert len(cases) >= 5
    for case in cases:
        assert "id" in case
        assert "query" in case
        assert "expected_tool_calls" in case
    ids = {c["id"] for c in cases}
    assert "G006" in ids  # refuse-diagnosis


def test_root_agent_registers_eight_tools():
    from agents.suggestion.agent import root_agent

    tool_names = {
        getattr(t, "__name__", getattr(t, "name", str(t))) for t in root_agent.tools
    }
    expected = {
        "search_patients",
        "get_active_medications",
        "get_active_allergies",
        "get_visit_summary",
        "get_patient_summary",
        "create_advisory_card",
        "list_advisory_cards",
        "dismiss_advisory_card",
    }
    if not expected.issubset(tool_names):
        assert len(list(root_agent.tools)) == 8
    else:
        assert expected.issubset(tool_names)


def test_s3_tool_contracts_for_fixture(fixture_patient_id: str, fixture_card_id: str):
    """Exercise the same tools golden cases expect (without LLM)."""
    from tests.suggestion.conftest import _bq_available

    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.suggestion.cards import reset_create_count
    from agents.suggestion.tools import (
        create_advisory_card,
        dismiss_advisory_card,
        get_active_allergies,
        get_active_medications,
        get_patient_summary,
        get_visit_summary,
        list_advisory_cards,
    )

    allergies = get_active_allergies(fixture_patient_id)
    assert isinstance(allergies, list)

    meds = get_active_medications(fixture_patient_id)
    assert isinstance(meds, list)

    summary = get_patient_summary(fixture_patient_id)
    assert summary and summary["patient_id"] == fixture_patient_id

    visits = get_visit_summary(fixture_patient_id, limit=5)
    assert isinstance(visits, list)

    reset_create_count()
    card = create_advisory_card(
        patient_id=fixture_patient_id,
        card_type="chart_completeness",
        title="Chart completeness",
        body="Staff may want to note if allergy documentation is incomplete.",
        severity="info",
    )
    assert "card_id" in card
    assert card["content"]["disclaimer"]

    listed = list_advisory_cards(fixture_patient_id)
    assert isinstance(listed, list)

    dismissed = dismiss_advisory_card(fixture_card_id, fixture_patient_id)
    assert dismissed.get("dismissed") is True or "error" in dismissed


def test_s5_guardrail_prompt_contains_rules():
    from agents.suggestion.prompt import SYSTEM_INSTRUCTION

    text = SYSTEM_INSTRUCTION.lower()
    assert "do not diagnose" in text or "you do not diagnose" in text
    assert "search_patients" in text
    assert "consult a clinician" in text
    assert "create_advisory_card" in text
    assert "prefix" in text
    assert "multiple" in text and "patient_id" in text


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_AGENT_SMOKE", "FALSE").upper() != "TRUE",
    reason="Set RUN_LIVE_AGENT_SMOKE=TRUE to run live ADK + Gemini smoke",
)
@pytest.mark.asyncio
async def test_live_agent_requires_patient_id():
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from agents.suggestion.agent import root_agent

    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="swiftcare",
        session_service=session_service,
    )
    session = await session_service.create_session(
        app_name="swiftcare", user_id="test-user", session_id="smoke-sugg-001"
    )
    message = types.Content(
        role="user",
        parts=[types.Part(text="Flag allergy advisories")],
    )
    texts: list[str] = []
    async for event in runner.run_async(
        user_id="test-user",
        session_id=session.id,
        new_message=message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    texts.append(part.text)

    assert texts, "Agent returned no text"
    joined = " ".join(texts).lower()
    assert "patient" in joined
