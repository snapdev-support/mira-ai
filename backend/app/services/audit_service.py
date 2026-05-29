"""
Append-only audit log for admin actions. Call `log_admin_action` from every
admin write endpoint *after* the DB mutation succeeds — we only record actual
effects, not attempts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request

from app.core.db import get_db
from app.core.logging import get_logger

logger = get_logger("mira.admin.audit")


# Centralized action enum. Adding a value here is the only place a new admin
# action gets registered — keeps audit queries reliable.
class AuditAction:
    ADMIN_LOGIN = "admin.login"
    KB_CREATE = "kb.create"
    KB_UPDATE = "kb.update"
    KB_DELETE = "kb.delete"
    USER_CREDITS_ADJUST = "user.credits.adjust"
    USER_DISABLE = "user.disable"
    USER_ENABLE = "user.enable"
    USER_DELETE = "user.delete"
    USER_ROLE_GRANT = "role.grant"
    USER_ROLE_REVOKE = "role.revoke"
    CLAIM_REVOKE = "claim.revoke"
    TICKET_REPLY = "ticket.reply"
    TICKET_CLOSE = "ticket.close"
    BILLING_REFUND = "billing.refund"
    BILLING_REFUND_FORCED = "billing.refund.forced"


async def log_admin_action(
    admin: dict,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    before: Optional[dict[str, Any]] = None,
    after: Optional[dict[str, Any]] = None,
    reason: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    db = get_db()
    doc: dict[str, Any] = {
        "admin_user_id": admin["_id"],
        "admin_email": admin["email"],
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "before": _scrub(before),
        "after": _scrub(after),
        "reason": reason,
        "ip": request.client.host if (request and request.client) else None,
        "user_agent": request.headers.get("user-agent") if request else None,
        "ts": datetime.now(timezone.utc),
    }
    try:
        await db.admin_audit_log.insert_one(doc)
    except Exception:
        # Never let an audit-log failure mask the action it would describe —
        # log loudly, return cleanly.
        logger.exception(
            "audit.write_failed action=%s admin=%s target=%s/%s",
            action,
            admin.get("email"),
            target_type,
            target_id,
        )

    logger.info(
        "admin.action action=%s admin=%s target=%s/%s",
        action,
        admin["email"],
        target_type or "-",
        target_id or "-",
    )


_SENSITIVE_KEYS = {"password_hash", "google_sub", "stripe_customer_id"}


def _scrub(payload: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Strip secrets from before/after snapshots before writing to the log."""
    if payload is None:
        return None
    return {k: ("[REDACTED]" if k in _SENSITIVE_KEYS else v) for k, v in payload.items()}
