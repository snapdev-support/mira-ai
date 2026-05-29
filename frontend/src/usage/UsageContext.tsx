/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/auth/AuthContext";
import type { AccountUsageResponse } from "@/types/backend";

type UsageStatus = "idle" | "loading" | "ready";

type UsageContextValue = {
  status: UsageStatus;
  usage: AccountUsageResponse | null;
  refresh: () => Promise<void>;
};

const UsageContext = createContext<UsageContextValue | undefined>(undefined);

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useAuth();
  const [status, setStatus] = useState<UsageStatus>("idle");
  const [usage, setUsage] = useState<AccountUsageResponse | null>(null);

  const refresh = useCallback(async () => {
    if (authStatus !== "authenticated") {
      setUsage(null);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    try {
      const res = await api.get<AccountUsageResponse>("/account/usage");
      setUsage(res.data);
      setStatus("ready");
    } catch {
      // If this fails (e.g. token expired), AuthProvider will handle logout elsewhere.
      setStatus("ready");
    }
  }, [authStatus]);

  useEffect(() => {
    // Fetch on app load / auth change.
    refresh();
  }, [refresh]);

  const value = useMemo<UsageContextValue>(() => ({ status, usage, refresh }), [status, usage, refresh]);

  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error("useUsage must be used within <UsageProvider>");
  return ctx;
}
