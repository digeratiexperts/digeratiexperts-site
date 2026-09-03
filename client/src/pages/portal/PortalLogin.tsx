import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail, Lock, ArrowRight, ShieldCheck, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import logoImage from "@assets/DE-Logo-new_1762461524794.webp";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useSEO } from "@/hooks/useSEO";
import { portalReturnLabel } from "@/lib/portalUrls";
import { marketplaceReturnTo } from "@shared/portalReturnTo";

type LoginStep = "credentials" | "mfa";

function readQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

export default function PortalLogin() {
  useSEO({
    title: "Client Portal Login",
    description: "Sign in to the Digerati Experts Client Portal. For existing clients only.",
    noIndex: true,
  });
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaMethod, setMfaMethod] = useState<"totp" | "email">("totp");
  const [mfaMessage, setMfaMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  // Remounting the widget issues a fresh single-use token after a failed
  // attempt; without this the second submit re-sends a spent token.
  const [turnstileKey, setTurnstileKey] = useState(0);
  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileKey((k) => k + 1);
  };
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [zohoConfigured, setZohoConfigured] = useState<boolean | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    // Door-knock beacon — counts login page visits (bots + people)
    fetch("/api/portal/login-knocks/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/portal/login" }),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const token = readQueryParam("token");
    const zohoSso = readQueryParam("zoho_sso");
    const err = readQueryParam("error");
    const message = readQueryParam("message");
    const returnTo = marketplaceReturnTo(readQueryParam("returnTo"));

    if (err) {
      setError(message || "Sign-in failed. Please try again.");
    }

    if (zohoSso === "1" && token) {
      (async () => {
        // Persist token first — JWT decode must never block session handoff
        localStorage.setItem("portalToken", token);
        try {
          let payload: any = null;
          try {
            const payloadPart = token.split(".")[1];
            payload = payloadPart
              ? JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")))
              : null;
          } catch {
            /* non-fatal */
          }
          try {
            const meRes = await fetch("/api/portal/me", {
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
            });
            const meData = await meRes.json();
            if (meRes.ok && meData.user) {
              localStorage.setItem("portalUser", JSON.stringify(meData.user));
              localStorage.setItem("portalUserId", meData.user.id);
              if (meData.user.email) localStorage.setItem("userEmail", meData.user.email);
            } else {
              const user = {
                id: payload?.userId || "portal-user",
                email: payload?.email || "",
                role: payload?.role || "user",
                storeRole: payload?.storeRole || "prospect",
                clientId: payload?.clientId ?? null,
                orgRole: payload?.orgRole || "staff",
                fullName: payload?.email?.split("@")[0] || "Portal User",
              };
              localStorage.setItem("portalUser", JSON.stringify(user));
              localStorage.setItem("portalUserId", user.id);
              if (user.email) localStorage.setItem("userEmail", user.email);
            }
          } catch {
            /* navigate with token; capabilities refresh on next /me */
          }
          const dest = marketplaceReturnTo(returnTo);
          window.history.replaceState({}, "", "/portal/login");
          navigate(dest);
        } catch {
          setError("Zoho sign-in completed but session handoff failed. Please try again.");
        }
      })();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/auth/zoho/status");
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setZohoConfigured(Boolean(data?.configured));
      } catch {
        if (!cancelled) setZohoConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (readQueryParam("zoho_sso") === "1") return;
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/portal/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!meRes.ok || cancelled) return;
        const meData = await meRes.json();
        if (cancelled || !meData?.user) return;
        localStorage.setItem("portalUser", JSON.stringify(meData.user));
        localStorage.setItem("portalUserId", meData.user.id || "portal-user");
        if (meData.user.email) localStorage.setItem("userEmail", meData.user.email);
        navigate(marketplaceReturnTo(readQueryParam("returnTo")));
      } catch {
        /* stay on login when no shared browser session exists */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        resetTurnstile();
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
      navigate(marketplaceReturnTo(readQueryParam("returnTo")));
    } catch (err) {
      setError("Connection error. Please try again.");
      resetTurnstile();
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
        credentials: "include",
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
      navigate(marketplaceReturnTo(readQueryParam("returnTo")));
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const returnToForZoho = marketplaceReturnTo(readQueryParam("returnTo"));
  const zohoStartHref = `/api/portal/auth/zoho/start?returnTo=${encodeURIComponent(returnToForZoho)}`;
  const returnLabel = portalReturnLabel(returnToForZoho);
  const showZoho = zohoConfigured !== false;

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
                  {returnToForZoho === "/portal/marketplace"
                    ? "Sign in to continue to the Client Marketplace."
                    : `Sign in to continue to ${returnLabel}.`}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {showZoho && (
                  <div className="mb-6 space-y-3">
                    <Button
                      type="button"
                      asChild
                      className="w-full bg-white text-[#0f0d2e] hover:bg-white/90 font-semibold"
                      data-testid="button-zoho-login"
                    >
                      <a href={zohoStartHref}>
                        Sign in with Zoho
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                    {zohoConfigured === null && (
                      <p className="text-xs text-gray-500 text-center">Checking Zoho sign-in…</p>
                    )}
                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-transparent px-2 text-gray-400">or use email</span>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
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
                    <label className="text-sm font-medium text-white">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
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
                    <a href="/portal/forgot-password" className="text-xs text-de-magenta-ink hover:underline" data-testid="link-forgot-password">
                      Forgot password?
                    </a>
                  </div>

                  <TurnstileWidget key={turnstileKey} onVerify={setTurnstileToken} />

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#D3126A] hover:bg-[#D3126A]/90 text-white font-semibold"
                    data-testid="button-login"
                  >
                    {loading ? "Signing in..." : "Sign In"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs text-gray-400 text-center mb-3">
                    Don't have an account?{" "}
                    <a href="/portal/signup" className="text-de-magenta-ink hover:underline" data-testid="link-signup">
                      Sign Up
                    </a>
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    Need help? Contact support@digeratiexperts.com
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-de-magenta-ink" />
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
                    className="w-full bg-[#D3126A] hover:bg-[#D3126A]/90 text-white font-semibold"
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
