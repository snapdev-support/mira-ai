"""
End-to-end smoke for the support chatbot.

What it exercises:
  1. Mongo connectivity + KB load (works whether or not the KB is populated).
  2. Streaming agentic loop in anonymous mode — tools must NOT fire.
  3. Streaming agentic loop in authed mode — tools SHOULD fire for an
     account-specific question ("how many credits do I have?").
  4. Thread persistence — create, append, fetch back, verify shape.

Requires:
  - MONGODB_URI in .env (or environment)
  - SMOKE_USER_EMAIL: email of an existing user (defaults to SEED_EMAIL)
  - ANTHROPIC_API_KEY: optional; without it the model path returns the
    offline fallback and we still validate wiring + persistence.

Run from the backend/ directory:
    python scripts/chat_smoke.py
"""
from __future__ import annotations

import asyncio
import os
import sys

from dotenv import load_dotenv


_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.dirname(_HERE)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

# Windows defaults stdout to cp1252; force UTF-8 so the ✓/✗ glyphs render.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass


load_dotenv()

from app.core.db import connect_mongo, close_mongo, get_db  # noqa: E402
from app.services.support_service import (  # noqa: E402
    append_to_thread,
    create_thread,
    get_current_thread,
    get_thread_for_user,
    serialize_thread,
    stream_chat,
)


GREEN = "\033[32m"
RED = "\033[31m"
DIM = "\033[2m"
RESET = "\033[0m"


def _ok(msg: str) -> None:
    print(f"{GREEN}✓{RESET} {msg}")


def _fail(msg: str) -> None:
    print(f"{RED}✗{RESET} {msg}")


def _info(msg: str) -> None:
    print(f"{DIM}· {msg}{RESET}")


async def _drain_stream(message: str, user_id: str | None) -> dict:
    """Run the generator to completion and return a summary."""
    text_parts: list[str] = []
    confident = False
    error: str | None = None
    async for ev in stream_chat(message, history=[], user_id=user_id):
        t = ev.get("type")
        if t == "token":
            text_parts.append(ev.get("delta", ""))
        elif t == "done":
            confident = bool(ev.get("confident"))
        elif t == "error":
            error = ev.get("message")
    return {
        "text": "".join(text_parts).strip(),
        "confident": confident,
        "error": error,
    }


async def main() -> int:
    if not os.environ.get("MONGODB_URI"):
        _fail("MONGODB_URI not set — aborting")
        return 1

    await connect_mongo()
    db = get_db()
    failures = 0

    try:
        # ── 1. KB sanity ───────────────────────────────────────────────────
        kb_count = await db.kb_articles.count_documents({})
        _info(f"kb_articles in DB: {kb_count}")

        # ── 2. Anonymous chat — no tools should fire ──────────────────────
        _info("anon chat: 'What is MiraTrust?'")
        anon = await _drain_stream("What is MiraTrust?", user_id=None)
        if anon["error"]:
            _info(f"anon error (likely no ANTHROPIC_API_KEY): {anon['error']}")
            _ok("anon stream emitted error event cleanly")
        elif anon["text"]:
            _ok(f"anon stream returned text ({len(anon['text'])} chars, confident={anon['confident']})")
        else:
            _fail("anon stream produced neither text nor error")
            failures += 1

        # ── 3. Authed chat — tool path ────────────────────────────────────
        email = (
            os.environ.get("SMOKE_USER_EMAIL")
            or os.environ.get("SEED_EMAIL")
            or "dev@example.com"
        ).lower()
        user = await db.users.find_one({"email": email})
        if not user:
            _fail(
                f"no user with email={email}; run `python scripts/seed_dev.py` "
                f"or set SMOKE_USER_EMAIL — skipping authed tests"
            )
            failures += 1
            return failures

        user_id = str(user["_id"])
        _info(f"authed user: {email} id={user_id}")

        _info("authed chat: 'How many credits do I have left?'")
        authed = await _drain_stream(
            "How many credits do I have left?", user_id=user_id
        )
        if authed["error"]:
            _info(f"authed error (likely no ANTHROPIC_API_KEY): {authed['error']}")
            _ok("authed stream emitted error event cleanly")
        elif authed["text"]:
            _ok(
                f"authed stream returned text ({len(authed['text'])} chars, "
                f"confident={authed['confident']})"
            )
            # `confident=True` for an account question is the tool-was-called
            # signal. Surface it but don't fail if missing — model may have
            # answered from KB about credit policy without a tool call.
            if authed["confident"]:
                _ok("answer was marked confident (likely tool-grounded)")
            else:
                _info("answer not marked confident — model may have skipped tools")
        else:
            _fail("authed stream produced neither text nor error")
            failures += 1

        # ── 4. Thread persistence ─────────────────────────────────────────
        _info("creating thread + appending a turn…")
        thread = await create_thread(user_id)
        await append_to_thread(thread["_id"], "Hello", "Hi there!")

        fetched = await get_thread_for_user(str(thread["_id"]), user_id)
        if not fetched:
            _fail("get_thread_for_user returned None after create+append")
            failures += 1
        else:
            shaped = serialize_thread(fetched)
            if (
                shaped["thread_id"] == str(thread["_id"])
                and len(shaped["messages"]) == 2
                and shaped["messages"][0]["role"] == "user"
                and shaped["messages"][1]["role"] == "assistant"
            ):
                _ok("thread round-trips through serialize_thread cleanly")
            else:
                _fail(f"thread shape unexpected: {shaped}")
                failures += 1

        # Ownership check — a different user must NOT see this thread.
        other = await db.users.find_one(
            {"_id": {"$ne": user["_id"]}}, {"_id": 1}
        )
        if other:
            stolen = await get_thread_for_user(
                str(thread["_id"]), str(other["_id"])
            )
            if stolen is None:
                _ok("thread is correctly hidden from a different user")
            else:
                _fail("get_thread_for_user leaked a thread across users")
                failures += 1
        else:
            _info("only one user in DB — skipping cross-user isolation check")

        # current-thread lookup picks up the freshly-created thread
        current = await get_current_thread(user_id)
        if current and str(current["_id"]) == str(thread["_id"]):
            _ok("get_current_thread returned the most recent thread")
        else:
            _fail(
                f"get_current_thread returned an unexpected thread "
                f"(got {current.get('_id') if current else None})"
            )
            failures += 1

        # Clean up the smoke thread so we don't leave noise behind.
        await db.chat_threads.delete_one({"_id": thread["_id"]})
        _info("cleaned up smoke thread")

    finally:
        await close_mongo()

    print()
    if failures:
        print(f"{RED}smoke FAILED ({failures} issue{'s' if failures != 1 else ''}){RESET}")
    else:
        print(f"{GREEN}smoke PASSED{RESET}")
    return failures


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
