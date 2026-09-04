"""Shared patient name lookup for all SwiftCare agents.

Prefix-matches first/last name against ``v_patient_360`` and returns a
markdown ``results_table`` for consistent ADK / chat UI display.
"""

from __future__ import annotations

import os
import re
from collections.abc import Callable
from typing import Any

from agents.display_names import display_person_name, with_display_names

RunQuery = Callable[..., tuple[list[dict[str, Any]], int, int]]
Fq = Callable[[str, str], str]
LogToolCall = Callable[..., None]


def _tokens(text: str) -> list[str]:
    return [t for t in re.split(r"\s+", text.strip()) if t]


def _cell(value: Any, empty: str = "—") -> str:
    if value is None or value == "":
        return empty
    text = str(value).replace("|", "/").replace("\n", " ").strip()
    return text or empty


def format_matches_table(matches: list[dict[str, Any]]) -> str:
    """User-friendly markdown table for ADK / chat UIs (best match first)."""
    if not matches:
        return "_No matching patients._"

    headers = [
        "#",
        "First name",
        "Last name",
        "Location",
        "Last visit",
        "Patient ID",
        "Match",
    ]
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for i, m in enumerate(matches, start=1):
        location = m.get("location") or ", ".join(
            p for p in [m.get("city"), m.get("state")] if p
        )
        matched = m.get("matched_on") or ""
        matched_label = {
            "exact_first_and_last": "Exact name",
            "exact_first": "Exact first",
            "exact_last": "Exact last",
            "prefix_first_and_last": "Both names",
            "prefix_last": "Last name",
            "prefix_first": "First name",
            "exact_or_prefix_last": "Last name",
        }.get(str(matched), str(matched).replace("_", " ").title() or "—")
        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    _cell(display_person_name(m.get("first_name"))),
                    _cell(display_person_name(m.get("last_name"))),
                    _cell(location),
                    _cell(m.get("last_visit_date")),
                    f"`{_cell(m.get('patient_id'), empty='')}`"
                    if m.get("patient_id")
                    else "—",
                    _cell(matched_label),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def search_patients_core(
    *,
    run_query: RunQuery,
    fq: Fq,
    log_tool_call: LogToolCall | None = None,
    name: str | None = None,
    last_name: str | None = None,
    first_name: str | None = None,
) -> dict[str, Any]:
    """Find patients by prefix-matching first and/or last name.

    A bare name (e.g. "Kuhn") matches **either** first_name **or** last_name
    with a case-insensitive prefix (so "Kuhn" finds "Kuhn96"). Results are
    ordered best match → weakest and include a markdown ``results_table``.
    """
    bare = (name or "").strip()
    first = (first_name or "").strip()
    last = (last_name or "").strip()
    single = ""

    if bare and not first and not last:
        parts = _tokens(bare)
        if len(parts) >= 2:
            first, last = parts[0], parts[-1]
        elif len(parts) == 1:
            single = parts[0]

    if not single and not first and not last:
        return {
            "error": "provide_name",
            "match_count": 0,
            "matches": [],
            "results_table": "_No matching patients._",
            "message": (
                "Provide a name to search (prefix-matched on first and last name)."
            ),
        }

    limit = int(os.getenv("SEARCH_RESULT_LIMIT", "20"))
    mode = "single_either_field" if single else "first_and_or_last"

    sql = f"""
WITH base AS (
  SELECT
    patient_id, first_name, last_name, city, state, last_visit_date,
    age_years, gender,
    LOWER(COALESCE(first_name, '')) AS fn,
    LOWER(COALESCE(last_name, '')) AS ln
  FROM {fq("swiftcare_fhir_views", "v_patient_360")}
),
scored AS (
  SELECT
    patient_id, first_name, last_name, city, state, last_visit_date,
    age_years, gender, fn, ln,
    CASE
      WHEN @is_single THEN
        CASE
          WHEN fn = @single OR ln = @single THEN
            300 + IF(fn = @single, 10, 0) + IF(ln = @single, 10, 0)
          WHEN STARTS_WITH(ln, @single) AND STARTS_WITH(fn, @single) THEN
            200 + CAST(
              SAFE_DIVIDE(LENGTH(@single) * 100, GREATEST(LENGTH(ln), 1)) AS INT64
            )
          WHEN STARTS_WITH(ln, @single) THEN
            100 + CAST(
              SAFE_DIVIDE(LENGTH(@single) * 100, GREATEST(LENGTH(ln), 1)) AS INT64
            )
          WHEN STARTS_WITH(fn, @single) THEN
            50 + CAST(
              SAFE_DIVIDE(LENGTH(@single) * 100, GREATEST(LENGTH(fn), 1)) AS INT64
            )
          ELSE 0
        END
      ELSE
        CASE
          WHEN (@has_first = FALSE OR fn = @first)
           AND (@has_last = FALSE OR ln = @last)
           AND (
             (@has_first = TRUE AND fn = @first)
             OR (@has_last = TRUE AND ln = @last)
           ) THEN
            300
            + IF(@has_first AND fn = @first, 10, 0)
            + IF(@has_last AND ln = @last, 10, 0)
          WHEN @has_first AND @has_last
           AND STARTS_WITH(fn, @first) AND STARTS_WITH(ln, @last) THEN
            200
            + CAST(SAFE_DIVIDE(LENGTH(@first) * 50, GREATEST(LENGTH(fn), 1)) AS INT64)
            + CAST(SAFE_DIVIDE(LENGTH(@last) * 50, GREATEST(LENGTH(ln), 1)) AS INT64)
          WHEN @has_last AND STARTS_WITH(ln, @last)
           AND (@has_first = FALSE OR STARTS_WITH(fn, @first)) THEN
            100 + CAST(
              SAFE_DIVIDE(LENGTH(@last) * 100, GREATEST(LENGTH(ln), 1)) AS INT64
            )
          WHEN @has_first AND STARTS_WITH(fn, @first)
           AND (@has_last = FALSE OR STARTS_WITH(ln, @last)) THEN
            50 + CAST(
              SAFE_DIVIDE(LENGTH(@first) * 100, GREATEST(LENGTH(fn), 1)) AS INT64
            )
          ELSE 0
        END
    END AS match_score,
    CASE
      WHEN @is_single THEN
        CASE
          WHEN fn = @single AND ln = @single THEN 'exact_first_and_last'
          WHEN ln = @single THEN 'exact_last'
          WHEN fn = @single THEN 'exact_first'
          WHEN STARTS_WITH(ln, @single) AND STARTS_WITH(fn, @single)
            THEN 'prefix_first_and_last'
          WHEN STARTS_WITH(ln, @single) THEN 'prefix_last'
          WHEN STARTS_WITH(fn, @single) THEN 'prefix_first'
          ELSE 'none'
        END
      ELSE
        CASE
          WHEN (@has_first AND fn = @first) AND (@has_last AND ln = @last)
            THEN 'exact_first_and_last'
          WHEN @has_first AND @has_last
           AND STARTS_WITH(fn, @first) AND STARTS_WITH(ln, @last)
            THEN 'prefix_first_and_last'
          WHEN @has_last AND STARTS_WITH(ln, @last) THEN 'prefix_last'
          WHEN @has_first AND STARTS_WITH(fn, @first) THEN 'prefix_first'
          ELSE 'none'
        END
    END AS matched_on
  FROM base
)
SELECT
  patient_id, first_name, last_name, city, state, last_visit_date,
  age_years, gender, match_score, matched_on
FROM scored
WHERE match_score > 0
ORDER BY match_score DESC, last_name, first_name, last_visit_date DESC
LIMIT @limit
"""

    rows, row_count, latency_ms = run_query(
        sql,
        {
            "is_single": bool(single),
            "single": single.lower(),
            "first": first.lower(),
            "last": last.lower(),
            "has_first": bool(first),
            "has_last": bool(last),
            "limit": limit,
        },
    )
    if log_tool_call is not None:
        log_tool_call(
            "search_patients",
            patient_id=rows[0]["patient_id"] if rows else None,
            action="search",
            row_count=row_count,
            latency_ms=latency_ms,
        )

    matches = [
        with_display_names(
            {
                "patient_id": r.get("patient_id"),
                "first_name": r.get("first_name"),
                "last_name": r.get("last_name"),
                "location": ", ".join(
                    p for p in [r.get("city"), r.get("state")] if p
                )
                or None,
                "city": r.get("city"),
                "state": r.get("state"),
                "last_visit_date": r.get("last_visit_date"),
                "age_years": r.get("age_years"),
                "gender": r.get("gender"),
                "match_score": r.get("match_score"),
                "matched_on": r.get("matched_on"),
            }
        )
        for r in rows
    ]

    results_table = format_matches_table(matches)
    result: dict[str, Any] = {
        "match_count": len(matches),
        "matches": matches,
        "results_table": results_table,
        "search_mode": mode,
        "query": {
            "name": bare or None,
            "single_token": single or None,
            "first_name": first or None,
            "last_name": last or None,
        },
    }
    if len(matches) > 1:
        result["message"] = (
            "Multiple patients matched (best match first). "
            "Show the results_table markdown to the user unchanged, then ask them "
            "to reply with a row # or patient_id."
        )
        result["display_hint"] = (
            f"### Matching patients ({len(matches)})\n\n"
            f"{results_table}\n\n"
            "_Reply with a **row #** or **Patient ID** to continue._"
        )
    elif len(matches) == 0:
        result["message"] = "No patients found for that name prefix."
        result["display_hint"] = (
            "No matching patients found. Ask for another name or patient_id."
        )
    else:
        result["message"] = "Single patient matched; use this patient_id."
        result["display_hint"] = (
            f"### Matching patient\n\n{results_table}\n\n"
            "_Using this patient unless you specify otherwise._"
        )
    return result


