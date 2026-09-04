"""Patient name lookup against v_patient_360 for Retrieval Agent."""

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

    A bare name (e.g. "Kuhn") matches **either** first_name **or** last_name
    with a case-insensitive prefix (so "Kuhn" finds "Kuhn96"). Results are
    ordered best match → weakest and include a markdown ``results_table`` for
    display in the chat UI.

    Args:
        name: Free-text name. One token → prefix either field.
            Two+ tokens → first token as first_name prefix, last token as
            last_name prefix.
        last_name: Optional explicit last-name prefix.
        first_name: Optional explicit first-name prefix.

    Returns:
        match_count, matches, results_table (markdown), and helper message.
    """
    return search_patients_core(
        run_query=run_query,
        fq=fq,
        log_tool_call=log_tool_call,
        name=name,
        last_name=last_name,
        first_name=first_name,
    )
