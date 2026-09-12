import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Lock, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { DE_LOGO_REVERSE } from '@/lib/brandAssets';

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
      <div className="min-h-screen bg-gradient-to-b from-[#030228] to-[#0f0d2e] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <img src={DE_LOGO_REVERSE} alt="Digerati Experts" className="h-10 w-auto" />
          </div>
          <Card className="bg-white/10 border-white/20 backdrop-blur">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Invalid or missing reset token. Please request a new password reset link.
              </div>
              <Link href="/portal/forgot-password">
                <Button className="w-full bg-[#D3126A] hover:bg-[#e01874]" data-testid="button-request-new-link">
                  Request New Link
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030228] to-[#0f0d2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={DE_LOGO_REVERSE} alt="Digerati Experts" className="h-10 w-auto" />
        </div>

        <Card className="bg-white/10 border-white/20 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-white">Choose New Password</CardTitle>
            <CardDescription className="text-gray-300">
              At least 8 characters with 1 uppercase letter and 1 number
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">Password updated successfully. You can now sign in with your new password.</p>
                </div>
                <Link href="/portal/login">
                  <Button className="w-full bg-[#D3126A] hover:bg-[#e01874]" data-testid="button-go-login">
                    Go to Login
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
                  <label className="text-sm font-medium text-white">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                      required
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-200"
                      data-testid="button-toggle-password"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                      required
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D3126A] hover:bg-[#e01874]"
                  data-testid="button-reset-password"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>

                <p className="text-center text-sm text-gray-400">
                  Remembered it?{" "}
                  <Link href="/portal/login" className="text-de-magenta-ink hover:underline" data-testid="link-login">
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
