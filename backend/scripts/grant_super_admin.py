"""
Promote an existing user to super_admin. There is no UI to create the first
super_admin (chicken-and-egg), so this script is the bootstrap path.

Usage:
    python scripts/grant_super_admin.py user@example.com

Or non-interactively via env var:
    SUPER_ADMIN_EMAIL=user@example.com python scripts/grant_super_admin.py

After bootstrapping the first super_admin, all subsequent admin role changes
should be made through the admin console UI (POST /api/v1/admin/users/{id}/role).

The script also unbans the account if it was disabled or soft-deleted, since
those flags would otherwise block login.
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


async def main() -> None:
    load_dotenv()
    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        raise SystemExit("MONGODB_URI not set in environment")

    email = (
        sys.argv[1].strip().lower()
        if len(sys.argv) > 1
        else (os.environ.get("SUPER_ADMIN_EMAIL", "") or "").strip().lower()
    )
    if not email:
        raise SystemExit("Usage: python scripts/grant_super_admin.py user@example.com")

    client = AsyncIOMotorClient(mongodb_uri)
    db = client.get_default_database()

    user = await db.users.find_one({"email": email})
    if not user:
        client.close()
        raise SystemExit(f"No user found with email {email!r}. Sign up first, then re-run.")

    result = await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "role": "super_admin",
                "is_disabled": False,
                "deleted_at": None,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    client.close()

    if result.matched_count == 1:
        # ASCII-only output so this works on Windows' default cp1252 codepage.
        print(f"Promoted {email} -> role=super_admin")
    else:
        raise SystemExit(f"Failed to update user {email!r}")


if __name__ == "__main__":
    asyncio.run(main())
