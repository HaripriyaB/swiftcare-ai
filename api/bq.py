"""Parameterized BigQuery helpers for API-owned tables (ops + analytics)."""

from __future__ import annotations

import os
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from google.cloud import bigquery

_client: bigquery.Client | None = None


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


def fq(dataset: str, table: str) -> str:
    return f"`{get_project_id()}.{dataset}.{table}`"


def _assert_allowlisted(sql: str) -> None:
    lowered = sql.lower()
    allowed = (
        "swiftcare_ops",
        "swiftcare_fhir_analytics",
        "swiftcare_fhir_views",
        "swiftcare_agent_cache",
    )
    if not any(a in lowered for a in allowed):
        raise ValueError("SQL must reference an allowlisted SwiftCare dataset")
    if "swiftcare_fhir_raw" in lowered:
        raise ValueError("SQL references disallowed raw dataset")


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
    """Execute parameterized DML. Returns affected row count."""
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
    job = client.query(sql, job_config=job_config)
    job.result()
    return int(job.num_dml_affected_rows or 0)
