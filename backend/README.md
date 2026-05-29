# Backend (FastAPI + MongoDB)

Stage-1 backend for MiraTrust.AI.

## Quickstart

1) Create a virtualenv and install deps:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Create `backend/.env` (already present in your workspace). At minimum you should add:

```dotenv
MONGODB_URI=...
JWT_SECRET=change-me
TOKEN_HMAC_SECRET=change-me
PUBLIC_WEB_BASE_URL=http://localhost:5173

# Preferred for Stripe redirect URLs
FRONTEND_BASE_URL=http://localhost:5173

# Stripe (test mode)

# This backend uses Stripe Checkout (mode=payment) for one-time claim-credit top-ups.
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_1000=price_...
STRIPE_PRICE_ID_5000=price_...
STRIPE_PRICE_ID_12000=price_...

# Legacy (optional)
STRIPE_PRICE_ID=price_...

# Compatibility Mode safety summary (optional)
# If SAFE_BROWSING_API_KEY is not set, Safe Browsing signal returns "unknown".
SAFETY_SUMMARY_ENABLED=true
SAFETY_REQUEST_TIMEOUT_S=0.5
SAFETY_RDAP_TIMEOUT_S=0.5
SAFETY_TLS_TIMEOUT_S=0.5
SAFETY_CACHE_TTL_S=300
SAFE_BROWSING_API_KEY=
```

3) Run the server:

```powershell
uvicorn app.main:app --reload --port 8000
```

## API

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/profile/me`
- `POST /api/v1/claims/issue` (JWT required)
- `GET /api/v1/account/usage` (JWT required)
- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/checkout-session` (JWT required)
- `POST /api/v1/verify`
- `POST /api/v1/stripe/webhook` (Stripe; credit top-ups)
- `POST /api/v1/billing/webhook` (Stripe; legacy alias)
- `GET /.well-known/mira/crl`
- `GET /.well-known/jwks.json`
- `GET /api/v1/ops/tiles` (stub)
