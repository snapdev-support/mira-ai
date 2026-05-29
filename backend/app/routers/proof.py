from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.db import get_db
from app.models.proof import ProofClaim, ProofResponse, ProofRevocation, ProofScanStats
from app.services.verify_service import verify_token
from app.utils.token import ParsedToken, validate_checksum


router = APIRouter(prefix="/api/v1", tags=["proof"])


@router.get("/proof/{jti}", response_model=ProofResponse)
async def get_proof(jti: str, h: str = Query(..., min_length=3, max_length=64)):
    """Public proof details for a Mira claim.

    This endpoint is checksum-gated (h = checksum) to avoid enumeration.
    It returns claim details + a verify-style verdict WITHOUT recording a scan_event.
    """

    if not validate_checksum(jti, h):
        raise HTTPException(status_code=404, detail="Proof not found")

    db = get_db()
    claim = await db.claims.find_one({"jti": jti})
    if not claim:
        raise HTTPException(status_code=404, detail="Proof not found")

    parsed = ParsedToken(token_class="mira", jti=jti, checksum=h)
    verify_result, _token_class = await verify_token(db, parsed)

    revocation_doc = None
    if claim.get("status") == "revoked":
        revocation_doc = await db.revocations.find_one({"jti": jti}, {"_id": 0})

    scan_count = 0
    last_scan = None
    try:
        scan_count = await db.scan_events.count_documents({"jti": jti})
        last_scan = await db.scan_events.find_one({"jti": jti}, sort=[("ts", -1)])
    except Exception:
        scan_count = 0
        last_scan = None

    now = datetime.now(timezone.utc)

    claim_model = ProofClaim(
        jti=jti,
        template=claim.get("template"),
        status=str(claim.get("status") or "unknown"),
        iat=claim.get("iat"),
        exp=claim.get("exp"),
        subject=claim.get("subject") or {},
        facts=claim.get("facts") or {},
        qr_payload=claim.get("qr_payload"),
        account_id=str(claim.get("account_id")) if claim.get("account_id") is not None else None,
    )

    revocation_model = None
    if revocation_doc:
        revocation_model = ProofRevocation(
            jti=jti,
            reason=revocation_doc.get("reason"),
            ts=revocation_doc.get("ts"),
            by_account_id=str(revocation_doc.get("by_account_id")) if revocation_doc.get("by_account_id") is not None else None,
        )

    scan_stats_model = ProofScanStats(
        scan_count=int(scan_count or 0),
        last_scan_ts=(last_scan or {}).get("ts") if last_scan else None,
        last_latency_ms=(last_scan or {}).get("latency_ms") if last_scan else None,
        last_verdict=(last_scan or {}).get("verdict") if last_scan else None,
    )

    # Ensure verify timestamp is present and monotonic-ish
    try:
        if not verify_result.get("timestamp"):
            verify_result["timestamp"] = now
    except Exception:
        pass

    return ProofResponse(
        claim=claim_model,
        verify=verify_result,
        revocation=revocation_model,
        scan_stats=scan_stats_model,
    )
