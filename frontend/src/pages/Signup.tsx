import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Eye, EyeOff, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthLayout from "@/components/layouts/AuthLayout";
import { useAuth } from "@/auth/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const Signup = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signup, loginWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    password: "",
    confirmPassword: ""
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
        variant: "destructive"
      });
      return;
    }

    // bcrypt uses a max of 72 *bytes* (UTF-8), not 72 characters.
    if (new TextEncoder().encode(formData.password).length > 72) {
      toast({
        title: "Password Too Long",
        description: "Password must be at most 72 bytes",
        variant: "destructive"
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      await signup(formData.email, formData.password);
      toast({
        title: "Account Created Successfully!",
        description: "Welcome to MiraTrust.",
      });
      navigate("/app/dashboard");
    } catch (error) {
      toast({
        title: "Signup Failed",
        description: "An error occurred during signup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 25) return "Very Weak";
    if (passwordStrength < 50) return "Weak";
    if (passwordStrength < 75) return "Good";
    return "Strong";
  };

  return (
    <AuthLayout title="Create Your Account" subtitle="Join thousands of companies using MiraTrust">
      <form onSubmit={handleSignup} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName" className="text-foreground">First Name</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              required
              className="border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 bg-background mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="lastName" className="text-foreground">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              required
              className="border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 bg-background mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email" className="text-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
            className="border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 bg-background mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="company" className="text-foreground">Company</Label>
          <div className="relative mt-1.5">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <Input
              id="company"
              type="text"
              placeholder="Your Company Name"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              className="pl-10 border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 bg-background"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password" className="text-foreground">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
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
          {formData.password && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground/60">Password Strength</span>
                <span className={passwordStrength >= 75 ? "text-[#4CAF7D]" : passwordStrength >= 50 ? "text-[#E6A817]" : "text-[#D95050]"}>
                  {getPasswordStrengthText()}
                </span>
              </div>
              <Progress value={passwordStrength} className="h-1.5" />
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              required
              className="border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 bg-background pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={acceptTerms}
              onCheckedChange={(checked) => setAcceptTerms(checked === true)}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-1"
            />
            <Label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground">
              I agree to the{" "}
              <Link to="/terms" className="text-primary hover:opacity-80 hover:underline transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary hover:opacity-80 hover:underline transition-colors">
                Privacy Policy
              </Link>
            </Label>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="marketing"
              checked={acceptMarketing}
              onCheckedChange={(checked) => setAcceptMarketing(checked === true)}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-1"
            />
            <Label htmlFor="marketing" className="text-sm leading-relaxed text-muted-foreground">
              I'd like to receive product updates and marketing communications
            </Label>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full font-semibold hover:opacity-90"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}
          disabled={isLoading || !acceptTerms}
        >
          {isLoading ? "Creating Account..." : "Create Account"}
        </Button>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground/60 shrink-0">or continue with</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <GoogleSignInButton
          label="Sign up with Google"
          onSuccess={async (accessToken) => {
            try {
              await loginWithGoogle(accessToken);
              toast({ title: "Account created with Google!" });
              navigate("/app/dashboard");
            } catch {
              toast({ title: "Google sign-in failed", description: "Please try again.", variant: "destructive" });
            }
          }}
        />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:opacity-80 hover:underline font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Signup;
