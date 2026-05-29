/**
 * Knowledge base list — what powers the support chatbot. Grouped by category,
 * showing slug, title, priority. Click a row to edit. New-article button
 * top-right. Delete is super-admin only and is gated by an inline confirm.
 *
 * Empty-state and search both behave identically to the tickets list.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import "../../admin/admin.css";
import { adminEndpoints, type KBArticleOut } from "../../admin/adminApi";
import { useAdminAuth } from "../../admin/AdminAuthContext";
import { ConfirmReason, formatStamp } from "../../admin/util";

export default function AdminKBList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(q);

  // Debounce search input to URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== q) {
        const next = new URLSearchParams(params);
        if (searchInput) next.set("q", searchInput);
        else next.delete("q");
        setParams(next, { replace: true });
      }
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["admin-kb", q],
    queryFn: () => adminEndpoints.listKB({ q: q || undefined }),
    keepPreviousData: true,
  });

  const [deleteTarget, setDeleteTarget] = useState<KBArticleOut | null>(null);
  const deleteMut = useMutation({
    mutationFn: (slug: string) => adminEndpoints.deleteKB(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kb"] });
      setDeleteTarget(null);
    },
  });

  const grouped = useMemo(() => {
    const articles = query.data?.articles ?? [];
    const map = new Map<string, KBArticleOut[]>();
    for (const a of articles) {
      const cat = a.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    return Array.from(map.entries()); // already priority-desc / slug-asc from backend
  }, [query.data]);

  const isSuper = me?.role === "super_admin";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header
        className="t-reveal"
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}
      >
        <div>
          <div className="t-label">CHATBOT KNOWLEDGE BASE</div>
          <h1 className="t-h1" style={{ marginTop: 4 }}>Articles</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="t-mono-dim" style={{ fontSize: 11, letterSpacing: "0.1em" }}>
            {query.data ? `${query.data.total} TOTAL` : ""}
          </span>
          <Link
            to="/admin/kb/new"
            className="t-btn"
            data-primary="true"
            style={{ textDecoration: "none" }}
          >
            + NEW ARTICLE
          </Link>
        </div>
      </header>

      {/* Filter bar */}
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
        }}
      >
        <span className="t-label" style={{ marginRight: 6 }}>SEARCH</span>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Title or content substring…"
          className="t-input"
          style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
        />
      </div>

      {/* Grouped table */}
      {query.isLoading ? (
        <span className="t-loading t-label">LOADING ARTICLES…</span>
      ) : grouped.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--term-rule)",
            padding: 28,
            textAlign: "center",
            color: "var(--term-fg-mute)",
            fontSize: 12,
          }}
        >
          {q ? `No articles matching "${q}".` : "Knowledge base is empty. Click + NEW ARTICLE to add one."}
        </div>
      ) : (
        <div className="t-reveal" data-delay="2" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {grouped.map(([category, articles]) => (
            <section key={category}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                  paddingBottom: 6,
                  borderBottom: "1px solid var(--term-rule)",
                }}
              >
                <span className="t-label" style={{ color: "var(--term-amber)" }}>
                  ╱ {category.toUpperCase()}
                </span>
                <span className="t-mono-mute" style={{ fontSize: 10, letterSpacing: "0.08em" }}>
                  ({articles.length})
                </span>
              </div>

              <table className="t-table" style={{ border: "1px solid var(--term-rule)" }}>
                <thead>
                  <tr>
                    <th style={{ width: 220 }}>SLUG</th>
                    <th>TITLE</th>
                    <th style={{ width: 90, textAlign: "right" }}>PRIORITY</th>
                    <th style={{ width: 180 }}>UPDATED</th>
                    <th style={{ width: 70, textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr
                      key={a.slug}
                      data-href={`/admin/kb/${a.slug}`}
                      onClick={(e) => {
                        // Don't navigate when clicking the action buttons cell
                        const target = e.target as HTMLElement;
                        if (target.closest("[data-action]")) return;
                        navigate(`/admin/kb/${a.slug}`);
                      }}
                    >
                      <td className="t-mono-amber">{a.slug}</td>
                      <td>{a.title}</td>
                      <td className="t-mono-dim" style={{ textAlign: "right" }}>{a.priority}</td>
                      <td className="t-mono-dim" title={formatStamp(a.updated_at)}>
                        {a.updated_at ? formatStamp(a.updated_at) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }} data-action>
                          <Link
                            to={`/admin/kb/${a.slug}`}
                            className="t-btn"
                            style={{ padding: "3px 8px", fontSize: 10, textDecoration: "none" }}
                          >
                            EDIT
                          </Link>
                          {isSuper ? (
                            <button
                              className="t-btn"
                              data-tone="red"
                              style={{ padding: "3px 8px", fontSize: 10 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(a);
                              }}
                            >
                              DEL
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {/* Inline delete confirmation — super-admin only path */}
      {deleteTarget ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
          onClick={() => !deleteMut.isPending && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--term-bg)",
              border: "1px solid var(--term-red)",
              padding: 22,
              minWidth: 420,
              maxWidth: 520,
            }}
          >
            <div className="t-label" style={{ color: "var(--term-red)", marginBottom: 10 }}>
              SUPER · DELETE ARTICLE
            </div>
            <div style={{ fontSize: 13, marginBottom: 14, color: "var(--term-fg)" }}>
              Permanently delete <span className="t-mono-amber">{deleteTarget.slug}</span>?
            </div>
            <div
              className="t-mono-dim"
              style={{
                fontSize: 11,
                letterSpacing: "0.04em",
                marginBottom: 14,
                padding: 10,
                border: "1px dashed var(--term-rule)",
              }}
            >
              {deleteTarget.title}
              <br />
              <span className="t-mono-mute">— {deleteTarget.content.slice(0, 160)}{deleteTarget.content.length > 160 ? "…" : ""}</span>
            </div>
            <ConfirmReason
              title="this cannot be undone"
              confirmLabel="DELETE PERMANENTLY"
              tone="red"
              submitting={deleteMut.isPending}
              onConfirm={() => deleteMut.mutate(deleteTarget.slug)}
              onCancel={() => setDeleteTarget(null)}
            />
            {deleteMut.isError ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "var(--term-red)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                ⚠ Delete failed.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
