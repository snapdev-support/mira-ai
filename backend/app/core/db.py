from __future__ import annotations

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings
from app.core.logging import get_logger

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None

logger = get_logger("mira.db")


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB not initialized")
    return _db


async def connect_mongo() -> None:
    global _client, _db
    if _client is not None:
        return
    # tz_aware=True: BSON datetimes don't carry tzinfo on the wire, but we
    # always write UTC values. Telling Motor to attach `tzinfo=UTC` on read
    # makes the ISO strings we ship to the frontend carry a `+00:00` offset
    # so JS doesn't reinterpret them as local time (the source of the ~5h
    # "ago" skew that PKT/IST users were seeing).
    _client = AsyncIOMotorClient(settings.mongodb_uri, tz_aware=True)
    _db = _client.get_default_database()

    # Verify the connection works without leaking credentials.
    await _db.command("ping")
    logger.info("DB connection successful")


async def close_mongo() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("stripe_customer_id", sparse=True)
    await db.users.create_index("role", sparse=True)
    await db.users.create_index("is_disabled", sparse=True)
    await db.users.create_index("deleted_at", sparse=True)
    await db.billing_transactions.create_index("stripe_event_id", unique=True, sparse=True)
    await db.billing_transactions.create_index("checkout_session_id", sparse=True)
    await db.billing_transactions.create_index([("account_id", 1), ("created_at", -1)])
    await db.claims.create_index("jti", unique=True)
    await db.claims.create_index([("account_id", 1), ("iat", -1)])
    await db.claims.create_index([("account_id", 1), ("status", 1)])
    await db.revocations.create_index("jti", unique=True)
    await db.revocations.create_index([("ts", -1)])
    await db.scan_events.create_index([("ts", -1)])
    await db.scan_events.create_index([("jti", 1), ("ts", -1)])
    await db.scan_events.create_index([("issuer_account_id", 1), ("ts", -1)])
    await db.scan_events.create_index([("issuer_account_id", 1), ("jti", 1), ("ts", -1)])
    await db.waitlist.create_index("email", unique=True)
    await db.support_tickets.create_index("ticket_id", unique=True)
    await db.support_tickets.create_index([("created_at", -1)])
    await db.support_tickets.create_index("status")
    # Knowledge base articles powering the support chat. Articles are loaded
    # in (priority desc, slug asc) order to keep the rendered system prompt
    # byte-stable for prompt caching.
    await db.kb_articles.create_index("slug", unique=True)
    await db.kb_articles.create_index([("priority", -1), ("slug", 1)])
    await db.kb_articles.create_index("category", sparse=True)
    # Append-only audit trail of admin actions. Indexed for the audit-log
    # viewer (recent first), per-admin queries, and per-target queries.
    await db.admin_audit_log.create_index([("ts", -1)])
    await db.admin_audit_log.create_index([("admin_user_id", 1), ("ts", -1)])
    await db.admin_audit_log.create_index([("target_type", 1), ("target_id", 1), ("ts", -1)])
    await db.admin_audit_log.create_index("action")
    # Per-user chat threads (Phase 3 chatbot persistence). Anonymous chats
    # are never persisted, so user_id is required for indexed lookups.
    await db.chat_threads.create_index([("user_id", 1), ("updated_at", -1)])
