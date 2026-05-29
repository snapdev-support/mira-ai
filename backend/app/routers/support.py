from __future__ import annotations

import json
from typing import Any, AsyncIterator, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.db import get_db
from app.core.logging import get_logger
from app.core.rate_limit import (
    CHAT_RATE_LIMIT_ANON,
    CHAT_RATE_LIMIT_AUTHED,
    CHAT_RATE_WINDOW_S,
    check_chat_rate_limit,
)
from app.core.security import decode_access_token
from app.models.support import (
    MyTicketChatTurn,
    MyTicketDetail,
    MyTicketListResponse,
    MyTicketReply,
    MyTicketReplyIn,
    MyTicketSummary,
)
from app.services.auth_service import get_user_by_id
from app.services.support_service import (
    append_to_thread,
    create_thread,
    create_ticket,
    get_current_thread,
    get_thread_for_user,
    serialize_thread,
    stream_chat,
)
# `create_thread` is still used internally by the chat endpoint for lazy
# thread creation when an authed caller doesn't supply a thread_id.
# `serialize_thread` is used by GET /threads/current.

router = APIRouter(prefix="/api/v1/support", tags=["support"])
logger = get_logger("mira.support.router")


# ── Schemas ────────────────────────────────────────────────────────────────


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessageIn] = []
    thread_id: Optional[str] = None


class TicketRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessageIn] = []


class TicketResponse(BaseModel):
    ok: bool
    ticket_id: str


# ── Optional-bearer auth ───────────────────────────────────────────────────


async def _try_load_user(request: Request) -> Optional[dict]:
    """
    Optional-bearer auth. Returns the user dict on a valid JWT for an account
    in good standing; returns None for missing or invalid tokens. Never raises
    — anonymous chat is the legitimate default for the public widget.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        payload = decode_access_token(token)
    except Exception:
        return None
    user = await get_user_by_id(get_db(), payload.get("sub"))
    if not user:
        return None
    if user.get("deleted_at") is not None or user.get("is_disabled"):
        return None
    return user


async def _require_user(request: Request) -> dict:
    user = await _try_load_user(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    return user


# ── SSE helpers ────────────────────────────────────────────────────────────


def _sse(event: str, data: dict) -> bytes:
    # Single-line JSON keeps the SSE `data:` field on one line, which is what
    # the EventSource / fetch parser on the frontend expects.
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n".encode("utf-8")


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/chat")
async def support_chat(payload: ChatRequest, request: Request) -> StreamingResponse:
    """
    Streaming chat endpoint. Optional bearer:
      - Authed: tools are exposed, a thread is resolved or created lazily, and
        the (user, assistant) pair is appended once the stream completes.
      - Anonymous: tools are empty, no thread is touched.

    SSE event schema:
      event: meta   data: {"thread_id": "..." | null}     — exactly once, first
      event: token  data: {"delta": "..."}                 — zero or more
      event: done   data: {"confident": true|false}        — terminal
      event: error  data: {"message": "..."}               — terminal on failure
    """
    user = await _try_load_user(request)
    user_id_str: Optional[str] = str(user["_id"]) if user else None

    # Rate limit BEFORE doing any DB or model work. Authed callers bucketed
    # per user; anon callers per remote IP. `request.client.host` is None
    # in some test transports — fall back to a sentinel so all anon traffic
    # without an IP shares one bucket (overly strict but safer than free).
    if user_id_str:
        rl_key = f"user:{user_id_str}"
        rl_limit = CHAT_RATE_LIMIT_AUTHED
    else:
        rl_key = f"ip:{(request.client.host if request.client else None) or 'unknown'}"
        rl_limit = CHAT_RATE_LIMIT_ANON
    allowed, retry_after = check_chat_rate_limit(rl_key, rl_limit)
    if not allowed:
        logger.info(
            "support.chat rate_limited key=%s limit=%d window=%ds",
            rl_key,
            rl_limit,
            CHAT_RATE_WINDOW_S,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many chat requests. Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    history = [{"role": m.role, "content": m.content} for m in payload.history]

    # Resolve or create the thread up-front so the meta event can carry it.
    # Anonymous callers never get a thread; threads live on authed users only.
    thread_doc: Optional[dict] = None
    if user_id_str:
        if payload.thread_id:
            thread_doc = await get_thread_for_user(payload.thread_id, user_id_str)
            if thread_doc is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found"
                )
        else:
            thread_doc = await create_thread(user_id_str)

    async def event_stream() -> AsyncIterator[bytes]:
        yield _sse(
            "meta",
            {"thread_id": str(thread_doc["_id"]) if thread_doc else None},
        )

        final_text = ""
        errored = False

        try:
            async for ev in stream_chat(payload.message, history, user_id=user_id_str):
                t = ev.get("type")
                if t == "token":
                    yield _sse("token", {"delta": ev.get("delta", "")})
                elif t == "done":
                    final_text = ev.get("final_text") or ""
                    yield _sse("done", {"confident": bool(ev.get("confident"))})
                elif t == "error":
                    errored = True
                    yield _sse(
                        "error",
                        {"message": ev.get("message", "Something went wrong.")},
                    )
        except Exception as exc:
            logger.exception("support.chat stream_unexpected_error: %s", exc)
            errored = True
            yield _sse("error", {"message": "Something went wrong on my end."})

        if thread_doc and not errored and final_text:
            try:
                await append_to_thread(thread_doc["_id"], payload.message, final_text)
            except Exception as exc:
                # Persistence failure shouldn't break the user's reply — they
                # already saw it stream. Log loudly and move on.
                logger.exception(
                    "support.chat thread_persist_error thread_id=%s: %s",
                    thread_doc["_id"],
                    exc,
                )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # nginx / Cloud Run buffer SSE by default; this disables it.
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/threads/current")
async def get_current_user_thread(request: Request) -> Any:
    user = await _require_user(request)
    thread = await get_current_thread(str(user["_id"]))
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No thread")
    return serialize_thread(thread)


@router.post("/ticket", response_model=TicketResponse)
async def create_support_ticket(
    payload: TicketRequest, request: Request
) -> TicketResponse:
    user = await _try_load_user(request)
    user_email: Optional[str] = user.get("email") if user else None
    history = [{"role": m.role, "content": m.content} for m in payload.conversation_history]
    ticket_id = await create_ticket(payload.message, history, user_email)
    return TicketResponse(ok=True, ticket_id=ticket_id)


# ── User-facing inbox ──────────────────────────────────────────────────────
#
# Customers read their own tickets here. Scoping is by `user_email` — tickets
# are anchored to the email captured at creation time, so we trust the email
# on the JWT-verified user record as the authoritative scope.


_TICKET_PREVIEW_LEN = 160
_MY_TICKETS_DEFAULT = 25
_MY_TICKETS_MAX = 100


def _my_ticket_summary(doc: dict) -> MyTicketSummary:
    msg = doc.get("message") or ""
    replies = doc.get("replies") or []
    last_reply_at = replies[-1]["ts"] if replies else None
    return MyTicketSummary(
        ticket_id=doc["ticket_id"],
        status=doc.get("status", "open"),
        message_preview=(msg[:_TICKET_PREVIEW_LEN] + "…") if len(msg) > _TICKET_PREVIEW_LEN else msg,
        created_at=doc["created_at"],
        closed_at=doc.get("closed_at"),
        reply_count=len(replies),
        last_reply_at=last_reply_at,
    )


def _normalize_reply(r: dict) -> MyTicketReply:
    """Reply rows older than two-way support carry only `admin_email`. Newer
    rows carry an explicit `role` + `author_email`. Normalize on read so the
    frontend doesn't need to know about the schema split."""
    role = r.get("role") or ("user" if r.get("user_email") else "admin")
    if role == "user":
        author = r.get("author_email") or r.get("user_email") or ""
    else:
        author = r.get("author_email") or r.get("admin_email") or ""
    return MyTicketReply(
        role=role,
        author_email=author,
        content=r["content"],
        ts=r["ts"],
    )


