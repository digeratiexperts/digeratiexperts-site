import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail, Lock, ArrowRight, ShieldCheck, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import logoImage from "@assets/DE-Logo-new_1762461524794.webp";
import TurnstileWidget from "@/components/TurnstileWidget";

type LoginStep = "credentials" | "mfa";

export default function PortalLogin() {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaMethod, setMfaMethod] = useState<"totp" | "email">("totp");
  const [mfaMessage, setMfaMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
        setMfaMethod(data.mfaMethod);
        setMfaMessage(data.message);
        setStep("mfa");
        return;
      }

      localStorage.setItem("portalUser", JSON.stringify(data.user));
      localStorage.setItem("portalToken", data.token);
      localStorage.setItem("portalUserId", data.user?.id || "portal-user");
      localStorage.setItem("userEmail", email);
      navigate("/portal/dashboard");
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/portal/mfa/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Verification failed");
        return;
      }

      localStorage.setItem("portalUser", JSON.stringify(data.user));
      localStorage.setItem("portalToken", data.token);
      localStorage.setItem("portalUserId", data.user?.id || "portal-user");
      localStorage.setItem("userEmail", email);
      navigate("/portal/dashboard");
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030228] to-[#0f0d2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={logoImage} alt="Digerati Experts" className="h-10 w-auto" />
        </div>

        <Card className="bg-white/10 border-white/20 backdrop-blur">
          {step === "credentials" ? (
            <>
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl text-white">Client Portal</CardTitle>
                <CardDescription className="text-gray-300">
                  Welcome back. Sign in to manage support, services, and account details.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="portal-email" className="text-sm font-medium text-white">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="portal-email"
                        type="email"
                        placeholder="your@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                        required
                        data-testid="input-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="portal-password" className="text-sm font-medium text-white">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="portal-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                        required
                        data-testid="input-password"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <a href="/portal/forgot-password" className="text-xs text-violet-400 hover:underline" data-testid="link-forgot-password">
                      Forgot password?
                    </a>
                  </div>

                  <TurnstileWidget onVerify={setTurnstileToken} />

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#5034ff] hover:bg-[#5034ff]/90 text-white font-semibold"
                    data-testid="button-login"
                  >
                    {loading ? "Signing in..." : "Sign In"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs text-gray-400 text-center mb-3">
                    Don't have an account?{" "}
                    <a href="/portal/signup" className="text-[#5034ff] hover:underline" data-testid="link-signup">
                      Sign Up
                    </a>
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    Need help? <a href="mailto:support@digeratiexperts.com" className="text-violet-400 hover:underline">Email support@digeratiexperts.com</a>
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-violet-400" />
                  <CardTitle className="text-2xl text-white">Verify Your Identity</CardTitle>
                </div>
                <CardDescription className="text-gray-300">
                  {mfaMessage}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleMfaVerify} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      {mfaMethod === "totp" ? "Authenticator Code" : "Email Verification Code"}
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9A-Za-z]*"
                      maxLength={8}
                      placeholder={mfaMethod === "totp" ? "Enter 6-digit code" : "Enter code from email"}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 text-center text-lg tracking-widest"
                      autoFocus
                      required
                      data-testid="input-mfa-code"
                    />
                    <p className="text-xs text-gray-500">You can also enter a backup code</p>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || mfaCode.length < 6}
                    className="w-full bg-[#5034ff] hover:bg-[#5034ff]/90 text-white font-semibold"
                    data-testid="button-verify-mfa"
                  >
                    {loading ? "Verifying..." : "Verify & Sign In"}
                    <ShieldCheck className="ml-2 h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setStep("credentials"); setError(""); setMfaCode(""); }}
                    className="w-full text-gray-400 hover:text-white"
                    data-testid="button-back-to-login"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
