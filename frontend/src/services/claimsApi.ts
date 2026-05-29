import type { IssueClaimRequest, IssueClaimResponse, PaymentRequiredResponse, RevokeClaimRequest, OkResponse } from "@/types/backend";
import { api } from "@/services/api";
import axios from "axios";

export class PaymentRequiredError extends Error {
  checkoutUrl: string;
  code?: string;
  pricingPageUrl?: string;
  creditsRemaining?: number;

  constructor(message: string, checkoutUrl: string, data?: PaymentRequiredResponse) {
    super(message);
    this.name = "PaymentRequiredError";
    this.checkoutUrl = checkoutUrl;

    this.code = data?.error?.code;
    this.pricingPageUrl = data?.actions?.pricingPageUrl;
    this.creditsRemaining = data?.quota?.creditsRemaining;
  }
}

export async function issueClaim(payload: IssueClaimRequest): Promise<IssueClaimResponse> {
  try {
    const res = await api.post<IssueClaimResponse>("/claims/issue", payload);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 402) {
      const data = err.response.data as PaymentRequiredResponse;
      const message = data?.error?.message ?? data?.detail ?? "Payment required";
      const checkoutUrl = data?.actions?.checkoutUrl ?? data?.checkoutUrl ?? "";
      throw new PaymentRequiredError(message, checkoutUrl, data);
    }
    throw err;
  }
}

export async function revokeClaim(payload: RevokeClaimRequest): Promise<OkResponse> {
  const res = await api.post<OkResponse>("/claims/revoke", payload);
  return res.data;
}