def _my_ticket_detail(doc: dict) -> MyTicketDetail:
    return MyTicketDetail(
        ticket_id=doc["ticket_id"],
        status=doc.get("status", "open"),
        message=doc.get("message") or "",
        conversation_history=[
            MyTicketChatTurn(role=t.get("role", "user"), content=t.get("content", ""))
            for t in (doc.get("conversation_history") or [])
        ],
        replies=[_normalize_reply(r) for r in (doc.get("replies") or [])],
        created_at=doc["created_at"],
        closed_at=doc.get("closed_at"),
    )


@router.get("/tickets", response_model=MyTicketListResponse)
async def list_my_tickets(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status", description="open | closed"),
    limit: int = Query(_MY_TICKETS_DEFAULT, ge=1, le=_MY_TICKETS_MAX),
    offset: int = Query(0, ge=0),
) -> MyTicketListResponse:
    user = await _require_user(request)
    db = get_db()

    query: dict = {"user_email": user["email"]}
    if status_filter in ("open", "closed"):
        query["status"] = status_filter

    total = await db.support_tickets.count_documents(query)
    cursor = (
        db.support_tickets.find(query)
        # status DESC so "open" sorts before "closed" alphabetically.
        # Within each bucket, newest first.
        .sort([("status", -1), ("created_at", -1)])
        .skip(offset)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return MyTicketListResponse(
        tickets=[_my_ticket_summary(d) for d in docs],
        total=total,
        has_more=(offset + len(docs)) < total,
    )


@router.get("/tickets/{ticket_id}", response_model=MyTicketDetail)
async def get_my_ticket(ticket_id: str, request: Request) -> MyTicketDetail:
    user = await _require_user(request)
    db = get_db()

    # Filter on both ticket_id AND user_email so a caller can't read someone
    # else's ticket by guessing the id. Generic 404 — don't leak existence.
    doc = await db.support_tickets.find_one(
        {"ticket_id": ticket_id, "user_email": user["email"]}
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return _my_ticket_detail(doc)


@router.post("/tickets/{ticket_id}/reply", response_model=MyTicketDetail)
async def reply_to_my_ticket(
    ticket_id: str, payload: MyTicketReplyIn, request: Request
) -> MyTicketDetail:
    """Customer replies on their own ticket. Reopens the ticket if closed."""
    from datetime import datetime, timezone

    user = await _require_user(request)
    db = get_db()

    doc = await db.support_tickets.find_one(
        {"ticket_id": ticket_id, "user_email": user["email"]}
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    now = datetime.now(timezone.utc)
    reply = {
        "role": "user",
        "author_id": user["_id"],
        "author_email": user["email"],
        "content": payload.content,
        "ts": now,
    }

    update: dict = {
        "$push": {"replies": reply},
        "$set": {"updated_at": now},
    }
    if doc.get("status") == "closed":
        # Reopen on user reply. Drop closed-by fields so the admin queue
        # treats it as a fresh open ticket.
        update["$set"]["status"] = "open"
        update["$unset"] = {"closed_at": "", "closed_by": "", "closed_by_email": ""}

    await db.support_tickets.update_one({"ticket_id": ticket_id}, update)

    updated = await db.support_tickets.find_one({"ticket_id": ticket_id})
    logger.info(
        "support.ticket.user_reply ticket_id=%s user=%s reopened=%s",
        ticket_id,
        user["email"],
        doc.get("status") == "closed",
    )
    return _my_ticket_detail(updated)
