/**
 * User detail page — single-user operator view with read & write surfaces.
 *
 * Top stack:
 *   - Back link
 *   - Identity header (email + role tag + state pills)
 *   - Meta strip (ID, plan, credits, issued, created, deleted/disabled stamps)
 *   - Stats strip (claims totals, scans totals, last activity)
 *
 * Tabbed body:
 *   OVERVIEW  · the actions panel (5 write actions, role-gated)
 *   CLAIMS    · paginated table of user's claims
 *   SCANS     · paginated table of user's scan events
 *
 * Each write action is a fold-out form requiring a reason text (most fields
 * are server-required), with the action button hot when valid. Soft-delete
 * and role change are super_admin-only and the buttons themselves are
 * hidden for plain admins.
 */

import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import "../../admin/admin.css";
import {
  adminEndpoints,
  type AdminClaim,
  type AdminScan,
  type AdminTransactionSummary,
  type RefundPolicyErrorBody,
  type UserDetail,
  type UserRole,
} from "../../admin/adminApi";
import { useAdminAuth } from "../../admin/AdminAuthContext";
import { BackLink, MetaStrip, ageLabel, formatStamp } from "../../admin/util";

type Tab = "overview" | "claims" | "scans" | "billing";

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useAdminAuth();
  const [params, setParams] = useSearchParams();

  // Hooks must come before any early return; the !userId guard lives below.
  const safeUserId = userId ?? "";

  const tab = (params.get("tab") as Tab | null) ?? "overview";
  function setTab(t: Tab) {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  }

  const userQuery = useQuery({
    queryKey: ["admin-user", safeUserId],
    queryFn: () => adminEndpoints.getUser(safeUserId),
    enabled: !!userId,
  });

  if (!userId) return <Navigate to="/admin/users" replace />;

  const user = userQuery.data;

  if (userQuery.isLoading) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <BackLink to="/admin/users" label="back to users" />
        <div style={{ marginTop: 20 }}>
          <span className="t-loading t-label">LOADING USER…</span>
        </div>
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <BackLink to="/admin/users" label="back to users" />
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid var(--term-red)",
            background: "var(--term-red-faint)",
            color: "var(--term-red)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ⚠ User not found or failed to load.
        </div>
      </div>
    );
  }

  const isSuper = me?.role === "super_admin";
  const isSelf = me?.id === user.id;

  function refresh(updated: UserDetail) {
    qc.setQueryData(["admin-user", userId], updated);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="t-reveal" style={{ marginBottom: 6 }}>
        <BackLink to="/admin/users" label="back to users" />
      </div>

      {/* Identity header */}
      <header
        className="t-reveal"
        data-delay="1"
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "8px 0 16px" }}
      >
        <div>
          <div className="t-label">USER · {user.id}</div>
          <h1 className="t-h1" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ wordBreak: "break-all" }}>{user.email}</span>
            <span className="t-tag" data-tone={roleTone(user.role)}>{roleLabel(user.role)}</span>
            {user.is_deleted ? <span className="t-tag" data-tone="red">DELETED</span> : null}
            {user.is_disabled && !user.is_deleted ? (
              <span className="t-tag" data-tone="red">DISABLED</span>
            ) : null}
          </h1>
        </div>
      </header>

      {/* Meta strip — identity + lifecycle stamps */}
      <div className="t-reveal" data-delay="1">
        <MetaStrip
          items={[
            { k: "PLAN", v: user.plan.toUpperCase() },
            { k: "CREDITS", v: user.credits_remaining, tone: "amber" },
            { k: "ISSUED", v: user.issued_count },
            { k: "CREATED", v: formatStamp(user.created_at), tone: "mute" },
            user.disabled_at
              ? { k: "DISABLED", v: formatStamp(user.disabled_at), tone: "red" }
              : { k: "DISABLED", v: "—", tone: "mute" },
            user.deleted_at
              ? { k: "DELETED", v: formatStamp(user.deleted_at), tone: "red" }
              : { k: "DELETED", v: "—", tone: "mute" },
          ]}
        />
      </div>

      {/* Stats strip */}
      <div className="t-reveal" data-delay="2" style={{ marginTop: 12 }}>
        <MetaStrip
          items={[
            { k: "TOTAL CLAIMS", v: user.stats.total_claims },
            { k: "ACTIVE", v: user.stats.active_claims, tone: "green" },
            { k: "REVOKED", v: user.stats.revoked_claims, tone: "red" },
            { k: "TOTAL SCANS", v: user.stats.total_scans },
            { k: "LAST SCAN", v: user.stats.last_scan_at ? `${ageLabel(user.stats.last_scan_at)} ago` : "—", tone: "mute" },
            { k: "LAST CLAIM", v: user.stats.last_claim_at ? `${ageLabel(user.stats.last_claim_at)} ago` : "—", tone: "mute" },
          ]}
        />
      </div>

      {/* Tabs */}
      <nav
        className="t-reveal"
        data-delay="3"
        style={{
          display: "flex",
          gap: 0,
          marginTop: 26,
          marginBottom: 0,
          borderBottom: "1px solid var(--term-rule-strong)",
        }}
      >
        {(
          [
            { key: "overview" as const, label: "OVERVIEW · ACTIONS" },
            { key: "claims" as const, label: `CLAIMS · ${user.stats.total_claims}` },
            { key: "scans" as const, label: `SCANS · ${user.stats.total_scans}` },
            { key: "billing" as const, label: "BILLING · REFUNDS" },
          ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: "1px solid var(--term-rule)",
              borderBottom: tab === t.key ? "2px solid var(--term-amber)" : "1px solid var(--term-rule)",
              borderRight: "none",
              background: tab === t.key ? "var(--term-amber-faint)" : "transparent",
              color: tab === t.key ? "var(--term-amber)" : "var(--term-fg-dim)",
              padding: "10px 18px",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 22 }}>
        {tab === "overview" ? (
          <ActionsPanel
            user={user}
            isSuper={isSuper}
            isSelf={isSelf}
            onUpdated={refresh}
            onDeleted={() => navigate("/admin/users")}
          />
        ) : tab === "claims" ? (
          <ClaimsTab userId={user.id} />
        ) : tab === "scans" ? (
          <ScansTab userId={user.id} />
        ) : (
          <BillingTab userId={user.id} isSuper={isSuper} />
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function roleTone(role: UserRole): "amber" | "green" | "mute" {
  if (role === "super_admin") return "amber";
  if (role === "admin") return "green";
  return "mute";
}
function roleLabel(role: UserRole): string {
  if (role === "super_admin") return "SUPER";
  if (role === "admin") return "ADMIN";
  return "USER";
}

// ── Actions panel ──────────────────────────────────────────────────────────

type ActionKey = "credits" | "disable" | "enable" | "role" | "delete" | null;

interface ActionsPanelProps {
  user: UserDetail;
  isSuper: boolean;
  isSelf: boolean;
  onUpdated: (u: UserDetail) => void;
  onDeleted: () => void;
}

function ActionsPanel({ user, isSuper, isSelf, onUpdated, onDeleted }: ActionsPanelProps) {
  const [open, setOpen] = useState<ActionKey>(null);

  const buttons: { key: ActionKey; label: string; tone?: "amber" | "red"; primary?: boolean; gate?: boolean; hint?: string }[] = [
    { key: "credits", label: "ADJUST CREDITS", primary: true, gate: !user.is_deleted, hint: "Modify the user's credit balance." },
    user.is_disabled
      ? { key: "enable", label: "ENABLE ACCOUNT", tone: "amber", gate: !user.is_deleted && !isSelf, hint: "Restore login access." }
      : { key: "disable", label: "DISABLE ACCOUNT", tone: "red", gate: !user.is_deleted && !isSelf, hint: "Block future logins. Reversible." },
    { key: "role", label: "CHANGE ROLE", gate: isSuper && !user.is_deleted, hint: "Super-admin only." },
    { key: "delete", label: "DELETE ACCOUNT", tone: "red", gate: isSuper && !user.is_deleted && !isSelf, hint: "Soft-delete. Super-admin only." },
  ];

  return (
    <div className="t-reveal">
      <div className="t-label" style={{ marginBottom: 10 }}>
        OPERATOR ACTIONS · {isSuper ? "SUPER PRIVILEGES" : "ADMIN"}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {buttons
          .filter((b) => b.gate !== false)
          .map((b) => (
            <button
              key={String(b.key)}
              className="t-btn"
              data-primary={b.primary ? "true" : undefined}
              data-tone={b.tone === "red" ? "red" : undefined}
              onClick={() => setOpen(open === b.key ? null : b.key)}
            >
              {open === b.key ? "▾ " : "▸ "}
              {b.label}
            </button>
          ))}
      </div>

      {isSelf ? (
        <div
          className="t-mono-mute"
          style={{
            marginTop: 10,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ⓘ Destructive actions are disabled on your own account.
        </div>
      ) : null}

      {open === "credits" ? (
        <CreditsForm user={user} onClose={() => setOpen(null)} onUpdated={onUpdated} />
      ) : null}

      {open === "disable" ? (
        <ReasonForm
          title={`DISABLE ${user.email}`}
          confirmLabel="DISABLE"
          tone="red"
          placeholder="e.g. spam reports / fraud / customer request"
          onCancel={() => setOpen(null)}
          submit={async (reason) => {
            const u = await adminEndpoints.disableUser(user.id, reason);
            onUpdated(u);
            setOpen(null);
          }}
        />
      ) : null}

      {open === "enable" ? (
        <ReasonForm
          title={`ENABLE ${user.email}`}
          confirmLabel="ENABLE"
          tone="amber"
          placeholder="(optional context — not required by backend)"
          required={false}
          onCancel={() => setOpen(null)}
          submit={async () => {
            const u = await adminEndpoints.enableUser(user.id);
            onUpdated(u);
            setOpen(null);
          }}
        />
      ) : null}

      {open === "role" ? (
        <RoleForm
          user={user}
          isSelf={isSelf}
          onCancel={() => setOpen(null)}
          onUpdated={(u) => {
            onUpdated(u);
            setOpen(null);
          }}
        />
      ) : null}

      {open === "delete" ? (
        <ReasonForm
          title={`SOFT-DELETE ${user.email}`}
          confirmLabel="DELETE PERMANENTLY"
          tone="red"
          placeholder="Required. e.g. GDPR deletion request / TOS violation"
          onCancel={() => setOpen(null)}
          submit={async (reason) => {
            await adminEndpoints.softDeleteUser(user.id, reason);
            onDeleted();
          }}
        />
      ) : null}
    </div>
  );
}

// ── Credit adjust form ─────────────────────────────────────────────────────

function CreditsForm({
  user,
  onClose,
  onUpdated,
}: {
  user: UserDetail;
  onClose: () => void;
  onUpdated: (u: UserDetail) => void;
}) {
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => adminEndpoints.adjustCredits(user.id, delta, reason),
    onSuccess: (u) => {
      onUpdated(u);
      onClose(); // auto-collapse the form once the write is acknowledged
    },
    onError: (e: { response?: { data?: { detail?: string } } } | null) => {
      setErr(e?.response?.data?.detail ?? "Adjustment failed.");
    },
  });

  const projected = Math.max(0, user.credits_remaining + delta);

  return (
    <div style={fold()}>
      <Header tone="amber" label="ADJUST CREDITS" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
        <Stat label="CURRENT" value={user.credits_remaining} tone="mute" />
        <Stat label="DELTA" value={delta >= 0 ? `+${delta}` : delta} tone={delta === 0 ? "mute" : delta > 0 ? "green" : "red"} />
        <Stat label="PROJECTED" value={projected} tone="amber" />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {[-100, -10, -1, +1, +10, +100, +1000].map((n) => (
          <button
            key={n}
            className="t-btn"
            onClick={() => setDelta((d) => d + n)}
            style={{ padding: "4px 10px", fontSize: 11 }}
          >
            {n > 0 ? `+${n}` : n}
          </button>
        ))}
        <button
          className="t-btn"
          onClick={() => setDelta(0)}
          style={{ padding: "4px 10px", fontSize: 11 }}
        >
          RESET
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="t-label">▍ DELTA · signed integer</span>
        <input
          type="number"
          className="t-input"
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value) || 0)}
          style={{ marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="t-label">▍ REASON · required, audit-logged</span>
        <textarea
          className="t-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. goodwill credit / billing dispute / migration fixup"
          maxLength={500}
          style={{ marginTop: 6 }}
        />
      </div>

      {err ? <ErrBox msg={err} /> : null}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          className="t-btn"
          data-primary="true"
          disabled={delta === 0 || !reason.trim() || mut.isPending}
          onClick={() => {
            setErr(null);
            mut.mutate();
          }}
        >
          {mut.isPending ? "APPLYING…" : "APPLY ADJUSTMENT →"}
        </button>
        <button className="t-btn" onClick={onClose} disabled={mut.isPending}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ── Reason form (disable / enable / soft-delete share this) ────────────────

function ReasonForm({
  title,
  confirmLabel,
  tone,
  placeholder,
  required = true,
  onCancel,
  submit,
}: {
  title: string;
  confirmLabel: string;
  tone: "amber" | "red";
  placeholder: string;
  required?: boolean;
  onCancel: () => void;
  submit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (required && !reason.trim()) {
      setErr("Reason is required for the audit log.");
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      await submit(reason);
    } catch (e) {
      setErr(
        (e as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
          "Action failed."
      );
      setSubmitting(false);
    }
  }

  return (
    <div style={fold(tone)}>
      <Header tone={tone} label={title} />
      <div style={{ marginTop: 12 }}>
        <span className="t-label">▍ REASON · {required ? "required" : "optional"} · audit-logged</span>
        <textarea
          className="t-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          maxLength={500}
          style={{ marginTop: 6 }}
        />
      </div>
      {err ? <ErrBox msg={err} /> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          className="t-btn"
          data-tone={tone === "red" ? "red" : undefined}
          data-primary={tone === "amber" ? "true" : undefined}
          disabled={submitting}
          onClick={go}
        >
          {submitting ? "…" : confirmLabel}
        </button>
        <button className="t-btn" onClick={onCancel} disabled={submitting}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ── Role change form ───────────────────────────────────────────────────────

function RoleForm({
  user,
  isSelf,
  onCancel,
  onUpdated,
}: {
  user: UserDetail;
  isSelf: boolean;
  onCancel: () => void;
  onUpdated: (u: UserDetail) => void;
}) {
  const [target, setTarget] = useState<UserRole>(user.role);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Block self-demotion at the UI level so it never round-trips.
  const blockedSelfDemote = isSelf && target !== "super_admin";
  const unchanged = target === user.role;

  async function go() {
    setErr(null);
    setSubmitting(true);
    try {
      const u = await adminEndpoints.changeUserRole(user.id, target, reason.trim() || undefined);
      onUpdated(u);
    } catch (e) {
      setErr(
        (e as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
          "Role change failed."
      );
      setSubmitting(false);
    }
  }

  return (
    <div style={fold("amber")}>
      <Header tone="amber" label={`CHANGE ROLE FROM ${roleLabel(user.role)}`} />
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        {(["user", "admin", "super_admin"] as UserRole[]).map((r) => (
          <button
            key={r}
            className="t-btn"
            data-primary={target === r ? "true" : undefined}
            onClick={() => setTarget(r)}
            style={{ padding: "6px 14px" }}
          >
            {roleLabel(r)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="t-label">▍ REASON · optional · audit-logged</span>
        <textarea
          className="t-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. promoting for the support rotation"
          maxLength={500}
          style={{ marginTop: 6 }}
        />
      </div>

      {blockedSelfDemote ? (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            border: "1px solid var(--term-red)",
            background: "var(--term-red-faint)",
            color: "var(--term-red)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          ⚠ You cannot demote your own super_admin role.
        </div>
      ) : null}

      {err ? <ErrBox msg={err} /> : null}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          className="t-btn"
          data-primary="true"
          disabled={submitting || unchanged || blockedSelfDemote}
          onClick={go}
        >
          {submitting ? "…" : `SET ROLE → ${roleLabel(target)}`}
        </button>
        <button className="t-btn" onClick={onCancel} disabled={submitting}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ── Claims tab ─────────────────────────────────────────────────────────────

function ClaimsTab({ userId }: { userId: string }) {
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: ["admin-user-claims", userId, statusFilter, offset],
    queryFn: () => adminEndpoints.listUserClaims(userId, { status: statusFilter, limit: 25, offset }),
    keepPreviousData: true,
  });

  const claims = useMemo<AdminClaim[]>(() => query.data?.claims ?? [], [query.data]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="t-btn" data-primary={!statusFilter ? "true" : undefined} onClick={() => { setStatusFilter(undefined); setOffset(0); }} style={{ padding: "4px 12px", fontSize: 11 }}>ALL</button>
        <button className="t-btn" data-primary={statusFilter === "active" ? "true" : undefined} onClick={() => { setStatusFilter("active"); setOffset(0); }} style={{ padding: "4px 12px", fontSize: 11 }}>ACTIVE</button>
        <button className="t-btn" data-primary={statusFilter === "revoked" ? "true" : undefined} onClick={() => { setStatusFilter("revoked"); setOffset(0); }} style={{ padding: "4px 12px", fontSize: 11 }}>REVOKED</button>
      </div>

      <div style={{ border: "1px solid var(--term-rule)" }}>
        <table className="t-table">
          <thead>
            <tr>
              <th style={{ width: 260 }}>JTI</th>
              <th style={{ width: 130 }}>TEMPLATE</th>
              <th style={{ width: 110 }}>STATUS</th>
              <th style={{ width: 170 }}>ISSUED</th>
              <th>EXPIRES</th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "var(--term-fg-mute)" }}>No claims.</td></tr>
            ) : (
              claims.map((c) => (
                <tr key={c.jti}>
                  <td className="t-mono-amber" style={{ wordBreak: "break-all" }}>{c.jti}</td>
                  <td className="t-mono-dim">{c.template ?? "—"}</td>
                  <td>
                    <span className="t-tag" data-tone={c.status === "active" ? "green" : c.status === "revoked" ? "red" : "mute"}>
                      {(c.status ?? "—").toUpperCase()}
                    </span>
                  </td>
                  <td className="t-mono-dim" title={formatStamp(c.iat)}>{c.iat ? formatStamp(c.iat) : "—"}</td>
                  <td className="t-mono-dim">{c.exp ? formatStamp(c.exp) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Paginator total={query.data?.total ?? 0} offset={offset} count={claims.length} hasMore={!!query.data?.has_more} onChange={setOffset} />
    </div>
  );
}

// ── Scans tab ──────────────────────────────────────────────────────────────

function ScansTab({ userId }: { userId: string }) {
  const [offset, setOffset] = useState(0);
  const [verdictFilter, setVerdictFilter] = useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: ["admin-user-scans", userId, verdictFilter, offset],
    queryFn: () => adminEndpoints.listUserScans(userId, { verdict: verdictFilter, limit: 25, offset }),
    keepPreviousData: true,
  });

  const scans = useMemo<AdminScan[]>(() => query.data?.scans ?? [], [query.data]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[undefined, "VALID", "EXPIRED", "REVOKED", "UNVERIFIED", "UNKNOWN"].map((v) => (
          <button
            key={v ?? "all"}
            className="t-btn"
            data-primary={verdictFilter === v ? "true" : undefined}
            onClick={() => { setVerdictFilter(v); setOffset(0); }}
            style={{ padding: "4px 12px", fontSize: 11 }}
          >
            {v ?? "ALL"}
          </button>
        ))}
      </div>

      <div style={{ border: "1px solid var(--term-rule)" }}>
        <table className="t-table">
          <thead>
            <tr>
              <th style={{ width: 180 }}>TS</th>
              <th style={{ width: 110 }}>VERDICT</th>
              <th style={{ width: 220 }}>JTI</th>
              <th>REASON</th>
              <th style={{ width: 90, textAlign: "right" }}>LATENCY</th>
            </tr>
          </thead>
          <tbody>
            {scans.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "var(--term-fg-mute)" }}>No scans.</td></tr>
            ) : (
              scans.map((s, i) => (
                <tr key={`${s.ts}-${i}`}>
                  <td className="t-mono-dim">{formatStamp(s.ts)}</td>
                  <td>
                    <span
                      className="t-tag"
                      data-tone={
                        s.verdict === "VALID" ? "green" :
                        s.verdict === "REVOKED" || s.verdict === "EXPIRED" ? "red" :
                        "mute"
                      }
                    >
                      {s.verdict ?? "—"}
                    </span>
                  </td>
                  <td className="t-mono-amber" style={{ wordBreak: "break-all" }}>{s.jti ?? "—"}</td>
                  <td className="t-mono-dim">{s.reason_code ?? "—"}</td>
                  <td className="t-mono-dim" style={{ textAlign: "right" }}>{s.latency_ms != null ? `${s.latency_ms}ms` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Paginator total={query.data?.total ?? 0} offset={offset} count={scans.length} hasMore={!!query.data?.has_more} onChange={setOffset} />
    </div>
  );
}

// ── Small shared atoms ─────────────────────────────────────────────────────

function fold(tone: "amber" | "red" = "amber"): React.CSSProperties {
  return {
    marginTop: 14,
    padding: 14,
    border: `1px solid ${tone === "red" ? "var(--term-red)" : "var(--term-amber)"}`,
    background: tone === "red" ? "var(--term-red-faint)" : "var(--term-amber-faint)",
  };
}

function Header({ tone, label }: { tone: "amber" | "red"; label: string }) {
  return (
    <div
      className="t-label"
      style={{ color: tone === "red" ? "var(--term-red)" : "var(--term-amber)" }}
    >
      ⌁ {label}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "amber" | "red" | "green" | "mute" }) {
  const color =
    tone === "amber" ? "var(--term-amber)" :
    tone === "red" ? "var(--term-red)" :
    tone === "green" ? "var(--term-green)" :
    tone === "mute" ? "var(--term-fg-mute)" :
    "var(--term-fg)";
  return (
    <div style={{ border: "1px solid var(--term-rule)", padding: "10px 12px", background: "var(--term-bg)" }}>
      <div className="t-label">{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 500, color }}>{value}</div>
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "8px 12px",
        border: "1px solid var(--term-red)",
        background: "var(--term-red-faint)",
        color: "var(--term-red)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      ⚠ {msg}
    </div>
  );
}

function Paginator({
  total,
  offset,
  count,
  hasMore,
  onChange,
}: {
  total: number;
  offset: number;
  count: number;
  hasMore: boolean;
  onChange: (n: number) => void;
}) {
  if (total <= 25) return null;
  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 11,
        color: "var(--term-fg-mute)",
        letterSpacing: "0.08em",
      }}
    >
      <span>SHOWING {offset + 1}–{Math.min(offset + count, total)} OF {total}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="t-btn" style={{ padding: "4px 10px", fontSize: 10 }} disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - 25))}>
          ← PREV
        </button>
        <button className="t-btn" style={{ padding: "4px 10px", fontSize: 10 }} disabled={!hasMore} onClick={() => onChange(offset + 25)}>
          NEXT →
        </button>
      </div>
    </div>
  );
}

// ── Billing tab ────────────────────────────────────────────────────────────
//
// Lists the user's transactions with a status pill + per-row Refund action.
// Refund is destructive and money-moving — it lives behind a confirm form
// requiring a reason. Super-admins also see a "FORCE OVERRIDE" toggle that
// bypasses the soft policy rules (and gets logged as billing.refund.forced).

function BillingTab({ userId, isSuper }: { userId: string; isSuper: boolean }) {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [activeRefundId, setActiveRefundId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-user-transactions", userId, offset],
    queryFn: () => adminEndpoints.listUserTransactions(userId, { limit: 25, offset }),
  });

  const transactions = useMemo<AdminTransactionSummary[]>(
    () => query.data?.transactions ?? [],
    [query.data]
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-user-transactions", userId] });
    qc.invalidateQueries({ queryKey: ["admin-user", userId] });
  };

  return (
    <div>
      <div className="t-label" style={{ marginBottom: 10 }}>
        TRANSACTIONS · {query.data?.total ?? 0}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="t-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>DESCRIPTION</th>
              <th style={{ textAlign: "right" }}>AMOUNT</th>
              <th style={{ textAlign: "right" }}>CREDITS</th>
              <th>STATUS</th>
              <th style={{ textAlign: "right" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--term-fg-mute)" }}>
                  Loading…
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--term-fg-mute)" }}>
                  No transactions on this account.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <BillingRow
                  key={tx.id}
                  tx={tx}
                  isSuper={isSuper}
                  expanded={activeRefundId === tx.id}
                  onToggle={() =>
                    setActiveRefundId((curr) => (curr === tx.id ? null : tx.id))
                  }
                  onRefunded={() => {
                    setActiveRefundId(null);
                    refresh();
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <Paginator
        total={query.data?.total ?? 0}
        offset={offset}
        count={transactions.length}
        hasMore={transactions.length === 25}
        onChange={setOffset}
      />
    </div>
  );
}

function BillingRow({
  tx,
  isSuper,
  expanded,
  onToggle,
  onRefunded,
}: {
  tx: AdminTransactionSummary;
  isSuper: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRefunded: () => void;
}) {
  const statusTone =
    tx.status === "paid"
      ? "green"
      : tx.status === "refunded"
      ? "mute"
      : tx.status === "partially_refunded"
      ? "amber"
      : "mute";

  const statusLabel =
    tx.status === "partially_refunded"
      ? "PARTIAL"
      : tx.status.toUpperCase();

  const totalRefunded = (tx.refunded_amount_cents / 100).toFixed(2);
  const showRefundedSubline = tx.refunds.length > 0;

  return (
    <>
      <tr>
        <td style={{ color: "var(--term-fg-dim)" }} title={tx.created_at ?? undefined}>
          {tx.created_at ? formatStamp(tx.created_at) : "—"}
        </td>
        <td>{tx.description}</td>
        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          ${tx.amount_usd}
        </td>
        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {tx.credits_added.toLocaleString()}
        </td>
        <td>
          <span className="t-tag" data-tone={statusTone}>
            {statusLabel}
          </span>
          {showRefundedSubline && (
            <div style={{ fontSize: 10, color: "var(--term-fg-mute)", marginTop: 4 }}>
              ${totalRefunded} refunded · {tx.refunds.length}{" "}
              {tx.refunds.length === 1 ? "event" : "events"}
            </div>
          )}
        </td>
        <td style={{ textAlign: "right" }}>
          {tx.refundable ? (
            <button
              className="t-btn"
              data-tone="red"
              onClick={onToggle}
              style={{ padding: "4px 10px", fontSize: 10 }}
            >
              {expanded ? "CANCEL" : "REFUND"}
            </button>
          ) : (
            <span style={{ fontSize: 10, color: "var(--term-fg-mute)" }}>—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: "var(--term-bg-1)", padding: 0 }}>
            <RefundForm
              tx={tx}
              isSuper={isSuper}
              onCancel={onToggle}
              onSuccess={onRefunded}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function RefundForm({
  tx,
  isSuper,
  onCancel,
  onSuccess,
}: {
  tx: AdminTransactionSummary;
  isSuper: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const [policyError, setPolicyError] = useState<RefundPolicyErrorBody | null>(null);

  const mutation = useMutation({
    mutationFn: () => adminEndpoints.issueRefund(tx.id, reason.trim(), force),
    onSuccess: () => {
      setPolicyError(null);
      onSuccess();
    },
    onError: (err: unknown) => {
      // Backend returns 400 with { detail: { code, message } } on policy
      // violations. Anything else surfaces as a generic error.
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      if (
        detail &&
        typeof detail === "object" &&
        "code" in detail &&
        "message" in detail
      ) {
        setPolicyError(detail as RefundPolicyErrorBody);
      } else {
        setPolicyError({
          code: "stripe_error",
          message: "Refund failed. Check Stripe dashboard and retry.",
        });
      }
    },
  });

  const policyCanBeForced =
    policyError &&
    ["too_old", "too_consumed", "recent_refund"].includes(policyError.code);

  const canSubmit =
    reason.trim().length >= 4 && !mutation.isPending;

  return (
    <div style={{ padding: "18px 20px", borderTop: "1px solid var(--term-rule)" }}>
      <div className="t-label" style={{ marginBottom: 8 }}>
        ISSUE REFUND · ${tx.amount_usd}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--term-fg-mute)",
          letterSpacing: "0.06em",
          marginBottom: 12,
        }}
      >
        Money returns to the customer's original card. Stripe shows it on
        their statement in 5–10 business days. This action is logged.
      </div>

      <textarea
        className="t-input"
        placeholder="Reason — required. Be specific. (e.g. 'customer billing dispute, duplicate charge')"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (policyError) setPolicyError(null);
        }}
        disabled={mutation.isPending}
        rows={3}
        style={{ width: "100%" }}
      />

      {policyError && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            border: "1px solid var(--term-red)",
            background: "var(--term-red-faint)",
            color: "var(--term-red)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.14em", marginBottom: 4 }}>
            ⚠ POLICY · {policyError.code.replace(/_/g, " ").toUpperCase()}
          </div>
          {policyError.message}
          {policyCanBeForced && isSuper && (
            <div style={{ marginTop: 8 }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                Override the policy (super-admin only — logs as forced)
              </label>
            </div>
          )}
          {policyCanBeForced && !isSuper && (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>
              Only a super-admin can override this rule.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <button
          className="t-btn"
          data-primary="true"
          data-tone="red"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? "ISSUING…"
            : force
            ? "FORCE & REFUND"
            : `REFUND $${tx.amount_usd}`}
        </button>
        <button
          className="t-btn"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          CANCEL
        </button>
        <span style={{ fontSize: 11, color: "var(--term-fg-mute)", marginLeft: "auto" }}>
          {reason.trim().length < 4
            ? "Reason needs at least 4 characters"
            : "Reason ready"}
        </span>
      </div>
    </div>
  );
}
