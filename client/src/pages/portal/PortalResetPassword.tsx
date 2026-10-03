import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { AlertCircle, Lock, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { DE_LOGO_REVERSE } from '@/lib/brandAssets';
import "@/styles/portal.css";

export default function PortalResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      <main id="main-content" tabIndex={-1} className="de-portal dark relative flex min-h-dvh items-center justify-center overflow-hidden p-4" data-theme="dark">
      <div aria-hidden="true" className="pt-login-glow pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pt-login-line pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <img src={DE_LOGO_REVERSE} alt="Digerati Experts" className="h-10 w-auto" />
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
    <main id="main-content" tabIndex={-1} className="de-portal dark relative flex min-h-dvh items-center justify-center overflow-hidden p-4" data-theme="dark">
      <div aria-hidden="true" className="pt-login-glow pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pt-login-line pointer-events-none absolute inset-x-0 top-0 h-px" />
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={DE_LOGO_REVERSE} alt="Digerati Experts" className="h-10 w-auto" />
        </div>

        <Card className="pt-still relative border-border bg-card shadow-none">
          <CardHeader className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight">Choose New Password</h1>
            <CardDescription className="text-muted-foreground">
              At least 8 characters with 1 uppercase letter and 1 number
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
                  <label className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-input bg-background pl-9 pr-10"
                      required
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-password"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPw ? "text" : "password"}
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
