import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  EarthLock,
  Radar,
  ScanQrCode,
  Sun,
  Moon,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { useUsage } from "@/usage/UsageContext";
import { CreditsExhaustedBanner } from "@/components/CreditsExhaustedBanner";
import { CreditsLowBanner } from "@/components/CreditsLowBanner";
import { useTheme } from "@/contexts/ThemeContext";
import { HelpWidget } from "@/components/support/HelpWidget";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { usage } = useUsage();
  const { theme, toggleTheme } = useTheme();

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/login");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/app/dashboard" },
    { icon: EarthLock,       label: "Studio",    path: "/app/studio" },
    { icon: ScanQrCode,      label: "Verify",    path: "/app/verify" },
    { icon: Radar,           label: "Console",   path: "/app/console" },
    { icon: CreditCard,      label: "Billing",   path: "/app/billing" },
    { icon: MessageCircle,   label: "Support",   path: "/app/support" },
    { icon: Settings,        label: "Settings",  path: "/app/settings" },
  ];

  return (
    <div className="min-h-screen flex flex-col overflow-hidden font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <CreditsExhaustedBanner />
      <CreditsLowBanner />
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-60 border-r transition-transform duration-200 ease-in-out
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
            lg:relative lg:translate-x-0
          `}
          style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)" }}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="h-14 flex items-center justify-between px-5 border-b" style={{ borderColor: "var(--color-border)" }}>
              <Link to="/" className="flex items-center gap-2">
                <Logo />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden -mr-2"
                style={{ color: "var(--color-muted)" }}
                onClick={toggleSidebar}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto custom-scrollbar">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center px-3 py-2.5 transition-colors duration-150"
                    style={{
                      borderRadius: 3,
                      background:   isActive ? "var(--color-accent-8)" : "transparent",
                      color:        isActive ? "var(--color-accent)" : "var(--color-muted)",
                      border:       isActive ? "1px solid var(--color-accent-20)" : "1px solid transparent",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--color-muted)"; }}
                  >
                    <item.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                    <span>{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1 h-1 rounded-full" style={{ background: "var(--color-accent)" }} />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User profile + theme toggle */}
            <div className="p-4 border-t" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border" style={{ borderColor: "var(--color-border)" }}>
                  <AvatarImage src="" />
                  <AvatarFallback style={{ background: "var(--color-bg-light)", color: "var(--color-muted)", fontSize: 12 }}>
                    {(user?.email?.slice(0, 2) ?? "ME").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>{user?.email ?? "Account"}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--color-muted)" }}>Plan: {user?.plan ?? "free"}</p>
                </div>
                <button
                  onClick={toggleTheme}
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-light)",
                    color: "var(--color-muted)",
                    cursor: "pointer",
                  }}
                >
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "var(--color-bg)" }}>

          {/* Top Header */}
          <header className="h-14 flex items-center justify-between px-6 sticky top-0 z-40 border-b" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden mr-3"
                style={{ color: "var(--color-muted)" }}
                onClick={toggleSidebar}
              >
                {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-card)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                    <Avatar className="h-7 w-7 border" style={{ borderColor: "var(--color-border)" }}>
                      <AvatarImage />
                      <AvatarFallback style={{ background: "var(--color-bg-card)", color: "var(--color-muted)", fontSize: 11 }}>
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-52"
                  style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  align="end"
                  forceMount
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{user?.email ?? "Account"}</p>
                      <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                        {user?.plan ? `Plan: ${user.plan}` : ""}
                      </p>
                      {usage && (
                        <p className="text-[10px] pt-0.5" style={{ color: "var(--color-muted)" }}>
                          {usage.creditsRemaining.toLocaleString()} credits left
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator style={{ background: "var(--color-border)" }} />
                  <DropdownMenuItem
                    onClick={() => navigate("/app/billing")}
                    className="cursor-pointer text-sm focus:bg-[var(--color-bg-light)]"
                    style={{ color: "var(--color-text)" }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/app/settings")}
                    className="cursor-pointer text-sm focus:bg-[var(--color-bg-light)]"
                    style={{ color: "var(--color-text)" }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator style={{ background: "var(--color-border)" }} />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-sm"
                    style={{ color: "#D95050" }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6 relative z-0">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Floating help widget */}
      <HelpWidget />
    </div>
  );
};

export default MainLayout;
