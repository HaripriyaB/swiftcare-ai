"""Shared FastAPI dependencies."""

from __future__ import annotations

from api.auth import CurrentUser, get_current_user

__all__ = ["CurrentUser", "get_current_user"]
