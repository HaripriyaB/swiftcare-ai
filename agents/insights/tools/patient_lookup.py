"""Patient name lookup against v_patient_360 for Insights Agent."""

from __future__ import annotations

from typing import Any

from agents.patient_lookup import search_patients_core

from ..bq_client import fq, run_query
from ..logging import log_tool_call


def search_patients(
    name: str | None = None,
    last_name: str | None = None,
    first_name: str | None = None,
) -> dict[str, Any]:
    """Find patients by prefix-matching first and/or last name.

    Used for drill-down when staff give a name instead of patient_id.
    Same shared search behavior as Retrieval and Suggestion agents.
    """
    return search_patients_core(
        run_query=run_query,
        fq=fq,
        log_tool_call=log_tool_call,
        name=name,
        last_name=last_name,
        first_name=first_name,
    )
