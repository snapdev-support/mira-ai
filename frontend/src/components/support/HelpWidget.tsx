import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  TicketCheck,
  ChevronDown,
  Bot,
} from "lucide-react";
import {
  createSupportTicket,
  getCurrentThread,
  streamSupport,
} from "@/services/supportApi";
import type { ChatMessage } from "@/services/supportApi";

// ── Types ──────────────────────────────────────────────────────────────────

interface Message extends ChatMessage {
  id: string;
  timestamp: Date;
}

type FeedbackState = null | "positive" | "negative";
type EscalationState = "idle" | "confirming" | "submitting" | "done";

// ── Constants ──────────────────────────────────────────────────────────────

const QUICK_TOPICS = [
  "How do credits work?",
  "I can't generate a QR code",
  "Payment or billing issue",
  "Verification isn't working",
];

function isSignedIn(): boolean {
  return Boolean(localStorage.getItem("token"));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <BotAvatar />
      <div
        className="px-3.5 py-2.5 flex items-center gap-1"
        style={{
          background: "var(--color-bg-light)",
          border: "1px solid var(--color-border)",
          borderRadius: "12px 12px 12px 2px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{
              background: "var(--color-muted)",
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div
      className="w-7 h-7 flex items-center justify-center flex-shrink-0 mb-0.5"
      style={{
        background: "var(--color-accent)",
        borderRadius: 8,
      }}
    >
      <Bot className="w-3.5 h-3.5" style={{ color: "var(--color-accent-fg)" }} />
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && <BotAvatar />}
      <div
        className="max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed"
        style={{
          background: isUser ? "var(--color-accent)" : "var(--color-bg-light)",
          color: isUser ? "var(--color-accent-fg)" : "var(--color-text)",
          border: isUser ? "none" : "1px solid var(--color-border)",
          borderRadius: isUser
            ? "12px 12px 2px 12px"
            : "12px 12px 12px 2px",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.content || "​"}
      </div>
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────────────

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [escalation, setEscalation] = useState<EscalationState>("idle");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadHydrated, setThreadHydrated] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom on new messages or streamed deltas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when panel opens; hydrate thread once per session if authed.
  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 100);
    setUnread(false);
    if (!threadHydrated && isSignedIn()) {
      setThreadHydrated(true);
      void getCurrentThread()
        .then((thread) => {
          if (!thread) return;
          setThreadId(thread.thread_id);
          if (thread.messages.length > 0) {
            setMessages(
              thread.messages.map((m, i) => ({
                id: `restored_${i}_${Date.now()}`,
                role: m.role,
                content: m.content,
                timestamp: m.ts ? new Date(m.ts) : new Date(),
              }))
            );
          }
        })
        .catch(() => {
          // Non-fatal — user can still chat, just without restored context.
        });
    }
  }, [open, threadHydrated]);

  // Cancel any in-flight stream when the widget unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const addMessage = (role: "user" | "assistant", content: string): string => {
    const id = `msg_${Date.now()}_${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      { id, role, content, timestamp: new Date() },
    ]);
    return id;
  };

  const appendToMessage = (id: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m))
    );
  };

  const replaceMessageContent = (id: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content } : m))
    );
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setFeedback(null);
    setEscalation("idle");

    // Snapshot history BEFORE adding the new user message so we don't pass
    // the just-sent turn twice (backend prepends it as the user message).
    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    addMessage("user", trimmed);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let assistantId: string | null = null;
    let sawError = false;
    let confident = true;

    try {
      for await (const ev of streamSupport({
        message: trimmed,
        history,
        threadId,
        signal: controller.signal,
      })) {
        if (ev.type === "meta") {
          if (ev.thread_id && ev.thread_id !== threadId) {
            setThreadId(ev.thread_id);
          }
        } else if (ev.type === "token") {
          if (assistantId === null) {
            assistantId = addMessage("assistant", ev.delta);
            setStreamingId(assistantId);
          } else {
            appendToMessage(assistantId, ev.delta);
          }
        } else if (ev.type === "done") {
          confident = ev.confident;
        } else if (ev.type === "error") {
          sawError = true;
          if (assistantId) {
            replaceMessageContent(assistantId, ev.message);
          } else {
            assistantId = addMessage("assistant", ev.message);
          }
        }
      }
    } catch (err) {
      // Network error / aborted. AbortError is silent; everything else surfaces.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        sawError = true;
        const fallback =
          "I'm having trouble connecting right now. Please try again or create a support ticket.";
        if (assistantId) {
          replaceMessageContent(assistantId, fallback);
        } else {
          addMessage("assistant", fallback);
        }
      }
    } finally {
      setStreamingId(null);
      setLoading(false);
    }

    if (sawError || !confident) {
      setEscalation("confirming");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleEscalate = async () => {
    setEscalation("submitting");
    try {
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const firstUserMsg =
        messages.find((m) => m.role === "user")?.content ?? "Support request";
      const res = await createSupportTicket({
        message: firstUserMsg,
        conversation_history: history,
      });
      setTicketId(res.ticket_id);
      setEscalation("done");
    } catch {
      setEscalation("confirming");
      addMessage(
        "assistant",
        "Failed to create a ticket. Please email us directly at support@miratrust.ai."
      );
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setFeedback(null);
    setEscalation("idle");
    setTicketId(null);
    // Clear thread_id so the next message lazily creates a fresh thread on
    // the server. We don't pre-create here — saves a round trip and avoids
    // orphan empty threads when the user closes the widget without sending.
    setThreadId(null);
  };

  const hasMessages = messages.length > 0;
  const showTypingDots = loading && streamingId === null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      {/* Panel */}
      {open && (
        <div
          className="flex flex-col shadow-2xl border overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{
            width: 360,
            maxHeight: "min(520px, calc(100vh - 120px))",
            background: "var(--color-bg-card)",
            borderColor: "var(--color-border)",
            borderRadius: 16,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-bg-card)",
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ background: "var(--color-accent)", borderRadius: 10 }}
            >
              <Bot className="w-4 h-4" style={{ color: "var(--color-accent-fg)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none" style={{ color: "var(--color-text)" }}>
                MiraTrust Support
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-muted)" }}>
                AI-powered · usually instant
              </p>
            </div>
            <div className="flex items-center gap-1">
              {hasMessages && (
                <button
                  onClick={handleReset}
                  title="New conversation"
                  className="flex items-center justify-center w-7 h-7 transition-colors rounded-md"
                  style={{ color: "var(--color-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--color-muted)")}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-7 h-7 transition-colors rounded-md"
                style={{ color: "var(--color-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--color-muted)")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar" style={{ minHeight: 0 }}>
            {!hasMessages ? (
              <WelcomeState onTopic={sendMessage} />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {showTypingDots && <TypingIndicator />}

                {/* Feedback row (after last assistant message, only when idle) */}
                {!loading && hasMessages && messages[messages.length - 1]?.role === "assistant" && feedback === null && escalation === "idle" && (
                  <FeedbackRow
                    onPositive={() => setFeedback("positive")}
                    onNegative={() => { setFeedback("negative"); setEscalation("confirming"); }}
                  />
                )}

                {feedback === "positive" && (
                  <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>
                    Glad that helped! 👍
                  </p>
                )}

                {/* Escalation */}
                {escalation === "confirming" && (
                  <EscalationPrompt
                    onEscalate={handleEscalate}
                    onDismiss={() => setEscalation("idle")}
                  />
                )}

                {escalation === "submitting" && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating ticket…
                  </div>
                )}

                {escalation === "done" && ticketId && (
                  <TicketConfirmation ticketId={ticketId} />
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3 py-3 border-t flex-shrink-0"
            style={{ borderColor: "var(--color-border)" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              disabled={loading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
              style={{ color: "var(--color-text)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex items-center justify-center w-8 h-8 flex-shrink-0 transition-opacity disabled:opacity-30"
              style={{
                background: "var(--color-accent)",
                color: "var(--color-accent-fg)",
                borderRadius: 8,
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              }}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-13 h-13 shadow-lg transition-transform duration-150 active:scale-95"
        style={{
          width: 52,
          height: 52,
          background: "var(--color-accent)",
          color: "var(--color-accent-fg)",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        }}
        title="Help & Support"
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
        {unread && !open && (
          <span
            className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full border-2"
            style={{
              background: "#ef4444",
              borderColor: "var(--color-bg)",
            }}
          />
        )}
      </button>
    </div>
  );
}

// ── Welcome state ──────────────────────────────────────────────────────────

function WelcomeState({ onTopic }: { onTopic: (t: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Hi there! 👋
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Ask me anything about MiraTrust — credits, QR codes, billing, or verification.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)", opacity: 0.6 }}>
          Common questions
        </p>
        <div className="flex flex-col gap-2">
          {QUICK_TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => onTopic(topic)}
              className="text-left text-sm px-3 py-2.5 border transition-colors"
              style={{
                background: "var(--color-bg)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                borderRadius: 8,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent-40)";
                (e.currentTarget as HTMLElement).style.background = "var(--color-accent-8)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.background = "var(--color-bg)";
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Feedback row ───────────────────────────────────────────────────────────

function FeedbackRow({
  onPositive,
  onNegative,
}: {
  onPositive: () => void;
  onNegative: () => void;
}) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
        Was this helpful?
      </span>
      <button
        onClick={onPositive}
        className="flex items-center gap-1 text-xs px-2 py-1 border rounded-md transition-colors"
        style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", background: "transparent" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "#10b981";
          (e.currentTarget as HTMLElement).style.color = "#10b981";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-muted)";
        }}
      >
        <ThumbsUp className="w-3 h-3" /> Yes
      </button>
      <button
        onClick={onNegative}
        className="flex items-center gap-1 text-xs px-2 py-1 border rounded-md transition-colors"
        style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", background: "transparent" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "#ef4444";
          (e.currentTarget as HTMLElement).style.color = "#ef4444";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-muted)";
        }}
      >
        <ThumbsDown className="w-3 h-3" /> No
      </button>
    </div>
  );
}

// ── Escalation prompt ──────────────────────────────────────────────────────

function EscalationPrompt({
  onEscalate,
  onDismiss,
}: {
  onEscalate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 p-3 border"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
        borderRadius: 10,
      }}
    >
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Sorry I couldn't fully help. Want to create a support ticket? A team member will follow up by email.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onEscalate}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 transition-opacity hover:opacity-80"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-fg)",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
          }}
        >
          <TicketCheck className="w-3.5 h-3.5" />
          Create Ticket
        </button>
        <button
          onClick={onDismiss}
          className="text-xs px-3 py-1.5 border transition-colors"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-muted)",
            background: "transparent",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Ticket confirmation ────────────────────────────────────────────────────

function TicketConfirmation({ ticketId }: { ticketId: string }) {
  return (
    <div
      className="flex items-start gap-3 p-3 border"
      style={{
        background: "rgba(16,185,129,0.06)",
        borderColor: "rgba(16,185,129,0.25)",
        borderRadius: 10,
      }}
    >
      <TicketCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#10b981" }} />
      <div>
        <p className="text-xs font-semibold" style={{ color: "#10b981" }}>
          Ticket created
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
          Ref: <span className="font-mono">{ticketId}</span>. We'll follow up by email soon.
        </p>
      </div>
    </div>
  );
}
