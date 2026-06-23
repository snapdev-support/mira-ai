from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

import anthropic
from bson import ObjectId

from app.core.config import settings
from app.core.db import get_db
from app.core.logging import get_logger

logger = get_logger("mira.support")

# ── Claude config ──────────────────────────────────────────────────────────

# Haiku 4.5 minimum cacheable prefix is 4096 tokens; below that cache_control
# silently no-ops. As the KB grows this starts paying off automatically.
SUPPORT_MODEL = "claude-haiku-4-5"
MAX_OUTPUT_TOKENS = 512
# Conversation history kept per request. Keeps token cost bounded on long
# sessions and protects against runaway prompt growth.
MAX_HISTORY_MESSAGES = 10
# Hard cap on agentic-loop iterations. Each tool call counts as one. If we
# blow past this the model is probably looping; fall back to escalation.
MAX_TOOL_ITERATIONS = 5

# ── Persona prompts ────────────────────────────────────────────────────────

_PERSONA_BASE = """\
You are the support assistant for MiraTrust, a B2B product authentication platform.

ABOUT MIRATRUST
MiraTrust helps brands protect products from counterfeiting using cryptographically-signed QR codes. When customers scan a QR code, they instantly see whether a product is authentic.

KEY SECTIONS
- Studio: Create and manage QR codes for products.
- Verify: Scan any MiraTrust QR code to check authenticity (no account needed).
- Console: View scan analytics and event logs.
- Billing: Manage plan, credits, and payment methods.
- Settings: Account preferences and profile.

RESPONSE STYLE
- Be concise: 2-4 sentences unless the question genuinely needs more.
- Be specific: name the section, button, or page.
- Be honest: never make up information."""

_PERSONA_AUTHED = (
    _PERSONA_BASE
    + """

YOUR JOB
Answer using the knowledge base below. You can also look up the signed-in user's account data via tools — use them whenever the user asks about THEIR specific credits, claims, scans, or tickets.

CRITICAL: Account state is MUTABLE. Status, balances, reply counts, and timestamps can change between turns (admins close tickets, scans land, credits get used). Treat tool results as the only source of truth for these fields. Do NOT reuse what an earlier message — yours or the user's — said about status, credits, ticket state, or scan results. Every time the user asks about a specific account fact, call the matching tool again, even if it was just asked.

Do not call tools for general questions answerable from the knowledge base. Never invent data; if a tool returns nothing, say so. If a question is outside the KB and not answerable from tools, say so and offer to create a support ticket."""
)

_PERSONA_ANON = (
    _PERSONA_BASE
    + """

YOUR JOB
Answer the user's question using ONLY the knowledge base below. The user is NOT signed in, so you cannot look up account-specific data. For questions about a specific account, ask them to sign in first. Do not invent features, prices, or policies."""
)


# ── Anthropic client ───────────────────────────────────────────────────────


_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> Optional[anthropic.AsyncAnthropic]:
    global _client
    if _client is not None:
        return _client
    if not settings.anthropic_api_key:
        return None
    _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


# ── Groq client ──────────────────────────────────────────────────────────

# Imported lazily so the package is only required when chat_provider="groq".
# Typed as Any to avoid importing the groq package at module load.
_groq_client: Optional[Any] = None


def _get_groq_client() -> Optional[Any]:
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    if not settings.groq_api_key:
        return None
    try:
        from groq import AsyncGroq
    except ImportError:
        logger.error("support.chat[groq] groq package not installed; run pip install groq")
        return None
    _groq_client = AsyncGroq(api_key=settings.groq_api_key)
    return _groq_client


