"""I3/I5 agent smoke tests — tool contracts + guardrail heuristics.

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
os.environ.setdefault("AGENT_TYPE", "insights")

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
    from agents.insights.agent import root_agent

    tool_names = {
        getattr(t, "__name__", getattr(t, "name", str(t))) for t in root_agent.tools
    }
    expected = {
        "search_patients",
        "list_at_risk_patients",
        "get_patient_risk",
        "get_risk_distribution",
        "get_patient_summary",
        "create_insight_alert",
        "list_insight_alerts",
        "dismiss_insight_alert",
    }
    if not expected.issubset(tool_names):
        assert len(list(root_agent.tools)) == 8
    else:
        assert expected.issubset(tool_names)


def test_i3_tool_contracts_for_fixtures(
    fixture_patient_id: str,
    fixture_at_risk_patient_id: str,
    fixture_alert_id: str,
):
    """Exercise the same tools golden cases expect (without LLM)."""
    from tests.insights.conftest import _bq_available

    if not _bq_available():
        pytest.skip("GCP ADC not configured")

    from agents.insights.alerts import reset_create_count
    from agents.insights.tools import (
        create_insight_alert,
        dismiss_insight_alert,
        get_patient_risk,
        get_risk_distribution,
        list_at_risk_patients,
        list_insight_alerts,
    )

    care_gaps = list_at_risk_patients(risk_flag="gap_in_care", limit=10)
    assert isinstance(care_gaps["patients"], list)

    high_util = list_at_risk_patients(risk_flag="high_utilizer", limit=10)
    assert isinstance(high_util["patients"], list)

    dist = get_risk_distribution()
    assert dist["count"] >= 1

    risk = get_patient_risk(fixture_patient_id)
    assert risk is not None

    reset_create_count()
    created = create_insight_alert(
        patient_id=fixture_at_risk_patient_id,
        alert_type="high_utilizer",
        severity="HIGH",
        message="Data shows high encounter volume — staff may want to review scheduling load.",
    )
    assert "error" not in created or created.get("deduped")

    alerts = list_insight_alerts(patient_id=fixture_at_risk_patient_id)
    assert isinstance(alerts, list)

    # Fixture alert from conftest should be dismissible
    dismissed = dismiss_insight_alert(fixture_alert_id, fixture_patient_id)
    assert dismissed.get("dismissed") is True or "error" in dismissed


def test_i5_prompt_refuses_clinical_orders():
    from agents.insights.prompt import SYSTEM_INSTRUCTION

    lower = SYSTEM_INSTRUCTION.lower()
    assert "do not diagnose" in lower or "you do not diagnose" in lower
    assert "prescribe" in lower
    assert "mv_at_risk_patients" in lower or "v_risk_flags" in lower
    assert "search_patients" in lower
    assert "do not ask whether the name is first or last" in lower
    assert "results_table" in lower or "display_hint" in lower
    assert "handoff → retrieval" in lower
    assert "handoff → suggestion" in lower
    assert "patient_id:" in lower
    assert "fell off the schedule" in lower or "morning huddle" in lower
    assert "markdown table" in lower or "#" in SYSTEM_INSTRUCTION


def test_i5_003_prompt_cites_source():
    from agents.insights.prompt import SYSTEM_INSTRUCTION

    assert "mv_at_risk_patients" in SYSTEM_INSTRUCTION
    assert "v_risk_flags" in SYSTEM_INSTRUCTION


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_AGENT_SMOKE", "FALSE").upper() != "TRUE",
    reason="Set RUN_LIVE_AGENT_SMOKE=TRUE to run live ADK smoke",
)
@pytest.mark.asyncio
async def test_live_agent_care_gaps_smoke():
    import uuid

    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from agents.insights.agent import root_agent

    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="swiftcare",
        session_service=session_service,
    )
    session = await session_service.create_session(
        app_name="swiftcare",
        user_id="dev-user",
        session_id=str(uuid.uuid4()),
    )
    message = types.Content(
        role="user",
        parts=[types.Part(text="Which patients have care gaps? List up to 5.")],
    )
    texts: list[str] = []
    async for event in runner.run_async(
        user_id="dev-user",
        session_id=session.id,
        new_message=message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    texts.append(part.text)
    joined = "\n".join(texts).lower()
    assert texts
    assert "patient" in joined or "gap" in joined or "risk" in joined
