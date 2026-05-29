from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.security import hash_password, verify_password


async def create_user(db: AsyncIOMotorDatabase, email: str, password: str) -> dict:
    now = datetime.now(timezone.utc)
    user = {
        "email": email.lower(),
        "password_hash": hash_password(password),
        "plan": "free",
        "role": "user",
        "is_disabled": False,
        "deleted_at": None,
        "issued_count": 0,
        "claim_credits_remaining": settings.free_tier_issue_cap,
        "created_at": now,
        "updated_at": now,
        "stripe_customer_id": None,
        "plan_updated_at": None,
    }
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    return user


async def authenticate_user(db: AsyncIOMotorDatabase, email: str, password: str) -> dict | None:
    """
    Returns the user dict on success, None on bad credentials, and raises
    PermissionError if the account is disabled or soft-deleted. The router
    translates the exception into HTTP 403.
    """
    user = await db.users.find_one({"email": email.lower()})
    if not user:
        return None
    if not verify_password(password, user.get("password_hash", "")):
        return None
    if user.get("deleted_at") is not None:
        raise PermissionError("account_deleted")
    if user.get("is_disabled"):
        raise PermissionError("account_disabled")
    return user


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> dict | None:
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None
    return await db.users.find_one({"_id": oid})
