"""Ops table writers for sessions, query log, and patient access audit."""

from __future__ import annotations

import os
import uuid

from .bq_client import fq, run_query


def _logging_enabled() -> bool:
    return os.getenv("LOG_QUERIES_TO_BQ", "TRUE").upper() == "TRUE"


def _agent_type() -> str:
    return os.getenv("AGENT_TYPE", "suggestion")


def upsert_session(
    session_id: str,
    user_id: str | None,
    patient_id: str | None,
) -> None:
    if not _logging_enabled():
        return
    sql = f"""
MERGE {fq("swiftcare_ops", "sessions")} AS t
USING (SELECT @session_id AS session_id) AS s
ON t.session_id = s.session_id
WHEN MATCHED THEN
  UPDATE SET active_patient_id = @patient_id, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (session_id, user_id, active_patient_id)
  VALUES (@session_id, @user_id, @patient_id)
"""
    run_query(
        sql,
        {
            "session_id": session_id,
            "user_id": user_id,
            "patient_id": patient_id,
        },
    )


def log_query(
    *,
    log_id: str | None = None,
    session_id: str | None = None,
    patient_id: str | None = None,
    natural_language_query: str,
    generated_sql: str,
    row_count: int,
    latency_ms: int,
) -> None:
    if not _logging_enabled():
        return
    sql = f"""
INSERT INTO {fq("swiftcare_ops", "agent_query_log")}
  (log_id, session_id, agent_type, patient_id,
   natural_language_query, generated_sql, row_count, latency_ms)
VALUES
  (@log_id, @session_id, @agent_type, @patient_id,
   @natural_language_query, @generated_sql, @row_count, @latency_ms)
"""
    run_query(
        sql,
        {
            "log_id": log_id or str(uuid.uuid4()),
            "session_id": session_id,
            "agent_type": _agent_type(),
            "patient_id": patient_id,
            "natural_language_query": natural_language_query,
            "generated_sql": generated_sql,
            "row_count": row_count,
            "latency_ms": latency_ms,
        },
    )


def log_patient_access(
    *,
    audit_id: str | None = None,
    user_id: str | None = None,
    patient_id: str,
    action: str,
) -> None:
    if not _logging_enabled():
        return
    sql = f"""
INSERT INTO {fq("swiftcare_ops", "patient_access_audit")}
  (audit_id, user_id, patient_id, action)
VALUES
  (@audit_id, @user_id, @patient_id, @action)
"""
    run_query(
        sql,
        {
            "audit_id": audit_id or str(uuid.uuid4()),
            "user_id": user_id or "dev-user",
            "patient_id": patient_id,
            "action": action,
        },
    )


def log_tool_call(
    tool_name: str,
    *,
    patient_id: str | None,
    action: str,
    row_count: int,
    latency_ms: int,
    session_id: str | None = None,
    user_id: str | None = None,
) -> None:
    """Convenience: write query log + optional patient access audit."""
    log_query(
        session_id=session_id,
        patient_id=patient_id,
        natural_language_query=f"tool:{tool_name}",
        generated_sql=f"{tool_name}:v1",
        row_count=row_count,
        latency_ms=latency_ms,
    )
    if patient_id:
        log_patient_access(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
        )
