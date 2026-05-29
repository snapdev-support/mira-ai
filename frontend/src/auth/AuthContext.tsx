/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import type { AuthResponse, UserPublic } from "@/types/backend";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  token: string | null;
  user: UserPublic | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "token";

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<UserPublic | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback(async () => {
    const t = getStoredToken();
    if (!t) {
      setToken(null);
      setUser(null);
      setStatus("anonymous");
      return;
    }

    setToken(t);
    try {
      const res = await api.get<UserPublic>("/profile/me");
      setUser(res.data);
      setStatus("authenticated");
    } catch {
      // Token might be invalid/expired.
      logout();
    }
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    setStoredToken(res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    setStatus("authenticated");
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>("/auth/signup", { email, password });
    setStoredToken(res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    setStatus("authenticated");
  }, []);

  const loginWithGoogle = useCallback(async (access_token: string) => {
    const res = await api.post<AuthResponse>("/auth/google", { access_token });
    setStoredToken(res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    // On first load, attempt to hydrate auth state.
    refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, token, user, login, signup, loginWithGoogle, logout, refresh }),
    [status, token, user, login, signup, loginWithGoogle, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
