"""
One-shot backfill for users created before the admin model existed.

Sets sensible defaults on every user document that's missing one of:
  - role         -> "user"
  - is_disabled  -> False
  - deleted_at   -> None

The admin-list endpoint is already tolerant of missing fields (uses `$ne` /
null-match), so this script is hygiene only — not required for correctness.
Run it once after deploying the admin work to keep the collection tidy.

Idempotent. Safe to run repeatedly. Dry-run mode reports what would change
without writing.

Usage:
    python scripts/backfill_user_fields.py            # apply changes
    DRY_RUN=1 python scripts/backfill_user_fields.py  # report only
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
        raise SystemExit("MONGODB_URI not set")

    dry_run = os.environ.get("DRY_RUN") == "1"

    client = AsyncIOMotorClient(mongodb_uri)
    db = client.get_default_database()

    # Report what's missing before we touch anything.
    total = await db.users.count_documents({})
    missing_role = await db.users.count_documents({"role": {"$exists": False}})
    missing_disabled = await db.users.count_documents({"is_disabled": {"$exists": False}})
    missing_deleted = await db.users.count_documents({"deleted_at": {"$exists": False}})

    print("== Pre-scan ==")
    print(f"  total users:              {total}")
    print(f"  missing role:             {missing_role}")
    print(f"  missing is_disabled:      {missing_disabled}")
    print(f"  missing deleted_at:       {missing_deleted}")

    if missing_role == 0 and missing_disabled == 0 and missing_deleted == 0:
        print("\nNothing to do — all users already have the admin fields.")
        client.close()
        return

    if dry_run:
        print("\nDRY_RUN=1 -> no writes performed.")
        client.close()
        return

    # Each $set only triggers an update when the field is actually missing,
    # so we run three independent updates instead of one combined one. This
    # also keeps the modified-count per-field accurate in the log.
    now = datetime.now(timezone.utc)

    role_result = await db.users.update_many(
        {"role": {"$exists": False}},
        {"$set": {"role": "user", "updated_at": now}},
    )
    disabled_result = await db.users.update_many(
        {"is_disabled": {"$exists": False}},
        {"$set": {"is_disabled": False, "updated_at": now}},
    )
    deleted_result = await db.users.update_many(
        {"deleted_at": {"$exists": False}},
        {"$set": {"deleted_at": None, "updated_at": now}},
    )

    print("\n== Backfill ==")
    print(f"  role           -> 'user'   : {role_result.modified_count} users updated")
    print(f"  is_disabled    -> False    : {disabled_result.modified_count} users updated")
    print(f"  deleted_at     -> None     : {deleted_result.modified_count} users updated")

    # Post-scan sanity check.
    still_missing = await db.users.count_documents(
        {
            "$or": [
                {"role": {"$exists": False}},
                {"is_disabled": {"$exists": False}},
                {"deleted_at": {"$exists": False}},
            ]
        }
    )
    print(f"\nUsers still missing at least one field: {still_missing}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
