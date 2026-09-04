"""Insight alert helpers — types, severity, disclaimer, caps, dedupe knobs."""

from __future__ import annotations

import os
import re

ALLOWED_ALERT_TYPES = frozenset(
    {
        "gap_in_care",
        "polypharmacy",
        "high_utilizer",
        "chronic_burden",
        "scheduling_inefficiency",
    }
)
ALLOWED_SEVERITIES = frozenset({"HIGH", "MEDIUM", "LOW"})

DEFAULT_DISCLAIMER = (
    "Not a diagnosis or clinical order. Staff review required. "
    "Operational insight only."
)

_FORBIDDEN_PHRASES = (
    r"\bi prescribe\b",
    r"\byou should (take|start|stop|prescribe)\b",
    r"\bstart (taking |on )?(antibiotics|aspirin|medication)\b",
    r"\bthis patient has (pneumonia|disease|cancer)\b",
    r"\bdiagnos(e|is|ed)\b",
    r"\bprescrib(e|ed|ing)\b",
)

_FORBIDDEN_RE = re.compile("|".join(_FORBIDDEN_PHRASES), re.IGNORECASE)

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


def max_alerts_per_turn() -> int:
    return int(os.getenv("MAX_ALERTS_PER_TURN", "10"))


def default_at_risk_limit() -> int:
    return int(os.getenv("DEFAULT_AT_RISK_LIMIT", "50"))


def dedupe_open_alerts() -> bool:
    return os.getenv("DEDUPE_OPEN_ALERTS", "TRUE").upper() == "TRUE"


def validate_alert_type(alert_type: str) -> str | None:
    if alert_type not in ALLOWED_ALERT_TYPES:
        return (
            f"invalid alert_type '{alert_type}'; "
            f"allowed: {sorted(ALLOWED_ALERT_TYPES)}"
        )
    return None


def validate_severity(severity: str) -> str | None:
    normalized = (severity or "").strip().upper()
    if normalized not in ALLOWED_SEVERITIES:
        return f"invalid severity '{severity}'; allowed: {sorted(ALLOWED_SEVERITIES)}"
    return None


def normalize_severity(severity: str) -> str:
    return (severity or "MEDIUM").strip().upper()


def validate_message_language(message: str) -> str | None:
    if _FORBIDDEN_RE.search(message or ""):
        return (
            "alert message contains clinical-order language; "
            "use operational wording only"
        )
    return None


def ensure_disclaimer(message: str) -> str:
    text = (message or "").strip()
    if DEFAULT_DISCLAIMER.lower() in text.lower():
        return text
    if not text:
        return DEFAULT_DISCLAIMER
    return f"{text} {DEFAULT_DISCLAIMER}"


def build_operational_insight_message(
    *,
    risk_flag: str,
    risk_level: str,
    days_since_last_visit: int | None = None,
) -> str:
    """Standard ops wording from Chunk 4 B.3.5 (disclaimer added by create tool)."""
    days_part = (
        f", days_since_last_visit={days_since_last_visit}"
        if days_since_last_visit is not None
        else ""
    )
    return (
        f"Operational insight: data shows risk_flag={risk_flag}, "
        f"risk_level={risk_level}{days_part}. "
        "Staff may want to review scheduling / care coordination."
    )


PLAIN_RISK_LABELS = {
    "gap_in_care": "care gap (visit overdue)",
    "polypharmacy": "many active meds",
    "high_utilizer": "high visit volume (90d)",
    "chronic_burden": "multiple active conditions",
    "scheduling_inefficiency": "scheduling inefficiency (ops)",
    "none": "no elevated risk flag",
}
