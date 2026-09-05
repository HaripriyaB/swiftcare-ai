"""API test fixtures."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Bypass auth before app import side effects matter
os.environ["API_AUTH_BYPASS"] = "true"
os.environ.pop("K_SERVICE", None)


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("API_AUTH_BYPASS", "true")
    monkeypatch.delenv("K_SERVICE", raising=False)
    from api.main import app

    return TestClient(app)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer bypass-dev-user"}
