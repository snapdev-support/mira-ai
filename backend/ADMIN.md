# MiraTrust Admin Console — Backend Notes

Living notes for operating the admin surface. Pair with the design doc at
[`DESIGN-admin-and-chatbot.md`](./DESIGN-admin-and-chatbot.md).

## Roles

Every user row has a `role` field:

- `user` (default) — regular customer
- `admin` — internal staff. Can view everything and perform most writes.
- `super_admin` — internal staff. All admin powers plus destructive ones:
  - Delete KB articles
  - Soft-delete users
  - Grant/revoke admin roles
  - View the audit log

JWTs carry `role`, but **the authoritative source is the DB row.** The
`require_admin` / `require_super_admin` dependencies re-read the user on
every request, so a role change takes effect at the user's next API call
even if their token was issued before the change.

## Bootstrapping the first super_admin

There's no UI to create the first super_admin (chicken-and-egg). Use the
helper script after signing up the future admin through the normal customer
flow:

```powershell
cd backend
# Sign the user up first via /auth/signup or the regular UI, then:
.\.venv\Scripts\python.exe scripts/grant_super_admin.py admin@miratrust.ai
```

The script also clears `is_disabled` and `deleted_at` in case the account
was banned before promotion.

After the first super_admin exists, all subsequent role changes should be
made through the admin console (POST `/api/v1/admin/users/{id}/role`).

## Endpoints (shipped)

All implemented in `app/routers/admin.py` under `/api/v1/admin/*`.

### Profile

| Method | Path | Required role |
|---|---|---|
| GET | `/me` | admin |

### Knowledge base

| Method | Path | Required role |
|---|---|---|
| GET | `/kb` | admin |
| GET | `/kb/{slug}` | admin |
| POST | `/kb` | admin |
| PUT | `/kb/{slug}` | admin |
| DELETE | `/kb/{slug}` | **super_admin** |

### Support tickets

| Method | Path | Required role |
|---|---|---|
| GET | `/tickets` | admin |
| GET | `/tickets/{ticket_id}` | admin |
| POST | `/tickets/{ticket_id}/reply` | admin |
| POST | `/tickets/{ticket_id}/close` | admin (idempotent) |

### Users

| Method | Path | Required role |
|---|---|---|
| GET | `/users` | admin |
| GET | `/users/{user_id}` | admin |
| GET | `/users/{user_id}/claims` | admin |
| GET | `/users/{user_id}/scans` | admin |
| POST | `/users/{user_id}/credits/adjust` | admin |
| POST | `/users/{user_id}/disable` | admin |
| POST | `/users/{user_id}/enable` | admin |
| DELETE | `/users/{user_id}` | **super_admin** (soft-delete) |
| POST | `/users/{user_id}/role` | **super_admin** |

### Claims

| Method | Path | Required role |
|---|---|---|
| POST | `/claims/{jti}/revoke` | admin |

### Metrics

| Method | Path | Required role |
|---|---|---|
| GET | `/metrics/overview` | admin |
| GET | `/metrics/scans` | admin |

### Audit log

| Method | Path | Required role |
|---|---|---|
| GET | `/audit-log` | **super_admin** |

## Behavior invariants worth remembering

- **Self-action guards**: admins cannot disable, soft-delete, or self-demote their own super_admin role. Returns 400 with a specific message.
- **Idempotency**: disable, enable, role change, soft-delete, claim revoke, and ticket close are all idempotent. Repeated calls return 200 but do **not** write a second audit-log row.
- **Credit floor**: `credits/adjust` clamps to 0 — a `delta` more negative than the current balance reduces balance to 0, not below.
- **Soft delete sets `is_disabled` too**: belt-and-suspenders — even if a check missed `deleted_at`, the disable check would catch it.
- **Role authority lives in the DB**, not the JWT. Even if a token was issued with `role: super_admin`, demoting the user in the DB takes effect on their next API call.
- **EmailStr on input, str on output**: customer signup uses strict `EmailStr`; admin output models use `str` so admins can see records with RFC-reserved TLDs (`.test`, `.localhost`) or legacy data that wouldn't pass strict validation.

## Audit log

All admin writes go through `app/services/audit_service.py::log_admin_action`,
which writes to `admin_audit_log` *after* the DB mutation succeeds.

- Append-only — never UPDATE or DELETE rows.
- `before` / `after` snapshots are auto-scrubbed of sensitive keys
  (`password_hash`, `google_sub`, `stripe_customer_id`).
- An audit-write failure logs loudly but doesn't fail the original request.

Add a new action by extending `AuditAction` in `audit_service.py`. Don't
hardcode action strings at call sites.

## New collections

- `admin_audit_log` — per-action history. Append-only.
- `chat_threads` — Phase 3 chatbot persistence (not yet wired up).

Indexes for both are created on app startup by `ensure_indexes()`.
