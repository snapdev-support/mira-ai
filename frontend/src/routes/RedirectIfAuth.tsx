import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export default function RedirectIfAuth({ to = "/app/dashboard" }: { to?: string }) {
  const { status } = useAuth();

  if (status === "loading") return null;

  if (status === "authenticated") {
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
}
