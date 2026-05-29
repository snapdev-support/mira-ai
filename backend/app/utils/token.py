from __future__ import annotations

import base64
import hmac
import secrets
from dataclasses import dataclass
from hashlib import sha256
from typing import Optional, Tuple
from urllib.parse import parse_qs, urlparse

from app.core.config import settings


_FALLBACK_TOKEN_HMAC_SECRET = secrets.token_bytes(32)

def _token_hmac_secret() -> bytes:
    if settings.token_hmac_secret:
        return settings.token_hmac_secret.encode("utf-8")
    # Dev fallback only. Set TOKEN_HMAC_SECRET in .env for stable tokens across restarts.
    return _FALLBACK_TOKEN_HMAC_SECRET


def compute_checksum(jti: str) -> str:
    digest = hmac.new(_token_hmac_secret(), jti.encode("utf-8"), sha256).digest()
    b32 = base64.b32encode(digest).decode("ascii").rstrip("=")
    return b32[:10].lower()


def validate_checksum(jti: str, checksum: str) -> bool:
    expected = compute_checksum(jti)
    return hmac.compare_digest(expected, checksum.lower())


@dataclass(frozen=True)
class ParsedToken:
    token_class: str
    jti: Optional[str] = None
    checksum: Optional[str] = None
    url: Optional[str] = None


def _parse_mira_scheme(token: str) -> Optional[Tuple[str, str]]:
    # mira:<jti>.<h>
    if not token.startswith("mira:"):
        return None
    rest = token[len("mira:") :].strip()
    if "." not in rest:
        return None
    jti, checksum = rest.split(".", 1)
    if not jti or not checksum:
        return None
    return jti, checksum


def _parse_t_url(token: str) -> Optional[Tuple[str, str]]:
    # https://<host>/t/<jti>?h=<h>
    try:
        parsed = urlparse(token)
    except Exception:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "t":
        jti = parts[1]
        qs = parse_qs(parsed.query)
        checksum = (qs.get("h") or [None])[0]
        if jti and checksum:
            return jti, checksum
    return None


def _parse_partner_query(token: str) -> Optional[Tuple[str, str]]:
    # https://partner.com/...?...&mira=<jti>.<h>
    try:
        parsed = urlparse(token)
    except Exception:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None
    qs = parse_qs(parsed.query)
    mira = (qs.get("mira") or [None])[0]
    if not mira or "." not in mira:
        return None
    jti, checksum = mira.split(".", 1)
    if not jti or not checksum:
        return None
    return jti, checksum


def classify_token(token: str) -> ParsedToken:
    token = (token or "").strip()
    if not token:
        return ParsedToken(token_class="unknown")

    mira = _parse_mira_scheme(token)
    if mira:
        jti, checksum = mira
        return ParsedToken(token_class="mira", jti=jti, checksum=checksum)

    t_url = _parse_t_url(token)
    if t_url:
        jti, checksum = t_url
        return ParsedToken(token_class="mira", jti=jti, checksum=checksum)

    partner = _parse_partner_query(token)
    if partner:
        jti, checksum = partner
        return ParsedToken(token_class="partner_mira", jti=jti, checksum=checksum, url=token)

    try:
        parsed = urlparse(token)
        if parsed.scheme in {"http", "https"}:
            return ParsedToken(token_class="third_party_url", url=token)
    except Exception:
        pass

    return ParsedToken(token_class="unknown")
