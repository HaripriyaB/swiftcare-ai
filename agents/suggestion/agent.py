"""ADK root agent for SwiftCare Suggestion (Chunk 3)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from google.adk.agents import Agent

load_dotenv()

from .prompt import SYSTEM_INSTRUCTION  # noqa: E402
from .tools import (  # noqa: E402
    create_advisory_card,
    dismiss_advisory_card,
    get_active_allergies,
    get_active_medications,
    get_patient_summary,
    get_visit_summary,
    list_advisory_cards,
    search_patients,
)

root_agent = Agent(
    name=os.getenv("AGENT_NAME", "swiftcare_suggestion_agent"),
    model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    description=(
        "Suggestion agent for SwiftCare AI. Surfaces guardrailed, dismissible "
        "operational advisory cards for front-desk and care coordination."
    ),
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        search_patients,
        get_active_medications,
        get_active_allergies,
        get_visit_summary,
        get_patient_summary,
        create_advisory_card,
        list_advisory_cards,
        dismiss_advisory_card,
    ],
)
