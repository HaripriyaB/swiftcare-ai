"""Display helpers for Synthea-style person names."""

from __future__ import annotations

import re
from typing import Any

# Synthea appends digits to given/family names (e.g. Fannie183, Kuhn96).
_TRAILING_DIGITS = re.compile(r"\d+$")


def display_person_name(value: Any) -> str | None:
    """Strip trailing numeric Synthea suffixes for user-facing output.

    Examples:
        Fannie183 → Fannie
        Kuhn96 → Kuhn
        Shanice479 → Shanice
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return text
    cleaned = _TRAILING_DIGITS.sub("", text).strip()
    return cleaned or text


def with_display_names(row: dict[str, Any]) -> dict[str, Any]:
    """Return a copy with first_name/last_name cleaned for display.

    Raw Synthea values are preserved as first_name_raw / last_name_raw when present.
    """
    out = dict(row)
    if "first_name" in out:
        out["first_name_raw"] = out.get("first_name")
        out["first_name"] = display_person_name(out.get("first_name"))
    if "last_name" in out:
        out["last_name_raw"] = out.get("last_name")
        out["last_name"] = display_person_name(out.get("last_name"))
    return out
