"""Deterministic persistence and read models for patient-continuity work."""

from __future__ import annotations

import json
import time
from typing import Any

from api.bq import fq, run_dml, run_query
from agents.display_names import display_full_name

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
# The continuity queue is operational data, not a live clinical monitor. Keep
# a short-lived shared snapshot so switching views is instant and BigQuery is
# not queried on every navigation. Writes clear the snapshot immediately.
_CACHE_SECONDS = 120
_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, loader):
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < _CACHE_SECONDS:
        return hit[1]
    value = loader()
    _cache[key] = (time.monotonic(), value)
    return value


def _clear_cache() -> None:
    _cache.clear()


def _hydrate(row: dict[str, Any]) -> dict[str, Any]:
    row["patient_name"] = display_full_name(row.get("patient_name")) or "Patient"
    evidence = row.pop("evidence_json", "[]")
    try:
        row["evidence"] = json.loads(evidence)
    except (TypeError, json.JSONDecodeError):
        row["evidence"] = []
    row["disclaimer"] = "Operational support only — staff review required."
    return row


def list_cards(*, priority: str | None, status: str | None, limit: int) -> list[dict[str, Any]]:
    return get_queue_snapshot(priority=priority, status=status, limit=limit)["cards"]


def get_queue_snapshot(*, priority: str | None, status: str | None, limit: int) -> dict[str, Any]:
    key = f"snapshot:{priority}:{status}:{limit}"
    return _cached(key, lambda: _queue_snapshot(priority=priority, status=status, limit=limit))


def _queue_snapshot(*, priority: str | None, status: str | None, limit: int) -> dict[str, Any]:
    """Load cards and priority totals in one BigQuery read."""
    status = status or "OPEN"
    params: dict[str, Any] = {"limit": min(max(limit, 1), 50), "status": status, "priority": priority}
    sql = f"""
WITH scoped AS (
  SELECT card_id, patient_id, patient_name, priority, priority_score, action_type,
         action_label, why_now, evidence_json, status, rule_version, created_at, updated_at,
         COUNTIF(priority = 'HIGH') OVER() AS high_count,
         COUNTIF(priority = 'MEDIUM') OVER() AS medium_count,
         COUNTIF(priority = 'LOW') OVER() AS low_count
  FROM {fq('swiftcare_ops', 'continuity_cards')}
  WHERE status = @status
)
SELECT * EXCEPT(high_count, medium_count, low_count), high_count, medium_count, low_count
FROM scoped
WHERE (@priority IS NULL OR priority = @priority)
ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         priority_score DESC, created_at DESC
LIMIT @limit
"""
    rows, _, _ = run_query(sql, params)
    summary = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    if rows:
        summary = {
            "HIGH": int(rows[0].pop("high_count", 0)),
            "MEDIUM": int(rows[0].pop("medium_count", 0)),
            "LOW": int(rows[0].pop("low_count", 0)),
        }
    for row in rows[1:]:
        row.pop("high_count", None)
        row.pop("medium_count", None)
        row.pop("low_count", None)
    return {"cards": [_hydrate(row) for row in rows], "summary": summary}


def _list_cards(*, priority: str | None, status: str | None, limit: int) -> list[dict[str, Any]]:
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
    return _cached(f"card:{card_id}", lambda: _get_card(card_id))


def _get_card(card_id: str) -> dict[str, Any] | None:
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
    card = get_card(card_id)
    if not card:
        return None
    sql = f"""
UPDATE {fq('swiftcare_ops', 'continuity_cards')}
SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP()
WHERE card_id = @card_id AND status = 'OPEN'
"""
    if not run_dml(sql, {"card_id": card_id}):
        return get_card(card_id)
    _clear_cache()
    card["status"] = "IN_PROGRESS"
    _event(card_id, actor_user_id, "STARTED", patient_id=card["patient_id"])
    return card


def complete_card(card_id: str, actor_user_id: str, outcome: str, note: str | None) -> dict[str, Any] | None:
    if outcome not in OUTCOMES:
        raise ValueError("Invalid continuity outcome")
    card = get_card(card_id)
    if not card:
        return None
    sql = f"""
UPDATE {fq('swiftcare_ops', 'continuity_cards')}
SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP()
WHERE card_id = @card_id AND status IN ('OPEN', 'IN_PROGRESS')
"""
    if not run_dml(sql, {"card_id": card_id}):
        return None
    _clear_cache()
    card["status"] = "COMPLETED"
    _event(card_id, actor_user_id, "COMPLETED", patient_id=card["patient_id"], outcome=outcome, note=note)
    return card


def dismiss_card(card_id: str, actor_user_id: str, reason: str, note: str | None) -> dict[str, Any] | None:
    if reason not in DISMISS_REASONS:
        raise ValueError("Invalid dismissal reason")
    card = get_card(card_id)
    if not card:
        return None
    sql = f"""
UPDATE {fq('swiftcare_ops', 'continuity_cards')}
SET status = 'DISMISSED', dismissed_reason = @reason, updated_at = CURRENT_TIMESTAMP()
WHERE card_id = @card_id AND status IN ('OPEN', 'IN_PROGRESS')
"""
    if not run_dml(sql, {"card_id": card_id, "reason": reason}):
        return None
    _clear_cache()
    card["status"] = "DISMISSED"
    card["dismissed_reason"] = reason
    _event(card_id, actor_user_id, "DISMISSED", patient_id=card["patient_id"], outcome=reason, note=note)
    return card


