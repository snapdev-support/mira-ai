import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="p-5 border" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <AlertTriangle className="h-12 w-12 text-[#E6A817]" />
          </div>
        </div>

        <h1 className="text-[64px] font-bold mb-3 tracking-[-0.04em] text-foreground leading-none">
          404
        </h1>

        <h2 className="text-xl font-semibold mb-3 text-foreground">Page Not Found</h2>

        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          The page you're looking for might have been removed, renamed, or is temporarily unavailable.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button size="default" className="w-full sm:w-auto font-semibold transition-opacity duration-150"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}>
              <Home className="h-4 w-4 mr-2" />
              Return Home
            </Button>
          </Link>
          <Button
            variant="outline"
            size="default"
            className="w-full sm:w-auto transition-colors duration-150 font-medium"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "transparent", borderRadius: 4 }}
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>

        <div className="mt-12 pt-8 border-t" style={{ borderColor: "var(--color-border)" }}>
          <p className="text-xs text-muted-foreground font-mono">
            ERROR_404_NOT_FOUND · {location.pathname}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
