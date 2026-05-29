import { api } from "@/services/api";
import type { VerifyRequest, VerifyResponse } from "@/types/backend";

export async function verifyToken(token: string, includeSafety: boolean = false): Promise<VerifyResponse> {
  const payload: VerifyRequest = { token, include_safety: includeSafety };
  const res = await api.post<VerifyResponse>("/verify", payload);
  return res.data;
}
