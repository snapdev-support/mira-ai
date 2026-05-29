import { api } from "@/services/api";
import type {
  OpsClaimsResponse,
  OpsEventsResponse,
  OpsTilesResponse,
  OpsTrafficResponse,
} from "@/types/backend";

export async function getOpsTiles(): Promise<OpsTilesResponse> {
  const res = await api.get<OpsTilesResponse>("/ops/tiles");
  return res.data;
}

export async function getOpsTraffic(days = 7): Promise<OpsTrafficResponse> {
  const res = await api.get<OpsTrafficResponse>("/ops/traffic", { params: { days } });
  return res.data;
}

export async function getOpsEvents(limit = 50): Promise<OpsEventsResponse> {
  const res = await api.get<OpsEventsResponse>("/ops/events", { params: { limit } });
  return res.data;
}

export async function getOpsClaims(limit = 50): Promise<OpsClaimsResponse> {
  const res = await api.get<OpsClaimsResponse>("/ops/claims", { params: { limit } });
  return res.data;
}

export async function getOpsClaimsCsv(): Promise<string> {
  const res = await api.get<string>("/ops/claims.csv", { responseType: "text" });
  return res.data;
}
