from __future__ import annotations

import base64
import ipaddress
import re
import socket
import ssl
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Literal, Optional, Tuple
from urllib.parse import ParseResult, urlparse, urlunparse

import httpx
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import ObjectIdentifier


SafetyCT = Literal["present", "unknown"]
SafetySafeBrowsing = Literal["clean", "flagged", "unknown"]


_OID_EMBEDDED_SCT = ObjectIdentifier("1.3.6.1.4.1.11129.2.4.2")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_rfc3339(value: str) -> Optional[datetime]:
    s = (value or "").strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        return None
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except Exception:
        return False


def _coarse_domain_category(host: str) -> str:
    host = (host or "").lower().strip(".")
    if not host:
        return "unknown"
    if _is_ip(host):
        return "ip"
    if host.endswith(".gov") or host.endswith(".gov."):
        return "gov"
    if host.endswith(".edu") or host.endswith(".edu."):
        return "edu"
    if host.endswith(".mil") or host.endswith(".mil."):
        return "mil"
    return "unknown"


def _normalize_url(raw: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (normalized_url, error_code).

    Keep this conservative: only allow http/https.
    """

    if raw is None:
        return None, "ERR_URL_EMPTY"

    s = raw.strip()
    if not s:
        return None, "ERR_URL_EMPTY"

    # Remove tab/CR/LF characters (Safe Browsing canonicalization guidance).
    s = s.replace("\t", "").replace("\r", "").replace("\n", "")

    parsed = urlparse(s)
    if not parsed.scheme:
        # Default camera scans often omit scheme.
        parsed = urlparse("http://" + s)

    if parsed.scheme.lower() not in {"http", "https"}:
        return None, "ERR_URL_UNSUPPORTED_SCHEME"

    if not parsed.netloc:
        return None, "ERR_URL_MISSING_HOST"

    # Drop fragments.
    parsed = ParseResult(
        scheme=parsed.scheme.lower(),
        netloc=parsed.netloc,
        path=parsed.path or "/",
        params=parsed.params,
        query=parsed.query,
        fragment="",
    )

    return urlunparse(parsed), None


def _tls_cert_summary(host: str, timeout_s: float) -> Dict[str, Any]:
    """Best-effort TLS check without fetching URL contents."""
    out: Dict[str, Any] = {
        "cert_valid": None,
        "cert_not_after": None,
        "ct": "unknown",
    }
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=timeout_s) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                der = ssock.getpeercert(binary_form=True)
        if not der:
            return out
        cert = x509.load_der_x509_certificate(der, default_backend())
        not_after = getattr(cert, "not_valid_after_utc", None) or cert.not_valid_after
        if not_after.tzinfo is None or not_after.tzinfo.utcoffset(not_after) is None:
            not_after = not_after.replace(tzinfo=timezone.utc)
        else:
            not_after = not_after.astimezone(timezone.utc)

        out["cert_not_after"] = not_after.isoformat()
        out["cert_valid"] = _now_utc() < not_after

        # Certificate Transparency is tricky: SCTs may be delivered via TLS extension.
        # We only check for embedded SCTs in the certificate to avoid false "absent".
        try:
            cert.extensions.get_extension_for_oid(_OID_EMBEDDED_SCT)
            out["ct"] = "present"
        except Exception:
            out["ct"] = "unknown"

    except Exception:
        # Any failure here should not block verify.
        return out

    return out


def _hsts_present(headers: httpx.Headers) -> Optional[bool]:
    v = headers.get("strict-transport-security")
    if v is None:
        return False
    return True


def _canonicalize_for_safebrowsing(url: str) -> str:
    """Conservative Safe Browsing v4 canonicalization, sufficient for v5 hashes.

    This is intentionally best-effort, not a full RFC 2396 validator.
    """

    u = (url or "").strip()
    u = u.replace("\t", "").replace("\r", "").replace("\n", "")

    # Drop fragment
    u = u.split("#", 1)[0]

    # Unescape repeatedly
    # NOTE: We avoid an aggressive percent-unescape loop that could be abused.
    # Safe Browsing guidance calls for repeated unescape until stable; we cap iterations.
    for _ in range(5):
        new_u = re.sub(
            r"%([0-9a-fA-F]{2})",
            lambda m: bytes([int(m.group(1), 16)]).decode("latin-1"),
            u,
        )
        if new_u == u:
            break
        u = new_u

    p = urlparse(u)
    scheme = (p.scheme or "http").lower()
    host = (p.hostname or "").strip(".").lower()
    host = re.sub(r"\.+", ".", host)

    path = p.path or "/"
    # Resolve /./ and /../ and collapse slashes
    parts: List[str] = []
    for seg in path.split("/"):
        if seg in {"", "."}:
            continue
        if seg == "..":
            if parts:
                parts.pop()
            continue
        parts.append(seg)
    norm_path = "/" + "/".join(parts)
    if path.endswith("/") and not norm_path.endswith("/"):
        norm_path += "/"
    norm_path = re.sub(r"/+$", "/", norm_path)

    query = p.query
    if query is None:
        query = ""

    # Percent-escape unsafe characters (<=32, >=127, '#', '%')
    def _escape(s: str) -> str:
        out_chars: List[str] = []
        for ch in s:
            o = ord(ch)
            if o <= 32 or o >= 127 or ch in {"#", "%"}:
                out_chars.append("%" + format(o, "02X"))
            else:
                out_chars.append(ch)
        return "".join(out_chars)

    host_esc = _escape(host)
    path_esc = _escape(norm_path)
    query_esc = _escape(query)

    # Port is discarded for hashing per Safe Browsing guidance.
    canon = f"{scheme}://{host_esc}{path_esc}"
    if query_esc != "" or p.query == "":
        # Preserve empty '?' if original had it.
        if "?" in u:
            canon += "?" + query_esc
    return canon


def _suffix_prefix_expressions(canon_url: str) -> List[str]:
    p = urlparse(canon_url)
    host = p.hostname or ""
    path = p.path or "/"
    query = p.query or ""

    host_variants: List[str] = []
    if _is_ip(host):
        host_variants = [host]
    else:
        parts = host.split(".")
        # exact host
        host_variants.append(host)
        # up to 4 more by removing leading components, considering last 5 components
        if len(parts) > 1:
            start = max(0, len(parts) - 5)
            tail = parts[start:]
            for i in range(1, min(5, len(tail))):
                host_variants.append(".".join(tail[i:]))
        # Deduplicate while keeping order
        seen = set()
        host_variants = [h for h in host_variants if not (h in seen or seen.add(h))]

    path_variants: List[str] = []
    full_path_q = path + ("?" + query if query or ("?" in canon_url) else "")
    path_variants.append(full_path_q)
    path_variants.append(path)

    # Up to 4 prefixes from root
    if path != "/":
        comps = [c for c in path.split("/") if c]
        accum = "/"
        path_variants.append(accum)
        for c in comps[:3]:
            accum = accum.rstrip("/") + "/" + c + "/"
            path_variants.append(accum)
    else:
        path_variants.append("/")

    # Deduplicate while keeping order
    seenp = set()
    path_variants = [pp for pp in path_variants if not (pp in seenp or seenp.add(pp))]

    out: List[str] = []
    for h in host_variants:
        for pp in path_variants:
            out.append(f"{h}{pp}")
            if len(out) >= 30:
                return out
    return out


def _sha256(data: bytes) -> bytes:
    import hashlib

    return hashlib.sha256(data).digest()


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


@dataclass
class _CacheEntry:
    value: Any
    expires_at_s: float


class _TTLCache:
    def __init__(self) -> None:
        self._store: Dict[str, _CacheEntry] = {}

    def get(self, key: str) -> Optional[Any]:
        e = self._store.get(key)
        if not e:
            return None
        if time.time() >= e.expires_at_s:
            self._store.pop(key, None)
            return None
        return e.value

    def set(self, key: str, value: Any, ttl_s: float) -> None:
        self._store[key] = _CacheEntry(value=value, expires_at_s=time.time() + max(0.0, ttl_s))


_SAFETY_CACHE = _TTLCache()


def _parse_duration_seconds(duration: str) -> Optional[float]:
    # v5 returns strings like "3.5s".
    s = (duration or "").strip().lower()
    if not s.endswith("s"):
        return None
    try:
        return float(s[:-1])
    except Exception:
        return None


class SafetyService:
    """Computes a lightweight, explainable safety summary for third-party URLs.

    IMPORTANT: This is not a guarantee that a URL is "safe". It only surfaces
    hygiene signals quickly and should always degrade gracefully.
    """

    def __init__(
        self,
        *,
        request_timeout_s: float = 0.5,
        rdap_timeout_s: float = 0.5,
        tls_timeout_s: float = 0.5,
        cache_ttl_s: float = 300.0,
        safebrowsing_api_key: Optional[str] = None,
    ) -> None:
        self.request_timeout_s = request_timeout_s
        self.rdap_timeout_s = rdap_timeout_s
        self.tls_timeout_s = tls_timeout_s
        self.cache_ttl_s = cache_ttl_s
        self.safebrowsing_api_key = safebrowsing_api_key

    async def summarize(self, raw_url: str) -> Dict[str, Any]:
        normalized_url, err = _normalize_url(raw_url)
        if err or not normalized_url:
            return {
                "url": raw_url,
                "normalized_url": None,
                "https": False,
                "hsts": None,
                "ct": "unknown",
                "domain_age_days": None,
                "domain_category": "unknown",
                "safe_browsing": "unknown",
                "error": err,
            }

        cache_key = f"safety:v1:{normalized_url}"
        cached = _SAFETY_CACHE.get(cache_key)
        if cached is not None:
            return cached

        p = urlparse(normalized_url)
        host = p.hostname or ""
        scheme = p.scheme.lower()

        result: Dict[str, Any] = {
            "url": raw_url,
            "normalized_url": normalized_url,
            "https": scheme == "https",
            "hsts": None,
            "ct": "unknown",
            "cert_valid": None,
            "cert_not_after": None,
            "domain_age_days": None,
            "domain_category": _coarse_domain_category(host),
            "safe_browsing": "unknown",
        }

        # TLS certificate summary (best-effort)
        if host and not _is_ip(host):
            tls = _tls_cert_summary(host, timeout_s=self.tls_timeout_s)
            result.update(tls)
        elif host:
            # IPs can still have TLS, but cert hostname validation often fails.
            tls = _tls_cert_summary(host, timeout_s=self.tls_timeout_s)
            result.update(tls)

        async with httpx.AsyncClient(follow_redirects=False) as client:
            # HSTS signal: must be HTTPS to be meaningful, but we can probe https://host/
            hsts_url = normalized_url if scheme == "https" else f"https://{host}/"
            try:
                async with client.stream(
                    "HEAD",
                    hsts_url,
                    timeout=self.request_timeout_s,
                    headers={"User-Agent": "MiraTrustSafety/1.0"},
                ) as r:
                    result["hsts"] = _hsts_present(r.headers)
            except httpx.HTTPStatusError:
                result["hsts"] = None
            except httpx.HTTPError:
                # HEAD sometimes blocked; try GET headers only.
                try:
                    async with client.stream(
                        "GET",
                        hsts_url,
                        timeout=self.request_timeout_s,
                        headers={"User-Agent": "MiraTrustSafety/1.0", "Range": "bytes=0-0"},
                    ) as r:
                        result["hsts"] = _hsts_present(r.headers)
                except Exception:
                    result["hsts"] = None

            # RDAP domain age (best-effort)
            if host and not _is_ip(host):
                try:
                    rdap_url = f"https://rdap.org/domain/{host}"
                    rdap = await client.get(rdap_url, timeout=self.rdap_timeout_s, follow_redirects=True)
                    if rdap.status_code == 200:
                        data = rdap.json()
                        events = data.get("events") or []
                        reg_dates: List[datetime] = []
                        for ev in events:
                            if not isinstance(ev, dict):
                                continue
                            if (ev.get("eventAction") or "").lower() in {"registration", "registered"}:
                                dt = _parse_rfc3339(str(ev.get("eventDate") or ""))
                                if dt:
                                    reg_dates.append(dt)
                        if reg_dates:
                            first = min(reg_dates)
                            result["domain_age_days"] = int((_now_utc() - first).total_seconds() // 86400)
                except Exception:
                    result["domain_age_days"] = None

            # Safe Browsing v5 hash-prefix lookup (optional)
            if self.safebrowsing_api_key:
                try:
                    sb = await self._safe_browsing_v5(client, normalized_url)
                    result.update(sb)
                except Exception:
                    result["safe_browsing"] = "unknown"

        _SAFETY_CACHE.set(cache_key, result, ttl_s=self.cache_ttl_s)
        return result

    async def _safe_browsing_v5(self, client: httpx.AsyncClient, url: str) -> Dict[str, Any]:
        canon = _canonicalize_for_safebrowsing(url)
        exprs = _suffix_prefix_expressions(canon)

        full_hashes = [_sha256(e.encode("utf-8")) for e in exprs]
        prefix4 = [h[:4] for h in full_hashes]

        # v5 expects base64-encoded bytes, repeated query param.
        params = [("hashPrefixes", _b64(p)) for p in prefix4[:30]]
        params.append(("key", self.safebrowsing_api_key or ""))
        r = await client.get(
            "https://safebrowsing.googleapis.com/v5/hashes:search",
            params=params,
            timeout=self.request_timeout_s,
            headers={"User-Agent": "MiraTrustSafety/1.0"},
        )
        if r.status_code != 200:
            return {"safe_browsing": "unknown"}

        data = r.json()
        found_full = data.get("fullHashes") or []

        returned_hashes: set[bytes] = set()
        for item in found_full:
            if not isinstance(item, dict):
                continue
            fh_b64 = item.get("fullHash")
            if not fh_b64:
                continue
            try:
                returned_hashes.add(base64.b64decode(fh_b64))
            except Exception:
                continue

        flagged = any(h in returned_hashes for h in full_hashes)

        cache_dur = _parse_duration_seconds(str(data.get("cacheDuration") or ""))
        if cache_dur is not None:
            # Cache safe browsing result separately using server-provided TTL.
            _SAFETY_CACHE.set(f"sb:v1:{url}", "flagged" if flagged else "clean", ttl_s=min(86400.0, max(0.0, cache_dur)))

        return {"safe_browsing": "flagged" if flagged else "clean"}
