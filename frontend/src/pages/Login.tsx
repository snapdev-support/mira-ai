import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthLayout from "@/components/layouts/AuthLayout";
import { useAuth } from "@/auth/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const Login = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      await login(email, password);

      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });

      navigate("/app/dashboard");
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to your MiraTrust account">
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <Label htmlFor="email" className="text-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 bg-background mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-foreground">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 bg-background pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor="remember" className="text-sm text-muted-foreground">Remember me</Label>
          </div>
          <Link to="/forgot-password" className="text-sm text-primary hover:opacity-80 hover:underline transition-colors">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full font-semibold hover:opacity-90"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing In...
            </>
          ) : (
            "Sign In"
          )}
        </Button>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground/60 shrink-0">or continue with</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <GoogleSignInButton
          onSuccess={async (accessToken) => {
            try {
              await loginWithGoogle(accessToken);
              toast({ title: "Signed in with Google" });
              navigate("/app/dashboard");
            } catch {
              toast({ title: "Google sign-in failed", description: "Please try again.", variant: "destructive" });
            }
          }}
        />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </form>

      {/* Admin Login Hint */}
      <div className="mt-6 p-4 border" style={{ background: "var(--color-accent-8)", borderColor: "var(--color-accent-16)", borderRadius: 3 }}>
        <div className="flex items-center space-x-2 mb-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Admin Access</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Admin views are not enabled in Stage-1 UI.
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;
