# Design: Admin Console + Chatbot Completion

**Status:** Approved scope, not yet implemented
**Author:** Ali
**Last updated:** 2026-05-18

This doc covers two parallel workstreams: completing the support chatbot (Phases 2 + 3 on top of the already-shipped Phase 1) and building the internal admin console (Option A from the brainstorm, locked-in answers from Sumit).

The goal is a one-page-per-decision reference an implementer can build from. Open questions are listed at the bottom; everything else is a decision.

---

## 1. Scope

### In scope

**Chatbot**
- Phase 2 — function calling: bot can read the *signed-in* user's own credits, claims, scans, tickets, and verify-verdict explanations.
- Phase 3 — streaming responses + per-user persistent conversation threads.

**Admin (Option A, internal staff console)**
- Seven day-one capabilities (the Stripe refund was deferred):
  1. View & reply to support tickets
  2. Edit chatbot KB articles
  3. Look up any user's account (credits, claims, scans)
  4. Manually adjust a user's credit balance
  5. Revoke a customer's claim on their behalf
  6. Ban / disable a user
  7. View platform-wide metrics
- Two role tiers: `admin` and `super_admin`.
- Separate admin console at `/admin/*` (same domain, distinct login surface).
- Full audit log of all admin writes.

### Out of scope (explicitly deferred)

- Stripe refund flow — comes in a follow-up.
- Option B (customer-side team management / multi-user orgs) — separate future workstream.
- MFA on admin accounts — design accommodates it but doesn't ship it now.
- Email notifications when an admin replies to a ticket — first cut just updates the ticket; email goes in a follow-up.

---

## 2. Default decisions taken on the two open questions

Per Sumit's go-ahead to move forward with my recommendations:

| Question | Decision | Why |
|---|---|---|
| Same-domain `/admin/*` vs `admin.miratrust.ai` subdomain? | **Same-domain `/admin/*`** | Cuts DNS + cookie complexity, no real isolation downside given JWT-based auth |
| What can super-admin delete? | **Users (soft delete), KB articles (hard delete). NOT claims/scans/audit log.** | Claims and scans are audit-relevant for the verify product — never destroyable. Audit log is append-only by design. |

---

## 3. Data model changes

### 3.1 `users` collection (additions)

```yaml
role: "user" | "admin" | "super_admin"   # default "user"
is_disabled: bool                         # default false
disabled_at: datetime | null
disabled_by: ObjectId | null              # admin who disabled
disabled_reason: string | null
deleted_at: datetime | null               # soft-delete (super_admin only)
deleted_by: ObjectId | null
```

A user with `deleted_at != null` is hidden from all customer-facing queries and login is blocked. Existing customer code paths must be updated to filter on `{deleted_at: null}`.

Index additions:
```python
await db.users.create_index("role", sparse=True)
await db.users.create_index("is_disabled", sparse=True)
await db.users.create_index("deleted_at", sparse=True)
```

### 3.2 `admin_audit_log` collection (new)

Append-only. Logged for every admin write.

```yaml
_id: ObjectId
admin_user_id: ObjectId
admin_email: string         # denormalized — survives if admin is later deleted
action: string              # enum: "kb.create", "kb.update", "kb.delete",
                            #        "user.credits.adjust", "user.disable",
                            #        "user.enable", "user.delete",
                            #        "claim.revoke", "ticket.reply", "ticket.close",
                            #        "role.grant", "role.revoke", "admin.login"
target_type: string         # "user" | "kb_article" | "claim" | "ticket" | null
target_id: string | null
before: dict | null         # JSON snapshot for diff (sensitive fields scrubbed)
after: dict | null
reason: string | null       # admin-provided justification (required for sensitive actions)
ip: string | null
user_agent: string | null
ts: datetime
```

