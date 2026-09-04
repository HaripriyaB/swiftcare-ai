"""ADK root agent for SwiftCare Insights (Chunk 4)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from google.adk.agents import Agent

load_dotenv()

from .prompt import SYSTEM_INSTRUCTION  # noqa: E402
from .tools import (  # noqa: E402
    create_insight_alert,
    dismiss_insight_alert,
    get_patient_risk,
    get_patient_summary,
    get_risk_distribution,
    list_at_risk_patients,
    list_insight_alerts,
    search_patients,
)

root_agent = Agent(
    name=os.getenv("AGENT_NAME", "swiftcare_insights_agent"),
    model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    description=(
        "Insights agent for SwiftCare AI. Mines population risk and visit-gap "
        "patterns; surfaces dismissible operational insight alerts."
    ),
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        search_patients,
        list_at_risk_patients,
        get_patient_risk,
        get_risk_distribution,
        get_patient_summary,
        create_insight_alert,
        list_insight_alerts,
        dismiss_insight_alert,
    ],
)
