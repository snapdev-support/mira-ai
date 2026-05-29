/**
 * Admin home — a single-screen operator dashboard. Visual focus over data
 * completeness for now; richer metrics ship when the /metrics page is built.
 *
 * Layout (terminal-style with hairline panels):
 *   [ banner: GREETING + system status ]
 *   [ shortcut grid: 6 panels — one per admin domain ]
 */

import { Link } from "react-router-dom";

import "../../admin/admin.css";
import { useAdminAuth } from "../../admin/AdminAuthContext";

interface Shortcut {
  to: string;
  label: string;
  hint: string;
  hotkey: string;
}

const SHORTCUTS: Shortcut[] = [
  { to: "/admin/tickets", label: "TICKETS", hint: "Reply, close, browse the queue", hotkey: "T" },
  { to: "/admin/kb", label: "KNOWLEDGE BASE", hint: "Edit what the chatbot knows", hotkey: "K" },
  { to: "/admin/users", label: "USERS", hint: "Lookup, adjust credits, disable", hotkey: "U" },
  { to: "/admin/metrics", label: "METRICS", hint: "DAU, scans, revenue", hotkey: "M" },
];

export default function AdminHome() {
  const { me } = useAdminAuth();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <section className="t-reveal" style={{ marginBottom: 28 }}>
        <div className="t-label">SESSION INITIALIZED</div>
        <h1 className="t-h1" style={{ marginTop: 6 }}>
          Welcome back, <span className="t-mono-amber">{me?.email.split("@")[0]}</span>
          <span className="t-caret" />
        </h1>
        <p className="t-mono-dim" style={{ marginTop: 8, maxWidth: 640 }}>
          Pick a section below or use the nav above. Sensitive actions are gated and audited —
          every write you make is recorded with a reason and your admin email.
        </p>
      </section>

      <div className="t-rule" style={{ margin: "20px 0 24px" }} />

      <section
        className="t-reveal"
        data-delay="1"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 0, border: "1px solid var(--term-rule)" }}
      >
        {SHORTCUTS.map((s, i) => (
          <Link
            key={s.to}
            to={s.to}
            style={{
              padding: 20,
              borderRight: (i + 1) % 4 === 0 ? "none" : "1px solid var(--term-rule)",
              borderBottom: i < SHORTCUTS.length - (SHORTCUTS.length % 4 || 4) ? "1px solid var(--term-rule)" : "none",
              textDecoration: "none",
              color: "var(--term-fg)",
              background: "var(--term-bg-1)",
              transition: "background 80ms linear, color 80ms linear",
              display: "block",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--term-amber-faint)";
              e.currentTarget.style.color = "var(--term-amber)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--term-bg-1)";
              e.currentTarget.style.color = "var(--term-fg)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, letterSpacing: "0.16em", fontWeight: 500 }}>{s.label}</span>
              <span
                className="t-mono-mute"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "2px 6px",
                  border: "1px solid var(--term-rule)",
                }}
              >
                ⌥{s.hotkey}
              </span>
            </div>
            <div className="t-mono-dim" style={{ marginTop: 10, fontSize: 12 }}>
              {s.hint}
            </div>
          </Link>
        ))}
      </section>

      <section
        className="t-reveal"
        data-delay="2"
        style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
      >
        <div className="t-panel">
          <div className="t-panel-header">
            <span className="t-label">CONNECTION</span>
            <span className="t-tag" data-tone="green">LIVE</span>
          </div>
          <div className="t-panel-body" style={{ fontSize: 12 }}>
            <Row k="API" v={import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1"} />
            <Row k="ROLE" v={me?.role.toUpperCase() ?? "—"} />
            <Row k="EMAIL" v={me?.email ?? "—"} />
          </div>
        </div>

        <div className="t-panel">
          <div className="t-panel-header">
            <span className="t-label">REMINDERS</span>
            <span className="t-tag" data-tone="amber">OPS</span>
          </div>
          <div className="t-panel-body" style={{ fontSize: 12, color: "var(--term-fg-dim)" }}>
            <div style={{ marginBottom: 8 }}>• Every write requires a reason — it's stored in the audit log.</div>
            <div style={{ marginBottom: 8 }}>• Soft-deletes are reversible by re-enabling the user record.</div>
            <div>• Super-admin-only routes are hidden from the nav for plain admins.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid var(--term-rule)", gap: 16 }}>
      <span className="t-mono-mute" style={{ width: 80, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        {k}
      </span>
      <span className="t-mono-dim" style={{ wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}