Indexes:
```python
await db.admin_audit_log.create_index([("ts", -1)])
await db.admin_audit_log.create_index([("admin_user_id", 1), ("ts", -1)])
await db.admin_audit_log.create_index([("target_type", 1), ("target_id", 1), ("ts", -1)])
await db.admin_audit_log.create_index("action")
```

### 3.3 `kb_articles` collection (additions)

```yaml
updated_by: ObjectId | null   # admin who last edited
created_by: ObjectId | null
```

### 3.4 `chat_threads` collection (new — Phase 3 persistence)

```yaml
_id: ObjectId
user_id: ObjectId            # null for anonymous (anon threads not persisted)
messages: [
  { role: "user" | "assistant", content: string, ts: datetime }
]
created_at: datetime
updated_at: datetime
```

Indexes:
```python
await db.chat_threads.create_index([("user_id", 1), ("updated_at", -1)])
```

Threads older than 90 days can be pruned by a background job (not in this iteration).

### 3.5 `revocations` collection (additions)

```yaml
revoked_by_admin: bool        # default false — true if admin revoked on customer's behalf
admin_id: ObjectId | null
admin_reason: string | null
```

No new index needed.

### 3.6 `support_tickets` collection (additions for admin reply flow)

```yaml
replies: [
  { admin_id: ObjectId, admin_email: string, content: string, ts: datetime }
]
closed_at: datetime | null
closed_by: ObjectId | null
```

---

## 4. API surface

All admin endpoints under `/api/v1/admin/*`. All require an `admin` or `super_admin` role; `super_admin` is enforced at the route level where flagged.

### 4.1 Admin auth & profile

| Method | Path | Role | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/token` | — | **Reused.** Returns same JWT for customers and admins. JWT payload carries `role`. Frontend routes by role after login. |
| `GET`  | `/api/v1/admin/me` | admin | Current admin's profile + role |

The auth endpoint isn't admin-specific. The customer login UI ignores admin/super_admin roles (redirects to `/admin/login` with a "use the admin console" message), and the admin login UI rejects plain `user` roles.

### 4.2 Tickets

| Method | Path | Role | Body / Query |
|---|---|---|---|
| `GET`  | `/api/v1/admin/tickets` | admin | Query: `status`, `from`, `to`, `q` (search), `limit`, `cursor` |
| `GET`  | `/api/v1/admin/tickets/{ticket_id}` | admin | — |
| `POST` | `/api/v1/admin/tickets/{ticket_id}/reply` | admin | `{ content: string }` — appends to `replies[]` |
| `POST` | `/api/v1/admin/tickets/{ticket_id}/close` | admin | — |

### 4.3 Knowledge base

| Method | Path | Role | Body |
|---|---|---|---|
| `GET`  | `/api/v1/admin/kb` | admin | Query: `category`, `q` |
| `GET`  | `/api/v1/admin/kb/{slug}` | admin | — |
| `POST` | `/api/v1/admin/kb` | admin | `{ slug, title, category, content, priority }` |
| `PUT`  | `/api/v1/admin/kb/{slug}` | admin | partial article |
| `DELETE` | `/api/v1/admin/kb/{slug}` | **super_admin** | — |

### 4.4 Users

| Method | Path | Role | Body |
|---|---|---|---|
| `GET`  | `/api/v1/admin/users` | admin | Query: `q` (email), `role`, `is_disabled`, `limit`, `cursor` |
| `GET`  | `/api/v1/admin/users/{user_id}` | admin | Returns user + summary (claim count, scan count, recent activity) |
| `GET`  | `/api/v1/admin/users/{user_id}/claims` | admin | Query: `status`, `limit`, `cursor` |
| `GET`  | `/api/v1/admin/users/{user_id}/scans` | admin | Query: `from`, `to`, `verdict`, `limit`, `cursor` |
| `POST` | `/api/v1/admin/users/{user_id}/credits/adjust` | admin | `{ delta: int, reason: string }` — `delta` may be negative; `reason` required |
| `POST` | `/api/v1/admin/users/{user_id}/disable` | admin | `{ reason: string }` |
| `POST` | `/api/v1/admin/users/{user_id}/enable` | admin | — |
| `DELETE` | `/api/v1/admin/users/{user_id}` | **super_admin** | `{ reason: string }` — soft-delete |
| `POST` | `/api/v1/admin/users/{user_id}/role` | **super_admin** | `{ role: "user" \| "admin" \| "super_admin" }` |

### 4.5 Claims

| Method | Path | Role | Body |
|---|---|---|---|
| `POST` | `/api/v1/admin/claims/{jti}/revoke` | admin | `{ reason: string }` — sets `revoked_by_admin: true` |

### 4.6 Metrics

| Method | Path | Role |
|---|---|---|
| `GET`  | `/api/v1/admin/metrics/overview` | admin |
| `GET`  | `/api/v1/admin/metrics/scans` | admin |

Overview returns:
```json
{
  "total_users": 1234,
  "active_users_24h": 87,
  "active_users_7d": 412,
  "total_claims_issued": 56210,
  "claims_issued_24h": 412,
  "total_scans": 198765,
  "scans_24h": 1432,
  "revenue_last_30d_cents": 248700,
  "open_tickets": 7
}
```

`/metrics/scans` accepts `from`, `to`, `granularity` (`day` | `hour`) and returns a time-series.

### 4.7 Audit log

| Method | Path | Role |
|---|---|---|
| `GET`  | `/api/v1/admin/audit-log` | **super_admin** |

Query: `action`, `admin_user_id`, `target_type`, `target_id`, `from`, `to`, `limit`, `cursor`.

---

## 5. Auth & RBAC

### 5.1 JWT payload (additive)

```json
{
  "sub": "user@example.com",
  "user_id": "...",
  "role": "user" | "admin" | "super_admin",
  "exp": ...
}
```

The customer JWT continues to work as-is — only `role` is added. Existing tokens treated as `role: "user"` (decode default).

### 5.2 FastAPI dependencies

New in `app/core/security.py`:

```python
async def require_admin(token: ... = Depends(oauth2)) -> UserContext:
    data = decode_access_token(token)
    if data.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required")
    return UserContext(**data)

