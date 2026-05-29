import { api } from "@/services/api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TicketRequest {
  message: string;
  conversation_history: ChatMessage[];
}

export interface TicketResponse {
  ok: boolean;
  ticket_id: string;
}

export interface ThreadMessage extends ChatMessage {
  ts: string | null;
}

export interface Thread {
  thread_id: string;
  messages: ThreadMessage[];
  created_at: string | null;
  updated_at: string | null;
}

// SSE events surfaced to callers of `streamSupport`. Mirrors the backend
// event schema (`event: meta | token | done | error`).
export type StreamEvent =
  | { type: "meta"; thread_id: string | null }
  | { type: "token"; delta: string }
  | { type: "done"; confident: boolean }
  | { type: "error"; message: string };

// ── Base URL / auth helpers ────────────────────────────────────────────────

const DEFAULT_BASE_URL = "http://localhost:8000/api/v1";
const baseURL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Threads ────────────────────────────────────────────────────────────────

/** Most recent thread for the signed-in user, or null if none exists. */
export async function getCurrentThread(): Promise<Thread | null> {
  try {
    const res = await api.get<Thread>("/support/threads/current");
    return res.data;
  } catch (err: unknown) {
    if (isAxiosNotFound(err)) return null;
    throw err;
  }
}

// Note: there used to be a `createThread()` here that called
// POST /support/threads/new, but threads are created lazily by the chat
// endpoint when an authed caller omits thread_id. The "New conversation"
// affordance just clears the client-side thread_id; the next outbound
// message generates a fresh thread server-side.

function isAxiosNotFound(err: unknown): boolean {
  // Avoid pulling axios isAxiosError just for one shape — works for our case.
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 404
  );
}

// ── Streaming chat ─────────────────────────────────────────────────────────

interface StreamChatParams {
  message: string;
  history: ChatMessage[];
  threadId?: string | null;
  signal?: AbortSignal;
}

/**
 * Open an SSE stream to /support/chat and yield parsed events.
 *
 * Sends bearer auth automatically if a token is in localStorage; otherwise
 * the request is anonymous and the backend won't expose tools.
 */
export async function* streamSupport(
  params: StreamChatParams
): AsyncGenerator<StreamEvent, void, unknown> {
  const res = await fetch(`${baseURL}/support/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeaders(),
    },
    body: JSON.stringify({
      message: params.message,
      history: params.history,
      thread_id: params.threadId ?? null,
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    let detail = "Chat request failed.";
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      // body wasn't JSON — keep the default
    }
    yield { type: "error", message: detail };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE frames (separated by a blank line).
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseSseFrame(frame);
      if (parsed) yield parsed;
    }
  }

  // Flush a trailing frame without a final blank line, just in case.
  if (buffer.trim().length > 0) {
    const parsed = parseSseFrame(buffer);
    if (parsed) yield parsed;
  }
}

function parseSseFrame(frame: string): StreamEvent | null {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  const p = payload as Record<string, unknown>;
  switch (event) {
    case "meta":
      return { type: "meta", thread_id: (p.thread_id as string | null) ?? null };
    case "token":
      return { type: "token", delta: String(p.delta ?? "") };
    case "done":
      return { type: "done", confident: Boolean(p.confident) };
    case "error":
      return { type: "error", message: String(p.message ?? "Unknown error") };
    default:
      return null;
  }
}

// ── Tickets ────────────────────────────────────────────────────────────────

export async function createSupportTicket(
  payload: TicketRequest
): Promise<TicketResponse> {
  const res = await api.post<TicketResponse>("/support/ticket", payload);
  return res.data;
}

// ── My tickets (customer-facing inbox) ─────────────────────────────────────

export type TicketStatus = "open" | "closed";

export interface MyTicketSummary {
  ticket_id: string;
  status: TicketStatus;
  message_preview: string;
  created_at: string;
  closed_at: string | null;
  reply_count: number;
  last_reply_at: string | null;
}

export interface MyTicketReply {
  role: "admin" | "user";
  author_email: string;
  content: string;
  ts: string;
}

export interface MyTicketChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface MyTicketDetail {
  ticket_id: string;
  status: TicketStatus;
  message: string;
  conversation_history: MyTicketChatTurn[];
  replies: MyTicketReply[];
  created_at: string;
  closed_at: string | null;
}

export interface MyTicketListResponse {
  tickets: MyTicketSummary[];
  total: number;
  has_more: boolean;
}

export interface ListMyTicketsParams {
  status?: TicketStatus;
  limit?: number;
  offset?: number;
}

export async function listMyTickets(
  params: ListMyTicketsParams = {}
): Promise<MyTicketListResponse> {
  const res = await api.get<MyTicketListResponse>("/support/tickets", { params });
  return res.data;
}

export async function getMyTicket(ticketId: string): Promise<MyTicketDetail> {
  const res = await api.get<MyTicketDetail>(`/support/tickets/${ticketId}`);
  return res.data;
}

/**
 * Customer posts a reply on their own ticket. If the ticket was closed,
 * sending a reply auto-reopens it. Returns the updated ticket so the caller
 * can drop it straight into the query cache.
 */
export async function replyToMyTicket(
  ticketId: string,
  content: string
): Promise<MyTicketDetail> {
  const res = await api.post<MyTicketDetail>(
    `/support/tickets/${ticketId}/reply`,
    { content }
  );
  return res.data;
}
