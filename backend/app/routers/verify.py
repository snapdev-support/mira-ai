from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from app.core.db import get_db
from app.core.logging import get_logger
from app.core.config import settings
from app.models.verify import VerifyRequest, VerifyResponse
from app.services.verify_service import verify_token
from app.utils.token import classify_token


router = APIRouter(prefix="/api/v1", tags=["verify"])

logger = get_logger("mira.verify")


@router.post("/verify", response_model=VerifyResponse)
async def verify(payload: VerifyRequest, request: Request):
    db = get_db()
    start = time.perf_counter()
    parsed = classify_token(payload.token)
    result, _token_class = await verify_token(db, parsed, include_safety=payload.include_safety)
    try:
        latency_ms = int((time.perf_counter() - start) * 1000)
        request_id = getattr(request.state, "request_id", None)

        # Persist scan event (do not store raw token or raw IP).
        now = datetime.now(timezone.utc)
        ip = None
        try:
            ip = request.client.host if request.client else None
        except Exception:
            ip = None
        ua = (request.headers.get("user-agent") or "").strip()
        if len(ua) > 200:
            ua = ua[:200]
        ip_hash = None
        if ip:
            salted = f"{ip}|{settings.scan_ip_hash_salt}".encode("utf-8")
            ip_hash = hashlib.sha256(salted).hexdigest()

        issuer_account_id = None
        try:
            issuer_account_id = (result.get("issuer") or {}).get("account_id")
        except Exception:
            issuer_account_id = None

        scan_doc = {
            "ts": now,
            "jti": parsed.jti,
            "token_class": _token_class,
            "verdict": result.get("verdict"),
            "reason_code": result.get("reason_code"),
            "latency_ms": latency_ms,
            "ip_hash": ip_hash,
            "ua": ua,
        }
        if issuer_account_id:
            # Store issuer_account_id as ObjectId for efficient user-scoped ops queries.
            try:
                from bson import ObjectId

                scan_doc["issuer_account_id"] = ObjectId(str(issuer_account_id))
            except Exception:
                pass

        try:
            await db.scan_events.insert_one(scan_doc)
        except Exception:
            # Never fail verification due to telemetry.
            pass

        # Do not log raw tokens/URLs. Only log class + jti.
        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "token_class": _token_class,
                    "verdict": result.get("verdict"),
                    "reason_code": result.get("reason_code"),
                    "latency_ms": latency_ms,
                    "jti": parsed.jti,
                },
                separators=(",", ":"),
                ensure_ascii=False,
            )
        )
        return VerifyResponse.model_validate(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verify response invalid: {e}")
