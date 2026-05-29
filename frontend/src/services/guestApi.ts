import { api } from "@/services/api";

const GUEST_TOKEN_KEY = "mira_guest_token";

export interface GuestScanResponse {
  allowed: boolean;
  token: string;
  scans_used: number;
  scans_remaining: number;
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

/**
 * Ask the backend whether this anonymous user is allowed to scan.
 * The backend issues a server-signed token so the count cannot be
 * tampered with from the browser.
 */
export async function checkGuestScan(): Promise<GuestScanResponse> {
  const token = getStoredToken();
  const res = await api.post<GuestScanResponse>("/guest/scan", { token });
  // Always persist the latest token returned by the server
  storeToken(res.data.token);
  return res.data;
}
