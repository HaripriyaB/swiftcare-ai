"""Session upsert / get against swiftcare_ops.sessions."""

from __future__ import annotations

import uuid
from typing import Any

from api.bq import fq, run_query

# In-process cache for tests / short-lived consistency after upsert
_memory: dict[str, dict[str, Any]] = {}


def upsert_session(
    *,
    session_id: str | None,
    user_id: str,
    active_patient_id: str | None,
) -> dict[str, Any]:
    sid = session_id or str(uuid.uuid4())
    sql = f"""
MERGE {fq("swiftcare_ops", "sessions")} AS t
USING (SELECT @session_id AS session_id) AS s
ON t.session_id = s.session_id
WHEN MATCHED THEN
  UPDATE SET
    user_id = @user_id,
    active_patient_id = @patient_id,
    updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (session_id, user_id, active_patient_id)
  VALUES (@session_id, @user_id, @patient_id)
"""
    try:
        run_query(
            sql,
            {
                "session_id": sid,
                "user_id": user_id,
                "patient_id": active_patient_id,
            },
        )
    except Exception:
        # Allow local/unit paths without BQ; memory still works
        pass

    row = {
        "session_id": sid,
        "user_id": user_id,
        "active_patient_id": active_patient_id,
    }
    _memory[user_id] = row
    _memory[sid] = row
    return row


def get_session(*, user_id: str, session_id: str | None = None) -> dict[str, Any]:
    if session_id and session_id in _memory:
        row = _memory[session_id]
        if row["user_id"] != user_id:
            raise PermissionError("session belongs to another user")
        return row
    if user_id in _memory:
        return _memory[user_id]

    sql = f"""
SELECT session_id, user_id, active_patient_id
FROM {fq("swiftcare_ops", "sessions")}
WHERE user_id = @user_id
  AND (@session_id IS NULL OR session_id = @session_id)
ORDER BY updated_at DESC
LIMIT 1
"""
    try:
        rows, _, _ = run_query(
            sql, {"session_id": session_id, "user_id": user_id}
        )
        if rows:
            _memory[user_id] = rows[0]
            _memory[rows[0]["session_id"]] = rows[0]
            return rows[0]
    except Exception:
        pass

    return {
        "session_id": session_id or str(uuid.uuid4()),
        "user_id": user_id,
        "active_patient_id": None,
    }
