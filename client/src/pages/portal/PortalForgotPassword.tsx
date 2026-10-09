import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { DE_LOGO_REVERSE } from '@/lib/brandAssets';
import "@/styles/portal.css";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function PortalForgotPassword() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  // Turnstile tokens are single-use: remount the widget after a failed
  // attempt so a retry sends a fresh one.
  const [turnstileKey, setTurnstileKey] = useState(0);
  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileKey((k) => k + 1);
  };
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/portal/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || "Request failed");
        resetTurnstile();
        return;
      }

      setSuccess(true);
    } catch {
      setError("Connection error. Please try again.");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight">Reset Password</h1>
            <CardDescription className="text-muted-foreground">
              Enter your email and we'll send you a reset link
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div role="status" className="pt-callout pt-tone-ok pt-ink flex items-start gap-3 rounded-lg border p-4">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox and spam folder.
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full border-border bg-background hover:bg-accent">
                  <Link href="/portal/login" data-testid="link-back-to-login">
                    Back to Login
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
                  <label className="text-sm font-medium">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-input bg-background pl-9"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <TurnstileWidget key={turnstileKey} onVerify={setTurnstileToken} />

                <Button
                  type="submit"
                  disabled={loading}
                  variant="brand"
                  className="w-full"
                  data-testid="button-send-reset"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link href="/portal/login" className="text-de-magenta-ink underline underline-offset-2 hover:no-underline" data-testid="link-back-login">
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
