"""Firebase Admin / local bypass auth for FastAPI."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)
_firebase_ready = False
_firebase_init_error: str | None = None
_log = logging.getLogger(__name__)


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    email: str | None


def auth_bypass_enabled() -> bool:
    if os.getenv("K_SERVICE"):
        return False
    return os.getenv("API_AUTH_BYPASS", "false").upper() == "TRUE"


def _init_firebase() -> None:
    global _firebase_ready, _firebase_init_error
    if _firebase_ready or _firebase_init_error is not None:
        return
    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv(
                "GCP_PROJECT_ID"
            )
            if not project_id:
                raise RuntimeError(
                    "FIREBASE_PROJECT_ID (or GCP_PROJECT_ID) is not set"
                )
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {"projectId": project_id})
        _firebase_ready = True
        _firebase_init_error = None
    except Exception as exc:
        _firebase_ready = False
        _firebase_init_error = str(exc)
        _log.exception("Firebase Admin failed to initialize")


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
    if not _firebase_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "auth_unavailable",
                "message": (
                    "Firebase Admin is not initialized. "
                    "Set FIREBASE_PROJECT_ID and ensure Application Default "
                    "Credentials can access the Firebase project."
                ),
            },
        )

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
