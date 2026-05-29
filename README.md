# Mira.AI — Proof at Scan

> Turn any QR into a human-readable verdict in under 2 seconds.

Mira.AI (MiraTrust.AI) is a QR-compatible, cryptographically verifiable trustmark. An issuer mints a Mira "claim" (a token with an HMAC checksum); anyone can scan or paste it and get a deterministic verdict — `VALID`, `EXPIRED`, `REVOKED`, `UNVERIFIED`, or `UNKNOWN` — with a short human-readable explanation. Target use cases span B2B invoice processing, B2C product verification, and B2B2C returns/SLA.

This is a single git repository ([`snapdev-support/mira-ai`](https://github.com/snapdev-support/mira-ai)) containing two applications that run as separate services:

| Directory | What it is | Stack |
|-----------|-----------|-------|
| [`backend/`](backend/) | MiraTrust.AI API service | FastAPI · MongoDB (Motor, async) · JWT auth · Stripe |
| [`frontend/`](frontend/) | Web app / verify PWA | Vite · React · TypeScript · shadcn/ui · Tailwind · TanStack Query |

> **Note on git:** there is one repo, rooted at the `Mira AI/` workspace folder (remote `origin` → `snapdev-support/mira-ai`); `backend/` and `frontend/` are subfolders within it, not independent repos. Run `git` from the workspace root.

---

## Architecture at a glance

```
                ┌─────────────────────────┐
   scan / paste │   frontend (Vite SPA)   │
  ─────────────▶│   :5173  · verify PWA   │
                └────────────┬────────────┘
                             │ REST (axios, bearer JWT)
                             │ VITE_API_BASE_URL → /api/v1
                             ▼
                ┌─────────────────────────┐
                │  backend (FastAPI)      │
                │  :8000  · /api/v1/*     │
                └────────────┬────────────┘
                             │ Motor (async)
                             ▼
                ┌─────────────────────────┐
                │        MongoDB          │
                └─────────────────────────┘
```

- A claim has a `jti` and checksum `h = base32(hmac_sha256(jti, TOKEN_HMAC_SECRET))[:10]`. Tokens are encoded as `mira:<jti>.<h>` or as a verify URL.
- The frontend's verify flow is a **PWA** (`start_url: /app/verify`); the service worker is registered at runtime.
- Auth is email + password → JWT (HS256), stored client-side and attached to every API request.

---

## Quickstart (local dev)

You need **two terminals** — one per service. Defaults: backend on `:8000`, frontend on `:5173`.

### 1. Backend — `:8000`

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health` → `{"ok": true}`
API docs (Swagger): `http://localhost:8000/docs`

Requires `backend/.env`. Minimum keys for non-broken dev: `MONGODB_URI`, `JWT_SECRET`, `TOKEN_HMAC_SECRET`, `PUBLIC_WEB_BASE_URL`. Stripe keys are optional in dev. See [`backend/README.md`](backend/README.md) for the full template.

### 2. Frontend — `:5173`

```powershell
cd frontend
pnpm install   # or: npm install (both lockfiles are committed)
pnpm dev
```

App: `http://localhost:5173`

Configured via `frontend/.env`: `VITE_API_BASE_URL` (defaults to `http://localhost:8000/api/v1`) and `VITE_GOOGLE_CLIENT_ID` for Google OAuth.

---

## Common commands

### Backend
| Command | Purpose |
|---------|---------|
| `uvicorn app.main:app --reload --port 8000` | Run the API server |
| `python scripts/seed_dev.py` | Seed a dev user + claims (reads `SEED_*` from `.env`) |
| `python scripts/safety_smoke.py` | Smoke-test the safety summary service |

*(No test suite or linter is configured for the backend.)*

### Frontend
| Command | Purpose |
|---------|---------|
| `pnpm dev` | Vite dev server on `:5173` |
| `pnpm build` | `tsc && vite build` |
| `pnpm lint` | ESLint (`--max-warnings 0`) |
| `pnpm typecheck` | Type-check app + node configs |
| `pnpm preview` | Preview the production build |

---

## Where to read more

- [`backend/README.md`](backend/README.md) — backend quickstart, full `.env` template, endpoint list
- [`backend/BACKEND-STATUS.md`](backend/BACKEND-STATUS.md) — **source of truth** for backend behavior, env vars, and response shapes
- [`backend/ADMIN.md`](backend/ADMIN.md) — admin surface
- [`frontend/MIRA-AI-COMPLETE-PROJECT-DOCUMENTATION.md`](frontend/MIRA-AI-COMPLETE-PROJECT-DOCUMENTATION.md) — product + design documentation
- [`frontend/AI_RULES.md`](frontend/AI_RULES.md) — frontend conventions (routing, structure)
- [`CLAUDE.md`](CLAUDE.md) — guidance for working in this workspace
