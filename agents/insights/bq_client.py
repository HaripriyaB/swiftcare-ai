"""Parameterized BigQuery client for Insights Agent tools.

SQL strings must only reference allowlisted datasets. User input is bound
exclusively via ScalarQueryParameter — never string-interpolated.
"""

from __future__ import annotations

import os
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from google.cloud import bigquery

_client: bigquery.Client | None = None

# Allowlisted clinical/ops objects for Insights (Chunk 4).
_ALLOWED_VIEW_TABLES = frozenset(
    {
        "v_risk_flags",
        "v_patient_360",
        "v_visit_summary",
    }
)
_ALLOWED_CACHE_TABLES = frozenset({"mv_at_risk_patients"})


def get_project_id() -> str:
    return (
        os.getenv("GCP_PROJECT_ID")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
        or "swiftcare-patchamomma"
    )


def get_client() -> bigquery.Client:
    global _client
    if _client is None:
        _client = bigquery.Client(project=get_project_id())
    return _client


def _assert_allowlisted(sql: str) -> None:
    """Reject SQL that references tables outside the Chunk 4 allowlist."""
    lowered = sql.lower()

    if "swiftcare_fhir_raw" in lowered or "swiftcare_fhir_analytics" in lowered:
        raise ValueError("SQL references disallowed raw/analytics datasets")

    # Suggestion owns advisory cards — Insights must never touch that table.
    if "advisory_cards" in lowered:
        raise ValueError(
            "SQL references advisory_cards — not allowed for Insights Agent "
            "(use Suggestion Agent / HANDOFF → suggestion)"
        )

    # Ops-only statements (INSERT/UPDATE/MERGE/SELECT on ops) are fine.
    if "swiftcare_ops" in lowered and (
        "swiftcare_fhir_views" not in lowered
        and "swiftcare_agent_cache" not in lowered
    ):
        return

    if "swiftcare_agent_cache" in lowered:
        if "mv_at_risk_patients" not in lowered:
            raise ValueError(
                "SQL references disallowed cache table — only mv_at_risk_patients "
                "is allowed for Insights Agent"
            )
        # Cache + optional ops in same statement is OK; views may also appear.
        return

    if "swiftcare_fhir_views" in lowered:
        # Soft check: must mention at least one allowed view name when selecting views.
        if not any(t in lowered for t in _ALLOWED_VIEW_TABLES):
            raise ValueError(
                "SQL references swiftcare_fhir_views but not an Insights-allowlisted view"
            )
        return

    if "swiftcare_ops" not in lowered:
        raise ValueError("SQL must reference an allowlisted SwiftCare dataset")


def _serialize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def run_query(
    sql: str,
    params: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], int, int]:
    """Execute parameterized SQL.

    Returns:
        (rows, row_count, latency_ms)
    """
    _assert_allowlisted(sql)
    client = get_client()
    query_params: list[bigquery.ScalarQueryParameter] = []
    for name, value in (params or {}).items():
        if value is None:
            query_params.append(bigquery.ScalarQueryParameter(name, "STRING", None))
        elif isinstance(value, bool):
            query_params.append(bigquery.ScalarQueryParameter(name, "BOOL", value))
        elif isinstance(value, int) and not isinstance(value, bool):
            query_params.append(bigquery.ScalarQueryParameter(name, "INT64", value))
        elif isinstance(value, float):
            query_params.append(bigquery.ScalarQueryParameter(name, "FLOAT64", value))
        else:
            query_params.append(
                bigquery.ScalarQueryParameter(name, "STRING", str(value))
            )

    job_config = bigquery.QueryJobConfig(query_parameters=query_params)
    started = time.perf_counter()
    result = client.query(sql, job_config=job_config).result()
    latency_ms = int((time.perf_counter() - started) * 1000)
    rows = [{k: _serialize_value(v) for k, v in dict(row).items()} for row in result]
    return rows, len(rows), latency_ms


def run_dml(sql: str, params: dict[str, Any] | None = None) -> int:
    """Execute parameterized DML (INSERT/UPDATE). Returns affected row count."""
    _assert_allowlisted(sql)
    client = get_client()
    query_params: list[bigquery.ScalarQueryParameter] = []
    for name, value in (params or {}).items():
        if value is None:
            query_params.append(bigquery.ScalarQueryParameter(name, "STRING", None))
        elif isinstance(value, bool):
            query_params.append(bigquery.ScalarQueryParameter(name, "BOOL", value))
        elif isinstance(value, int) and not isinstance(value, bool):
            query_params.append(bigquery.ScalarQueryParameter(name, "INT64", value))
        else:
            query_params.append(
                bigquery.ScalarQueryParameter(name, "STRING", str(value))
            )

    job_config = bigquery.QueryJobConfig(query_parameters=query_params)
    job = client.query(sql, job_config=job_config)
    job.result()
    return int(job.num_dml_affected_rows or 0)


def fq(dataset: str, table: str) -> str:
    """Fully-qualified table/view id."""
    return f"`{get_project_id()}.{dataset}.{table}`"