def _tools_to_openai(tools: list[dict]) -> list[dict]:
    """
    Translate our Anthropic-shaped tool schemas into OpenAI/Groq function
    schemas. Same name/description/JSON-schema — only the envelope differs
    (`input_schema` → `function.parameters`). The executors are untouched.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in tools
    ]


# ── Knowledge base ─────────────────────────────────────────────────────────


async def _load_kb_articles() -> list[dict]:
    """
    Load KB articles in deterministic (priority desc, slug asc) order so the
    rendered system prompt is byte-stable across requests — required for
    prompt caching to register hits.
    """
    db = get_db()
    cursor = db.kb_articles.find(
        {},
        {"_id": 0, "slug": 1, "title": 1, "content": 1, "category": 1, "priority": 1},
    ).sort([("priority", -1), ("slug", 1)])
    return await cursor.to_list(length=500)


def _format_kb(articles: list[dict]) -> str:
    if not articles:
        return "KNOWLEDGE BASE\n(empty — escalate any specific question to a human)"

    lines = ["KNOWLEDGE BASE", ""]
    current_category = None
    for art in articles:
        category = art.get("category") or "General"
        if category != current_category:
            lines.append(f"## {category}")
            current_category = category
        lines.append(f"### {art['title']}")
        lines.append(art["content"].strip())
        lines.append("")
    return "\n".join(lines).rstrip()


# ── Tools ──────────────────────────────────────────────────────────────────

# Tool schemas exposed to Claude when the request is authenticated. Anonymous
# requests get an empty tool list and the model is told it cannot look things
# up. Keep these descriptions tight — they're spent context every request.
_TOOL_SCHEMAS: list[dict] = [
    {
        "name": "get_my_account",
        "description": "Get the signed-in user's account summary: credits remaining, plan tier, total QR codes issued.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_my_recent_claims",
        "description": "List the user's most recent QR codes / claims (newest first).",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5}
            },
            "required": [],
        },
    },
    {
        "name": "get_my_recent_scans",
        "description": "List the user's most recent scan events with verdicts (newest first).",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5}
            },
            "required": [],
        },
    },
    {
        "name": "lookup_my_ticket",
        "description": "Look up the status of a support ticket by ID (format: tkt_xxxxx). Only returns tickets opened by the signed-in user.",
        "input_schema": {
            "type": "object",
            "properties": {"ticket_id": {"type": "string"}},
            "required": ["ticket_id"],
        },
    },
    {
        "name": "explain_verdict",
        "description": "Explain why a specific QR code returned its verify verdict (VALID / EXPIRED / REVOKED / UNVERIFIED / UNKNOWN). Only works for the user's own claims.",
        "input_schema": {
            "type": "object",
            "properties": {"jti": {"type": "string"}},
            "required": ["jti"],
        },
    },
]


def _iso(dt: Any) -> Optional[str]:
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    if isinstance(dt, str):
        return dt
    return None


async def _tool_get_my_account(user_id: str, _args: dict) -> dict:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"error": "User not found"}
    free_limit = int(settings.free_tier_issue_cap)
    issued = int(user.get("issued_count", 0) or 0)
    credits = user.get("claim_credits_remaining")
    if credits is None:
        credits = max(free_limit - issued, 0)
    plan = "paid" if user.get("plan") in ("paid", "pro") else "free"
    return {
        "credits_remaining": int(credits),
        "total_issued": issued,
        "plan": plan,
        "free_limit": free_limit,
    }


async def _tool_get_my_recent_claims(user_id: str, args: dict) -> dict:
    db = get_db()
    limit = max(1, min(int(args.get("limit") or 5), 20))
    rows = (
        await db.claims.find(
            {"account_id": ObjectId(user_id)},
            {"_id": 0, "jti": 1, "template": 1, "subject": 1, "status": 1, "iat": 1, "exp": 1},
        )
        .sort("iat", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return {
        "claims": [
            {
                "jti": r.get("jti"),
                "template": r.get("template"),
                "subject": r.get("subject") or {},
                "status": r.get("status"),
                "issued_at": _iso(r.get("iat")),
                "expires_at": _iso(r.get("exp")),
            }
            for r in rows
        ]
    }


async def _tool_get_my_recent_scans(user_id: str, args: dict) -> dict:
    db = get_db()
    limit = max(1, min(int(args.get("limit") or 5), 20))
    rows = (
        await db.scan_events.find(
            {"issuer_account_id": ObjectId(user_id)},
            {"_id": 0, "ts": 1, "jti": 1, "verdict": 1, "reason_code": 1},
        )
        .sort("ts", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return {
        "scans": [
            {
                "jti": r.get("jti"),
                "verdict": r.get("verdict"),
                "reason_code": r.get("reason_code"),
                "scanned_at": _iso(r.get("ts")),
            }
            for r in rows
        ]
    }


async def _tool_lookup_my_ticket(user_id: str, args: dict) -> dict:
    db = get_db()
    ticket_id = (args.get("ticket_id") or "").strip()
    if not ticket_id:
        return {"error": "ticket_id is required"}
    # Tickets are joined by user_email (the schema we have today), so we look
    # up the caller's email and filter on it. Returning a generic not-found
    # for both "doesn't exist" and "not yours" prevents enumeration.
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1})
    if not user:
        return {"error": "User not found"}
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket or (ticket.get("user_email") or "").lower() != (user.get("email") or "").lower():
        return {"error": f"No ticket with id {ticket_id} found on your account"}
    return {
        "ticket_id": ticket["ticket_id"],
        "status": ticket.get("status"),
        "created_at": _iso(ticket.get("created_at")),
        "reply_count": len(ticket.get("replies") or []),
        "closed_at": _iso(ticket.get("closed_at")),
    }


async def _tool_explain_verdict(user_id: str, args: dict) -> dict:
    db = get_db()
    jti = (args.get("jti") or "").strip()
    if not jti:
        return {"error": "jti is required"}
    claim = await db.claims.find_one({"jti": jti, "account_id": ObjectId(user_id)})
    if not claim:
        return {"error": f"No claim with jti {jti} found on your account"}

    now = datetime.now(timezone.utc)
    status = claim.get("status")
    if status == "revoked":
        return {
            "jti": jti,
            "verdict": "REVOKED",
            "explanation": "This claim was revoked. Customers who scan it will see a revoked verdict.",
            "status": status,
        }

    exp = claim.get("exp")
    if isinstance(exp, datetime):
        exp_utc = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if now > exp_utc:
            return {
                "jti": jti,
                "verdict": "EXPIRED",
                "explanation": f"This claim expired on {exp_utc.date().isoformat()}.",
                "status": status,
            }
    return {
        "jti": jti,
        "verdict": "VALID",
        "explanation": "This claim is currently active and valid.",
        "status": status,
    }


_TOOL_EXECUTORS = {
    "get_my_account": _tool_get_my_account,
    "get_my_recent_claims": _tool_get_my_recent_claims,
    "get_my_recent_scans": _tool_get_my_recent_scans,
    "lookup_my_ticket": _tool_lookup_my_ticket,
    "explain_verdict": _tool_explain_verdict,
}


async def _execute_tool(user_id: str, name: str, args: dict) -> tuple[Any, bool]:
    """
    Run a tool and return (result, is_error). Exceptions are converted into
    is_error=True tool_result blocks so the model can apologize gracefully
    instead of the whole request failing.
    """
    executor = _TOOL_EXECUTORS.get(name)
    if executor is None:
        return {"error": f"Unknown tool: {name}"}, True
    try:
        out = await executor(user_id, args or {})
        # If the executor itself returned a structured "error" we surface it
        # to the model but don't classify the call as a hard error — model
        # can still react conversationally to "no ticket found".
        return out, False
    except Exception as exc:
        logger.exception("support.chat tool_error tool=%s user_id=%s err=%s", name, user_id, exc)
        return {"error": "Tool execution failed. Please try again."}, True


# ── History sanitisation ───────────────────────────────────────────────────


def _trim_history(history: list[dict]) -> list[dict]:
    """
    Keep the most recent MAX_HISTORY_MESSAGES turns, then drop leading
    non-user messages so the API gets a valid sequence.
    """
    trimmed = [
        {"role": m["role"], "content": m["content"]} for m in history[-MAX_HISTORY_MESSAGES:]
    ]
    while trimmed and trimmed[0].get("role") != "user":
        trimmed = trimmed[1:]
    return trimmed


# ── Confidence heuristic ───────────────────────────────────────────────────

# When the model declines to call a tool AND its answer contains one of these
# phrases, we surface the "create a ticket" affordance. This is intentionally
# lossy — a real-data answer (any tool call succeeded) trumps the heuristic.
_ESCALATION_PHRASES = (
    "create a support ticket",
    "let me connect you",
    "connect you with a human",
    "i'm not sure",
    "i don't know",
    "i don't have",
    "not in the knowledge base",
    "i cannot",
    "i can't",
)


def _is_confident(text: str, tool_was_called: bool) -> bool:
    if tool_was_called:
        return True
    lowered = text.lower()
    return not any(phrase in lowered for phrase in _ESCALATION_PHRASES)


# ── Fallback copy ──────────────────────────────────────────────────────────


_FALLBACK_OFFLINE = (
    "I'm having trouble connecting to the AI right now. "
    "Please try again or create a support ticket and a team member will follow up."
)
_FALLBACK_ERROR = (
    "Something went wrong on my end. Please create a support ticket and we'll help you shortly."
)
_FALLBACK_LOOP_LIMIT = (
    "I'm having trouble looking that up right now. "
    "Would you like to create a support ticket so a human can help?"
)


# ── Assistant-content normalizer ───────────────────────────────────────────


# Fields the SDK decorates onto content blocks for caller convenience but
# the API rejects when echoed back (400 "Extra inputs are not permitted").
# Keep this list, not a hardcoded set inside the function, so it's obvious
# what to add if a new SDK version drops another helper field.
_SDK_INTERNAL_BLOCK_FIELDS = {"parsed_output"}


def _normalize_assistant_content(content: list) -> list[dict]:
    """
    Reshape the SDK's content blocks into the minimal canonical input form
    accepted by /v1/messages. We can't just `c.model_dump()` because the SDK
    adds internal helper fields (e.g. `parsed_output` on text blocks for
    structured-output convenience) that aren't valid input — the next
    iteration's request gets 400'd.

    Whitelist per block type rather than blacklisting known offenders, so
    future SDK additions can't sneak in.
    """
    out: list[dict] = []
    for c in content:
        t = getattr(c, "type", None)
        if t == "text":
            out.append({"type": "text", "text": c.text})
        elif t == "tool_use":
            out.append(
                {
                    "type": "tool_use",
                    "id": c.id,
                    "name": c.name,
                    "input": c.input,
                }
            )
        elif t == "thinking":
            block: dict = {"type": "thinking", "thinking": c.thinking}
            sig = getattr(c, "signature", None)
            if sig:
                block["signature"] = sig
            out.append(block)
        elif t == "redacted_thinking":
            out.append({"type": "redacted_thinking", "data": c.data})
        else:
            # Unknown block type — dump and strip known SDK-internal keys.
            d = c.model_dump(exclude_none=True)
            for k in _SDK_INTERNAL_BLOCK_FIELDS:
                d.pop(k, None)
            out.append(d)
    return out


# ── Streaming agentic loop ─────────────────────────────────────────────────


async def _stream_chat_anthropic(
    message: str,
    history: list[dict],
    user_id: Optional[str] = None,
) -> AsyncIterator[dict]:
    """
    Anthropic (Claude) backend for the agentic loop. Yields SSE-style event
    dicts. Selected when settings.chat_provider != "groq".

    Yields events of the form:
        {"type": "token", "delta": "..."}
        {"type": "done", "confident": True}
        {"type": "error", "message": "..."}

    `user_id` controls tool availability. When None, tools are not exposed and
    the system prompt tells the model it cannot look up account data.

    NOTE on streaming semantics: text deltas from EVERY iteration are emitted
    to the client, including any preamble the model writes before a tool_use
    block (e.g. "Let me check that for you…"). The design doc called for
    tool iterations to be invisible; surfacing the preamble produces better
    perceived latency and never leaks tool JSON to the user (tool_use blocks
    contain no text deltas).
    """
    client = _get_client()
    if client is None:
        yield {"type": "token", "delta": _FALLBACK_OFFLINE}
        yield {"type": "done", "confident": False, "final_text": _FALLBACK_OFFLINE}
        return

    articles = await _load_kb_articles()
    kb_text = _format_kb(articles)

    persona = _PERSONA_AUTHED if user_id else _PERSONA_ANON

    # Single cache breakpoint on the KB block — caches (persona + KB) and,
    # because tools render before system in the request, the tools list too.
    # Cached prefix breaks whenever an admin edits the KB; that's intended.
    system_blocks = [
        {"type": "text", "text": persona},
        {"type": "text", "text": kb_text, "cache_control": {"type": "ephemeral"}},
    ]

    tools = _TOOL_SCHEMAS if user_id else []

    messages: list[dict] = _trim_history(history)
    messages.append({"role": "user", "content": message})

    tool_was_called = False
    final_text_parts: list[str] = []

    try:
        for iteration in range(MAX_TOOL_ITERATIONS):
            # Accumulate this iteration's text + tool_use blocks. We don't
            # know which is which until the stream starts emitting blocks.
            iteration_text_parts: list[str] = []
            tool_use_blocks: list[dict] = []
            current_tool: Optional[dict] = None
            current_tool_json = ""
            cache_read = 0
            cache_write = 0
            input_tokens = 0

            stream_kwargs: dict[str, Any] = {
                "model": SUPPORT_MODEL,
                "max_tokens": MAX_OUTPUT_TOKENS,
                "system": system_blocks,
                "messages": messages,
            }
            if tools:
                stream_kwargs["tools"] = tools

            async with client.messages.stream(**stream_kwargs) as stream:
                async for event in stream:
                    et = event.type
                    if et == "content_block_start":
                        block = event.content_block
                        if block.type == "tool_use":
                            current_tool = {
                                "id": block.id,
                                "name": block.name,
                                "input": {},
                            }
                            current_tool_json = ""
                    elif et == "content_block_delta":
                        d = event.delta
                        if d.type == "text_delta":
                            iteration_text_parts.append(d.text)
                            yield {"type": "token", "delta": d.text}
                        elif d.type == "input_json_delta" and current_tool is not None:
                            current_tool_json += d.partial_json
                    elif et == "content_block_stop":
                        if current_tool is not None:
                            import json as _json
                            try:
                                current_tool["input"] = (
                                    _json.loads(current_tool_json) if current_tool_json else {}
                                )
                            except Exception:
                                current_tool["input"] = {}
                            tool_use_blocks.append(current_tool)
                            current_tool = None
                            current_tool_json = ""

                final_message = await stream.get_final_message()

            stop_reason = final_message.stop_reason
            usage = getattr(final_message, "usage", None)
            if usage:
                cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
                cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
                input_tokens = getattr(usage, "input_tokens", 0) or 0

            logger.info(
                "support.chat iter=%d stop=%s tools=%d cache_read=%d cache_write=%d in_tokens=%d",
                iteration,
                stop_reason,
                len(tool_use_blocks),
                cache_read,
                cache_write,
                input_tokens,
            )

            # Append assistant turn to messages history. We CAN'T just
            # `model_dump()` blindly — the SDK decorates text blocks with
            # internal fields (e.g. `parsed_output` for structured output)
            # that the API rejects when echoed back: 400 "Extra inputs are
            # not permitted". Reshape each block to the canonical input form.
            messages.append(
                {
                    "role": "assistant",
                    "content": _normalize_assistant_content(final_message.content),
                }
            )
            final_text_parts.extend(iteration_text_parts)

            if stop_reason != "tool_use" or not tool_use_blocks:
                # No more tool calls requested — we're done.
                break

            # Execute tools and append a single user turn with all results.
            tool_results: list[dict] = []
            for tb in tool_use_blocks:
                tool_was_called = True
                logger.info(
                    "support.chat tool_call name=%s user_id=%s",
                    tb["name"],
                    user_id or "anon",
                )
                result, is_error = await _execute_tool(user_id or "", tb["name"], tb["input"])
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tb["id"],
                        "content": _coerce_tool_content(result),
                        **({"is_error": True} if is_error else {}),
                    }
                )
            messages.append({"role": "user", "content": tool_results})
        else:
            # Hit MAX_TOOL_ITERATIONS without an end_turn.
            logger.warning("support.chat loop_limit_hit user_id=%s", user_id or "anon")
            # Wipe any partial text and surface the fallback to the user.
            final_text_parts = [_FALLBACK_LOOP_LIMIT]
            yield {"type": "token", "delta": _FALLBACK_LOOP_LIMIT}
            yield {
                "type": "done",
                "confident": False,
                "final_text": _FALLBACK_LOOP_LIMIT,
            }
            return

        final_text = "".join(final_text_parts).strip()
        if not final_text:
            # Model produced no text after all iterations — degrade gracefully.
            final_text = "I'm not sure how to answer that — would you like me to create a support ticket?"
            yield {"type": "token", "delta": final_text}

        yield {
            "type": "done",
            "confident": _is_confident(final_text, tool_was_called),
            "final_text": final_text,
        }

    except anthropic.APIStatusError as exc:
        logger.error("support.chat api_error status=%s message=%s", exc.status_code, exc.message)
        yield {"type": "error", "message": _FALLBACK_OFFLINE}
    except anthropic.APIConnectionError as exc:
        logger.error("support.chat connection_error: %s", exc)
        yield {"type": "error", "message": _FALLBACK_OFFLINE}
    except Exception as exc:
        logger.exception("support.chat unexpected_error: %s", exc)
        yield {"type": "error", "message": _FALLBACK_ERROR}


# ── Groq streaming agentic loop ────────────────────────────────────────────


async def _stream_chat_groq(
    message: str,
    history: list[dict],
    user_id: Optional[str] = None,
) -> AsyncIterator[dict]:
    """
    Groq (open-source model) backend for the agentic loop. Selected when
    settings.chat_provider == "groq". Yields the SAME event dicts as the
    Anthropic backend so the router and frontend are provider-agnostic.

    Differences from the Anthropic path, all internal:
      - System prompt is a single OpenAI `system` message (persona + KB),
        not a list of cache-controlled blocks (Groq has no prompt caching).
      - Tools use OpenAI function schemas (see `_tools_to_openai`).
      - The tool loop speaks OpenAI's `tool_calls` / `tool`-role protocol:
        each round the assistant turn echoes its tool_calls, then one
        `{"role": "tool", ...}` message per result feeds back in.
      - Streamed tool_calls arrive fragmented; we accumulate them by index.
    """
    client = _get_groq_client()
    if client is None:
        yield {"type": "token", "delta": _FALLBACK_OFFLINE}
        yield {"type": "done", "confident": False, "final_text": _FALLBACK_OFFLINE}
        return

    articles = await _load_kb_articles()
    kb_text = _format_kb(articles)
    persona = _PERSONA_AUTHED if user_id else _PERSONA_ANON

    # OpenAI-style messages: one system turn carries persona + KB.
    messages: list[dict] = [{"role": "system", "content": f"{persona}\n\n{kb_text}"}]
    messages.extend(_trim_history(history))
    messages.append({"role": "user", "content": message})

    tools = _tools_to_openai(_TOOL_SCHEMAS) if user_id else None

    tool_was_called = False
    final_text_parts: list[str] = []

    try:
        for iteration in range(MAX_TOOL_ITERATIONS):
            iteration_text_parts: list[str] = []
            # Streamed tool_calls come in fragments keyed by their `index`;
            # id + name land on the first fragment, arguments stream after.
            tool_calls_acc: dict[int, dict] = {}
            finish_reason: Optional[str] = None

            create_kwargs: dict[str, Any] = {
                "model": settings.groq_model,
                "max_tokens": MAX_OUTPUT_TOKENS,
                "messages": messages,
                "stream": True,
            }
            if tools:
                create_kwargs["tools"] = tools
                create_kwargs["tool_choice"] = "auto"

            stream = await client.chat.completions.create(**create_kwargs)
            async for chunk in stream:
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                if choice.finish_reason:
                    finish_reason = choice.finish_reason
                delta = choice.delta
                if delta is None:
                    continue
                if delta.content:
                    iteration_text_parts.append(delta.content)
                    yield {"type": "token", "delta": delta.content}
                for tc in delta.tool_calls or []:
                    slot = tool_calls_acc.setdefault(
                        tc.index, {"id": None, "name": None, "args": ""}
                    )
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            slot["name"] = tc.function.name
                        if tc.function.arguments:
                            slot["args"] += tc.function.arguments

            logger.info(
                "support.chat[groq] iter=%d finish=%s tools=%d model=%s",
                iteration,
                finish_reason,
                len(tool_calls_acc),
                settings.groq_model,
            )

            final_text_parts.extend(iteration_text_parts)

            if finish_reason != "tool_calls" or not tool_calls_acc:
                # No tool calls requested — we're done.
                break

            # Echo the assistant's tool_calls turn (required before tool
            # results), then run each tool and append its result message.
            ordered = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]
            assistant_tool_calls = [
                {
                    "id": c["id"] or f"call_{iteration}_{n}",
                    "type": "function",
                    "function": {
                        "name": c["name"] or "",
                        "arguments": c["args"] or "{}",
                    },
                }
                for n, c in enumerate(ordered)
            ]
            messages.append(
                {
                    "role": "assistant",
                    "content": "".join(iteration_text_parts) or None,
                    "tool_calls": assistant_tool_calls,
                }
            )

            import json as _json

            for c, tc_msg in zip(ordered, assistant_tool_calls):
                tool_was_called = True
                name = c["name"] or ""
                try:
                    args = _json.loads(c["args"]) if c["args"] else {}
                except Exception:
                    args = {}
                logger.info(
                    "support.chat[groq] tool_call name=%s user_id=%s",
                    name,
                    user_id or "anon",
                )
                result, _is_error = await _execute_tool(user_id or "", name, args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc_msg["id"],
                        "content": _coerce_tool_content(result),
                    }
                )
        else:
            # Hit MAX_TOOL_ITERATIONS without a terminal turn.
            logger.warning("support.chat[groq] loop_limit_hit user_id=%s", user_id or "anon")
            final_text_parts = [_FALLBACK_LOOP_LIMIT]
            yield {"type": "token", "delta": _FALLBACK_LOOP_LIMIT}
            yield {"type": "done", "confident": False, "final_text": _FALLBACK_LOOP_LIMIT}
            return

        final_text = "".join(final_text_parts).strip()
        if not final_text:
            final_text = "I'm not sure how to answer that — would you like me to create a support ticket?"
            yield {"type": "token", "delta": final_text}

        yield {
            "type": "done",
            "confident": _is_confident(final_text, tool_was_called),
            "final_text": final_text,
        }

    except Exception as exc:
        # groq.APIError / APIConnectionError and anything else map to the same
        # offline fallback the Anthropic path surfaces — the widget degrades
        # to "create a ticket" rather than erroring out.
        logger.exception("support.chat[groq] error: %s", exc)
        yield {"type": "error", "message": _FALLBACK_OFFLINE}


# ── Provider dispatch ──────────────────────────────────────────────────────


async def stream_chat(
    message: str,
    history: list[dict],
    user_id: Optional[str] = None,
) -> AsyncIterator[dict]:
    """
    Provider-agnostic entry point used by the router. Dispatches to the
    Groq or Anthropic backend based on settings.chat_provider. Both yield the
    identical event contract:
        {"type": "token", "delta": "..."}
        {"type": "done", "confident": bool, "final_text": "..."}
        {"type": "error", "message": "..."}
    """
    provider = (settings.chat_provider or "anthropic").strip().lower()
    backend = _stream_chat_groq if provider == "groq" else _stream_chat_anthropic
    async for event in backend(message, history, user_id=user_id):
        yield event


def _coerce_tool_content(result: Any) -> str:
    """tool_result content must be a string or list of content blocks. We
    always serialize to JSON-stringified text — small and unambiguous."""
    import json as _json

    if isinstance(result, str):
        return result
    try:
        return _json.dumps(result, default=str)
    except Exception:
        return str(result)


# ── Non-streaming compatibility wrapper ────────────────────────────────────


async def ask_claude(
    message: str,
    history: list[dict],
    user_id: Optional[str] = None,
) -> tuple[str, bool]:
    """
    Non-streaming wrapper that consumes the streaming generator. Preserved
    so older callers (and any test paths) keep working. Returns
    (answer, confident).
    """
    final_text = ""
    confident = False
    async for event in stream_chat(message, history, user_id=user_id):
        if event["type"] == "done":
            final_text = event.get("final_text") or "".join([])
            confident = bool(event.get("confident"))
        elif event["type"] == "error":
            return event["message"], False
    return final_text or _FALLBACK_ERROR, confident


# ── Thread persistence ─────────────────────────────────────────────────────


async def get_current_thread(user_id: str) -> Optional[dict]:
    """Most recent thread for this user, or None."""
    db = get_db()
    return await db.chat_threads.find_one(
        {"user_id": ObjectId(user_id)},
        sort=[("updated_at", -1)],
    )


async def create_thread(user_id: str) -> dict:
    """Create a new empty thread for the user."""
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": ObjectId(user_id),
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.chat_threads.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_thread_for_user(thread_id: str, user_id: str) -> Optional[dict]:
    """Look up a thread, returning None if it doesn't belong to this user."""
    db = get_db()
    try:
        tid = ObjectId(thread_id)
    except Exception:
        return None
    return await db.chat_threads.find_one(
        {"_id": tid, "user_id": ObjectId(user_id)},
    )