async def require_super_admin(token: ... = Depends(oauth2)) -> UserContext:
    data = decode_access_token(token)
    if data.get("role") != "super_admin":
        raise HTTPException(403, "Super-admin access required")
    return UserContext(**data)
```

Existing `get_current_user` continues to work for customer routes.

### 5.3 Two-tier capability matrix

| Capability | `admin` | `super_admin` |
|---|:---:|:---:|
| Read everything (users, claims, scans, tickets, KB, metrics) | ✅ | ✅ |
| Reply to / close tickets | ✅ | ✅ |
| Adjust user credits | ✅ | ✅ |
| Disable / enable users | ✅ | ✅ |
| Revoke claims | ✅ | ✅ |
| Create / update KB articles | ✅ | ✅ |
| Delete KB articles | ❌ | ✅ |
| Soft-delete users | ❌ | ✅ |
| Grant / revoke admin roles | ❌ | ✅ |
| View audit log | ❌ | ✅ |

Bootstrap: the first super-admin is set manually in Mongo (`db.users.updateOne({email: "..."}, {$set: {role: "super_admin"}})`). Document in the README.

---

## 6. Admin frontend

### 6.1 Route tree (additions to `src/App.tsx`)

```
/admin/login                  (public)
/admin                        ── RequireAdmin wrapper
  /admin/tickets              list
  /admin/tickets/:ticket_id   detail + reply
  /admin/kb                   list
  /admin/kb/new               create form
  /admin/kb/:slug             edit form
  /admin/users                search/list
  /admin/users/:user_id       account view + actions
  /admin/metrics              overview dashboard
  /admin/audit                super-admin only
  /admin/settings             admin profile, password change
