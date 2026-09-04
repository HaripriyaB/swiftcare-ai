"""Advisory card content helpers — JSON payloads and guardrails."""

from __future__ import annotations

import json
import os
import re
from typing import Any

ALLOWED_CARD_TYPES = frozenset(
    {
        "allergy_awareness",
        "medication_review",
        "follow_up_scheduling",
        "chart_completeness",
    }
)
ALLOWED_SEVERITIES = frozenset({"info", "attention"})

DEFAULT_DISCLAIMER = (
    "Not a clinical order. Staff review required. Not a diagnosis or prescription."
)

# Soft blocklist for clinical-order language in card bodies (tool-enforced).
_FORBIDDEN_PHRASES = (
    r"\bi prescribe\b",
    r"\byou should (take|start|stop|prescribe)\b",
    r"\bstart (taking |on )?(antibiotics|aspirin|medication)\b",
    r"\bthis patient has (pneumonia|disease|cancer)\b",
    r"\bdiagnos(e|is|ed)\b",
    r"\bprescrib(e|ed|ing)\b",
)

_FORBIDDEN_RE = re.compile("|".join(_FORBIDDEN_PHRASES), re.IGNORECASE)

# Process-local create counter for MAX_CARDS_PER_TURN enforcement in tests/tools.
_create_count = 0


def reset_create_count() -> None:
    global _create_count
    _create_count = 0


def get_create_count() -> int:
    return _create_count


def bump_create_count() -> int:
    global _create_count
    _create_count += 1
    return _create_count


def max_cards_per_turn() -> int:
    return int(os.getenv("MAX_CARDS_PER_TURN", "5"))


def default_severity() -> str:
    value = os.getenv("CARD_DEFAULT_SEVERITY", "info").strip().lower()
    return value if value in ALLOWED_SEVERITIES else "info"


def polypharmacy_threshold() -> int:
    return int(os.getenv("POLYPHARMACY_MED_THRESHOLD", "5"))


def follow_up_gap_days() -> int:
    return int(os.getenv("FOLLOW_UP_GAP_DAYS", "180"))


def dedupe_open_cards() -> bool:
    return os.getenv("DEDUPE_OPEN_CARDS", "TRUE").upper() == "TRUE"


def validate_card_type(card_type: str) -> str | None:
    if card_type not in ALLOWED_CARD_TYPES:
        return (
            f"invalid card_type '{card_type}'; "
            f"allowed: {sorted(ALLOWED_CARD_TYPES)}"
        )
    return None


def validate_severity(severity: str) -> str | None:
    if severity not in ALLOWED_SEVERITIES:
        return f"invalid severity '{severity}'; allowed: {sorted(ALLOWED_SEVERITIES)}"
    return None


def validate_body_language(body: str) -> str | None:
    if _FORBIDDEN_RE.search(body or ""):
        return (
            "card body contains clinical-order language; "
            "use operational wording only"
        )
    return None


def build_content(
    *,
    title: str,
    body: str,
    severity: str,
    card_type: str,
    disclaimer: str = DEFAULT_DISCLAIMER,
) -> str:
    payload = {
        "title": title,
        "body": body,
        "severity": severity,
        "card_type": card_type,
        "disclaimer": disclaimer,
    }
    return json.dumps(payload, ensure_ascii=False)


def build_source_refs(
    source_refs: list[dict[str, Any]] | None,
    *,
    patient_id: str,
    default_view: str | None = None,
) -> str:
    refs = source_refs if source_refs is not None else []
    if not refs and default_view:
        refs = [{"view": default_view, "patient_id": patient_id, "fields": []}]
    # Ensure patient_id is present on each ref when missing.
    normalized: list[dict[str, Any]] = []
    for ref in refs:
        item = dict(ref)
        item.setdefault("patient_id", patient_id)
        normalized.append(item)
    return json.dumps(normalized, ensure_ascii=False)


def parse_json_field(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value
