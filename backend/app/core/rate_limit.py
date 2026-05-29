"""
In-memory sliding-window rate limiter for the support chat endpoint.

Single-process by design — uvicorn runs one process in dev. If we ever shard
behind a load balancer this needs to move to Redis or Mongo, but we're not
there yet and the simpler implementation here is what we actually want
today: O(1) per check, no extra infra, resets on restart (acceptable).

Constants are env-overridable so ops can dial limits without redeploys:
    CHAT_RATE_LIMIT_AUTHED   default 20  (per user)
    CHAT_RATE_LIMIT_ANON     default 10  (per IP)
    CHAT_RATE_WINDOW_S       default 60
"""
from __future__ import annotations

import os
from collections import defaultdict, deque
from time import monotonic
from typing import Deque


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        return default


CHAT_RATE_LIMIT_AUTHED = _env_int("CHAT_RATE_LIMIT_AUTHED", 20)
CHAT_RATE_LIMIT_ANON = _env_int("CHAT_RATE_LIMIT_ANON", 10)
CHAT_RATE_WINDOW_S = _env_int("CHAT_RATE_WINDOW_S", 60)


_buckets: dict[str, Deque[float]] = defaultdict(deque)


def check_chat_rate_limit(key: str, limit: int) -> tuple[bool, int]:
    """
    Sliding-window check + record. Returns (allowed, retry_after_seconds).
    `retry_after_seconds` is meaningful only when allowed=False.

    Records the timestamp on a positive check so a denied request doesn't
    extend the window for the caller.
    """
    now = monotonic()
    cutoff = now - CHAT_RATE_WINDOW_S
    dq = _buckets[key]
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= limit:
        retry_after = max(1, int(dq[0] + CHAT_RATE_WINDOW_S - now) + 1)
        return False, retry_after
    dq.append(now)
    return True, 0


def reset_for_tests() -> None:
    """Wipe all buckets — useful from pytest. Not used in prod paths."""
    _buckets.clear()
