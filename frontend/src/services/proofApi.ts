import { api } from "@/services/api";
import type { ProofResponse } from "@/types/backend";

export async function getProof(jti: string, checksum: string): Promise<ProofResponse> {
  const res = await api.get<ProofResponse>(`/proof/${encodeURIComponent(jti)}`, {
    params: { h: checksum },
  });
  return res.data;
}
