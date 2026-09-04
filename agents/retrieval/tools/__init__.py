"""Guarded Retrieval Agent tools — parameterized BigQuery only."""

from .allergies import get_active_allergies
from .medications import get_active_medications
from .patient_360 import get_patient_summary
from .patient_lookup import search_patients
from .timeline import get_patient_timeline
from .visits import get_visit_history
from .vitals import get_latest_vitals

ALL_TOOLS = [
    search_patients,
    get_patient_summary,
    get_patient_timeline,
    get_latest_vitals,
    get_visit_history,
    get_active_medications,
    get_active_allergies,
]

__all__ = [
    "ALL_TOOLS",
    "search_patients",
    "get_patient_summary",
    "get_patient_timeline",
    "get_latest_vitals",
    "get_visit_history",
    "get_active_medications",
    "get_active_allergies",
]
