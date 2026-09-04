"""Guarded Insights Agent tools — parameterized BigQuery only."""

from .at_risk import list_at_risk_patients
from .insight_alerts import (
    create_insight_alert,
    dismiss_insight_alert,
    list_insight_alerts,
)
from .patient_360 import get_patient_summary
from .patient_lookup import search_patients
from .patient_risk import get_patient_risk
from .risk_distribution import get_risk_distribution

ALL_TOOLS = [
    search_patients,
    list_at_risk_patients,
    get_patient_risk,
    get_risk_distribution,
    get_patient_summary,
    create_insight_alert,
    list_insight_alerts,
    dismiss_insight_alert,
]

__all__ = [
    "ALL_TOOLS",
    "search_patients",
    "list_at_risk_patients",
    "get_patient_risk",
    "get_risk_distribution",
    "get_patient_summary",
    "create_insight_alert",
    "list_insight_alerts",
    "dismiss_insight_alert",
]
