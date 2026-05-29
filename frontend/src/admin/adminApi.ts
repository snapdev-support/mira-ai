/**
 * Separate axios instance for the admin console.
 *
 * Why a second instance: the admin console is a deliberately separate session
 * from the customer app. A staff member can be signed in as themselves on
 * `/app/*` AND as an admin on `/admin/*` in the same browser. The two tokens
 * live under different localStorage keys so neither path leaks into the other.
 */

import axios, { AxiosHeaders } from "axios";

const DEFAULT_BASE_URL = "http://localhost:8000/api/v1";
const baseURL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;

export const ADMIN_TOKEN_KEY = "admin_token";

export const adminApi = axios.create({ baseURL });

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    config.headers = AxiosHeaders.from(config.headers ?? {});
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// On 401 from any admin endpoint, drop the token and bounce to admin login.
// Skips /auth/ so the login form can render its own "Invalid credentials"
// error instead of redirecting to itself.
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/")
    ) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "/admin/login";
    }
    return Promise.reject(error);
  }
);

// ── Types (mirror backend Pydantic models in app/models/admin.py) ─────────

export type AdminRole = "admin" | "super_admin";

export interface AdminMe {
  id: string;
  email: string;
  role: AdminRole;
  first_name: string | null;
  last_name: string | null;
}

export interface TicketSummary {
  ticket_id: string;
  user_email: string | null;
  status: "open" | "closed";
  message_preview: string;
  created_at: string;
  closed_at: string | null;
  reply_count: number;
  last_reply_at: string | null;
}

export interface TicketListResponse {
  tickets: TicketSummary[];
  total: number;
  has_more: boolean;
}

export interface TicketReply {
  role: "admin" | "user";
  author_email: string;
  // Legacy fields — populated only for admin replies; null for user replies.
  admin_id: string | null;
  admin_email: string | null;
  content: string;
  ts: string;
}

export interface TicketDetail {
  ticket_id: string;
  user_email: string | null;
  status: "open" | "closed";
  message: string;
  conversation_history: { role: "user" | "assistant"; content: string }[];
  replies: TicketReply[];
  created_at: string;
  closed_at: string | null;
  closed_by_email: string | null;
}

// ── Knowledge base ─────────────────────────────────────────────────────────

export interface KBArticleOut {
  slug: string;
  title: string;
  category: string;
  content: string;
  priority: number;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface KBListResponse {
  articles: KBArticleOut[];
  total: number;
}

export interface KBArticleIn {
  slug: string;
  title: string;
  category: string;
  content: string;
  priority?: number;
}

export interface KBArticleUpdate {
  title?: string;
  category?: string;
  content?: string;
  priority?: number;
}

// ── Users ──────────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin" | "super_admin";

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  plan: string;
  is_disabled: boolean;
  is_deleted: boolean;
  issued_count: number;
  credits_remaining: number;
  created_at: string | null;
}

export interface UserDetailStats {
  total_claims: number;
  active_claims: number;
  revoked_claims: number;
  total_scans: number;
  last_scan_at: string | null;
  last_claim_at: string | null;
}

export interface UserDetail extends UserSummary {
  first_name: string | null;
  last_name: string | null;
  stripe_customer_id: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
  deleted_at: string | null;
  stats: UserDetailStats;
}

export interface UserListResponse {
  users: UserSummary[];
  total: number;
  has_more: boolean;
}

export interface AdminClaim {
  jti: string;
  template: string | null;
  status: string | null;
  iat: string | null;
  exp: string | null;
  qr_payload: string | null;
}

export interface ClaimListResponse {
  claims: AdminClaim[];
  total: number;
  has_more: boolean;
}

export interface AdminScan {
  ts: string;
  jti: string | null;
  verdict: string | null;
  reason_code: string | null;
  latency_ms: number | null;
  token_class: string | null;
}

export interface ScanListResponse {
  scans: AdminScan[];
  total: number;
  has_more: boolean;
}

// ── Metrics ────────────────────────────────────────────────────────────────

export interface MetricsOverview {
  total_users: number;
  active_users_24h: number;
  active_users_7d: number;
  total_claims_issued: number;
  claims_issued_24h: number;
  total_scans: number;
  scans_24h: number;
  open_tickets: number;
  revenue_last_30d_usd: number;
  generated_at: string;
}

export type ScanGranularity = "hour" | "day";

export interface ScansBucket {
  ts: string;
  count: number;
}

export interface ScansSeriesResponse {
  granularity: ScanGranularity;
  buckets: ScansBucket[];
  total: number;
}

// ── Audit log ──────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  ts: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  has_more: boolean;
}

// ── Billing / refunds ─────────────────────────────────────────────────────

export interface AdminRefundRecord {
  stripe_refund_id: string;
  amount_cents: number;
  currency: string;
  reason: string | null;
  forced: boolean;
  issued_by_email: string | null;
  ts: string;
  stripe_status: string | null;
}

export interface AdminTransactionSummary {
  id: string;
  created_at: string | null;
  description: string;
  amount_usd: number;
  credits_added: number;
  status: "pending" | "paid" | "refunded" | "partially_refunded";
  refunded_amount_cents: number;
  refunds: AdminRefundRecord[];
  payment_intent_id: string | null;
  refundable: boolean;
}

export interface AdminTransactionListResponse {
  transactions: AdminTransactionSummary[];
  total: number;
}

export interface RefundIssueResponse {
  stripe_refund_id: string;
  amount_cents: number;
  transaction_id: string;
  forced: boolean;
}

// Shape of the 400 body the backend returns on a policy violation.
export interface RefundPolicyErrorBody {
  code:
    | "no_charge"
    | "already_refunded"
    | "no_payment_intent"
    | "not_paid"
    | "too_old"
    | "too_consumed"
    | "recent_refund"
    | "stripe_error"
    | "bad_id"
    | "not_found";
  message: string;
}

