from __future__ import annotations

from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str

    # NOTE: keep as string so dotenv values like "http://a,http://b" work.
    cors_origins: str = ""
    frontend_url: str = "http://localhost:5173"
    # Preferred for Stripe redirect URLs (can differ from FRONTEND_URL).
    frontend_base_url: Optional[str] = None
    port: int = 8000

    jwt_secret: Optional[str] = None
    jwt_expires_in_seconds: int = 60 * 60 * 24 * 7

    token_hmac_secret: Optional[str] = None
    public_web_base_url: str = "http://localhost:5173"

    # Used to hash IP addresses for scan event storage (privacy).
    # Recommended: set in .env for stable hashing across restarts.
    scan_ip_hash_salt: str = ""

    ab_copy_variant: str = "A"

    # Compatibility Mode safety summary (third-party URLs)
    safety_summary_enabled: bool = True
    safety_request_timeout_s: float = 0.5
    safety_rdap_timeout_s: float = 0.5
    safety_tls_timeout_s: float = 0.5
    # A/B seam for caching TTL (e.g. 30s vs 5m). Default to 5m.
    safety_cache_ttl_s: float = 300.0
    # Optional: enables Safe Browsing v5 hash-prefix lookup.
    # If not set, safe_browsing will be "unknown".
    safe_browsing_api_key: Optional[str] = None

    # Google OAuth
    google_client_id: Optional[str] = None

    # Simple secret for internal ops/admin endpoints (e.g. waitlist export).
    # Set OPS_SECRET in .env — if unset, these endpoints return 403.
    ops_secret: Optional[str] = None

    log_level: str = "INFO"

    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    # Legacy single price id (kept for backwards compatibility)
    stripe_price_id: Optional[str] = None
    # Credit top-up prices (one-time Checkout, mode=payment)
    stripe_price_id_1000: Optional[str] = None
    stripe_price_id_5000: Optional[str] = None
    stripe_price_id_12000: Optional[str] = None
    # Legacy success/cancel URLs (kept; new flows use FRONTEND_BASE_URL)
    stripe_success_url: Optional[str] = None
    stripe_cancel_url: Optional[str] = None

    free_tier_issue_cap: int = 100

    # Anthropic — used for the automated support chat widget
    anthropic_api_key: Optional[str] = None

    # Rate limits for /support/chat. Authed callers are bucketed per user,
    # anonymous callers per remote IP. Sliding window of `chat_rate_window_s`
    # seconds; counts a request the moment it lands (before model spend).
    chat_rate_limit_authed: int = 20
    chat_rate_limit_anon: int = 10
    chat_rate_window_s: int = 60

    # SendGrid for transactional email (admin-reply / admin-close ticket
    # notifications). If sendgrid_api_key is blank, notifications_service
    # degrades to log-only mode — the admin's HTTP request still succeeds.
    sendgrid_api_key: Optional[str] = None
    # Must be a sender identity verified in the SendGrid console (single-sender
    # or domain-authenticated). Mail from an unverified address gets 403'd.
    sendgrid_from_email: str = "support@miratrust.ai"
    sendgrid_from_name: str = "MiraTrust Support"
    # Address customers replying to the notification email actually reach.
    # Should be a real monitored inbox.
    support_reply_to: str = "support@miratrust.ai"

    @property
    def stripe_frontend_base_url(self) -> str:
        return (self.frontend_base_url or self.frontend_url).rstrip("/")

    @property
    def cors_origins_list(self) -> List[str]:
        raw = [s.strip() for s in (self.cors_origins or "").split(",")]
        return [s for s in raw if s]

    @property
    def normalized_public_web_base_url(self) -> str:
        return self.public_web_base_url.rstrip("/")


settings = Settings()
