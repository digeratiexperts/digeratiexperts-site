/**
 * Zoho Connect — one-click, server-based OAuth for every Zoho product the
 * website uses (CRM, Desk, Books, Payments). docs/ZOHO-OAUTH-INVENTORY.md.
 *
 * Ported from Intelligence Hub routes/zoho-connect.ts. Wired in routes.ts
 * behind authMiddleware + requireAdmin; every handler here also requires:
 *   - ZOHO_CONNECT_ENABLED on (otherwise 404, as if the route did not exist);
 *   - the owner: a live admin signed in with a master portal email
 *     (portalZohoAuth.ts isMasterPortalEmail), not impersonating a company.
 *
 *   GET  /api/zoho/connect            → 302 to Zoho consent (every product's scopes)
 *   GET  /api/zoho/connect/callback   Zoho → exchange code → store → revoke the replaced grant
 *   GET  /api/zoho/connection         the Connect grant + each product's health (no secrets)
 *   POST /api/zoho/disconnect         revoke + remove the Connect grant
 *
 * The callback is a top-level GET navigation from accounts.zoho.<dc>, so the
 * SameSite=Lax portalAuth cookie and the state cookie are both sent.
 */
import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { isMasterPortalEmail } from "./portalZohoAuth";
import {
  buildZohoConnectUrl,
  completeZohoConnect,
  disconnectZoho,
  getZohoConnectSummary,
  isZohoConnectAvailable,
  isZohoConnectEnabled,
  parseZohoProducts,
  refreshZohoConnectSnapshot,
  resetAllZohoProductCaches,
  zohoConnectRedirectUri,
  zohoTokenStore,
  ZOHO_PRODUCTS,
  type ZohoProduct,
  type ZohoProductHealth,
} from "./zoho/oauth";

const COOKIE = "zoho_connect";
const COOKIE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_RETURN = "/portal/admin";

interface ConnectUser {
  id?: string;
  email?: string;
  role?: string;
  impersonatingCompanyId?: string | null;
}

type ConnectRequest = Request & { user?: ConnectUser };

export interface ZohoConnectRouteDeps {
  /** Per-product health for /api/zoho/connection (stored state, no Zoho call). */
  productHealth: () => Promise<Record<ZohoProduct, ZohoProductHealth>>;
  /** Tests inject a stub; production uses completeZohoConnect. */
  complete?: typeof completeZohoConnect;
  disconnect?: typeof disconnectZoho;
}

function useSecureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

/** The public origin the redirect URI is built on (never the Host header in production). */
function origin(req: Request): string {
  const configured = (process.env.PUBLIC_SITE_URL || (process.env.MAIN_DOMAIN ? `https://${process.env.MAIN_DOMAIN}` : "")).trim();
  if (configured) {
    try {
      const u = new URL(configured);
      if (u.protocol === "https:" || u.protocol === "http:") return `${u.protocol}//${u.host}`;
    } catch {
      /* fall through */
    }
  }
  return `${req.protocol}://${req.get("host")}`;
}

function safeReturnTo(v: unknown): string {
  // A backslash reads as a slash in browsers (`/\evil.com`); refuse it and controls.
  return typeof v === "string" && /^\/(?![\/\\])/.test(v) && !/[\\\x00-\x1f\x7f]/.test(v)
    ? v
    : DEFAULT_RETURN;
}

function withQuery(path: string, params: Record<string, string>): string {
  const u = new URL(path, "http://site.local");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return `${u.pathname}${u.search}${u.hash}`;
}

/** The owner: live admin, master portal email, not impersonating. */
export function isZohoConnectOwner(req: Request): boolean {
  const user = (req as ConnectRequest).user;
  return (
    user?.role === "admin" &&
    typeof user.email === "string" &&
    isMasterPortalEmail(user.email) &&
    !user.impersonatingCompanyId
  );
}

function userId(req: Request): string {
  const id = (req as ConnectRequest).user?.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

interface ConnectCookie {
  state: string;
  uid: string;
  products: ZohoProduct[];
  returnTo: string;
}

function readCookie(req: Request): ConnectCookie | null {
  const raw = (req.cookies as Record<string, string> | undefined)?.[COOKIE];
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as ConnectCookie;
    return typeof v.state === "string" && typeof v.uid === "string" ? v : null;
  } catch {
    return null;
  }
}

function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** 404 unless ZOHO_CONNECT_ENABLED is on. */
export function requireZohoConnectEnabled(_req: Request, res: Response, next: NextFunction) {
  if (!isZohoConnectEnabled()) return res.status(404).json({ error: "Not found" });
  next();
}

