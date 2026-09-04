"""R3/R5 agent smoke tests — tool contracts + guardrail heuristics.

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

GOLDEN_PATH = Path(__file__).parent / "golden_queries.yaml"


def test_golden_yaml_loads():
    cases = yaml.safe_load(GOLDEN_PATH.read_text())
    assert isinstance(cases, list)
    assert len(cases) >= 5
    for case in cases:
        assert "id" in case
        assert "query" in case
        assert "expected_tool_calls" in case


def test_root_agent_registers_seven_tools():
    from agents.retrieval.agent import root_agent

    tool_names = {getattr(t, "__name__", getattr(t, "name", str(t))) for t in root_agent.tools}
    expected = {
        "search_patients",
        "get_patient_summary",
        "get_patient_timeline",
        "get_latest_vitals",
        "get_visit_history",
        "get_active_medications",
        "get_active_allergies",
    }
    # ADK may wrap callables; fall back to counting tools
    if not expected.issubset(tool_names):
        assert len(list(root_agent.tools)) == 7
    else:
        assert expected.issubset(tool_names)


def test_r3_tool_contracts_for_fixture(fixture_patient_id: str, fixture_last_name: str):
    """Exercise the same tools golden cases expect (without LLM)."""
    from tests.retrieval.conftest import _bq_available

    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.retrieval.tools import (
        get_active_medications,
        get_latest_vitals,
        get_patient_summary,
        get_patient_timeline,
        get_visit_history,
        search_patients,
    )

    search = search_patients(last_name=fixture_last_name)
    assert search and search[0]["patient_id"]

    summary = get_patient_summary(fixture_patient_id)
    assert summary and "total_encounters" in summary

    timeline = get_patient_timeline(fixture_patient_id, limit=10)
    assert timeline and "event_date" in timeline[0]

    meds = get_active_medications(fixture_patient_id)
    assert isinstance(meds, list)

    vitals = get_latest_vitals(fixture_patient_id)
    assert vitals and vitals["patient_id"] == fixture_patient_id

    visits = get_visit_history(fixture_patient_id, limit=5)
    assert visits and "visit_date" in visits[0]


def test_r5_guardrail_prompt_contains_rules():
    from agents.retrieval.prompt import SYSTEM_INSTRUCTION

    text = SYSTEM_INSTRUCTION.lower()
    assert "do not diagnose" in text or "do not provide medical diagnoses" in text
    assert "consult a clinician" in text
    assert "search_patients" in text


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_AGENT_SMOKE", "FALSE").upper() != "TRUE",
    reason="Set RUN_LIVE_AGENT_SMOKE=TRUE to run live ADK + Gemini smoke",
)
@pytest.mark.asyncio
async def test_live_agent_lookup_smoke(fixture_last_name: str):
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from agents.retrieval.agent import root_agent

    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="swiftcare",
        session_service=session_service,
    )
    session = await session_service.create_session(
        app_name="swiftcare", user_id="test-user", session_id="smoke-001"
    )
    message = types.Content(
        role="user",
        parts=[types.Part(text=f"Find patients with last name {fixture_last_name}")],
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
    assert "patient" in joined or fixture_last_name.lower() in joined