# Shared PATIENT RESOLUTION / RESPONSE FORMAT rules for all agent prompts.
SHARED_PATIENT_RESOLUTION_RULES = """
1. PATIENT RESOLUTION
   - Chart / patient-specific tools need a patient_id.
   - If the user gives a name (not an id), call search_patients immediately.
     Do NOT ask whether the name is first or last.
   - Name search behavior (built into the tool):
     * Single token (e.g. "Kuhn") → prefix-matches BOTH first_name and last_name
       (so "Kuhn" finds last_name "Kuhn96"). Results are ordered best→worst match.
     * Two tokens (e.g. "Shanice Kuhn") → first token prefixes first_name, second
       prefixes last_name.
     * Explicit first_name / last_name args still work when the user is precise.
   - If match_count == 1, briefly confirm using the results_table, then continue
     with that patient_id.
   - If match_count > 1 (multiple patients):
     * Paste the tool's `display_hint` (or `results_table`) **verbatim** as a
       markdown table — do not convert it to a bullet list.
     * Ask the user to reply with a row # or Patient ID.
     * Do NOT run further patient-specific tools until they choose.
   - If match_count == 0, say no match was found and ask for another name or patient_id.
   - Never invent a patient_id.
""".strip()

SHARED_RESPONSE_FORMAT_RULES = """
- Patient search results: always use a markdown table (from results_table /
  display_hint). Columns: #, First name, Last name, Location, Last visit,
  Patient ID, Match.
- Person names in tool results are already cleaned (Fannie183 → Fannie,
  Kuhn96 → Kuhn). Never re-introduce trailing numeric Synthea suffixes.
""".strip()

SHARED_GUARDRAIL_RULES = """
- Do NOT provide medical diagnoses or treatment recommendations.
- Do NOT tell the user to start, stop, or change medications.
- Never say: "You should prescribe", "This patient has disease X", "Start drug Y".
- If asked for clinical advice, refuse and offer documented chart / ops data only —
  or tell them to consult a clinician.
""".strip()
