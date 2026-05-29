import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Index from "./pages/Index";
import Verify from "./pages/Verify";
import Studio from "./pages/Studio";
import Console from "./pages/Console";
import Playground from "./pages/Playground";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Docs from "./pages/Docs";
import Invoices from "./pages/solutions/Invoices";
import NotFound from "./pages/NotFound";
import RequireAuth from "@/routes/RequireAuth";
import RedirectIfAuth from "@/routes/RedirectIfAuth";
import AppShell from "@/components/layouts/AppShell";
import Settings from "./pages/Settings";
import TokenLanding from "./pages/TokenLanding";
import ComingSoon from "./pages/ComingSoon";
import Pricing from "./pages/Pricing";
import BillingSuccess from "./pages/BillingSuccess";
import BillingDashboard from "./pages/BillingDashboard";
import Proof from "./pages/Proof";
import Waitlist from "./pages/Waitlist";
import WaitlistAdmin from "./pages/WaitlistAdmin";
import MyTickets from "./pages/MyTickets";
import MyTicketDetail from "./pages/MyTicketDetail";

// Admin console — Operator Terminal theme. Separate session, own token,
// distinct visual identity. See backend/DESIGN-admin-and-chatbot.md §6.
import { AdminAuthProvider } from "@/admin/AdminAuthContext";
import AdminShell from "@/admin/AdminShell";
import RequireAdmin from "@/admin/RequireAdmin";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminHome from "./pages/admin/AdminHome";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminTicketDetail from "./pages/admin/AdminTicketDetail";
import AdminKBList from "./pages/admin/AdminKBList";
import AdminKBEditor from "./pages/admin/AdminKBEditor";
import AdminUsersList from "./pages/admin/AdminUsersList";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminMetrics from "./pages/admin/AdminMetrics";
import AdminAuditLog from "./pages/admin/AdminAuditLog";

const queryClient = new QueryClient();

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

const App = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminAuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/t/:jti" element={<TokenLanding />} />
          <Route path="/proof/:jti" element={<Proof />} />

          {/* Legacy redirects */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/studio" element={<Navigate to="/app/studio" replace />} />
          <Route path="/console" element={<Navigate to="/app/console" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          <Route path="/solutions" element={<Navigate to="/solutions/invoices" replace />} />

          <Route element={<RedirectIfAuth />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          <Route path="/playground" element={<Playground />} />

          <Route path="/billing/success" element={<BillingSuccess />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
              <Route path="/app/dashboard" element={<Dashboard />} />
              <Route path="/app/studio" element={<Studio />} />
              <Route path="/app/verify" element={<Verify />} />
              <Route path="/app/console" element={<Console />} />
              <Route path="/app/settings" element={<Settings />} />
              <Route path="/app/billing" element={<BillingDashboard />} />
              <Route path="/app/support" element={<MyTickets />} />
              <Route path="/app/support/:ticketId" element={<MyTicketDetail />} />

            </Route>
          </Route>

          {/* Company Pages */}
          <Route path="/about" element={<About />} />

          {/* Placeholder routes referenced by marketing/docs UI */}
          <Route path="/contact" element={<ComingSoon />} />
          <Route path="/careers" element={<ComingSoon />} />
          <Route path="/legal" element={<ComingSoon />} />
          <Route path="/privacy" element={<ComingSoon />} />
          <Route path="/terms" element={<ComingSoon />} />

          {/* Developer Pages */}
          <Route path="/docs" element={<Docs />} />

          <Route path="/api" element={<ComingSoon />} />
          <Route path="/status" element={<ComingSoon />} />
          <Route path="/blog" element={<ComingSoon />} />
          <Route path="/changelog" element={<ComingSoon />} />

          {/* Solution Pages */}
          <Route path="/solutions/invoices" element={<Invoices />} />

          <Route path="/pricing" element={<Pricing />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/admin/waitlist" element={<WaitlistAdmin />} />

          {/* ── Admin console ─ /admin/* ───────────────────────────────
             Separate session (admin_token), terminal-themed shell, lives
             alongside the customer app but is visually and functionally
             isolated. See backend/DESIGN-admin-and-chatbot.md §6.        */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<RequireAdmin />}>
            <Route element={<AdminShell />}>
              <Route path="/admin" element={<AdminHome />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/admin/tickets/:ticketId" element={<AdminTicketDetail />} />
              <Route path="/admin/kb" element={<AdminKBList />} />
              <Route path="/admin/kb/new" element={<AdminKBEditor />} />
              <Route path="/admin/kb/:slug" element={<AdminKBEditor />} />
              <Route path="/admin/users" element={<AdminUsersList />} />
              <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
              <Route path="/admin/metrics" element={<AdminMetrics />} />
            </Route>
            {/* Super-admin only sub-tree */}
            <Route element={<RequireAdmin superOnly />}>
              <Route element={<AdminShell />}>
                <Route path="/admin/audit" element={<AdminAuditLog />} />
              </Route>
            </Route>
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AdminAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;