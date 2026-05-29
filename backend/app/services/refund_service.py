"""
Admin-initiated Stripe refunds with policy enforcement.

The policy guard rails live HERE, not in the router, so any future caller
(scripts, webhooks, batch jobs) gets the same protection automatically. The
router just wires HTTP shape; the rules below are the single source of truth.

Policy (v1):
  Auto-approve  — payment errors, OR within 14 days AND < 10% credits consumed
  Discretion    — within 60 days AND < 50% credits consumed
  Hard decline  — > 60 days OR > 50% consumed OR another refund within 90 days

`force=True` (super_admin only, enforced at the router) bypasses every soft
rule and logs the override loudly in the audit trail.

Stripe-side flow is straightforward: we call `stripe.Refund.create()` with an
idempotency key derived from the transaction id + refund attempt number. The
`charge.refunded` webhook reconciles asynchronously in case anything was
issued from the Stripe dashboard directly.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import stripe
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("mira.refunds")


# ── Policy parameters ──────────────────────────────────────────────────────
#
# Pulled out as module constants so it's easy to dial them in once the audit
# log shows real-world abuse patterns.

REFUND_HARD_WINDOW_DAYS = 60
REFUND_CONSUMPTION_HARD_CAP = 0.50  # > 50% of credits used → hard decline
REFUND_REPEAT_WINDOW_DAYS = 90      # block second refund within this window


class RefundPolicyError(Exception):
    """Raised when a refund attempt violates a hard policy rule and force=False.

    Carries a short, customer-safe `code` so the frontend can branch UI on the
    reason (e.g. show 'Override' button on super_admin sessions).
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class RefundResult:
    stripe_refund_id: str
    amount_cents: int
    transaction_id: str
    forced: bool


def _as_aware_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Mongo/Motor returns naive datetimes (BSON has no tzinfo). Treat them
    as UTC so comparisons against `datetime.now(timezone.utc)` don't blow up.
    Returns None unchanged."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ── Internal helpers ───────────────────────────────────────────────────────


def _configure_stripe() -> None:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe secret key not configured")
    stripe.api_key = settings.stripe_secret_key


async def _count_recent_refunds(
    db: AsyncIOMotorDatabase, account_id: ObjectId, since: datetime
) -> int:
    """Count refund events on this user's transactions since the given date.

    We count refund *events* (rows in the embedded `refunds[]` array), not
    distinct transactions — a single tx that was partially refunded twice
    counts as two, which is what we want for abuse-pattern detection.
    """
    pipeline: list[dict[str, Any]] = [
        {"$match": {"account_id": account_id, "refunds": {"$exists": True}}},
        {"$unwind": "$refunds"},
        {"$match": {"refunds.ts": {"$gte": since}}},
        {"$count": "n"},
    ]
    rows = await db.billing_transactions.aggregate(pipeline).to_list(1)
    return int(rows[0]["n"]) if rows else 0


