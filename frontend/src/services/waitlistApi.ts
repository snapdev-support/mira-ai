import { api } from "@/services/api";

export interface WaitlistPayload {
  name: string;
  email: string;
  company?: string;
  role?: string;
}

export interface WaitlistResponse {
  ok: boolean;
  already_registered: boolean;
}

export async function joinWaitlist(payload: WaitlistPayload): Promise<WaitlistResponse> {
  const res = await api.post<WaitlistResponse>("/waitlist", payload);
  return res.data;
}