export function createZohoConnectHandlers(deps: ZohoConnectRouteDeps) {
  const complete = deps.complete ?? completeZohoConnect;
  const disconnect = deps.disconnect ?? disconnectZoho;

  const start = (req: Request, res: Response) => {
    // The state cookie must be set on the host Zoho redirects back to (e.g.
    // start on portal.digeratiexperts.com, return to digeratiexperts.com).
    const callbackOrigin = new URL(zohoConnectRedirectUri(origin(req))).origin;
    if (req.get("host") && new URL(callbackOrigin).host !== req.get("host")) {
      res.redirect(302, `${callbackOrigin}${req.originalUrl}`);
      return;
    }
    const returnTo = safeReturnTo(req.query.returnTo);
    if (!isZohoConnectOwner(req)) {
      res.redirect(302, withQuery(returnTo, { zoho_connect: "error", zoho_error: "Only the owner can connect Zoho." }));
      return;
    }
    const products = parseZohoProducts(req.query.products);
    try {
      const redirectUri = zohoConnectRedirectUri(origin(req));
      const { url, state } = buildZohoConnectUrl({ products, redirectUri });
      const cookie: ConnectCookie = { state, uid: userId(req), products, returnTo };
      res.cookie(COOKIE, Buffer.from(JSON.stringify(cookie)).toString("base64url"), {
        httpOnly: true,
        secure: useSecureCookies(),
        sameSite: "lax",
        path: "/api/zoho/connect",
        maxAge: COOKIE_TTL_MS,
      });
      res.redirect(302, url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.redirect(302, withQuery(returnTo, { zoho_connect: "error", zoho_error: msg }));
    }
  };

  const callback = async (req: Request, res: Response) => {
    const cookie = readCookie(req);
    res.clearCookie(COOKIE, { path: "/api/zoho/connect" });
    const returnTo = cookie?.returnTo ? safeReturnTo(cookie.returnTo) : DEFAULT_RETURN;
    const fail = (msg: string) =>
      res.redirect(302, withQuery(returnTo, { zoho_connect: "error", zoho_error: msg }));

    if (!isZohoConnectOwner(req)) {
      fail("Only the owner can connect Zoho.");
      return;
    }
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!cookie || !state || !sameString(cookie.state, state) || cookie.uid !== userId(req)) {
      fail("Zoho Connect session expired or did not match. Click Connect Zoho again.");
      return;
    }
    if (typeof req.query.error === "string" && req.query.error) {
      fail(req.query.error === "access_denied" ? "Zoho consent was declined." : "Zoho returned an error.");
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      fail("Zoho did not return an authorization code.");
      return;
    }
    const accountsServer =
      typeof req.query["accounts-server"] === "string" ? req.query["accounts-server"] : null;
    try {
      const result = await complete({
        code,
        accountsServer,
        redirectUri: zohoConnectRedirectUri(origin(req)),
        requestedProducts: cookie.products?.length ? cookie.products : [...ZOHO_PRODUCTS],
        store: zohoTokenStore(),
      });
      resetAllZohoProductCaches();
      await refreshZohoConnectSnapshot();
      console.log("[zoho-connect] grant stored", { products: result.products, dc: result.dc, deskOrg: Boolean(result.deskOrgId) });
      res.redirect(
        302,
        withQuery(returnTo, {
          zoho_connect: "ok",
          zoho_products: result.products.join(","),
          ...(result.warnings.length ? { zoho_warning: result.warnings.join(" ") } : {}),
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[zoho-connect] failed", { error: msg.slice(0, 200) });
      fail(msg);
    }
  };

  const connection = async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const [summary, products] = await Promise.all([getZohoConnectSummary(zohoTokenStore()), deps.productHealth()]);
    res.json({
      enabled: isZohoConnectEnabled(),
      connectAvailable: isZohoConnectAvailable(),
      redirectUri: zohoConnectRedirectUri(origin(req)),
      canManage: isZohoConnectOwner(req),
      unified: summary,
      products,
    });
  };

  const disconnectHandler = async (req: Request, res: Response) => {
    if (!isZohoConnectOwner(req)) {
      res.status(403).json({ error: "Only the owner can disconnect Zoho." });
      return;
    }
    const removed = await disconnect(zohoTokenStore());
    resetAllZohoProductCaches();
    await refreshZohoConnectSnapshot();
    res.json({ removed });
  };

  return { start, callback, connection, disconnect: disconnectHandler };
}
