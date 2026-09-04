"""ADK root agent for SwiftCare Retrieval (Chunk 2)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from google.adk.agents import Agent

load_dotenv()

from .prompt import SYSTEM_INSTRUCTION  # noqa: E402
from .tools import (  # noqa: E402
    get_active_allergies,
    get_active_medications,
    get_latest_vitals,
    get_patient_summary,
    get_patient_timeline,
    get_visit_history,
    search_patients,
)

root_agent = Agent(
    name=os.getenv("AGENT_NAME", "swiftcare_retrieval_agent"),
    model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    description=(
        "Retrieval agent for SwiftCare AI. Answers front-desk questions "
        "about patient charts using grounded BigQuery data."
    ),
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        search_patients,
        get_patient_summary,
        get_patient_timeline,
        get_latest_vitals,
        get_visit_history,
        get_active_medications,
        get_active_allergies,
    ],
)