```

`RequireAdmin` mirrors `RequireAuth` but additionally checks `role`. If a `user`-role token tries to access `/admin/*`, redirects to `/admin/login` with an inline error.

### 6.2 Token storage

To keep customer and admin sessions cleanly isolated (different tabs, easier mental model):

- Customer token: `localStorage.token` (existing)
- Admin token: `localStorage.admin_token` (new)
- Separate axios instance `adminApi` mirroring `api`, attaching `admin_token` and force-redirecting to `/admin/login` on 401

A staff member can be logged into the customer app as themselves AND into the admin console as an admin role simultaneously.

### 6.3 Visual identity

The admin console gets a deliberately different look from the customer app (different accent color, denser layout, monospace metric tiles) so there's no risk of mistaking which surface you're on. Same shadcn/ui components, different theme.

### 6.4 Page-by-page contract

| Page | Key components | Notable behavior |
|---|---|---|
| Tickets list | Table, filters bar, status badges | Default sort: status=open, newest first |
| Ticket detail | Transcript view, reply box, close button | Reply box mirrors HelpWidget bubble style |
| KB list | Table grouped by category | "New article" button |
| KB editor | Form (slug, title, category, content, priority) | Slug is required-unique-immutable after create |
| Users list | Search by email, filters: role, disabled, deleted | Soft-deleted users hidden by default; toggle to view |
| User detail | Account summary, credits adjust modal, disable button, "view claims" / "view scans" tabs | All write actions require a `reason` text input |
| Metrics | Tile grid (overview) + line chart (scans/day) | Recharts |
| Audit log | Filterable table | Super-admin only — render diff for `before` / `after` |

---

## 7. Chatbot Phase 2 — function calling

### 7.1 Tools exposed to Claude

Each tool is a read-only function executed in `support_service.py` against the authenticated user's data. Registered only when the chat request carries a valid bearer token; for anonymous chats the tool list is empty and a system-prompt note clarifies this.

```python
tools = [
    {
        "name": "get_my_account",
        "description": "Get the signed-in user's account summary: credits remaining, plan tier, total QR codes issued.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_my_recent_claims",
        "description": "List the user's most recent QR codes / claims.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5}},
        },
    },
    {
        "name": "get_my_recent_scans",
        "description": "List the user's most recent scan events with verdicts.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5}},
        },
    },
    {
        "name": "lookup_my_ticket",
        "description": "Look up the status of a support ticket by ID (format: tkt_xxxxx).",
        "input_schema": {
            "type": "object",
            "properties": {"ticket_id": {"type": "string"}},
            "required": ["ticket_id"],
        },
    },
    {
        "name": "explain_verdict",
        "description": "Explain why a specific QR code returned a given verify verdict (VALID / EXPIRED / REVOKED / UNVERIFIED / UNKNOWN).",
        "input_schema": {
            "type": "object",
            "properties": {"jti": {"type": "string"}},
            "required": ["jti"],
        },
    },
]
```

### 7.2 Safety constraints

- Tools only return data belonging to the authenticated user. `lookup_my_ticket` returns 404-shaped result if the ticket exists but is not the caller's.
- All tool calls log a debug line (`support.chat.tool.call`) with tool name, user_id, and arg hash — no PII in log content.
- Tools never write. The bot cannot mutate state.

### 7.3 Agentic loop replaces structured-output call

Tools are incompatible with `messages.parse()` in the simplest form. The new flow:

```
1. POST to Claude with system + history + tools
2. If stop_reason == "tool_use":
     execute each tool_use block against the DB
     append assistant turn + tool_result user turn
     loop back to step 1
   If stop_reason == "end_turn":
     proceed to step 3
3. Final assistant text is the answer to return
4. Compute `confident` from a simple heuristic:
     - confident = true if at least one tool was called successfully
       (the bot used real data → high confidence)
     - confident = false if no tool calls AND the text contains escalation
       phrases ("create a support ticket", "let me connect you", etc.)
     - confident = true otherwise (general KB answer)
```

This replaces the structured-output `needs_human` field. We lose the model's self-reported uncertainty signal but gain real-data answers, which is the bigger lever. Tradeoff is documented.

Cap the loop at 5 iterations to prevent runaway costs; if hit, return a fallback.

### 7.4 System prompt addition

When tools are available, append to the system prompt:

```
You can look up the signed-in user's account data via tools. Use them whenever the
user asks about THEIR specific credits, claims, scans, or tickets. Do not call
tools for general questions answerable from the knowledge base — they cost the
user time. Never invent data; if a tool returns nothing, say so.
```

When unauthenticated, append:

```
The user is not signed in. You cannot look up account-specific data. For
account questions, ask them to sign in first.
```

---

## 8. Chatbot Phase 3 — streaming + persistence

### 8.1 Streaming

- Backend: switch `/support/chat` to return SSE (`text/event-stream`).
- Stream events from `client.messages.stream()` directly to the client.
- Tool-call iterations are invisible to the client — only the final text is streamed.
- Frontend: replace axios POST with `fetch()` + `ReadableStream` reader in `HelpWidget`. Replace fake `TypingIndicator` with real token-by-token rendering.

### 8.2 Persistence

For authenticated users only.

- On widget open: `GET /api/v1/support/threads/current` returns the user's most recent open thread (or 404).
- Each new message: backend appends to the thread; thread is committed before Claude call returns.
- Anonymous users: thread lives in component state only (current behavior).

New endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/support/threads/current` | Current user's most recent thread |
| `POST` | `/api/v1/support/threads/new` | Start a fresh thread (resets context) |

The existing `/support/chat` is updated to accept an optional `thread_id` and append to it.

---

## 9. Audit log mechanics

### 9.1 Centralized helper

`app/services/audit_service.py`:

```python
async def log_admin_action(
    admin: UserContext,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
    reason: str | None = None,
    request: Request | None = None,
) -> None:
    ...
```

Every admin write endpoint calls this once, after the DB mutation succeeds (so we only log actual effects, not attempts).

### 9.2 Sensitive-action UI gate

Frontend gates these actions behind a confirmation modal that requires a typed `reason`:
- Credit adjustment
- User disable
- User soft-delete
- Claim revocation
- Role grant/revoke

The `reason` becomes part of the audit log entry.

---

## 10. Sequence diagrams

### 10.1 Phase 2 chat with tool use

```
User                Widget          Backend            Anthropic         MongoDB
 │                    │                │                    │                │
 │  "How many         │                │                    │                │
 │   credits do       │                │                    │                │
 │   I have?"         │                │                    │                │
 ├───────────────────►│                │                    │                │
 │                    │  POST /chat    │                    │                │
 │                    │  (Bearer JWT)  │                    │                │
 │                    ├───────────────►│                    │                │
 │                    │                │  load KB articles  │                │
 │                    │                ├───────────────────────────────────►│
 │                    │                │◄───────────────────────────────────┤
 │                    │                │  Messages(tools, system, history)  │
 │                    │                ├───────────────────►│                │
 │                    │                │  tool_use:         │                │
 │                    │                │  get_my_account()  │                │
 │                    │                │◄───────────────────┤                │
 │                    │                │  execute tool      │                │
 │                    │                ├───────────────────────────────────►│
 │                    │                │  {credits: 87, ...}│                │
 │                    │                │◄───────────────────────────────────┤
 │                    │                │  tool_result back  │                │
 │                    │                ├───────────────────►│                │
 │                    │                │  text: "You have   │                │
 │                    │                │   87 credits..."   │                │
 │                    │                │◄───────────────────┤                │
 │                    │  {answer, conf}│                    │                │
 │                    │◄───────────────┤                    │                │
 │  display           │                │                    │                │
 │◄───────────────────┤                │                    │                │
```

### 10.2 Admin login

```
Admin            Browser            Backend          MongoDB
  │                │                  │                 │
  │ visit          │                  │                 │
  │  /admin/login  │                  │                 │
  ├───────────────►│                  │                 │
  │                │  GET HTML        │                 │
  │                ├─────────────────►│                 │
  │                │◄─────────────────┤                 │
  │ enter creds    │                  │                 │
  │◄───────────────│                  │                 │
  │                │ POST /auth/token │                 │
  │                ├─────────────────►│                 │
  │                │                  │ verify password │
  │                │                  ├────────────────►│
  │                │                  │◄────────────────┤
  │                │  {token, role}   │                 │
  │                │◄─────────────────┤                 │
  │                │ role in (admin,  │                 │
  │                │  super_admin)?   │                 │
  │                │ → store          │                 │
  │                │   admin_token    │                 │
  │                │ → redirect       │                 │
  │                │   /admin/tickets │                 │
  │                │                  │ log admin.login │
  │                │                  ├────────────────►│
```

---

## 11. Build order (dependency-aware)

The work has natural parallelism. Two-track plan:

**Track 1 — Chatbot completion (~1 week)**
1. Phase 2 tool definitions + execution functions
2. Phase 2 agentic loop in `support_service`
3. Phase 2 auth integration on `/support/chat`
4. Phase 3 streaming endpoint
5. Phase 3 frontend streaming consumer
6. Phase 3 thread persistence
7. Smoke tests

**Track 2 — Admin (~2 weeks)**
1. Data model migrations (roles, audit log, soft-delete fields)
2. Auth dependencies + RBAC
3. Tickets endpoints + frontend page
4. KB endpoints + frontend page
5. User search + detail + credit adjust + disable
6. Claim revoke
7. Metrics dashboard
8. Audit log viewer
9. Visual polish
10. QA

If working solo, **alternate** between tracks rather than finishing one fully — keeps both running and surfaces shared concerns (auth, JWT shape) early.

---

## 12. Rollout

1. Land all data-model migrations in one PR with `ensure_indexes()` updates.
2. Bootstrap the first super_admin manually in Mongo, document in `backend/README.md`.
3. Ship the admin backend behind no feature flag — endpoints are inert without an admin-role user.
4. Ship the admin frontend behind a known URL — no link from the customer app.
5. Ship chatbot Phase 2 behind a runtime check: tools enabled only when the request carries a valid JWT and the KB is loaded. Anonymous traffic continues to work as today.
6. Ship Phase 3 streaming once Phase 2 is stable in prod.

No staged rollout / canary needed for a small user base.

---

## 13. Open items

These can be confirmed asynchronously without blocking implementation start. Defaults below ship if no response.

| # | Question | Default if no answer |
|---|---|---|
| 1 | Should disabled users be able to log in to read-only mode, or fully blocked? | **Fully blocked.** |
| 2 | Credit adjustment cap per action (e.g., max ±1,000 per click)? | **No cap initially**, revisit if abuse appears. |
| 3 | Email user on admin reply to their ticket? | **Defer.** Out of scope per §1. |
| 4 | Admin password requirements stronger than user (length, complexity)? | **Same as user policy** for now, revisit if MFA lands. |
| 5 | Audit log retention — keep forever, or prune after N months? | **Keep forever** — small data, high value. |

---

## 14. Out of scope but explicitly considered

So future-Ali doesn't redesign these by accident:

- **MFA on admin** — JWT structure has a `role` field; adding an `mfa_verified` claim later is mechanical.
- **Stripe refund flow** — will mount under `/admin/users/{id}/billing` with same audit-log pattern.
- **Email notifications** — abstract behind a `notifications_service.py` when added; admin reply path is a clean caller.
- **Option B (multi-user customer orgs)** — will introduce an `accounts` collection separating org-from-user. The current `account_id` field on claims/scans already pretends users are accounts; that becomes accurate once Option B ships.