// ── Endpoint helpers ──────────────────────────────────────────────────────

export const adminEndpoints = {
  async login(email: string, password: string): Promise<{ access_token: string }> {
    // Reuses the customer /auth/token endpoint — backend stamps role into JWT.
    const body = new URLSearchParams({ username: email, password });
    const res = await adminApi.post<{ access_token: string }>("/auth/token", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.data;
  },

  async me(): Promise<AdminMe> {
    return (await adminApi.get<AdminMe>("/admin/me")).data;
  },

  async listTickets(params: {
    status?: "open" | "closed";
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<TicketListResponse> {
    return (await adminApi.get<TicketListResponse>("/admin/tickets", { params })).data;
  },

  async getTicket(ticketId: string): Promise<TicketDetail> {
    return (await adminApi.get<TicketDetail>(`/admin/tickets/${ticketId}`)).data;
  },

  async replyToTicket(ticketId: string, content: string): Promise<TicketDetail> {
    return (await adminApi.post<TicketDetail>(`/admin/tickets/${ticketId}/reply`, { content })).data;
  },

  async closeTicket(ticketId: string): Promise<TicketDetail> {
    return (await adminApi.post<TicketDetail>(`/admin/tickets/${ticketId}/close`)).data;
  },

  // ── KB ────────────────────────────────────────────────────────────────
  async listKB(params: { category?: string; q?: string }): Promise<KBListResponse> {
    return (await adminApi.get<KBListResponse>("/admin/kb", { params })).data;
  },

  async getKB(slug: string): Promise<KBArticleOut> {
    return (await adminApi.get<KBArticleOut>(`/admin/kb/${slug}`)).data;
  },

  async createKB(payload: KBArticleIn): Promise<KBArticleOut> {
    return (await adminApi.post<KBArticleOut>("/admin/kb", payload)).data;
  },

  async updateKB(slug: string, payload: KBArticleUpdate): Promise<KBArticleOut> {
    return (await adminApi.put<KBArticleOut>(`/admin/kb/${slug}`, payload)).data;
  },

  async deleteKB(slug: string): Promise<void> {
    await adminApi.delete(`/admin/kb/${slug}`);
  },

  // ── Users ─────────────────────────────────────────────────────────────
  async listUsers(params: {
    q?: string;
    role?: UserRole;
    is_disabled?: boolean;
    include_deleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<UserListResponse> {
    return (await adminApi.get<UserListResponse>("/admin/users", { params })).data;
  },

  async getUser(userId: string): Promise<UserDetail> {
    return (await adminApi.get<UserDetail>(`/admin/users/${userId}`)).data;
  },

  async listUserClaims(
    userId: string,
    params: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<ClaimListResponse> {
    return (await adminApi.get<ClaimListResponse>(`/admin/users/${userId}/claims`, { params })).data;
  },

  async listUserScans(
    userId: string,
    params: { verdict?: string; limit?: number; offset?: number } = {}
  ): Promise<ScanListResponse> {
    return (await adminApi.get<ScanListResponse>(`/admin/users/${userId}/scans`, { params })).data;
  },

  async listUserTransactions(
    userId: string,
    params: { limit?: number; offset?: number } = {}
  ): Promise<AdminTransactionListResponse> {
    return (
      await adminApi.get<AdminTransactionListResponse>(
        `/admin/users/${userId}/transactions`,
        { params }
      )
    ).data;
  },

  async issueRefund(
    transactionId: string,
    reason: string,
    force = false
  ): Promise<RefundIssueResponse> {
    return (
      await adminApi.post<RefundIssueResponse>(
        `/admin/billing/transactions/${transactionId}/refund`,
        { reason, force }
      )
    ).data;
  },

  async adjustCredits(userId: string, delta: number, reason: string): Promise<UserDetail> {
    return (await adminApi.post<UserDetail>(`/admin/users/${userId}/credits/adjust`, { delta, reason })).data;
  },

  async disableUser(userId: string, reason: string): Promise<UserDetail> {
    return (await adminApi.post<UserDetail>(`/admin/users/${userId}/disable`, { reason })).data;
  },

  async enableUser(userId: string): Promise<UserDetail> {
    return (await adminApi.post<UserDetail>(`/admin/users/${userId}/enable`)).data;
  },

  async softDeleteUser(userId: string, reason: string): Promise<UserDetail> {
    // axios.delete doesn't pass body unless via `data` option
    return (
      await adminApi.delete<UserDetail>(`/admin/users/${userId}`, { data: { reason } })
    ).data;
  },

  async changeUserRole(userId: string, role: UserRole, reason?: string): Promise<UserDetail> {
    return (await adminApi.post<UserDetail>(`/admin/users/${userId}/role`, { role, reason })).data;
  },

  // ── Metrics ───────────────────────────────────────────────────────────
  async metricsOverview(): Promise<MetricsOverview> {
    return (await adminApi.get<MetricsOverview>("/admin/metrics/overview")).data;
  },

  async scansSeries(params: {
    granularity?: ScanGranularity;
    from?: string;
    to?: string;
  } = {}): Promise<ScansSeriesResponse> {
    return (await adminApi.get<ScansSeriesResponse>("/admin/metrics/scans", { params })).data;
  },

  // ── Audit log (super_admin) ───────────────────────────────────────────
  async auditLog(params: {
    action?: string;
    target_type?: string;
    target_id?: string;
    admin_email?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AuditLogResponse> {
    return (await adminApi.get<AuditLogResponse>("/admin/audit-log", { params })).data;
  },
};