async def append_to_thread(
    thread_id: ObjectId,
    user_message: str,
    assistant_message: str,
) -> None:
    db = get_db()
    now = datetime.now(timezone.utc)
    await db.chat_threads.update_one(
        {"_id": thread_id},
        {
            "$push": {
                "messages": {
                    "$each": [
                        {"role": "user", "content": user_message, "ts": now},
                        {"role": "assistant", "content": assistant_message, "ts": now},
                    ]
                }
            },
            "$set": {"updated_at": now},
        },
    )


def serialize_thread(thread: dict) -> dict:
    """Shape a thread doc for the API response."""
    return {
        "thread_id": str(thread["_id"]),
        "messages": [
            {
                "role": m["role"],
                "content": m["content"],
                "ts": _iso(m.get("ts")),
            }
            for m in thread.get("messages", [])
        ],
        "created_at": _iso(thread.get("created_at")),
        "updated_at": _iso(thread.get("updated_at")),
    }


# ── Ticket storage (unchanged) ─────────────────────────────────────────────


async def create_ticket(
    message: str,
    history: list[dict],
    user_email: Optional[str] = None,
) -> str:
    """Store a support ticket in MongoDB and return the ticket ID."""
    db = get_db()
    ticket_id = f"tkt_{uuid.uuid4().hex[:10]}"
    doc = {
        "ticket_id": ticket_id,
        "message": message,
        "conversation_history": history,
        "user_email": user_email,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    }
    await db.support_tickets.insert_one(doc)
    logger.info(
        "support.ticket.created ticket_id=%s email=%s",
        ticket_id,
        user_email or "anonymous",
    )
    return ticket_id
