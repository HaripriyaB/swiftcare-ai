"""SwiftCare AI FastAPI entrypoint."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from api.routers import chat, health, insights, patients, session  # noqa: E402

app = FastAPI(title="SwiftCare AI API", version="0.6.0")

origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(
    _request: Request, exc: HTTPException
) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "error", "message": str(exc.detail)},
    )


app.include_router(health.router, prefix="/api/v1")
app.include_router(session.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")

_static = os.getenv("STATIC_FE_DIR", "")
if _static and Path(_static).is_dir():
    app.mount("/", StaticFiles(directory=_static, html=True), name="fe")
