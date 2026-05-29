import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Shield } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* Left Side — Form */}
      <div className="flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12" style={{ background: "var(--color-bg)" }}>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-10 w-fit">
            <Logo />
          </Link>

          <h2 className="text-[32px] font-bold tracking-[-0.02em] mb-2 leading-tight" style={{ color: "var(--color-text)" }}>
            {title}
          </h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {subtitle}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          {children}
        </div>
      </div>

      {/* Right Side — Visual */}
      <div className="hidden lg:flex flex-col justify-between p-16 border-l" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)" }}>
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border text-xs font-semibold" style={{ borderColor: "var(--color-border)", borderRadius: 3, color: "var(--color-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <Shield className="h-3 w-3 text-[#4CAF7D]" />
            Enterprise Grade Security
          </div>
        </div>

        <div className="max-w-md">
          <p className="text-[11px] font-bold tracking-[0.1em] uppercase mb-5" style={{ color: "var(--color-accent)" }}>
            Trusted by engineers
          </p>
          <blockquote className="text-2xl font-medium leading-relaxed mb-8" style={{ color: "var(--color-text)", fontStyle: "normal" }}>
            "MiraTrust changed how we prove what's real. Our customers scan a QR and get a trusted verdict in seconds — no app, no friction."
          </blockquote>

          <div className="flex items-center gap-4 p-4 border" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <div className="h-9 w-9 flex items-center justify-center font-bold text-sm" style={{ background: "var(--color-bg-light)", color: "var(--color-accent)", borderRadius: 2 }}>
              JD
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Jane Doe</div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>CTO at TechCorp</div>
            </div>
            <div className="ml-auto pl-4 border-l" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center text-xs font-medium text-[#4CAF7D]">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified Partner
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