async def _consumption_ratio(
    db: AsyncIOMotorDatabase, account_id: ObjectId, credits_added: int
) -> float:
    """Best-effort estimate of how much of the credits-added pack has been
    consumed. We look at the user's remaining balance vs. the total credits
    they've ever been granted. Returns a ratio in [0.0, 1.0]; 0 if we can't
    determine it.
    """
    if credits_added <= 0:
        return 0.0
    user = await db.users.find_one({"_id": account_id}, projection={"claim_credits_remaining": 1})
    remaining = int((user or {}).get("claim_credits_remaining", 0) or 0)

    pipeline = [
        {"$match": {"account_id": account_id, "status": {"$in": ["paid", "refunded", "partially_refunded"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$credits_added"}}},
    ]
    rows = await db.billing_transactions.aggregate(pipeline).to_list(1)
    total = int(rows[0]["total"]) if rows else credits_added
    if total <= 0:
        return 0.0
    used = max(0, total - remaining)
    return min(1.0, used / total)


# ── Public API ─────────────────────────────────────────────────────────────


async def evaluate_policy(
    db: AsyncIOMotorDatabase, tx: dict, force: bool
) -> None:
    """Run all hard checks. Raise RefundPolicyError on first violation.

    If force=True, every soft rule is skipped and only structural rules
    remain (already fully refunded, missing Stripe id, etc.).
    """
    # Structural checks — always enforced, even with force=True
    refunded_so_far = int(tx.get("refunded_amount_cents", 0))
    original_cents = int(tx.get("usd_amount", 0)) * 100
    if original_cents <= 0:
        raise RefundPolicyError(
            "no_charge",
            "Transaction has no recorded charge to refund.",
        )
    if refunded_so_far >= original_cents:
        raise RefundPolicyError(
            "already_refunded",
            "This transaction has already been fully refunded.",
        )
    if not tx.get("payment_intent_id"):
        raise RefundPolicyError(
            "no_payment_intent",
            "Transaction has no Stripe payment_intent on file. Refund manually from Stripe dashboard.",
        )
    if tx.get("status") not in ("paid", "partially_refunded"):
        raise RefundPolicyError(
            "not_paid",
            f"Transaction status is '{tx.get('status')}'. Only paid transactions can be refunded.",
        )

    if force:
        return  # super_admin override — soft rules skipped

    # Soft rules ────
    created_at = _as_aware_utc(tx.get("created_at"))
    if created_at is not None:
        age = datetime.now(timezone.utc) - created_at
        if age > timedelta(days=REFUND_HARD_WINDOW_DAYS):
            raise RefundPolicyError(
                "too_old",
                f"Transaction is {age.days} days old — policy declines refunds past "
                f"{REFUND_HARD_WINDOW_DAYS} days. Super-admin can override.",
            )

    consumption = await _consumption_ratio(
        db, tx["account_id"], int(tx.get("credits_added", 0))
    )
    if consumption > REFUND_CONSUMPTION_HARD_CAP:
        raise RefundPolicyError(
            "too_consumed",
            f"Customer has consumed {int(consumption * 100)}% of their credits. "
            f"Policy declines refunds past {int(REFUND_CONSUMPTION_HARD_CAP * 100)}%. "
            "Super-admin can override.",
        )

    since = datetime.now(timezone.utc) - timedelta(days=REFUND_REPEAT_WINDOW_DAYS)
    recent = await _count_recent_refunds(db, tx["account_id"], since)
    if recent > 0:
        raise RefundPolicyError(
            "recent_refund",
            f"Customer has {recent} refund(s) in the last {REFUND_REPEAT_WINDOW_DAYS} days. "
            "Policy blocks repeats — super-admin can override.",
        )


async def issue_refund(
    db: AsyncIOMotorDatabase,
    transaction_id: str,
    *,
    admin_id: ObjectId,
    admin_email: str,
    reason: str,
    force: bool = False,
) -> RefundResult:
    """Issue a full refund against the original transaction.

    v1: full refunds only — Stripe API supports partial via `amount=`, but
    we keep v1 tight. Partial support is a one-line change when we want it.
    """
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe secret key not configured")

    try:
        tx_oid = ObjectId(transaction_id)
    except Exception as exc:
        raise RefundPolicyError("bad_id", "Invalid transaction id.") from exc

    tx = await db.billing_transactions.find_one({"_id": tx_oid})
    if not tx:
        raise RefundPolicyError("not_found", "Transaction not found.")

    await evaluate_policy(db, tx, force=force)

    _configure_stripe()
    refund_cents = int(tx["usd_amount"]) * 100 - int(tx.get("refunded_amount_cents", 0))

    # Idempotency key design: hash the request body so that
    #   - Exact retries of the same request (network blip, double-click) →
    #     same key → Stripe replays the cached response (safe).
    #   - A genuine re-attempt with a different reason/amount/force flag →
    #     different key → Stripe treats it as a fresh request.
    # Without the hash, a partial failure (Stripe accepted but our DB crash)
    # would leave a "burned" key — any retry with a different reason would
    # 400 with "idempotent key used with different parameters" until we
    # manually reconciled.
    prior_refunds = len(tx.get("refunds") or [])
    body_fingerprint = hashlib.sha256(
        f"{refund_cents}|{reason}|{force}".encode("utf-8")
    ).hexdigest()[:16]
    idempotency_key = f"refund-{transaction_id}-{prior_refunds}-{body_fingerprint}"

    try:
        sr = stripe.Refund.create(
            payment_intent=tx["payment_intent_id"],
            amount=refund_cents,
            reason="requested_by_customer",
            metadata={
                "account_id": str(tx["account_id"]),
                "transaction_id": transaction_id,
                "admin_email": admin_email,
                "internal_reason": reason[:450],  # Stripe metadata cap is 500 chars
                "forced": "true" if force else "false",
            },
            idempotency_key=idempotency_key,
        )
    except stripe.error.StripeError as exc:
        logger.exception(
            "refund.stripe_error tx=%s err=%s", transaction_id, exc
        )
        # Stripe failures bubble as a policy error so the router maps cleanly
        # to a 4xx — these are user-actionable (re-try, contact Stripe, etc.)
        raise RefundPolicyError("stripe_error", str(exc)) from exc

    # stripe.Refund is a StripeObject — supports bracket and getattr access,
    # but NOT .get() in the stripe>=8 SDK. Use bracket + getattr defensively.
    now = datetime.now(timezone.utc)
    refund_record = {
        "stripe_refund_id": sr["id"],
        "amount_cents": refund_cents,
        "currency": (getattr(sr, "currency", None) or "usd").lower(),
        "reason": reason,
        "forced": force,
        "issued_by": admin_id,
        "issued_by_email": admin_email,
        "ts": now,
        "stripe_status": getattr(sr, "status", None),
    }

    new_refunded_total = int(tx.get("refunded_amount_cents", 0)) + refund_cents
    new_status = "refunded" if new_refunded_total >= int(tx["usd_amount"]) * 100 else "partially_refunded"

    await db.billing_transactions.update_one(
        {"_id": tx_oid},
        {
            "$set": {
                "status": new_status,
                "refunded_amount_cents": new_refunded_total,
                "updated_at": now,
            },
            "$push": {"refunds": refund_record},
        },
    )

    logger.info(
        "refund.issued tx=%s amount_cents=%d admin=%s forced=%s stripe_id=%s",
        transaction_id,
        refund_cents,
        admin_email,
        force,
        sr["id"],
    )

    return RefundResult(
        stripe_refund_id=sr["id"],
        amount_cents=refund_cents,
        transaction_id=transaction_id,
        forced=force,
    )


async def reconcile_refund_from_webhook(
    db: AsyncIOMotorDatabase, refund_obj: dict
) -> None:
    """Idempotent handler for Stripe `charge.refunded` events.

    Covers two cases:
      1. Refund initiated through our admin UI — already recorded by
         issue_refund(). We match by `stripe_refund_id` and just update the
         `stripe_status`.
      2. Refund initiated directly in the Stripe dashboard — no embedded
         record exists. We synthesize a refund row so the audit trail
         reflects what Stripe shows.
    """
    refund_id = refund_obj.get("id")
    payment_intent = refund_obj.get("payment_intent")
    amount_cents = int(refund_obj.get("amount") or 0)
    status_ = refund_obj.get("status")

    if not refund_id or not payment_intent:
        return

    tx = await db.billing_transactions.find_one({"payment_intent_id": payment_intent})
    if not tx:
        logger.warning(
            "refund.webhook tx_not_found pi=%s refund=%s", payment_intent, refund_id
        )
        return

    now = datetime.now(timezone.utc)
    existing = next(
        (r for r in (tx.get("refunds") or []) if r.get("stripe_refund_id") == refund_id),
        None,
    )

    if existing:
        # Just update the stripe_status. No change to refunded_amount_cents
        # since we already counted it at issue time.
        await db.billing_transactions.update_one(
            {"_id": tx["_id"], "refunds.stripe_refund_id": refund_id},
            {
                "$set": {
                    "refunds.$.stripe_status": status_,
                    "updated_at": now,
                }
            },
        )
        return

    # Out-of-band refund (issued from Stripe dashboard). Synthesize a record.
    new_refunded_total = int(tx.get("refunded_amount_cents", 0)) + amount_cents
    new_status = "refunded" if new_refunded_total >= int(tx["usd_amount"]) * 100 else "partially_refunded"

    await db.billing_transactions.update_one(
        {"_id": tx["_id"]},
        {
            "$set": {
                "status": new_status,
                "refunded_amount_cents": new_refunded_total,
                "updated_at": now,
            },
            "$push": {
                "refunds": {
                    "stripe_refund_id": refund_id,
                    "amount_cents": amount_cents,
                    "currency": (refund_obj.get("currency") or "usd").lower(),
                    "reason": "issued in Stripe dashboard",
                    "forced": False,
                    "issued_by": None,
                    "issued_by_email": None,
                    "ts": now,
                    "stripe_status": status_,
                    "source": "stripe_dashboard",
                }
            },
        },
    )
    logger.info(
        "refund.webhook reconciled out_of_band pi=%s refund=%s amount_cents=%d",
        payment_intent,
        refund_id,
        amount_cents,
    )


def get_refundable_user_email(tx: dict, fallback_db_lookup: Optional[str]) -> Optional[str]:
    """Helper for callers that want to email the customer post-refund.

    Tries the transaction's denormalized fields first; falls back to whatever
    the caller already looked up.
    """
    return tx.get("user_email") or fallback_db_lookup
