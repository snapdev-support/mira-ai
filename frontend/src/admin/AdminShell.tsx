/**
 * Operator-Terminal shell for /admin/*. Everything inside is dark, monospace,
 * and styled by admin.css via the `.admin-shell` class on the root <div>.
 *
 * Layout:
 *   [ status-bar header — brand, breadcrumb, live UTC clock, profile/logout ]
 *   [ section nav — TICKETS | KB | USERS | CLAIMS | METRICS | AUDIT       ]
 *   [ content (Outlet)                                                      ]
 */

import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import "./admin.css";
import { useAdminAuth } from "./AdminAuthContext";

interface NavItem {
  to: string;
  label: string;
  superOnly?: boolean;
  /** Alt+<key> jumps here from anywhere in the admin console. Shown as ⌥<KEY>. */
  hotkey?: string;
}

const NAV: NavItem[] = [
  { to: "/admin/tickets", label: "TICKETS", hotkey: "T" },
  { to: "/admin/kb", label: "KB", hotkey: "K" },
  { to: "/admin/users", label: "USERS", hotkey: "U" },
  { to: "/admin/metrics", label: "METRICS", hotkey: "M" },
  { to: "/admin/audit", label: "AUDIT", superOnly: true, hotkey: "A" },
];

// Hotkeys that don't appear in the nav but are operator-useful. H sends you
// home; ? would normally open a help overlay (deferred).
const EXTRA_HOTKEYS: { key: string; to: string }[] = [
  { key: "H", to: "/admin" },
];

/**
 * Wire Alt+<key> shortcuts to navigation. Skips when focus is in an editable
 * field (input/textarea/contenteditable) so admins can type "M" in a reply
 * without getting yanked to the metrics page. Also bails out if other
 * modifiers are pressed so we don't fight browser/OS combos.
 */
function useAdminHotkeys(isSuperAdmin: boolean) {
  const navigate = useNavigate();

  useEffect(() => {
    function isEditable(el: unknown): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // Check both the event target (real keypresses) and the active element
      // (defensive — covers edge cases where target is window or document).
      if (isEditable(e.target) || isEditable(document.activeElement)) return;
      // `e.key` on Mac becomes a special char when Option is held (Alt+T → "†").
      // Use `e.code` instead — "KeyT" stays stable regardless of OS layer.
      if (!e.code.startsWith("Key")) return;
      const letter = e.code.slice(3); // "KeyT" → "T"

      const navHit = NAV.find((n) => n.hotkey === letter && (!n.superOnly || isSuperAdmin));
      if (navHit) {
        e.preventDefault();
        navigate(navHit.to);
        return;
      }
      const extraHit = EXTRA_HOTKEYS.find((h) => h.key === letter);
      if (extraHit) {
        e.preventDefault();
        navigate(extraHit.to);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, isSuperAdmin]);
}

function useUtcClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    const iso = now.toISOString();
    // HH:MM:SS UTC — matches the mock
    return `${iso.slice(11, 19)} UTC`;
  }, [now]);
}

export default function AdminShell() {
  const { me, logout } = useAdminAuth();
  const clock = useUtcClock();
  const location = useLocation();

  useAdminHotkeys(me?.role === "super_admin");

  // Derive a breadcrumb token from the URL for the header.
  const crumb = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean); // ["admin", ...]
    if (parts.length <= 1) return "HOME";
    return parts.slice(1).join(" / ").toUpperCase();
  }, [location.pathname]);

  const visibleNav = NAV.filter((n) => !n.superOnly || me?.role === "super_admin");

  return (
    <div className="admin-shell">
      {/* Status bar */}
      <div className="t-statusbar">
        <span className="brand">MIRATRUST / ADMIN</span>
        <span className="t-mono-mute">::</span>
        <span className="t-mono-dim">{crumb}</span>
        <span style={{ flex: 1 }} />
        {me ? (
          <>
            <span className="t-mono-dim" title={me.email}>
              {me.email}
            </span>
            <span className="t-tag" data-tone={me.role === "super_admin" ? "amber" : "mute"}>
              {me.role === "super_admin" ? "SUPER" : "ADMIN"}
            </span>
            <button className="t-btn" onClick={logout} style={{ padding: "4px 10px", fontSize: 10 }}>
              LOGOUT
            </button>
          </>
        ) : null}
        <span className="t-mono-amber" style={{ minWidth: 84, textAlign: "right" }}>
          {clock}
        </span>
      </div>

      {/* Section nav */}
      <nav
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--term-rule-strong)",
          background: "var(--term-bg)",
        }}
      >
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "admin-nav-link active" : "admin-nav-link")}
            style={({ isActive }) => ({
              padding: "11px 18px",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textDecoration: "none",
              color: isActive ? "var(--term-amber)" : "var(--term-fg-dim)",
              background: isActive ? "var(--term-amber-faint)" : "transparent",
              borderRight: "1px solid var(--term-rule)",
              borderBottom: isActive ? "2px solid var(--term-amber)" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "color 80ms linear, background 80ms linear",
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main
        style={{
          padding: "24px 28px",
          minHeight: "calc(100vh - 88px)",
        }}
      >
        <Outlet />
      </main>

      {/* Bottom hint bar — small touch of terminal HUD */}
      <div
        style={{
          padding: "6px 16px",
          borderTop: "1px solid var(--term-rule)",
          background: "var(--term-bg)",
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "var(--term-fg-mute)",
          textTransform: "uppercase",
          display: "flex",
          gap: 24,
        }}
      >
        <span>READY</span>
        <span>·</span>
        <span>
          ⌥H home · ⌥T tickets · ⌥K kb · ⌥U users · ⌥M metrics
          {me?.role === "super_admin" ? " · ⌥A audit" : ""}
        </span>
        <span style={{ flex: 1 }} />
        <span>v0.1 dev</span>
      </div>
    </div>
  );
}
