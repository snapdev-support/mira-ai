# Backend Status / Integration Guide (Stage‑1, Week‑0)

Last updated: 2025‑12‑13

This document is the source of truth for how the FastAPI backend is currently implemented, what endpoints exist, and how the frontend should integrate.

---

## 1) Stack & Structure

- Framework: FastAPI
- DB: MongoDB via Motor (async)
- Auth: Email + password, JWT (HS256)
- Billing: Stripe integration is present but intentionally minimal; full enforcement/hardening is planned as the final step.

Code layout (important files):

- `backend/app/main.py` – FastAPI app factory, middleware, router registration
- `backend/app/core/config.py` – env settings (pydantic-settings)
- `backend/app/core/db.py` – Mongo connect/close, index creation
- `backend/app/core/security.py` – password hashing + JWT encode/decode
- `backend/app/core/logging.py` – logging configuration helper
- `backend/app/utils/token.py` – Mira token parsing + checksum
- `backend/app/routers/*.py` – HTTP routes
- `backend/app/services/*.py` – core business logic

There is also a convenience import entrypoint:

- `backend/main.py` – exports `app` for uvicorn if needed

---

## 2) Running Locally

From `backend/`:

```powershell
uvicorn app.main:app --reload --port 8000
```

Health check:

- `GET /health` → `{ "ok": true }`

---

## 3) Environment Variables

The backend reads `backend/.env`.

Required for production‑grade stability (set these):

- `MONGODB_URI` – Mongo connection string
- `JWT_SECRET` – ensures JWTs remain valid across restarts
- `TOKEN_HMAC_SECRET` – ensures Mira token checksums remain valid across restarts
- `PUBLIC_WEB_BASE_URL` – used to generate QR URL payloads (e.g. `http://localhost:5173`)

Useful:

- `CORS_ORIGINS` – comma-separated, e.g. `http://localhost:5173`
- `FRONTEND_URL` – used for Stripe redirect defaults
- `PORT` – server port (uvicorn `--port` still controls runtime)
- `LOG_LEVEL` – `INFO` (default), `DEBUG`, etc.

Stripe (Stage‑1 paywall):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

A template exists at `backend/.env.example`.

---

## 4) Logging & Observability (Week‑0)

### 4.1 Startup / DB log

- On startup, Mongo connects and performs a `ping`.
- On success, it logs: `DB connection successful`.

### 4.2 Request IDs

Middleware adds:

- Response header: `X-Request-ID`
- Response header: `X-Response-Time-Ms`

If the request includes `X-Request-ID`, we propagate it; otherwise we generate one.

### 4.3 Verify request JSON log

Each `POST /api/v1/verify` emits a single JSON log line (no raw token/URL logging):

```json
{
  "request_id": "...",
  "token_class": "mira|partner_mira|third_party_url|unknown",
  "verdict": "VALID|EXPIRED|REVOKED|UNVERIFIED|UNKNOWN",
  "reason_code": "...",
  "latency_ms": 12,
  "jti": "..."
}
```

---

## 5) Auth (Production‑standard Swagger support)

### 5.1 Endpoints

- `POST /api/v1/auth/signup` (JSON)
- `POST /api/v1/auth/login` (JSON)
- `POST /api/v1/auth/token` (OAuth2 password flow / form-encoded)
- `GET /api/v1/profile/me` (JWT required)

### 5.2 Swagger authorization

Swagger’s “Authorize” modal uses OAuth2 password flow.

Use:

- `username` = your email
- `password` = your password

Swagger will call `POST /api/v1/auth/token` and automatically attach `Authorization: Bearer <token>`.

### 5.3 Response shapes

