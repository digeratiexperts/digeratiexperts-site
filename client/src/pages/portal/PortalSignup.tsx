import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { AlertCircle, Mail, Lock, User, ArrowRight, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { DE_LOGO_PRIMARY, DE_LOGO_REVERSE } from '@/lib/brandAssets';
import TurnstileWidget from "@/components/TurnstileWidget";
import "@/styles/portal.css";
import { usePortalAppearance } from "@/components/portal/shell/portalTheme";
import { PasswordRequirements, PasswordVisibilityToggle, isBreachedPasswordMessage } from "@/components/portal/PasswordRequirements";
import { passwordPolicyError } from "@shared/passwordPolicy";

export default function PortalSignup() {
  const { theme } = usePortalAppearance();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // The password the server last rejected as breached, so the checklist can mark it.
  const [breachedPw, setBreachedPw] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // POST /api/portal/register runs verifyTurnstile, like sign-in: without a
  // token it answers 400 "Bot verification required" wherever
  // TURNSTILE_SECRET_KEY is set.
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileKey((k) => k + 1);
  };
  const [, navigate] = useLocation();

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!email || !username || !password || !confirmPassword) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    const policyError = passwordPolicyError(password, { email, username });
    if (policyError) {
      setError(policyError);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, turnstileToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || "Signup failed");
        if (isBreachedPasswordMessage(data.message)) setBreachedPw(password);
        setLoading(false);
        resetTurnstile();
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/portal/login");
      }, 2000);
    } catch (err) {
      setError("Connection error. Please try again.");
      setLoading(false);
      resetTurnstile();
    }
  };

  if (success) {
    return (
      <main id="main-content" tabIndex={-1} className={`de-portal ${theme !== "light" ? "dark" : ""} relative flex min-h-dvh items-center justify-center overflow-hidden p-4`} data-theme={theme}>
      <div aria-hidden="true" className="pt-login-glow pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pt-login-line pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="w-full max-w-md">
          <Card className="pt-still relative border-border bg-card shadow-none">
            <CardContent className="pt-12 pb-12 text-center">
              <CheckCircle className="pt-ink pt-tone-ok mx-auto mb-4 h-12 w-12" />
              <h1 className="font-heading mb-2 text-xl font-semibold">Account Created Successfully!</h1>
              <p className="mb-4 text-sm text-muted-foreground">
                Your portal account has been created. Redirecting to login...
              </p>
              <div role="status" aria-label="Redirecting to sign in" className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className={`de-portal ${theme !== "light" ? "dark" : ""} relative flex min-h-dvh items-center justify-center overflow-hidden p-4`} data-theme={theme}>
      <div aria-hidden="true" className="pt-login-glow pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pt-login-line pointer-events-none absolute inset-x-0 top-0 h-px" />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={theme === "light" ? DE_LOGO_PRIMARY : DE_LOGO_REVERSE}
            alt="Digerati Experts"
            className="h-10 w-auto"
          />
        </div>

        <Card className="pt-still relative border-border bg-card shadow-none">
          <CardHeader className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight">Create Portal Account</h1>
            <CardDescription className="text-muted-foreground">
              Sign up to access the client portal
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div role="alert" className="pt-callout pt-tone-bad pt-ink flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="your@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-input bg-background pl-10"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="signup-username" className="text-sm font-medium">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-username"
                    type="text"
                    autoComplete="username"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border-input bg-background pl-10"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="signup-password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="signup-password"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-input bg-background pl-10 pr-12"
                    aria-describedby="signup-password-rules"
                    required
                    data-testid="input-password"
                  />
                  <PasswordVisibilityToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />
                </div>
                <PasswordRequirements
                  id="signup-password-rules"
                  password={password}
                  context={{ email, username }}
                  confirm={confirmPassword}
                  breached={breachedPw !== null && breachedPw === password}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="signup-confirm-password" className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="signup-confirm-password"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="border-input bg-background pl-10"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <TurnstileWidget key={turnstileKey} onVerify={setTurnstileToken} />

              <Button
                type="submit"
                disabled={loading}
                variant="brand"
                className="w-full font-semibold"
                data-testid="button-signup"
              >
                {loading ? "Creating Account..." : "Sign Up"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-6">
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <a href="/portal/login" className="text-de-magenta-ink underline underline-offset-2 hover:no-underline">
                  Sign In
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
