#!/usr/bin/env python3
"""Minimal programmatic invoke for Insights Agent (final_chunk_4 §B.12)."""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")
os.environ.setdefault("AGENT_TYPE", "insights")
os.environ.setdefault("AGENT_NAME", "swiftcare_insights_agent")


async def ask(question: str) -> str:
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from agents.insights.agent import root_agent

    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="swiftcare",
        session_service=session_service,
    )
    session = await session_service.create_session(
        app_name="swiftcare", user_id="dev-user", session_id=str(uuid.uuid4())
    )
    message = types.Content(role="user", parts=[types.Part(text=question)])
    texts: list[str] = []
    async for event in runner.run_async(
        user_id="dev-user",
        session_id=session.id,
        new_message=message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    texts.append(part.text)
    return "\n".join(texts)


if __name__ == "__main__":
    q = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.getenv(
            "INSIGHTS_SMOKE_QUERY",
            "Which patients have care gaps? Summarize the top 5.",
        )
    )
    print(asyncio.run(ask(q)))
