from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.utils.token import ParsedToken, validate_checksum
from app.services.safety_service import SafetyService


def _explain(verdict: str, detail: str) -> List[str]:
    # Deterministic 2-line explanation (Stage-1 copy experiment seam)
    variant = (settings.ab_copy_variant or "A").upper()
    if variant == "B":
        templates = {
            "VALID": ("Verified", detail),
            "EXPIRED": ("No longer valid", detail),
            "REVOKED": ("Revoked", detail),
            "UNVERIFIED": ("Unverified", detail),
            "UNKNOWN": ("Unknown", detail),
        }
    else:
        templates = {
            "VALID": ("Valid", detail),
            "EXPIRED": ("Expired", detail),
            "REVOKED": ("Revoked", detail),
            "UNVERIFIED": ("Unverified", detail),
            "UNKNOWN": ("Unknown", detail),
        }
    a, b = templates.get(verdict, ("Unknown", "We couldn’t verify this token safely"))
    return [a, b]


def _ensure_utc(dt: datetime) -> datetime:
    # MongoDB datetimes are commonly returned as tz-naive UTC datetimes.
    # Normalize to timezone-aware UTC for safe comparisons.
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # Accept RFC3339-ish strings that end in 'Z'
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None

async def verify_token(db: AsyncIOMotorDatabase, parsed: ParsedToken, include_safety: bool = False) -> Tuple[dict, str]:
    now = datetime.now(timezone.utc)

    if parsed.token_class in {"mira", "partner_mira"} and parsed.jti and parsed.checksum:
        if not validate_checksum(parsed.jti, parsed.checksum):
            return (
                {
                    "verdict": "UNKNOWN",
                    "reason_code": "ERR_MIRA_CHECKSUM",
                    "explanation": _explain("UNKNOWN", "We couldn’t verify this token safely"),
                    "issuer": {"type": "mira"},
                    "subject": {},
                    "timestamp": now,
                },
                parsed.token_class,
            )

        claim = await db.claims.find_one({"jti": parsed.jti})
        if not claim:
            return (
                {
                    "verdict": "UNKNOWN",
                    "reason_code": "ERR_CLAIM_NOT_FOUND",
                    "explanation": _explain("UNKNOWN", "We couldn’t find a matching Mira claim"),
                    "issuer": {"type": "mira"},
                    "subject": {},
                    "timestamp": now,
                },
                parsed.token_class,
            )

        if claim.get("status") == "revoked":
            return (
                {
                    "verdict": "REVOKED",
                    "reason_code": "STATE_REVOKED",
                    "explanation": _explain("REVOKED", "Issuer revoked this claim"),
                    "issuer": {"type": "mira", "account_id": str(claim.get("account_id"))},
                    "subject": claim.get("subject") or {},
                    "timestamp": now,
                    "proofUrl": f"{settings.normalized_public_web_base_url}/proof/{parsed.jti}?h={parsed.checksum}",
                },
                parsed.token_class,
            )

        exp_raw = claim.get("exp")
        exp_dt = _parse_datetime(exp_raw)
        if exp_raw is not None and exp_dt is None:
            # Safer to fail closed than to treat a potentially expired claim as valid.
            return (
                {
                    "verdict": "UNKNOWN",
                    "reason_code": "ERR_CLAIM_EXP_INVALID",
                    "explanation": _explain("UNKNOWN", "We couldn’t verify this token safely"),
                    "issuer": {"type": "mira", "account_id": str(claim.get("account_id"))},
                    "subject": claim.get("subject") or {},
                    "timestamp": now,
                    "proofUrl": f"{settings.normalized_public_web_base_url}/proof/{parsed.jti}?h={parsed.checksum}",
                },
                parsed.token_class,
            )

        if exp_dt is not None:
            exp_utc = _ensure_utc(exp_dt)
            if now > exp_utc:
                return (
                    {
                        "verdict": "EXPIRED",
                        "reason_code": "STATE_EXPIRED",
                        "explanation": _explain("EXPIRED", f"This claim expired on {exp_utc.date().isoformat()}"),
                        "issuer": {"type": "mira", "account_id": str(claim.get("account_id"))},
                        "subject": claim.get("subject") or {},
                        "timestamp": now,
                        "proofUrl": f"{settings.normalized_public_web_base_url}/proof/{parsed.jti}?h={parsed.checksum}",
                    },
                    parsed.token_class,
                )

        return (
            {
                "verdict": "VALID",
                "reason_code": "OK_VALID",
                "explanation": _explain("VALID", "Issued by Mira • Proof found"),
                "issuer": {"type": "mira", "account_id": str(claim.get("account_id"))},
                "subject": claim.get("subject") or {},
                "timestamp": now,
                "proofUrl": f"{settings.normalized_public_web_base_url}/proof/{parsed.jti}?h={parsed.checksum}",
            },
            parsed.token_class,
        )

    if parsed.token_class == "third_party_url":
        safety: Optional[dict] = None
        if settings.safety_summary_enabled and include_safety:
            svc = SafetyService(
                request_timeout_s=settings.safety_request_timeout_s,
                rdap_timeout_s=settings.safety_rdap_timeout_s,
                tls_timeout_s=settings.safety_tls_timeout_s,
                cache_ttl_s=settings.safety_cache_ttl_s,
                safebrowsing_api_key=settings.safe_browsing_api_key,
            )
            safety = await svc.summarize(parsed.url or "")
        return (
            {
                "verdict": "UNVERIFIED",
                "reason_code": "UNVERIFIED_THIRD_PARTY",
                "explanation": _explain("UNVERIFIED", "No Mira proof found • Safety summary below" if (settings.safety_summary_enabled and include_safety) else "No Mira proof found"),
                "issuer": {"type": "mira"},
                "subject": {},
                "timestamp": now,
                "safety": safety,
            },
            parsed.token_class,
        )

    return (
        {
            "verdict": "UNKNOWN",
            "reason_code": "ERR_INVALID_TOKEN",
            "explanation": _explain("UNKNOWN", "We couldn’t verify this token safely"),
            "issuer": {"type": "mira"},
            "subject": {},
            "timestamp": now,
        },
        parsed.token_class,
    )
