import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { DE_LOGO_REVERSE } from '@/lib/brandAssets';
import TurnstileWidget from "@/components/TurnstileWidget";

export default function PortalForgotPassword() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
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
        setError(data.message || "Request failed");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030228] to-[#0f0d2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={DE_LOGO_REVERSE} alt="Digerati Experts" className="h-10 w-auto" />
        </div>

        <Card className="bg-white/10 border-white/20 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-white">Reset Password</CardTitle>
            <CardDescription className="text-gray-300">
              Enter your email and we'll send you a reset link
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox and spam folder.
                  </p>
                </div>
                <Link href="/portal/login">
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10" data-testid="link-back-to-login">
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <TurnstileWidget onVerify={setTurnstileToken} />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D3126A] hover:bg-[#e01874]"
                  data-testid="button-send-reset"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <p className="text-center text-sm text-gray-400">
                  Remember your password?{" "}
                  <Link href="/portal/login" className="text-de-magenta-ink hover:underline" data-testid="link-back-login">
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