def _event(card_id: str, actor_user_id: str, event_type: str, *, patient_id: str, outcome: str | None = None, note: str | None = None) -> None:
    sql = f"""
INSERT INTO {fq('swiftcare_ops', 'continuity_action_events')}
  (event_id, card_id, patient_id, actor_user_id, event_type, outcome, note)
VALUES (GENERATE_UUID(), @card_id, @patient_id, @actor_user_id, @event_type, @outcome, @note)
"""
    run_dml(sql, {"card_id": card_id, "patient_id": patient_id, "actor_user_id": actor_user_id,
                  "event_type": event_type, "outcome": outcome, "note": note})


def get_summary() -> dict[str, int]:
    return get_queue_snapshot(priority=None, status="OPEN", limit=50)["summary"]


def patient_context_fallback(patient_id: str) -> dict[str, Any] | None:
    """Keep a queue patient's workspace usable if a source view is delayed."""
    sql = f"""
SELECT patient_id, patient_name
FROM {fq('swiftcare_ops', 'continuity_cards')}
WHERE patient_id = @patient_id
ORDER BY updated_at DESC
LIMIT 1
"""
    rows, _, _ = run_query(sql, {"patient_id": patient_id})
    if not rows:
        return None
    parts = (display_full_name(rows[0]["patient_name"]) or "Patient").split(" ", 1)
    return {
        "patient_id": patient_id,
        "display_first_name": parts[0],
        "display_last_name": parts[1] if len(parts) > 1 else "",
        "active_conditions_count": 0,
        "active_medications_count": 0,
        "active_allergies_count": 0,
    }


def list_history(*, day: str | None, limit: int) -> list[dict[str, Any]]:
    sql = f"""
SELECT event.event_id, event.card_id, card.patient_name, card.action_label,
       event.patient_id, event.event_type, event.outcome, event.note, event.actor_user_id, event.created_at
FROM {fq('swiftcare_ops', 'continuity_action_events')} event
JOIN {fq('swiftcare_ops', 'continuity_cards')} card USING (card_id)
WHERE event.event_type IN ('COMPLETED', 'DISMISSED')
  AND (@day IS NULL OR DATE(event.created_at) = DATE(@day))
ORDER BY event.created_at DESC
LIMIT @limit
"""
    rows, _, _ = run_query(sql, {"day": day, "limit": min(max(limit, 1), 100)})
    for row in rows:
        row["patient_name"] = display_full_name(row.get("patient_name")) or "Patient"
    return rows


def get_history_entry(event_id: str) -> dict[str, Any] | None:
    sql = f"""
SELECT event.event_id, event.card_id, event.patient_id, card.patient_name,
       card.action_label, card.priority, card.why_now, event.event_type,
       event.outcome, event.note, event.actor_user_id, event.created_at
FROM {fq('swiftcare_ops', 'continuity_action_events')} event
JOIN {fq('swiftcare_ops', 'continuity_cards')} card USING (card_id)
WHERE event.event_id = @event_id
  AND event.event_type IN ('COMPLETED', 'DISMISSED')
LIMIT 1
"""
    rows, _, _ = run_query(sql, {"event_id": event_id})
    if not rows:
        return None
    entry = rows[0]
    entry["patient_name"] = display_full_name(entry.get("patient_name")) or "Patient"
    audit_sql = f"""
SELECT event_id, event_type, outcome, note, actor_user_id, created_at
FROM {fq('swiftcare_ops', 'continuity_action_events')}
WHERE card_id = @card_id
ORDER BY created_at ASC
"""
    revisions, _, _ = run_query(audit_sql, {"card_id": entry["card_id"]})
    entry["audit_history"] = revisions
    return entry


def update_history_entry(event_id: str, actor_user_id: str, outcome: str, note: str | None) -> dict[str, Any] | None:
    entry = get_history_entry(event_id)
    if not entry:
        return None
    allowed = OUTCOMES if entry["event_type"] == "COMPLETED" else DISMISS_REASONS
    if outcome not in allowed:
        raise ValueError("Invalid outcome for this work entry")
    previous_outcome = entry.get("outcome") or "not recorded"
    previous_note = entry.get("note") or "No note"
    update_sql = f"""
UPDATE {fq('swiftcare_ops', 'continuity_action_events')}
SET outcome = @outcome, note = @note
WHERE event_id = @event_id
"""
    if not run_dml(update_sql, {"event_id": event_id, "outcome": outcome, "note": note}):
        return None
    audit_note = f"Updated outcome from {previous_outcome}. Previous note: {previous_note}"
    _event(
        entry["card_id"],
        actor_user_id,
        "OUTCOME_UPDATED",
        patient_id=entry["patient_id"],
        outcome=outcome,
        note=audit_note,
    )
    return get_history_entry(event_id)
