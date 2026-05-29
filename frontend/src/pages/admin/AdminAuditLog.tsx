/**
 * Audit log viewer — append-only forensic record of every admin write.
 *
 * Super-admin only at the route level (RequireAdmin superOnly).
 *
 * Layout:
 *   - Filter bar: action dropdown, target type dropdown, admin email search,
 *     date range (from/to as date inputs)
 *   - Table rows are expandable: click to show before/after JSON snapshots,
 *     IP, and the full reason text.
 *
 * Action ↔ tone mapping (kept here so it's local to this view):
 *   - login → mute
 *   - delete / disable / revoke → red
 *   - role.grant / role.revoke / credits.adjust → amber
 *   - everything else → default text
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import "../../admin/admin.css";
import { adminEndpoints, type AuditLogEntry } from "../../admin/adminApi";
import { formatStamp } from "../../admin/util";

const PAGE_SIZE = 50;

const ACTION_OPTIONS = [
  { value: "", label: "ALL ACTIONS" },
  { value: "admin.login", label: "admin.login" },
  { value: "kb.create", label: "kb.create" },
  { value: "kb.update", label: "kb.update" },
  { value: "kb.delete", label: "kb.delete" },
  { value: "user.credits.adjust", label: "user.credits.adjust" },
  { value: "user.disable", label: "user.disable" },
  { value: "user.enable", label: "user.enable" },
  { value: "user.delete", label: "user.delete" },
  { value: "role.grant", label: "role.grant" },
  { value: "role.revoke", label: "role.revoke" },
  { value: "claim.revoke", label: "claim.revoke" },
  { value: "ticket.reply", label: "ticket.reply" },
  { value: "ticket.close", label: "ticket.close" },
  { value: "billing.refund", label: "billing.refund" },
  { value: "billing.refund.forced", label: "billing.refund.forced" },
];

const TARGET_OPTIONS = [
  { value: "", label: "ALL TARGETS" },
  { value: "user", label: "user" },
  { value: "kb_article", label: "kb_article" },
  { value: "billing_transaction", label: "billing_transaction" },
  { value: "claim", label: "claim" },
  { value: "ticket", label: "ticket" },
];

function actionTone(action: string): "red" | "amber" | "green" | "mute" | undefined {
  if (action.endsWith("delete") || action.endsWith("disable") || action.endsWith("revoke")) return "red";
  if (action.endsWith("enable") || action === "kb.create") return "green";
  if (action.startsWith("role.") || action === "user.credits.adjust") return "amber";
  if (action === "admin.login") return "mute";
  return undefined;
}

export default function AdminAuditLog() {
  const [params, setParams] = useSearchParams();
  const action = params.get("action") ?? "";
  const target_type = params.get("target_type") ?? "";
  const adminEmail = params.get("admin_email") ?? "";
  const fromDate = params.get("from") ?? "";
  const toDate = params.get("to") ?? "";
  const offset = parseInt(params.get("offset") ?? "0", 10) || 0;

  const [adminEmailInput, setAdminEmailInput] = useState(adminEmail);

  // Debounce email input to URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (adminEmailInput !== adminEmail) {
        patch((next) => {
          if (adminEmailInput) next.set("admin_email", adminEmailInput);
          else next.delete("admin_email");
        });
      }
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmailInput]);

  function patch(updater: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    updater(next);
    next.delete("offset");
    setParams(next, { replace: true });
  }

  // Date inputs come back as YYYY-MM-DD; widen to full-day UTC bounds.
  const queryFrom = fromDate ? new Date(`${fromDate}T00:00:00Z`).toISOString() : undefined;
  const queryTo = toDate ? new Date(`${toDate}T23:59:59Z`).toISOString() : undefined;

  const query = useQuery({
    queryKey: ["admin-audit-log", { action, target_type, adminEmail, queryFrom, queryTo, offset }],
    queryFn: () =>
      adminEndpoints.auditLog({
        action: action || undefined,
        target_type: target_type || undefined,
        admin_email: adminEmail || undefined,
        from: queryFrom,
        to: queryTo,
        limit: PAGE_SIZE,
        offset,
      }),
    keepPreviousData: true,
  });

  const entries = useMemo<AuditLogEntry[]>(() => query.data?.entries ?? [], [query.data]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearAll() {
    setAdminEmailInput("");
    setParams(new URLSearchParams(), { replace: true });
  }

  const activeFilters =
    [action, target_type, adminEmail, fromDate, toDate].filter(Boolean).length;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <header
        className="t-reveal"
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}
      >
        <div>
          <div className="t-label">FORENSIC RECORD · SUPER-ADMIN</div>
          <h1 className="t-h1" style={{ marginTop: 4 }}>Audit log</h1>
        </div>
        <span className="t-mono-dim" style={{ fontSize: 11, letterSpacing: "0.1em" }}>
          {query.data ? `${query.data.total.toLocaleString()} ENTRIES` : ""}
        </span>
      </header>

      {/* Filter bar */}
      <div
        className="t-reveal"
        data-delay="1"
        style={{
          marginBottom: 16,
          padding: "12px 14px",
          border: "1px solid var(--term-rule)",
          background: "var(--term-bg-1)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr) auto",
          gap: 12,
          alignItems: "end",
        }}
      >
        <FilterField label="ACTION">
          <select
            className="t-input"
            value={action}
            onChange={(e) => patch((n) => (e.target.value ? n.set("action", e.target.value) : n.delete("action")))}
            style={{ padding: "6px 10px", fontSize: 12 }}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="TARGET">
          <select
            className="t-input"
            value={target_type}
            onChange={(e) => patch((n) => (e.target.value ? n.set("target_type", e.target.value) : n.delete("target_type")))}
            style={{ padding: "6px 10px", fontSize: 12 }}
          >
            {TARGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="FROM">
          <input
            type="date"
            className="t-input"
            value={fromDate}
            onChange={(e) => patch((n) => (e.target.value ? n.set("from", e.target.value) : n.delete("from")))}
            style={{ padding: "5px 10px", fontSize: 12 }}
          />
        </FilterField>

        <FilterField label="TO">
          <input
            type="date"
            className="t-input"
            value={toDate}
            onChange={(e) => patch((n) => (e.target.value ? n.set("to", e.target.value) : n.delete("to")))}
            style={{ padding: "5px 10px", fontSize: 12 }}
          />
        </FilterField>

        <button
          className="t-btn"
          onClick={clearAll}
          disabled={activeFilters === 0 && !adminEmailInput}
          style={{ padding: "8px 14px", height: 32 }}
        >
          CLEAR
        </button>

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center" }}>
          <span className="t-label">ADMIN EMAIL CONTAINS</span>
          <input
            className="t-input"
            value={adminEmailInput}
            onChange={(e) => setAdminEmailInput(e.target.value)}
            placeholder="substring · case-insensitive"
            style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="t-reveal" data-delay="2" style={{ border: "1px solid var(--term-rule)" }}>
        <table className="t-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th style={{ width: 175 }}>TIMESTAMP</th>
              <th style={{ width: 200 }}>ADMIN</th>
              <th style={{ width: 200 }}>ACTION</th>
              <th style={{ width: 130 }}>TARGET</th>
              <th>REASON</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: 28, textAlign: "center" }}>
                  <span className="t-loading t-label">LOADING ENTRIES…</span>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--term-fg-mute)" }}>
                  No entries matching these filters.
                </td>
              </tr>
            ) : (
              entries.flatMap((e) => {
                const isOpen = expanded.has(e.id);
                const rows = [
                  <tr key={e.id} onClick={() => toggleExpanded(e.id)} style={{ cursor: "pointer" }}>
                    <td className="t-mono-mute" style={{ textAlign: "center" }}>{isOpen ? "▾" : "▸"}</td>
                    <td className="t-mono-dim" style={{ fontSize: 11 }}>{formatStamp(e.ts)}</td>
                    <td style={{ wordBreak: "break-all" }}>{e.admin_email}</td>
                    <td>
                      <span className="t-tag" data-tone={actionTone(e.action)}>{e.action}</span>
                    </td>
                    <td className="t-mono-dim">
                      {e.target_type ? (
                        <>
                          <span className="t-mono-mute">{e.target_type}/</span>
                          <span className="t-mono-amber" style={{ wordBreak: "break-all" }}>{e.target_id}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="t-mono-dim" style={{ wordBreak: "break-word" }}>
                      {e.reason ? (
                        e.reason.length > 80 ? `${e.reason.slice(0, 80)}…` : e.reason
                      ) : (
                        <span className="t-mono-mute">—</span>
                      )}
                    </td>
                  </tr>,
                ];

                if (isOpen) {
                  rows.push(
                    <tr key={`${e.id}-detail`} onClick={(ev) => ev.stopPropagation()}>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <ExpandedDetail entry={e} />
                      </td>
                    </tr>
                  );
                }

                return rows;
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {query.data && query.data.total > PAGE_SIZE ? (
        <div
          className="t-reveal"
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--term-fg-mute)",
            letterSpacing: "0.08em",
          }}
        >
          <span>SHOWING {offset + 1}–{Math.min(offset + entries.length, query.data.total)} OF {query.data.total}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="t-btn"
              style={{ padding: "4px 10px", fontSize: 10 }}
              disabled={offset === 0}
              onClick={() => patch((n) => n.set("offset", String(Math.max(0, offset - PAGE_SIZE))))}
            >
              ← PREV
            </button>
            <button
              className="t-btn"
              style={{ padding: "4px 10px", fontSize: 10 }}
              disabled={!query.data.has_more}
              onClick={() => patch((n) => n.set("offset", String(offset + PAGE_SIZE)))}
            >
              NEXT →
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="t-mono-mute"
        style={{ marginTop: 16, fontSize: 10, letterSpacing: "0.1em", lineHeight: 1.7 }}
      >
        • Log is append-only — entries cannot be edited or deleted.
        <br />• Sensitive fields (password hashes, OAuth subs) are scrubbed before logging.
        <br />• Click any row to expand before/after snapshots and full reason.
      </div>
    </div>
  );
}

// ── Expanded detail row ────────────────────────────────────────────────────

function ExpandedDetail({ entry }: { entry: AuditLogEntry }) {
  const hasBefore = entry.before && Object.keys(entry.before).length > 0;
  const hasAfter = entry.after && Object.keys(entry.after).length > 0;

  return (
    <div style={{ background: "var(--term-bg)", padding: 18, borderTop: "1px dashed var(--term-rule)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Snapshot title="BEFORE" data={entry.before} present={!!hasBefore} tone="red" />
        <Snapshot title="AFTER"  data={entry.after}  present={!!hasAfter}  tone="green" />
      </div>

      {entry.reason ? (
        <div style={{ marginTop: 14 }}>
          <div className="t-label" style={{ marginBottom: 6 }}>FULL REASON</div>
          <div
            style={{
              border: "1px solid var(--term-rule)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--term-fg)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {entry.reason}
          </div>
        </div>
      ) : null}

      <div
        className="t-mono-mute"
        style={{ marginTop: 12, fontSize: 10, letterSpacing: "0.06em", display: "flex", gap: 16 }}
      >
        <span>ENTRY ID · <span className="t-mono-amber">{entry.id}</span></span>
        {entry.ip ? <span>IP · {entry.ip}</span> : null}
      </div>
    </div>
  );
}

function Snapshot({
  title,
  data,
  present,
  tone,
}: {
  title: string;
  data: Record<string, unknown> | null;
  present: boolean;
  tone: "red" | "green";
}) {
  const accent = tone === "red" ? "var(--term-red)" : "var(--term-green)";
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 6, color: accent }}>
        {title}
      </div>
      <pre
        style={{
          border: `1px solid ${accent}`,
          background: tone === "red" ? "var(--term-red-faint)" : "var(--term-green-faint)",
          padding: 12,
          margin: 0,
          fontSize: 11,
          lineHeight: 1.55,
          color: "var(--term-fg)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          minHeight: 60,
        }}
      >
        {present ? JSON.stringify(data, null, 2) : "(no snapshot)"}
      </pre>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
