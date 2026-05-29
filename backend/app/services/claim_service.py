from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.services.billing_service import create_checkout_session
from app.utils.token import compute_checksum


class PaymentRequiredError(Exception):
    def __init__(self, payload: dict):
        self.payload = payload


async def issue_claim(db: AsyncIOMotorDatabase, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user id")

    user = await db.users.find_one({"_id": oid})
    if not user:
        raise ValueError("User not found")

    free_limit = int(settings.free_tier_issue_cap)
    issued_count = int(user.get("issued_count", 0) or 0)

    # Backfill credits for older accounts that only tracked issued_count.
    if user.get("claim_credits_remaining") is None:
        derived = max(free_limit - issued_count, 0)
        await db.users.update_one(
            {"_id": oid, "claim_credits_remaining": {"$exists": False}},
            {"$set": {"claim_credits_remaining": int(derived), "updated_at": datetime.now(timezone.utc)}},
        )
        user = await db.users.find_one({"_id": oid}) or user

    credits_remaining = int(user.get("claim_credits_remaining", 0) or 0)
    if credits_remaining <= 0:
        checkout_url, _session_id = await create_checkout_session(db, user, "credits_1000")
        raise PaymentRequiredError(
            {
                "error": {
                    "code": "PAYWALL_CLAIMS_EXHAUSTED",
                    "message": "All claim credits have been used.",
                    "httpStatus": 402,
                },
                "quota": {
                    "plan": "paid" if user.get("plan") in ("paid", "pro") else "free",
                    "issuedCount": issued_count,
                    "creditsRemaining": 0,
                    "freeLimit": free_limit,
                },
                "actions": {
                    "pricingPageUrl": "/pricing",
                    "checkoutUrl": checkout_url or None,
                },
                # Legacy fields
                "detail": "Plan limit reached",
                "checkoutUrl": checkout_url or "",
            }
        )

    jti = uuid.uuid4().hex
    checksum = compute_checksum(jti)
    qr_payload = f"{settings.normalized_public_web_base_url}/t/{jti}?h={checksum}"

    now = datetime.now(timezone.utc)
    claim_doc = {
        "jti": jti,
        "account_id": oid,
        "template": payload["template"],
        "subject": payload.get("subject"),
        "facts": payload.get("facts") or {},
        "status": "active",
        "iat": now,
        "exp": payload["exp"],
        "policy": payload.get("policy") or {"replay_window_s": 300},
        "qr_payload": qr_payload,
    }

    # Atomic quota enforcement: decrement credits + increment issued_count, then insert claim.
    result = await db.users.update_one(
        {"_id": oid, "claim_credits_remaining": {"$gt": 0}},
        {"$inc": {"claim_credits_remaining": -1, "issued_count": 1}, "$set": {"updated_at": now}},
    )
    if result.matched_count == 0:
        checkout_url, _session_id = await create_checkout_session(db, user, "credits_1000")
        raise PaymentRequiredError(
            {
                "error": {
                    "code": "PAYWALL_CLAIMS_EXHAUSTED",
                    "message": "All claim credits have been used.",
                    "httpStatus": 402,
                },
                "quota": {
                    "plan": "paid" if user.get("plan") in ("paid", "pro") else "free",
                    "issuedCount": issued_count,
                    "creditsRemaining": 0,
                    "freeLimit": free_limit,
                },
                "actions": {
                    "pricingPageUrl": "/pricing",
                    "checkoutUrl": checkout_url or None,
                },
                "detail": "Plan limit reached",
                "checkoutUrl": checkout_url or "",
            }
        )

    try:
        await db.claims.insert_one(claim_doc)
    except Exception:
        await db.users.update_one(
            {"_id": oid},
            {"$inc": {"issued_count": -1, "claim_credits_remaining": 1}},
        )
        raise

    return {
        "jti": jti,
        "qrPayload": qr_payload,
        "exp": claim_doc["exp"],
        "status": claim_doc["status"],
    }


async def revoke_claim(db: AsyncIOMotorDatabase, user_id: str, jti: str, reason: str) -> None:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user id")

    now = datetime.now(timezone.utc)
    await db.claims.update_one({"jti": jti, "account_id": oid}, {"$set": {"status": "revoked"}})
    await db.revocations.update_one(
        {"jti": jti},
        {"$setOnInsert": {"jti": jti, "reason": reason, "ts": now, "by_account_id": oid}},
        upsert=True,
    )
