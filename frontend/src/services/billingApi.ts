import { api } from "@/services/api";
import type {
  BillingPlansResponse,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  PaymentMethodsResponse,
  TransactionsResponse,
  SubscriptionOverview,
  SetupIntentResponse,
  AttachPaymentMethodRequest,
  BillingPortalResponse,
  PaymentMethod,
} from "@/types/backend";

export async function fetchBillingPlans(): Promise<BillingPlansResponse> {
  const res = await api.get<BillingPlansResponse>("/billing/plans");
  return res.data;
}

export async function createCheckoutSession(
  payload: CreateCheckoutSessionRequest
): Promise<CreateCheckoutSessionResponse> {
  const res = await api.post<CreateCheckoutSessionResponse>(
    "/billing/checkout-session",
    payload
  );
  return res.data;
}

export async function fetchSubscriptionOverview(): Promise<SubscriptionOverview> {
  const res = await api.get<SubscriptionOverview>("/billing/subscription");
  return res.data;
}

export async function fetchTransactions(
  page = 1,
  pageSize = 10
): Promise<TransactionsResponse> {
  const res = await api.get<TransactionsResponse>(
    `/billing/transactions?page=${page}&pageSize=${pageSize}`
  );
  return res.data;
}

export async function fetchPaymentMethods(): Promise<PaymentMethodsResponse> {
  const res = await api.get<PaymentMethodsResponse>("/billing/payment-methods");
  return res.data;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await api.delete(`/billing/payment-methods/${id}`);
}

export async function setDefaultPaymentMethod(id: string): Promise<void> {
  await api.put(`/billing/payment-methods/${id}/default`);
}

export async function createSetupIntent(): Promise<SetupIntentResponse> {
  const res = await api.post<SetupIntentResponse>("/billing/setup-intent");
  return res.data;
}

export async function attachPaymentMethod(
  payload: AttachPaymentMethodRequest
): Promise<PaymentMethod> {
  const res = await api.post<PaymentMethod>("/billing/payment-methods", payload);
  return res.data;
}

export async function createBillingPortalSession(): Promise<BillingPortalResponse> {
  const res = await api.post<BillingPortalResponse>("/billing/portal");
  return res.data;
}

export async function cancelPlan(): Promise<void> {
  await api.post("/billing/cancel");
}

export async function verifyCheckoutSession(sessionId: string): Promise<SubscriptionOverview> {
  const res = await api.post<SubscriptionOverview>(`/billing/verify-session/${sessionId}`);
  return res.data;
}
