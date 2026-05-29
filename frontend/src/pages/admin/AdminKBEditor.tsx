/**
 * KB article editor. Handles both create and edit modes by branching on
 * whether the slug route param is "new" or an existing slug.
 *
 * UI design — terminal-form pattern:
 *   - Each field has a leading dim "▍ FIELD_NAME" tag in the gutter
 *   - Slug is read-only after creation (immutable per backend spec)
 *   - Live "preview" panel on the right shows how the article will render
 *     to the chatbot when loaded into the system prompt
 *   - Save & Cancel sit at the bottom with consistent t-btn styling
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import "../../admin/admin.css";
import { adminEndpoints, type KBArticleIn, type KBArticleUpdate } from "../../admin/adminApi";
import { BackLink, formatStamp } from "../../admin/util";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

interface FormState {
  slug: string;
  title: string;
  category: string;
  content: string;
  priority: number;
}

const EMPTY: FormState = { slug: "", title: "", category: "General", content: "", priority: 50 };

export default function AdminKBEditor() {
  const { slug } = useParams<{ slug: string }>();
  const isCreate = !slug || slug === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = useQuery({
    enabled: !isCreate,
    queryKey: ["admin-kb-article", slug],
    queryFn: () => adminEndpoints.getKB(slug!),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  // Populate the form once existing data loads
  useEffect(() => {
    if (!isCreate && existing.data) {
      setForm({
        slug: existing.data.slug,
        title: existing.data.title,
        category: existing.data.category || "General",
        content: existing.data.content,
        priority: existing.data.priority,
      });
    }
  }, [isCreate, existing.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isCreate) {
        const payload: KBArticleIn = {
          slug: form.slug,
          title: form.title,
          category: form.category,
          content: form.content,
          priority: form.priority,
        };
        return adminEndpoints.createKB(payload);
      } else {
        const payload: KBArticleUpdate = {
          title: form.title,
          category: form.category,
          content: form.content,
          priority: form.priority,
        };
        return adminEndpoints.updateKB(slug!, payload);
      }
    },
    onSuccess: (article) => {
      qc.invalidateQueries({ queryKey: ["admin-kb"] });
      qc.invalidateQueries({ queryKey: ["admin-kb-article", article.slug] });
      navigate("/admin/kb");
    },
  });

  // Client-side guardrails before posting.
  function validateAndSubmit() {
    setFormError(null);

    if (isCreate) {
      if (!form.slug.trim()) return setFormError("Slug is required.");
      if (!SLUG_PATTERN.test(form.slug)) {
        return setFormError("Slug must be lowercase alphanumerics or hyphens, starting with a letter or digit.");
      }
    }
    if (!form.title.trim()) return setFormError("Title is required.");
    if (!form.category.trim()) return setFormError("Category is required.");
    if (!form.content.trim()) return setFormError("Content cannot be empty.");
    if (form.content.length > 8000) return setFormError("Content exceeds 8000 characters.");
    if (form.priority < 0 || form.priority > 1000) return setFormError("Priority must be 0–1000.");

    saveMut.mutate();
  }

  const isLoading = !isCreate && existing.isLoading;
  const renderedPreview = useMemo(() => {
    // How the bot ingests it: ## CATEGORY \n ### TITLE \n CONTENT
    return `## ${form.category || "—"}\n### ${form.title || "(untitled)"}\n${form.content || ""}`.trim();
  }, [form]);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <BackLink to="/admin/kb" label="back to articles" />
        <div style={{ marginTop: 20 }}>
          <span className="t-loading t-label">LOADING ARTICLE…</span>
        </div>
      </div>
    );
  }

  if (!isCreate && existing.isError) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <BackLink to="/admin/kb" label="back to articles" />
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
          ⚠ Article not found.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="t-reveal" style={{ marginBottom: 6 }}>
        <BackLink to="/admin/kb" label="back to articles" />
      </div>

      <header
        className="t-reveal"
        data-delay="1"
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "8px 0 20px" }}
      >
        <div>
          <div className="t-label">{isCreate ? "NEW KB ARTICLE" : "EDIT KB ARTICLE"}</div>
          <h1 className="t-h1" style={{ marginTop: 4 }}>
            {isCreate ? "New article" : <span className="t-mono-amber">{form.slug || slug}</span>}
          </h1>
        </div>
        {!isCreate && existing.data ? (
          <div className="t-mono-mute" style={{ fontSize: 10, letterSpacing: "0.1em" }}>
            UPDATED {formatStamp(existing.data.updated_at)}
          </div>
        ) : null}
      </header>

      <div className="t-reveal" data-delay="2" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 22 }}>
        {/* ── Form column ─────────────────────────────────────────────── */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            validateAndSubmit();
          }}
          style={{ border: "1px solid var(--term-rule)", padding: 18, background: "var(--term-bg-1)" }}
        >
          <FormRow label="SLUG" hint={isCreate ? "lowercase, dashes ok · permanent after save" : "immutable"}>
            <input
              className="t-input"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
              disabled={!isCreate || saveMut.isPending}
              placeholder="e.g. credits-basics"
            />
          </FormRow>

          <FormRow label="TITLE" hint="user-facing heading">
            <input
              className="t-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={saveMut.isPending}
              placeholder="How credits work"
              maxLength={200}
            />
          </FormRow>

          <FormRow label="CATEGORY" hint="groups the article in the chatbot's view">
            <input
              className="t-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              disabled={saveMut.isPending}
              placeholder="Credits & Billing"
              maxLength={80}
            />
          </FormRow>

          <FormRow label="PRIORITY" hint="higher = appears earlier · 0–1000 · default 50">
            <input
              type="number"
              className="t-input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
              disabled={saveMut.isPending}
              min={0}
              max={1000}
              step={5}
            />
          </FormRow>

          <FormRow
            label="CONTENT"
            hint={`max 8000 chars · ${form.content.length}/${8000}`}
          >
            <textarea
              className="t-input"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              disabled={saveMut.isPending}
              placeholder="Plain text. Newlines and dashes welcome. This is what the bot reads verbatim."
              rows={12}
              maxLength={8000}
            />
          </FormRow>

          {formError ? (
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
              ⚠ {formError}
            </div>
          ) : null}

          {saveMut.isError ? (
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
              ⚠ Save failed.{" "}
              {(saveMut.error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
                "Check the slug or try again."}
            </div>
          ) : null}

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button type="submit" className="t-btn" data-primary="true" disabled={saveMut.isPending}>
              {saveMut.isPending ? "SAVING…" : isCreate ? "CREATE ARTICLE →" : "SAVE CHANGES →"}
            </button>
            <button
              type="button"
              className="t-btn"
              onClick={() => navigate("/admin/kb")}
              disabled={saveMut.isPending}
            >
              CANCEL
            </button>
          </div>
        </form>

        {/* ── Preview column ──────────────────────────────────────────── */}
        <aside>
          <div className="t-label" style={{ marginBottom: 8 }}>
            CHATBOT PREVIEW · injected into the system prompt
          </div>
          <pre
            style={{
              border: "1px solid var(--term-rule)",
              padding: 14,
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--term-fg-dim)",
              background: "var(--term-bg)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              minHeight: 220,
            }}
          >
{renderedPreview}
          </pre>
          <div
            className="t-mono-mute"
            style={{
              marginTop: 10,
              fontSize: 10,
              letterSpacing: "0.1em",
              lineHeight: 1.6,
            }}
          >
            • Articles are sorted by (priority desc, slug asc) at runtime.
            <br />• Caching kicks in automatically once the KB grows past ~4000 tokens.
            <br />• Edits take effect on the next chat request — no redeploy.
          </div>
        </aside>
      </div>
    </div>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="t-label">▍ {label}</span>
        {hint ? (
          <span className="t-mono-mute" style={{ fontSize: 10, letterSpacing: "0.08em" }}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
