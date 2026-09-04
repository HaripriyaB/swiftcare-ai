"""Patient name lookup against v_patient_360 for Suggestion Agent."""

from __future__ import annotations

import os
import re
from typing import Any

from ..bq_client import fq, run_query
from ..logging import log_tool_call
from agents.display_names import display_person_name, with_display_names


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

    Ranking (higher is better):
      1. Exact match on first or last
      2. Prefix match on both fields (two-token query)
      3. Prefix match on last name
      4. Prefix match on first name
      Within a tier, longer relative overlap ranks higher.

    Args:
        name: Free-text name. One token → prefix either field.
            Two+ tokens → first token as first_name prefix, last token as
            last_name prefix.
        last_name: Optional explicit last-name prefix.
        first_name: Optional explicit first-name prefix.

    Returns:
        match_count, matches, results_table (markdown), and helper message.
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
