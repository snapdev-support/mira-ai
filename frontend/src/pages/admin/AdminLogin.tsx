/**
 * Admin login screen. Visually distinct from /login so there's zero chance
 * of confusing the two surfaces. Pure terminal: ASCII-style banner, mono
 * input fields, blinking caret on the active prompt.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import "../../admin/admin.css";
import { useAdminAuth } from "../../admin/AdminAuthContext";

interface FromState {
  from?: string;
}

export default function AdminLogin() {
  const { login, status, me } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as FromState | null)?.from ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  if (status === "authenticated" && me) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      // Backend returns 401 on bad creds, 403 on plain-user role hitting /me
      const status_ = (err as { response?: { status?: number } } | null)?.response?.status;
      if (status_ === 401) setError("Invalid credentials.");
      else if (status_ === 403) setError("Account lacks admin access.");
      else setError("Login failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-shell t-grid-bg" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, padding: 32 }}>
        {/* ASCII-style banner */}
        <pre
          className="t-mono-amber t-reveal"
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            margin: 0,
            color: "var(--term-amber)",
            letterSpacing: "0.04em",
          }}
        >{`╔════════════════════════════════════════════╗
║   MIRATRUST  /  ADMIN CONSOLE              ║
║   restricted · staff access only           ║
╚════════════════════════════════════════════╝`}</pre>

        <div
          className="t-reveal"
          data-delay="1"
          style={{ marginTop: 14, fontSize: 11, color: "var(--term-fg-mute)", letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          Authentication required<span className="t-caret" />
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
          <div className="t-reveal" data-delay="2" style={{ marginBottom: 18 }}>
            <label className="t-label" style={{ display: "block", marginBottom: 6 }}>
              EMAIL
            </label>
            <input
              ref={emailRef}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="t-input"
              placeholder="staff@miratrust.ai"
            />
          </div>

          <div className="t-reveal" data-delay="3" style={{ marginBottom: 22 }}>
            <label className="t-label" style={{ display: "block", marginBottom: 6 }}>
              PASSWORD
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="t-input"
              placeholder="········"
            />
          </div>

          {error ? (
            <div
              className="t-reveal"
              role="alert"
              style={{
                marginBottom: 18,
                padding: "8px 12px",
                border: "1px solid var(--term-red)",
                background: "var(--term-red-faint)",
                color: "var(--term-red)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              ⚠ {error}
            </div>
          ) : null}

          <div className="t-reveal" data-delay="4" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" className="t-btn" data-primary="true" disabled={submitting}>
              {submitting ? "AUTHENTICATING…" : "AUTHENTICATE →"}
            </button>
            <span className="t-mono-mute" style={{ fontSize: 10, letterSpacing: "0.12em" }}>
              ENTER to submit
            </span>
          </div>
        </form>

        <div
          className="t-reveal"
          data-delay="4"
          style={{
            marginTop: 48,
            paddingTop: 16,
            borderTop: "1px solid var(--term-rule)",
            fontSize: 10,
            color: "var(--term-fg-mute)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Not for customers</span>
          <span>All actions are logged</span>
        </div>
      </div>
    </div>
  );
}
