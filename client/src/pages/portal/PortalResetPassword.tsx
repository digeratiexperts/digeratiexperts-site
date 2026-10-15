import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { AlertCircle, Lock, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { DE_LOGO_PRIMARY, DE_LOGO_REVERSE } from '@/lib/brandAssets';
import "@/styles/portal.css";
import { usePortalAppearance } from "@/components/portal/shell/portalTheme";
import { PasswordRequirements, PasswordVisibilityToggle, isBreachedPasswordMessage } from "@/components/portal/PasswordRequirements";
import { passwordPolicyError } from "@shared/passwordPolicy";

export default function PortalResetPassword() {
  const { theme } = usePortalAppearance();
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [breachedPw, setBreachedPw] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const policyError = passwordPolicyError(password);
    if (policyError) {
      setError(policyError);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/portal/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Password reset failed");
        if (isBreachedPasswordMessage(data.message)) setBreachedPw(password);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main id="main-content" tabIndex={-1} className={`de-portal ${theme !== "light" ? "dark" : ""} relative flex min-h-dvh items-center justify-center overflow-hidden p-4`} data-theme={theme}>
      <div aria-hidden="true" className="pt-login-glow pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pt-login-line pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <img src={theme === "light" ? DE_LOGO_PRIMARY : DE_LOGO_REVERSE} alt="Digerati Experts" className="h-10 w-auto" />
          </div>
          <Card className="pt-still relative border-border bg-card shadow-none">
            <CardHeader className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight">Reset link not valid</h1>
            </CardHeader>
            <CardContent className="space-y-4">
              <div role="alert" className="pt-callout pt-tone-bad pt-ink flex items-center gap-2 rounded-lg border p-3 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Invalid or missing reset token. Please request a new password reset link.
              </div>
              <Button asChild variant="brand" className="w-full">
                <Link href="/portal/forgot-password" data-testid="button-request-new-link">
                  Request New Link
                </Link>
              </Button>
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
        <div className="flex justify-center mb-8">
          <img src={theme === "light" ? DE_LOGO_PRIMARY : DE_LOGO_REVERSE} alt="Digerati Experts" className="h-10 w-auto" />
        </div>

        <Card className="pt-still relative border-border bg-card shadow-none">
          <CardHeader className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight">Choose New Password</h1>
            <CardDescription className="text-muted-foreground">
              Choose a password you have not used anywhere else
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div role="status" className="pt-callout pt-tone-ok pt-ink flex items-start gap-3 rounded-lg border p-4">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">Password updated successfully. You can now sign in with your new password.</p>
                </div>
                <Button asChild variant="brand" className="w-full">
                  <Link href="/portal/login" data-testid="button-go-login">
                    Go to Login
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div role="alert" className="pt-callout pt-tone-bad pt-ink flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="reset-password" className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="reset-password"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Choose a new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-input bg-background pl-9 pr-12"
                      aria-describedby="reset-password-rules"
                      required
                      data-testid="input-password"
                    />
                    <PasswordVisibilityToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />
                  </div>
                  <PasswordRequirements
                    id="reset-password-rules"
                    password={password}
                    confirm={confirm}
                    breached={breachedPw !== null && breachedPw === password}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="reset-confirm-password" className="text-sm font-medium">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="reset-confirm-password"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Re-enter your new password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="border-input bg-background pl-9"
                      required
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  variant="brand"
                  className="w-full"
                  data-testid="button-reset-password"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Remembered it?{" "}
                  <Link href="/portal/login" className="text-de-magenta-ink underline underline-offset-2 hover:no-underline" data-testid="link-login">
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
