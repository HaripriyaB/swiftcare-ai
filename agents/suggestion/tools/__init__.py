"""Guarded Suggestion Agent tools — parameterized BigQuery only."""

from .advisory_cards import (
    create_advisory_card,
    dismiss_advisory_card,
    list_advisory_cards,
)
from .allergies import get_active_allergies
from .medications import get_active_medications
from .patient_360 import get_patient_summary
from .patient_lookup import search_patients
from .visits import get_visit_summary

ALL_TOOLS = [
    search_patients,
    get_active_medications,
    get_active_allergies,
    get_visit_summary,
    get_patient_summary,
    create_advisory_card,
    list_advisory_cards,
    dismiss_advisory_card,
]

__all__ = [
    "ALL_TOOLS",
    "search_patients",
    "get_active_medications",
    "get_active_allergies",
    "get_visit_summary",
    "get_patient_summary",
    "create_advisory_card",
    "list_advisory_cards",
    "dismiss_advisory_card",
]
