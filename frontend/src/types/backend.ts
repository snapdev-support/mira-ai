export type Plan = "free" | "paid" | "pro";

export type Verdict = "VALID" | "EXPIRED" | "REVOKED" | "UNVERIFIED" | "UNKNOWN";

export interface UserPublic {
  id: string;
  email: string;
  plan: Plan;
  issued_count: number;
  stripe_customer_id?: string | null;
  plan_updated_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: UserPublic;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

export type TemplateType = "invoice" | "package" | "return_sla";

export interface IssueClaimRequest {
  template: TemplateType;
  subject: { type: string; id: string };
  facts: Record<string, unknown>;
  exp: string; // ISO datetime
  policy?: { replay_window_s: number };
}

export interface IssueClaimResponse {
  jti: string;
  qrPayload: string;
  exp: string; // ISO datetime
  status: "active" | "revoked";
}

export interface PaymentRequiredResponse {
  // Legacy
  detail?: string;
  checkoutUrl?: string;

  error?: {
    code: string;
    message: string;
    httpStatus: number;
  };
  quota?: {
    plan: Plan;
    issuedCount: number;
    creditsRemaining: number;
    freeLimit?: number;
  };
  actions?: {
    pricingPageUrl?: string;
    checkoutUrl?: string | null;
  };
}

export interface AccountUsageResponse {
  plan: Plan;
  issuedCount: number;
  creditsRemaining: number;
  creditsTotal: number;
  freeLimit: number;
}

export interface BillingPlan {
  id: "credits_1000" | "credits_5000" | "credits_12000" | string;
  priceUsd: number;
  credits: number;
  stripePriceId?: string | null;
}

export interface BillingPlansResponse {
  currency: "usd" | string;
  plans: BillingPlan[];
}

export interface CreateCheckoutSessionRequest {
  planId: string;
}

export interface CreateCheckoutSessionResponse {
  checkoutUrl: string;
}

export interface RevokeClaimRequest {
  jti: string;
  reason: string;
}

export interface OkResponse {
  ok: boolean;
}

export interface VerifyRequest {
  token: string;
  include_safety?: boolean;
}

export interface VerifyResponse {
  verdict: Verdict;
  explanation: [string, string];
  reason_code: string;
  subject: { type?: string | null; id?: string | null };
  issuer: { type: "mira"; account_id?: string | null; display?: string | null };
  timestamp: string; // ISO datetime
  proofUrl?: string | null;
  safety?: Record<string, unknown> | null;
}

export interface ProofClaim {
  jti: string;
  template?: string | null;
  status: string;
  iat?: string | null;
  exp?: string | null;
  subject: Record<string, unknown>;
  facts: Record<string, unknown>;
  qr_payload?: string | null;
  account_id?: string | null;
}

export interface ProofRevocation {
  jti: string;
  reason?: string | null;
  ts?: string | null;
  by_account_id?: string | null;
}

export interface ProofScanStats {
  scan_count: number;
  last_scan_ts?: string | null;
  last_latency_ms?: number | null;
  last_verdict?: string | null;
}

export interface ProofResponse {
  claim: ProofClaim;
  verify: VerifyResponse;
  revocation?: ProofRevocation | null;
  scan_stats?: ProofScanStats | null;
}

export type OpsEventType = "scan" | "issue" | "revoke";
export type OpsEventStatus = "success" | "info" | "warning" | "error";

export interface OpsTilesResponse {
  updated_at: string; // ISO datetime

  scans_today: number;
  total_scans: number;

  claims_total: number;
  claims_active: number;
  claims_revoked: number;

  verify_p50_ms: number | null;
  verify_p95_ms: number | null;
  verify_avg_ms: number | null;

  last_revocation_age_s: number | null;
}

export interface OpsTrafficBucket {
  date: string; // YYYY-MM-DD (UTC)
  scans: number;
  avg_latency_ms: number | null;
}

export interface OpsTrafficResponse {
  items: OpsTrafficBucket[];
}

export interface OpsEventItem {
  id: string;
  type: OpsEventType;
  status: OpsEventStatus;
  message: string;
  ts: string; // ISO datetime
  jti?: string | null;
  verdict?: Verdict | string | null;
}

export interface OpsEventsResponse {
  items: OpsEventItem[];
}

export interface OpsClaimItem {
  jti: string;
  template?: string | null;
  status: "active" | "revoked";
  iat: string; // ISO datetime
  exp?: unknown;
  subject: Record<string, unknown>;
  qr_payload: string;
  scan_count: number;
  last_scan_ts?: string | null;
}

export interface OpsClaimsResponse {
  items: OpsClaimItem[];
  next_cursor?: string | null;
}

// ── Billing / Payment ──────────────────────────────────────────────────────

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";
export type PaymentMethodType = "card" | "us_bank_account";
export type TransactionStatus = "paid" | "pending" | "failed" | "refunded";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  isDefault: boolean;
  card?: {
    brand: CardBrand;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
    accountType: "checking" | "savings";
  };
  createdAt: string; // ISO datetime
}

export interface Transaction {
  id: string;
  date: string;          // ISO datetime
  description: string;
  amountUsd: number;
  credits?: number;
  status: TransactionStatus;
  invoiceUrl?: string | null;
  planId?: string | null;
}

export interface SubscriptionOverview {
  planName: string;
  planId: string;
  amountUsd: number;
  interval: "month" | "year" | "one_time";
  status: "active" | "canceled" | "past_due" | "trialing" | "none";
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;  // "next billing date"
  cancelAtPeriodEnd?: boolean;
  creditsRemaining: number;
  creditsTotal: number;
}

export interface PaymentMethodsResponse {
  items: PaymentMethod[];
}

export interface TransactionsResponse {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SetupIntentResponse {
  clientSecret: string;
}

export interface AttachPaymentMethodRequest {
  paymentMethodId: string;
  setDefault?: boolean;
}

export interface BillingPortalResponse {
  url: string;
}
