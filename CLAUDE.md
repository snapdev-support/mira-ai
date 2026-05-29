# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a single git repo, rooted at the `Mira AI/` workspace folder (remote `origin` → `snapdev-support/mira-ai`). `backend/` and `frontend/` are subfolders within it — two apps that run as separate services, not independent repos. Run `git` from the workspace root.

- `backend/` — FastAPI + MongoDB (Motor) service for MiraTrust.AI
- `frontend/` — Vite + React + TypeScript + shadcn/ui + Tailwind SPA / PWA

Long-form context lives in `backend/BACKEND-STATUS.md` (treat as source of truth for backend behavior, env vars, response shapes) and the `frontend/MIRA-AI-*.md` / `Landing-Page-Section-Architecture.md` design docs.

## Backend (`backend/`)

### Run
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Health: `GET /health` → `{"ok": true}`. Swagger uses OAuth2 password flow at `POST /api/v1/auth/token` (username = email).

### Scripts
- `python scripts/seed_dev.py` — seeds a dev user (reads `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_CLAIMS`, `SEED_SCANS_PER_CLAIM`, `SEED_SET_ISSUED_COUNT`, `SEED_SET_CREDITS_REMAINING` from `.env`)
- `python scripts/safety_smoke.py` — quick check that the safety summary service runs end-to-end

There is no test suite or linter configured.

### Architecture
- `app/main.py::create_app` is the app factory. It wires the request-id + response-time middleware, CORS (driven by `CORS_ORIGINS` comma-list), and on startup calls `connect_mongo()` then `ensure_indexes()`. Mongo handle comes from `app.core.db.get_db()` — never construct your own client.
- Routers live under `app/routers/` and are all mounted under `/api/v1` (except `well_known` and `/health`). Adding a new domain means: model in `app/models/`, business logic in `app/services/`, HTTP shell in `app/routers/`, then `app.include_router(...)` in `main.py`.
- All Mongo access is async via Motor. `ensure_indexes()` in `app/core/db.py` is the canonical list of collections (`users`, `claims`, `revocations`, `scan_events`, `billing_transactions`, `waitlist`, `support_tickets`) and their indexes — update it whenever you introduce a new collection or query shape.
- Settings come from `pydantic-settings` in `app/core/config.py`, reading `backend/.env`. Two secrets must be persisted across restarts or tokens break: `JWT_SECRET` (sessions) and `TOKEN_HMAC_SECRET` (QR checksums). If unset, `app/utils/token.py` falls back to a per-process random secret — acceptable for dev, fatal for prod stability.

### Token / verify model
This is the core domain and easy to get wrong:
- A Mira "claim" has a `jti` and an HMAC checksum `h = base32(hmac_sha256(jti, TOKEN_HMAC_SECRET))[:10].lower()`.
- `app/utils/token.py::classify_token` parses an input string into one of: `mira:<jti>.<h>`, `https://host/t/<jti>?h=<h>`, partner URL with `?mira=<jti>.<h>` (token_class `partner_mira`), any other http/https URL (token_class `third_party_url`), or `unknown`.
- `app/services/verify_service.py` returns a deterministic `{verdict, explanation: [line1, line2], reason_code}`. Verdicts are exactly `VALID | EXPIRED | REVOKED | UNVERIFIED | UNKNOWN` — keep this enum stable; the frontend switches on it. The A/B copy variant is gated on `AB_COPY_VARIANT`.
- Free-tier issuance cap (`FREE_TIER_ISSUE_CAP`, default 100) is enforced by an atomic conditional `$inc` on `users.issued_count`. Over-cap returns `HTTP 402` with `{detail, checkoutUrl}` — the frontend redirects to `checkoutUrl`.

## Frontend (`frontend/`)

### Run
```powershell
cd frontend
pnpm install   # (or npm install — both lockfiles are committed)
pnpm dev       # vite on :5173
pnpm build     # tsc && vite build
pnpm lint      # eslint, --max-warnings 0
pnpm typecheck # tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json --noEmit
pnpm preview
```

### Architecture
- Routes are declared inline in `src/App.tsx` and **must stay there** (`AI_RULES.md`). Auth gating is composed via two route wrappers: `<RequireAuth>` (redirects anonymous → `/login`) and `<RedirectIfAuth>` (redirects authed away from `/login` and `/signup`). Authenticated app pages are nested under `<AppShell>` at `/app/*`; legacy `/dashboard`, `/studio`, `/console`, `/settings` are kept as `<Navigate replace>` redirects to `/app/*`.
- `src/auth/AuthContext.tsx` owns the JWT (in `localStorage` under key `token`) and exposes `login` / `signup` / `loginWithGoogle` / `logout` / `refresh`. `src/services/api.ts` is the single axios instance — its request interceptor attaches the bearer, and the response interceptor force-redirects to `/login` on a 401 from any non-`/auth/*` route. New API modules should import this `api` instance, not construct their own.
- API base URL comes from `VITE_API_BASE_URL` (defaults to `http://localhost:8000/api/v1`). Google OAuth uses `VITE_GOOGLE_CLIENT_ID`.
- Path alias `@/` → `src/` (`vite.config.ts` + `tsconfig`). UI is shadcn/ui in `src/components/ui/` — these are generated; do not edit them in place, wrap them in a new component instead.
- The verify flow is a PWA. `vite.config.ts` configures `vite-plugin-pwa` with `start_url: "/app/verify"` and an SPA `navigateFallback` to `/index.html`; service worker is enabled in dev too. `src/pwa.ts` registers the worker at runtime.
- TanStack Query v4 is the data layer (`QueryClientProvider` in `App.tsx`). React Hook Form + Zod for forms.

### Frontend conventions worth respecting
- Pages go in `src/pages/`, shared components in `src/components/`. Don't bypass the AppShell for authenticated pages — they need its nav and credit banners.
- Token-aware pages: `/t/:jti` (`TokenLanding`) and `/proof/:jti` (`Proof`) are public; `/verify` is public, `/app/verify` is the authed PWA entry.

## Env files

`backend/.env` and `frontend/.env` are present locally and ignored by git. Templates: `backend/.env.example` (and the env block in `backend/README.md`). Required for non-broken local dev: `MONGODB_URI`, `JWT_SECRET`, `TOKEN_HMAC_SECRET`, `PUBLIC_WEB_BASE_URL`. Stripe keys are optional in dev — without them `checkoutUrl` falls back to a placeholder so the 402 redirect path still works.
