/**
 * Lightweight admin-session state. Decoupled from customer AuthContext so
 * the two sessions can coexist (a staff member can be signed in as a
 * customer on /app/* AND as an admin on /admin/* simultaneously).
 *
 * State sources:
 *   - admin_token in localStorage (set on login, cleared on logout / 401)
 *   - GET /admin/me on mount when a token is present, to verify and load profile
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ADMIN_TOKEN_KEY, adminEndpoints, type AdminMe } from "./adminApi";

type Status = "loading" | "authenticated" | "anonymous";

interface AdminAuthState {
  status: Status;
  me: AdminMe | null;
  login: (email: string, password: string) => Promise<AdminMe>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<AdminMe | null>(null);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      setStatus("anonymous");
      setMe(null);
      return;
    }
    try {
      const profile = await adminEndpoints.me();
      setMe(profile);
      setStatus("authenticated");
    } catch {
      // Token is invalid or insufficient role — clear and treat as anon.
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setMe(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await adminEndpoints.login(email, password);
      localStorage.setItem(ADMIN_TOKEN_KEY, access_token);
      // /admin/me will 403 if the account is role=user — that's the gate.
      try {
        const profile = await adminEndpoints.me();
        setMe(profile);
        setStatus("authenticated");
        return profile;
      } catch (err) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setMe(null);
        setStatus("anonymous");
        throw err;
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setMe(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AdminAuthState>(
    () => ({ status, me, login, logout, refresh }),
    [status, me, login, logout, refresh]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

// react-refresh wants Provider and hook in separate files, but co-locating
// is the conventional React Context pattern and the cost of splitting here
// would be import churn across every admin page.
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  }
  return ctx;
}
