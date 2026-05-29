/**
 * Users list — operator's master index of every account on the platform.
 *
 * Filters along the top in a single bar:
 *   - role chip-toggle: ALL | USER | ADMIN | SUPER
 *   - state toggle: ACTIVE | DISABLED | INCLUDE DELETED
 *   - free-text search on email
 *
 * Rows show:
 *   email · role tag · plan · credits remaining · issued count · state pills
 *
 * Soft-deleted users are hidden by default and surfaced with a dim "DEL" tag
 * when "include deleted" is on.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import "../../admin/admin.css";
import { adminEndpoints, type UserRole, type UserSummary } from "../../admin/adminApi";

const PAGE_SIZE = 25;
type StateFilter = "active" | "disabled" | "all";

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

export default function AdminUsersList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const role = (params.get("role") as UserRole | null) ?? undefined;
  const stateFilter = (params.get("state") as StateFilter | null) ?? "active";
  const includeDeleted = params.get("deleted") === "1";
  const offset = parseInt(params.get("offset") ?? "0", 10) || 0;
  const q = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== q) {
        const next = new URLSearchParams(params);
        if (searchInput) next.set("q", searchInput);
        else next.delete("q");
        next.delete("offset");
        setParams(next, { replace: true });
      }
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["admin-users", { role, stateFilter, includeDeleted, q, offset }],
    queryFn: () =>
      adminEndpoints.listUsers({
        role,
        is_disabled:
          stateFilter === "disabled" ? true : stateFilter === "active" ? false : undefined,
        include_deleted: includeDeleted,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    keepPreviousData: true,
  });

  function patchParams(updater: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    updater(next);
    next.delete("offset");
    setParams(next, { replace: true });
  }

  const users = useMemo<UserSummary[]>(() => query.data?.users ?? [], [query.data]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <header
        className="t-reveal"
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}
      >
        <div>
          <div className="t-label">PLATFORM DIRECTORY</div>
          <h1 className="t-h1" style={{ marginTop: 4 }}>Users</h1>
        </div>
        <span className="t-mono-dim" style={{ fontSize: 11, letterSpacing: "0.1em" }}>
          {query.data ? `${query.data.total} MATCHING` : ""}
        </span>
      </header>

      {/* Filters bar */}
      <div
        className="t-reveal"
        data-delay="1"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          padding: "10px 14px",
          border: "1px solid var(--term-rule)",
          background: "var(--term-bg-1)",
          flexWrap: "wrap",
        }}
      >
        <span className="t-label">ROLE</span>
        <ChipToggle
          options={[
            { label: "ALL", value: undefined },
            { label: "USER", value: "user" },
            { label: "ADMIN", value: "admin" },
            { label: "SUPER", value: "super_admin" },
          ]}
          value={role}
          onChange={(v) =>
            patchParams((next) => {
              if (v) next.set("role", v);
              else next.delete("role");
            })
          }
        />

        <span className="t-mono-mute" style={{ margin: "0 4px" }}>·</span>

        <span className="t-label">STATE</span>
        <ChipToggle
          options={[
            { label: "ACTIVE", value: "active" },
            { label: "DISABLED", value: "disabled" },
            { label: "ALL", value: "all" },
          ]}
          value={stateFilter}
          onChange={(v) => patchParams((next) => next.set("state", v))}
        />

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: includeDeleted ? "var(--term-amber)" : "var(--term-fg-mute)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) =>
              patchParams((next) => {
                if (e.target.checked) next.set("deleted", "1");
                else next.delete("deleted");
              })
            }
            style={{ accentColor: "var(--term-amber)" }}
          />
          INCLUDE DELETED
        </label>

        <span style={{ flex: "1 1 200px" }} />

        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by email…"
          className="t-input"
          style={{ width: 280, padding: "6px 10px", fontSize: 12 }}
        />
      </div>

      {/* Table */}
      <div className="t-reveal" data-delay="2" style={{ border: "1px solid var(--term-rule)" }}>
        <table className="t-table">
          <thead>
            <tr>
              <th style={{ width: 280 }}>EMAIL</th>
              <th style={{ width: 90 }}>ROLE</th>
              <th style={{ width: 80 }}>PLAN</th>
              <th style={{ width: 110, textAlign: "right" }}>CREDITS</th>
              <th style={{ width: 110, textAlign: "right" }}>ISSUED</th>
              <th>STATE</th>
              <th style={{ width: 130 }}>CREATED</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: 28, textAlign: "center" }}>
                  <span className="t-loading t-label">LOADING USERS…</span>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--term-fg-mute)" }}>
                  {q ? `No users matching "${q}".` : "No users matching these filters."}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  data-href={`/admin/users/${u.id}`}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                >
                  <td style={{ wordBreak: "break-all" }}>{u.email}</td>
                  <td>
                    <span className="t-tag" data-tone={roleTone(u.role)}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="t-mono-dim" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {u.plan}
                  </td>
                  <td className="t-mono-amber" style={{ textAlign: "right" }}>
                    {u.credits_remaining}
                  </td>
                  <td className="t-mono-dim" style={{ textAlign: "right" }}>
                    {u.issued_count}
                  </td>
                  <td>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      {u.is_deleted ? (
                        <span className="t-tag" data-tone="red">DEL</span>
                      ) : null}
                      {u.is_disabled && !u.is_deleted ? (
                        <span className="t-tag" data-tone="red">DISABLED</span>
                      ) : null}
                      {!u.is_disabled && !u.is_deleted ? (
                        <span className="t-tag" data-tone="green">ACTIVE</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="t-mono-mute" style={{ fontSize: 11 }}>
                    {u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : "—"}
                  </td>
                </tr>
              ))
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
          <span>
            SHOWING {offset + 1}–{Math.min(offset + users.length, query.data.total)} OF {query.data.total}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="t-btn"
              style={{ padding: "4px 10px", fontSize: 10 }}
              disabled={offset === 0}
              onClick={() => patchParams((next) => next.set("offset", String(Math.max(0, offset - PAGE_SIZE))))}
            >
              ← PREV
            </button>
            <button
              className="t-btn"
              style={{ padding: "4px 10px", fontSize: 10 }}
              disabled={!query.data.has_more}
              onClick={() => patchParams((next) => next.set("offset", String(offset + PAGE_SIZE)))}
            >
              NEXT →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ChipToggleProps<T> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}
function ChipToggle<T>({ options, value, onChange }: ChipToggleProps<T>) {
  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          className="t-btn"
          data-primary={opt.value === value ? "true" : undefined}
          onClick={() => onChange(opt.value)}
          style={{ padding: "4px 10px", fontSize: 10 }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
