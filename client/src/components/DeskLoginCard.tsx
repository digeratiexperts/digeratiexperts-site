import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import TurnstileWidget from "@/components/TurnstileWidget";
import { PORTAL_FORGOT_PASSWORD } from "@/lib/portalUrls";
import type { PortalUserSession } from "@/lib/portalRoles";

type LoginStep = "credentials" | "mfa";

interface DeskLoginCardProps {
  /** Fires after the canonical portal session is established. */
  onSignedIn: (user: PortalUserSession) => void;
  /** Returns to the Client Tools gate without closing ASK DE. */
  onBack?: () => void;
}

const ZOHO_POPUP_NAME = "de-zoho-portal-auth";
const ZOHO_START_URL = "/api/portal/auth/zoho/start?returnTo=%2Fportal";

/**
 * Inline Client Portal sign-in for ASK DE.
 *
 * Password + MFA delegate to the canonical portal endpoints. Zoho OAuth uses
 * a popup because the identity provider must be top-level, while ASK DE stays
 * stationary. The shared HttpOnly portalAuth cookie remains the browser
 * session authority across the public site and portal subdomain.
 */
export default function DeskLoginCard({ onSignedIn, onBack }: DeskLoginCardProps) {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaMethod, setMfaMethod] = useState<"totp" | "email">("totp");
  const [mfaMessage, setMfaMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [zohoConfigured, setZohoConfigured] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const zohoPopupRef = useRef<Window | null>(null);
  const zohoPollRef = useRef<number | null>(null);

  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileKey((value) => value + 1);
  };

  const clearZohoPoll = () => {
    if (zohoPollRef.current !== null) {
      window.clearInterval(zohoPollRef.current);
      zohoPollRef.current = null;
    }
  };

  const storeSession = (user: PortalUserSession, token?: string) => {
    localStorage.setItem("portalUser", JSON.stringify(user));
    if (token) localStorage.setItem("portalToken", token);
    localStorage.setItem("portalUserId", user.id || "portal-user");
    localStorage.setItem("userEmail", user.email || email);
    window.dispatchEvent(new CustomEvent("de-portal-auth-changed"));
    onSignedIn(user);
  };

  const adoptSharedCookieSession = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/portal/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return false;
      const data = (await response.json().catch(() => ({}))) as { user?: PortalUserSession };
      if (!data.user) return false;
      storeSession(data.user);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/portal/auth/zoho/status", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setZohoConfigured(Boolean(data?.configured));
      })
      .catch(() => {
        if (!cancelled) setZohoConfigured(false);
      });
    return () => {
      cancelled = true;
      clearZohoPoll();
      try {
        zohoPopupRef.current?.close();
      } catch {
        /* cross-origin popup may already be gone */
      }
    };
  }, []);

  const handleZohoSignIn = () => {
    setError("");
    clearZohoPoll();
    const popup = window.open(
      ZOHO_START_URL,
      ZOHO_POPUP_NAME,
      "popup=yes,width=560,height=760,resizable=yes,scrollbars=yes",
    );
    if (!popup) {
      setError("Allow the secure Zoho sign-in window, then try again.");
      return;
    }
    zohoPopupRef.current = popup;
    let attempts = 0;
    zohoPollRef.current = window.setInterval(() => {
      attempts += 1;
      if (popup.closed) {
        clearZohoPoll();
        return;
      }
      if (attempts > 180) {
        clearZohoPoll();
        setError("Zoho sign-in was not completed. Try again when ready.");
        return;
      }
      void adoptSharedCookieSession().then((signedIn) => {
        if (!signedIn) return;
        clearZohoPoll();
        window.setTimeout(() => {
          try {
            popup.close();
          } catch {
            /* already closed */
          }
        }, 600);
      });
    }, 750);
  };

  const handleLogin = async (e: FormEvent) => {
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || data.error || "Sign-in failed. Please try again.");
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
      storeSession(data.user, data.token);
    } catch {
      setError("Connection error. Please try again.");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: FormEvent) => {
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "Verification failed");
        return;
      }
      storeSession(data.user, data.token);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const topBack = onBack ? (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
      <button
        type="button"
        className="de-desk-more-toggle"
        onClick={onBack}
        data-testid="button-desk-login-dismiss"
      >
        <ArrowLeft aria-hidden="true" />
        Back
      </button>
    </div>
  ) : null;

  if (step === "mfa") {
    return (
      <form className="de-desk-form de-desk-login" onSubmit={handleMfaVerify} data-testid="desk-login-card">
        {topBack}
        <p className="de-desk-login-hint" data-testid="desk-login-mfa-hint">
          <ShieldCheck aria-hidden="true" />
          {mfaMessage || "Enter your verification code."} A backup code also works.
        </p>
        {error ? (
          <div className="de-desk-form-error" role="alert" data-testid="desk-login-error">
            <AlertCircle aria-hidden="true" />
            {error}
          </div>
        ) : null}
        <div className="de-desk-field">
          <label htmlFor="desk-login-mfa">
            {mfaMethod === "totp" ? "Authenticator code" : "Email verification code"}
          </label>
          <Input
            id="desk-login-mfa"
            type="text"
            inputMode="numeric"
            pattern="[0-9A-Za-z]*"
            maxLength={8}
            placeholder={mfaMethod === "totp" ? "6-digit code" : "Code from your email"}
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            className="de-desk-input is-bare"
            autoFocus
            required
            data-testid="input-desk-login-mfa"
          />
        </div>
        <button
          type="submit"
          className="de-desk-btn-grad"
          disabled={loading || mfaCode.length < 6}
          data-testid="button-desk-login-verify"
        >
          {loading ? "Verifying…" : "Verify & sign in"}
        </button>
        <button
          type="button"
          className="de-desk-more-toggle"
          onClick={() => {
            setStep("credentials");
            setError("");
            setMfaCode("");
          }}
          data-testid="button-desk-login-back"
        >
          <ArrowLeft aria-hidden="true" />
          Back to sign-in
        </button>
      </form>
    );
  }

  return (
    <form className="de-desk-form de-desk-login" onSubmit={handleLogin} data-testid="desk-login-card">
      {topBack}
      {error ? (
        <div className="de-desk-form-error" role="alert" data-testid="desk-login-error">
          <AlertCircle aria-hidden="true" />
          {error}
        </div>
      ) : null}
      <div className="de-desk-field">
        <label htmlFor="desk-login-email">Email</label>
        <div className="de-desk-input-wrap">
          <Mail aria-hidden="true" />
          <Input
            id="desk-login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="de-desk-input"
            required
            data-testid="input-desk-login-email"
          />
        </div>
      </div>
      <div className="de-desk-field">
        <label htmlFor="desk-login-password">Password</label>
        <div className="de-desk-input-wrap">
          <Lock aria-hidden="true" />
          <Input
            id="desk-login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="de-desk-input"
            required
            data-testid="input-desk-login-password"
          />
        </div>
      </div>
      <TurnstileWidget key={turnstileKey} onVerify={setTurnstileToken} theme="light" />
      <button
        type="submit"
        className="de-desk-btn-grad"
        disabled={loading}
        data-testid="button-desk-login-submit"
      >
        <LogIn aria-hidden="true" />
        {loading ? "Signing in…" : "Sign in"}
      </button>
      {zohoConfigured ? (
        <button
          type="button"
          className="de-desk-more-toggle"
          onClick={handleZohoSignIn}
          data-testid="button-desk-login-zoho"
        >
          <ShieldCheck aria-hidden="true" />
          Sign in with Zoho
        </button>
      ) : null}
      <div className="de-desk-login-links">
        <a
          href={PORTAL_FORGOT_PASSWORD}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-desk-login-forgot"
        >
          Forgot password?
        </a>
      </div>
    </form>
  );
}