Signup (`/auth/signup`) response:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "plan": "free",
    "issued_count": 0
  }
}
```

Token (`/auth/token`) response:

```json
{ "access_token": "...", "token_type": "bearer" }
```

Error handling:

- Duplicate email returns `409` with `detail: "Email already in use"`.
- Other failures return `500` with `detail: "Signup failed due to a server error"`.

---

## 6) Claims Issuance (Week‑0)

### 6.1 Endpoint

- `POST /api/v1/claims/issue` (JWT required)

Request (matches implementation plan):

```json
{
  "template": "invoice|package|return_sla",
  "subject": { "type": "invoice|package|return_sla", "id": "string" },
  "facts": {},
  "exp": "2026-01-10T00:00:00Z",
  "policy": { "replay_window_s": 300 }
}
```

Response (200):

```json
{ "jti": "...", "qrPayload": "https://.../t/<jti>?h=<h>", "exp": "...", "status": "active" }
```

### 6.2 Free tier cap & paywall

- Free tier cap is `100` issues per account (configurable via `FREE_TIER_ISSUE_CAP`, defaults to 100).
- On cap exceeded, the endpoint returns:

HTTP 402:

```json
{ "detail": "Plan limit reached", "checkoutUrl": "..." }
```

Implementation note:

- Cap is enforced using an atomic `issued_count` increment conditioned on `issued_count < cap`.
- If Stripe env vars are not set yet, `checkoutUrl` falls back to a stable placeholder URL so the frontend can still implement the 402 redirect behavior.

### 6.3 Revocation (Week‑0)

- `POST /api/v1/claims/revoke` (JWT required)

Request:

```json
{ "jti": "...", "reason": "..." }
```

Response:

```json
{ "ok": true }
```

---

## 7) Token / QR Payload Format

Generated QR payload (URL form):

- `PUBLIC_WEB_BASE_URL/t/<jti>?h=<checksum>`

Checksum:

- `h = base32(hmac_sha256(jti, TOKEN_HMAC_SECRET))[0:10]` (lowercased)

Classifier supports:

1) `mira:<jti>.<h>`
2) `https://<host>/t/<jti>?h=<h>`
3) `https://partner.com/...?...&mira=<jti>.<h>`
4) Any other http/https URL → third-party
5) Otherwise → unknown

---

## 8) Verify (Week‑0)

### 8.1 Endpoint

- `POST /api/v1/verify`

Request:

```json
{ "token": "string" }
```

Response always includes a deterministic 2-line explanation:

- `verdict`: `VALID | EXPIRED | REVOKED | UNVERIFIED | UNKNOWN`
- `explanation`: `[line1, line2]`
- `reason_code`: stable string

Week‑0 logic for Mira tokens:

- Invalid checksum → `UNKNOWN` (`ERR_MIRA_CHECKSUM`)
- Claim missing → `UNKNOWN` (`ERR_CLAIM_NOT_FOUND`)
- Claim status revoked → `REVOKED` (`STATE_REVOKED`)
- `now > exp` → `EXPIRED` (`STATE_EXPIRED`)
- Otherwise → `VALID` (`OK_VALID`)

Third-party URL tokens:

- `UNVERIFIED` (`UNVERIFIED_THIRD_PARTY`)

Unknown tokens:

- `UNKNOWN` (`ERR_INVALID_TOKEN`)

Note: Compatibility safety signals (HSTS, RDAP, Safe Browsing, etc.) are planned for Week‑2; not implemented yet.

---

## 9) Well‑known endpoints

- `GET /.well-known/mira/crl` – returns revocations list

```json
{ "ts": "...", "revoked": [ {"jti":"...","reason":"...","ts":"..."} ] }
```

- `GET /.well-known/jwks.json` – stub seam for Stage‑2 crypto

```json
{ "keys": [] }
```

---

## 10) Console / Ops (Week‑0 scaffolding)

These are intentionally stubbed but have stable response shapes for the frontend to integrate.

- `GET /api/v1/ops/tiles`

```json
{ "scans_today": 0, "verify_p50_ms": null, "verify_p95_ms": null, "last_revocation_age_s": null }
```

- `GET /api/v1/ops/events?limit=50`

```json
{ "items": [] }
```

- `GET /api/v1/ops/claims?limit=50`

```json
{ "items": [], "next_cursor": null }
```

- `GET /api/v1/ops/claims.csv`

Returns `text/csv` with header row.

---

## 11) MongoDB Collections & Indexes

Created/used collections:

- `users`
  - unique index: `email`
  - sparse index: `stripe_customer_id`
- `claims`
  - unique index: `jti`
  - compound: `(account_id, iat desc)`
  - compound: `(account_id, status)`
- `revocations`
  - unique index: `jti`
  - index: `(ts desc)`
- `scan_events` (reserved for later; indexes created)

Indexes are created on startup via `ensure_indexes()`.

---

## 12) Known gaps / next backend steps

- Add verify metrics histogram + counters (`/metrics`) and ops endpoints backed by DB.
- Implement replay window + scan event storage.
- Implement Compatibility Mode safety summary with strict timeouts + caching.
- Harden Stripe webhook handling (signature verification already present; add more event handling + tests).

---

## 13) Notes for frontend integration

- Prefer using Swagger authorize (OAuth2 password flow) for manual testing.
- In the actual frontend, call `/api/v1/auth/login` (JSON) or `/api/v1/auth/token` (form) depending on your client.
- For authenticated routes, send header:

`Authorization: Bearer <access_token>`

- On claim issuance, if HTTP 402 is returned, redirect the browser to `checkoutUrl`.
