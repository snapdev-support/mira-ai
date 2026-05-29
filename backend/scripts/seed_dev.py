from __future__ import annotations

import asyncio
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Allow running as: python scripts/seed_dev.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.security import hash_password


async def main() -> None:
    # Allow running without manually exporting env vars.
    # Reads backend/.env when invoked from the backend folder.
    load_dotenv()

    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        raise RuntimeError("MONGODB_URI not set")

    email = os.environ.get("SEED_EMAIL", "dev@example.com").lower()
    password = os.environ.get("SEED_PASSWORD", "password123")

    seed_claims = int(os.environ.get("SEED_CLAIMS", "0") or 0)
    seed_scans_per_claim = int(os.environ.get("SEED_SCANS_PER_CLAIM", "0") or 0)

    seed_set_issued_count_raw = os.environ.get("SEED_SET_ISSUED_COUNT")
    seed_set_credits_remaining_raw = os.environ.get("SEED_SET_CREDITS_REMAINING")
    free_limit = int(os.environ.get("FREE_TIER_ISSUE_CAP", "100") or 100)

    client = AsyncIOMotorClient(mongodb_uri)
    db = client.get_default_database()

    await db.users.update_one(
        {"email": email},
        {
            "$setOnInsert": {
                "email": email,
                "password_hash": hash_password(password),
                "plan": "free",
                "issued_count": 0,
                "claim_credits_remaining": 100,
            }
        },
        upsert=True,
    )

    user = await db.users.find_one({"email": email})
    if not user:
        raise RuntimeError("Failed to load seeded user")

    print(f"Seeded user: {email} / {password}")

    if seed_set_issued_count_raw is not None:
        issued_count = int(seed_set_issued_count_raw)
        if seed_set_credits_remaining_raw is not None:
            credits_remaining = int(seed_set_credits_remaining_raw)
        else:
            credits_remaining = max(free_limit - issued_count, 0)

        now = datetime.now(timezone.utc)
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "plan": "free",
                    "issued_count": issued_count,
                    "claim_credits_remaining": credits_remaining,
                    "updated_at": now,
                }
            },
        )
        print(f"Updated usage: issued_count={issued_count}, claim_credits_remaining={credits_remaining}")

    if seed_claims > 0:
        now = datetime.now(timezone.utc)
        claims = []
        for _ in range(seed_claims):
            jti = uuid.uuid4().hex
            claims.append(
                {
                    "jti": jti,
                    "account_id": user["_id"],
                    "template": random.choice(["invoice", "package", "return_sla"]),
                    "subject": {"type": "seed", "id": f"seed-{jti[:8]}"},
                    "facts": {},
                    "status": random.choice(["active", "active", "active", "revoked"]),
                    "iat": now - timedelta(days=random.randint(0, 6), minutes=random.randint(0, 1200)),
                    "exp": (now + timedelta(days=30)).isoformat(),
                    "policy": {"replay_window_s": 300},
                    "qr_payload": f"seed://t/{jti}",
                }
            )

        # Insert while keeping unique jti constraint happy.
        for c in claims:
            await db.claims.update_one({"jti": c["jti"]}, {"$setOnInsert": c}, upsert=True)

        print(f"Seeded claims: {seed_claims}")

        if seed_scans_per_claim > 0:
            scan_docs = []
            verdicts = ["VALID", "VALID", "VALID", "UNVERIFIED", "UNKNOWN", "EXPIRED", "REVOKED"]
            for c in claims:
                for i in range(seed_scans_per_claim):
                    ts = now - timedelta(minutes=random.randint(0, 60 * 24))
                    verdict = random.choice(verdicts)
                    scan_docs.append(
                        {
                            "ts": ts,
                            "jti": c["jti"],
                            "issuer_account_id": user["_id"],
                            "token_class": "mira",
                            "verdict": verdict,
                            "reason_code": "OK_VALID" if verdict == "VALID" else "seed",
                            "latency_ms": random.randint(40, 450),
                            "ip_hash": "seed",
                            "ua": "seed",
                        }
                    )

            if scan_docs:
                await db.scan_events.insert_many(scan_docs)
            print(f"Seeded scan_events: {seed_claims * seed_scans_per_claim}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
