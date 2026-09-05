"""Firebase Admin / local bypass auth for FastAPI."""

from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)
_firebase_ready = False


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    email: str | None


def auth_bypass_enabled() -> bool:
    if os.getenv("K_SERVICE"):
        return False
    return os.getenv("API_AUTH_BYPASS", "false").upper() == "TRUE"


def _init_firebase() -> None:
    global _firebase_ready
    if _firebase_ready:
        return
    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv(
                "GCP_PROJECT_ID"
            )
            opts = {"projectId": project_id} if project_id else None
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, opts)
        _firebase_ready = True
    except Exception:
        _firebase_ready = False


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Missing bearer token"},
        )

    token = creds.credentials
    if auth_bypass_enabled() and token == "bypass-dev-user":
        return CurrentUser(user_id="dev-user", email="dev-user@local")

    _init_firebase()
    try:
        from firebase_admin import auth as fb_auth

        decoded = fb_auth.verify_id_token(token)
        return CurrentUser(
            user_id=str(decoded.get("uid") or decoded.get("user_id")),
            email=decoded.get("email"),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Invalid bearer token"},
        ) from exc
