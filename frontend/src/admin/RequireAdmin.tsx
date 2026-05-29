/**
 * Route guard for /admin/*. Mirrors customer RequireAuth but with role-aware
 * gating. Renders nothing while the session is being verified to avoid a
 * flash of the wrapped UI.
 *
 * Optional `superOnly` prop guards super_admin-only sub-routes (audit log,
 * KB delete, user role/delete actions). Components can still gate their own
 * actions; this is the route-level fence.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAdminAuth } from "./AdminAuthContext";

interface Props {
  superOnly?: boolean;
}

export default function RequireAdmin({ superOnly = false }: Props) {
  const { status, me } = useAdminAuth();
  const location = useLocation();

  if (status === "loading") {
    // Minimal terminal-style splash. No spinner — just a heartbeat.
    return (
      <div className="admin-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <span className="t-loading t-label">Verifying session</span>
      </div>
    );
  }

  if (status === "anonymous" || !me) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (superOnly && me.role !== "super_admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
