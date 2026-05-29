"""
Seed the kb_articles collection with the initial MiraTrust support knowledge base.

Idempotent: re-running upserts each article by slug, so it's safe to use both
for first-time setup and to push KB updates from this file in dev.

For production edits prefer editing the documents directly in Mongo (no redeploy
required); use this script only to bootstrap an empty collection or reset to a
known baseline (`SEED_KB_RESET=1 python scripts/seed_kb.py`).
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


# Higher priority articles render first in the system prompt. The model reads
# top-to-bottom, so the most-asked questions belong at the top.
ARTICLES: list[dict] = [
    # ── Credits ────────────────────────────────────────────────────────────
    {
        "slug": "credits-basics",
        "category": "Credits & Billing",
        "title": "How credits work",
        "priority": 100,
        "content": (
            "1 credit = 1 QR code issued. Free accounts start with 100 credits. "
            "Credits never expire. The current balance is shown in the top "
            "navigation bar of the app."
        ),
    },
    {
        "slug": "credit-packs",
        "category": "Credits & Billing",
        "title": "Credit pack pricing",
        "priority": 95,
        "content": (
            "Three one-time credit packs are available (never expire):\n"
            "- Starter: 1,000 credits for $97\n"
            "- Growth: 5,000 credits for $499\n"
            "- Enterprise: 12,000 credits for $999\n"
            "Add credits from the Billing section or the /pricing page. Credits "
            "are applied to the account instantly after payment succeeds."
        ),
    },
    {
        "slug": "credits-not-showing",
        "category": "Credits & Billing",
        "title": "Credits not showing after payment",
        "priority": 80,
        "content": (
            "Refresh the page — credits are applied automatically as soon as "
            "payment clears. If they're still missing after 5 minutes, check "
            "Billing > History for the transaction status. If the transaction "
            "shows as succeeded but credits are still missing, escalate to a "
            "human (this requires a manual fix)."
        ),
    },
    {
        "slug": "refund-policy",
        "category": "Credits & Billing",
        "title": "Refunds",
        "priority": 70,
        "content": (
            "Credit packs are non-refundable. Exceptions are made for billing "
            "errors (double-charge, wrong amount, charge after cancellation) — "
            "these require a human review, so escalate to support."
        ),
    },
    # ── QR generation ──────────────────────────────────────────────────────
    {
        "slug": "cant-generate-qr",
        "category": "QR Codes",
        "title": "Can't generate a QR code",
        "priority": 90,
        "content": (
            "First, check the credit balance in the top navigation bar. If "
            "credits are 0, add more from Billing > Add Credits — issuance is "
            "blocked at zero credits. If credits are available but generation "
            "still fails, this is unusual and should be escalated."
        ),
    },
    {
        "slug": "studio-overview",
        "category": "QR Codes",
        "title": "Where to create QR codes",
        "priority": 60,
        "content": (
            "QR codes are created and managed in the Studio section of the app "
            "(/app/studio). Each QR represents one signed claim and consumes "
            "one credit when issued."
        ),
    },
    # ── Verify / scanning ──────────────────────────────────────────────────
    {
        "slug": "verify-where",
        "category": "Verification",
        "title": "How to verify a QR code",
        "priority": 85,
        "content": (
            "Anyone can verify a MiraTrust QR code at /verify — no account "
            "needed. Authenticated users can also use /app/verify, which is "
            "installable as a PWA for offline-friendly verification."
        ),
    },
    {
        "slug": "qr-shows-invalid",
        "category": "Verification",
        "title": "QR scan shows counterfeit or invalid",
        "priority": 75,
        "content": (
            "An invalid result means one of two things: the brand revoked the "
            "claim (the product was returned, recalled, or flagged), or the QR "
            "is genuinely counterfeit. Either way, contact the brand directly "
            "— MiraTrust cannot override a revocation."
        ),
    },
    {
        "slug": "qr-camera-not-scanning",
        "category": "Verification",
        "title": "QR code not scanning with camera",
        "priority": 60,
        "content": (
            "Make sure camera permissions are granted to the browser. If the "
            "camera still won't open, use the web scanner at /verify and "
            "upload an image of the QR instead — that path doesn't need "
            "camera access."
        ),
    },
    {
        "slug": "verdict-meanings",
        "category": "Verification",
        "title": "What the verify verdicts mean",
        "priority": 55,
        "content": (
            "VALID — claim is active and the signature checks out.\n"
            "EXPIRED — claim was valid but its expiry date has passed.\n"
            "REVOKED — the brand explicitly revoked this claim.\n"
            "UNVERIFIED — the QR points to a partner URL we couldn't verify.\n"
            "UNKNOWN — the input doesn't match any MiraTrust format."
        ),
    },
    # ── Account ────────────────────────────────────────────────────────────
    {
        "slug": "cant-sign-in",
        "category": "Account",
        "title": "Can't sign in",
        "priority": 70,
        "content": (
            "Use 'Forgot password' on the login page to reset the password. "
            "For Google sign-in issues, clear browser cookies and sign out of "
            "Google first, then retry. Persistent login issues should be "
            "escalated to a human."
        ),
    },
    {
        "slug": "team-members",
        "category": "Account",
        "title": "Inviting team members",
        "priority": 50,
        "content": (
            "Team management is on the roadmap but not yet available. Right "
            "now MiraTrust is one account per organization. If multiple "
            "people need access today, share the login credentials securely."
        ),
    },
]


async def main() -> None:
    load_dotenv()
    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        raise RuntimeError("MONGODB_URI not set")

    reset = os.environ.get("SEED_KB_RESET") == "1"

    client = AsyncIOMotorClient(mongodb_uri)
    db = client.get_default_database()

    if reset:
        deleted = await db.kb_articles.delete_many({})
        print(f"Reset: deleted {deleted.deleted_count} existing articles")

    now = datetime.now(timezone.utc)
    upserts = 0
    for art in ARTICLES:
        result = await db.kb_articles.update_one(
            {"slug": art["slug"]},
            {
                "$set": {**art, "updated_at": now},
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        if result.upserted_id is not None or result.modified_count:
            upserts += 1

    total = await db.kb_articles.count_documents({})
    print(f"Seeded {upserts}/{len(ARTICLES)} articles. Collection now has {total} total.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
