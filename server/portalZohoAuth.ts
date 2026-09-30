/**
 * Client Portal Zoho Public Platform SSO (OIDC authorization-code).
 *
 * Canonical routes (wired in routes.ts):
 *   GET /api/portal/auth/zoho/status
 *   GET /api/portal/auth/zoho/start
 *   GET /api/portal/auth/zoho/callback
 *
 * Legacy alias (matches VPS ZOHO_PORTAL_OIDC_REDIRECT_URI):
 *   GET /api/zoho/oauth/callback
 *
 * Hub SSO (/api/login?provider=zoho) is a separate app — do not reuse those paths.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { resolveJwtSecret } from "./config/authSecrets";

const ACCOUNTS_BASE = (process.env.ZOHO_OIDC_ISSUER || "https://accounts.zoho.com").replace(
  /\/$/,
  "",
);
const AUTH_URL = `${ACCOUNTS_BASE}/oauth/v2/auth`;
const TOKEN_URL = `${ACCOUNTS_BASE}/oauth/v2/token`;
const USERINFO_URL = `${ACCOUNTS_BASE}/oauth/v2/userinfo`;
const SCOPE = "openid email profile";

const MASTER_EMAILS = new Set([
  "admin@digeratiexperts.com",
  "admin@digerati-experts.com",
]);

export interface ZohoPortalConfig {
  configured: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountsBase: string;
}

export function getZohoPortalConfig(): ZohoPortalConfig {
  const clientId = (
    process.env.ZOHO_CLIENT_ID ||
    process.env.ZOHO_CLIENT_ID_API ||
    ""
  ).trim();
  const clientSecret = (
    process.env.ZOHO_CLIENT_SECRET ||
    process.env.ZOHO_CLIENT_SECRET_API ||
    ""
  ).trim();
  const redirectUri = (
    process.env.ZOHO_PORTAL_OIDC_REDIRECT_URI ||
    process.env.ZOHO_OAUTH_PORTAL_REDIRECT_URI ||
    "https://portal.digeratiexperts.com/api/portal/auth/zoho/callback"
  ).trim();

  return {
    configured: Boolean(clientId && clientSecret && redirectUri),
    clientId,
    clientSecret,
    redirectUri,
    accountsBase: ACCOUNTS_BASE,
  };
}

function stateSecret(): string {
  // No hardcoded fallback: resolveJwtSecret fails closed in production and
  // supplies a stable ephemeral secret in development.
  return (
    process.env.ZOHO_OAUTH_STATE_SECRET ||
    process.env.SESSION_SECRET ||
    resolveJwtSecret()
  );
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b.toString("base64url");
}

function signState(payload: Record<string, unknown>): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): Record<string, unknown> | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isEmailAllowedForPortalOAuth(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  if (MASTER_EMAILS.has(normalized)) return true;

  const raw = (process.env.PORTAL_OAUTH_EMAIL_ALLOWLIST || "").trim();
  if (!raw) return false;

  const parts = raw.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  for (const entry of parts) {
    if (entry.startsWith("@")) {
      if (normalized.endsWith(entry)) return true;
    } else if (entry === normalized) {
      return true;
    }
  }
  return false;
}

export function isMasterPortalEmail(email: string): boolean {
  return MASTER_EMAILS.has(email.trim().toLowerCase());
}

import { marketplaceReturnTo, sanitizeReturnTo } from "@shared/portalReturnTo";

export { marketplaceReturnTo, sanitizeReturnTo };

export function portalLoginErrorRedirect(code: string, message?: string): string {
  const params = new URLSearchParams({ error: code });
  if (message) params.set("message", message);
  return `/portal/login?${params.toString()}`;
}

export function buildZohoAuthorizeUrl(opts: {
  state: string;
  codeChallenge: string;
}): string {
  const cfg = getZohoPortalConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope: SCOPE,
    redirect_uri: cfg.redirectUri,
    access_type: "offline",
    prompt: "consent",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function createZohoStartPayload(returnTo?: string): {
  authorizeUrl: string;
  codeVerifier: string;
} {
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(createHash("sha256").update(codeVerifier).digest());
  const state = signState({
    v: 1,
    exp: Date.now() + 10 * 60 * 1000,
    r: marketplaceReturnTo(returnTo),
    n: b64url(randomBytes(16)),
  });
  return {
    authorizeUrl: buildZohoAuthorizeUrl({ state, codeChallenge }),
    codeVerifier,
  };
}

export function verifyZohoOAuthState(state: string): { returnTo: string } | null {
  const parsed = verifyState(state);
  if (!parsed) return null;
  return { returnTo: marketplaceReturnTo(parsed.r) };
}

export async function exchangeZohoAuthCode(opts: {
  code: string;
  codeVerifier: string;
}): Promise<{
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
}> {
  const cfg = getZohoPortalConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code: opts.code,
    code_verifier: opts.codeVerifier,
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || typeof json.access_token !== "string") {
    const err = typeof json.error === "string" ? json.error : `HTTP ${resp.status}`;
    throw new Error(`Zoho token exchange failed: ${err}`);
  }
  return {
    accessToken: json.access_token,
    idToken: typeof json.id_token === "string" ? json.id_token : undefined,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
  };
}

export async function fetchZohoUserInfo(accessToken: string): Promise<{
  email: string;
  fullName: string;
  sub?: string;
}> {
  const tryFetch = async (authHeader: string) => {
    const resp = await fetch(USERINFO_URL, {
      headers: { Authorization: authHeader },
    });
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: resp.ok, json };
  };

  let result = await tryFetch(`Bearer ${accessToken}`);
  if (!result.ok) {
    result = await tryFetch(`Zoho-oauthtoken ${accessToken}`);
  }
  if (!result.ok) {
    throw new Error("Zoho userinfo request failed");
  }

  const emailRaw =
    (typeof result.json.email === "string" && result.json.email) ||
    (typeof result.json.Email === "string" && result.json.Email) ||
    "";
  const email = emailRaw.trim().toLowerCase();
  if (!email) throw new Error("Zoho account did not return an email");

  const fullName =
    (typeof result.json.name === "string" && result.json.name.trim()) ||
    [result.json.given_name, result.json.family_name]
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .join(" ")
      .trim() ||
    email.split("@")[0];

  return {
    email,
    fullName,
    sub: typeof result.json.sub === "string" ? result.json.sub : undefined,
  };
}

export function setZohoPkceCookie(res: Response, codeVerifier: string): void {
  res.cookie("portal_zoho_cv", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
}

export function clearZohoPkceCookie(res: Response): void {
  res.clearCookie("portal_zoho_cv", { path: "/" });
}

export function readZohoPkceCookie(req: Request): string | undefined {
  const v = req.cookies?.portal_zoho_cv;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
