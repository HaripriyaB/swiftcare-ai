"""Deterministic persistence and read models for patient-continuity work."""

from __future__ import annotations

import json
from typing import Any

from api.bq import fq, run_dml, run_query

OPEN_STATUSES = ("OPEN", "IN_PROGRESS")
OUTCOMES = {
    "CONTACT_ATTEMPTED",
    "PATIENT_REACHED",
    "FOLLOW_UP_REQUESTED",
    "REFERRAL_VERIFIED",
    "VISIT_CONFIRMED",
    "NEEDS_CARE_TEAM_REVIEW",
}
DISMISS_REASONS = {"ALREADY_HANDLED", "NOT_APPLICABLE", "DUPLICATE", "OTHER"}


def _hydrate(row: dict[str, Any]) -> dict[str, Any]:
    evidence = row.pop("evidence_json", "[]")
    try:
        row["evidence"] = json.loads(evidence)
    except (TypeError, json.JSONDecodeError):
        row["evidence"] = []
    row["disclaimer"] = "Operational support only — staff review required."
    return row


def list_cards(*, priority: str | None, status: str | None, limit: int) -> list[dict[str, Any]]:
    filters = ["1 = 1"]
    params: dict[str, Any] = {"limit": min(max(limit, 1), 50)}
    if priority:
        filters.append("priority = @priority")
        params["priority"] = priority
    if status:
        filters.append("status = @status")
        params["status"] = status
    sql = f"""
SELECT card_id, patient_id, patient_name, priority, priority_score, action_type,
       action_label, why_now, evidence_json, status, rule_version, created_at, updated_at
FROM {fq('swiftcare_ops', 'continuity_cards')}
WHERE {' AND '.join(filters)}
ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         priority_score DESC, created_at DESC
LIMIT @limit
"""
    rows, _, _ = run_query(sql, params)
    return [_hydrate(row) for row in rows]


def get_card(card_id: str) -> dict[str, Any] | None:
    sql = f"""
SELECT card_id, patient_id, patient_name, priority, priority_score, action_type,
       action_label, why_now, evidence_json, status, rule_version, created_at, updated_at,
       dismissed_reason
FROM {fq('swiftcare_ops', 'continuity_cards')}
WHERE card_id = @card_id
LIMIT 1
"""
    rows, _, _ = run_query(sql, {"card_id": card_id})
    return _hydrate(rows[0]) if rows else None


def start_card(card_id: str, actor_user_id: str) -> dict[str, Any] | None:
    sql = f"""
UPDATE {fq('swiftcare_ops', 'continuity_cards')}
SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP()
WHERE card_id = @card_id AND status = 'OPEN'
"""
    if not run_dml(sql, {"card_id": card_id}):
        return get_card(card_id)
    _event(card_id, actor_user_id, "STARTED")
    return get_card(card_id)


def complete_card(card_id: str, actor_user_id: str, outcome: str, note: str | None) -> dict[str, Any] | None:
    if outcome not in OUTCOMES:
        raise ValueError("Invalid continuity outcome")
    sql = f"""
UPDATE {fq('swiftcare_ops', 'continuity_cards')}
SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP()
WHERE card_id = @card_id AND status IN ('OPEN', 'IN_PROGRESS')
"""
    if not run_dml(sql, {"card_id": card_id}):
        return None
    _event(card_id, actor_user_id, "COMPLETED", outcome=outcome, note=note)
    return get_card(card_id)


def dismiss_card(card_id: str, actor_user_id: str, reason: str, note: str | None) -> dict[str, Any] | None:
    if reason not in DISMISS_REASONS:
        raise ValueError("Invalid dismissal reason")
    sql = f"""
UPDATE {fq('swiftcare_ops', 'continuity_cards')}
SET status = 'DISMISSED', dismissed_reason = @reason, updated_at = CURRENT_TIMESTAMP()
WHERE card_id = @card_id AND status IN ('OPEN', 'IN_PROGRESS')
"""
    if not run_dml(sql, {"card_id": card_id, "reason": reason}):
        return None
    _event(card_id, actor_user_id, "DISMISSED", outcome=reason, note=note)
    return get_card(card_id)


def _event(card_id: str, actor_user_id: str, event_type: str, *, outcome: str | None = None, note: str | None = None) -> None:
    card = get_card(card_id)
    if not card:
        return
    sql = f"""
INSERT INTO {fq('swiftcare_ops', 'continuity_action_events')}
  (event_id, card_id, patient_id, actor_user_id, event_type, outcome, note)
VALUES (GENERATE_UUID(), @card_id, @patient_id, @actor_user_id, @event_type, @outcome, @note)
"""
    run_dml(sql, {"card_id": card_id, "patient_id": card["patient_id"], "actor_user_id": actor_user_id,
                  "event_type": event_type, "outcome": outcome, "note": note})
