import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { resolveJwtSecret } from "./config/authSecrets.ts";

type PortalPrincipal = {
  id: string;
  clientId?: string | null;
  impersonatingCompanyId?: string | null;
  role?: string;
  orgRole?: string | null;
  storeRole?: string;
  clientRoles?: string[];
  departmentId?: string | null;
  managerUserId?: string | null;
  isCompanyItContact?: boolean;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function digest(domain: string, values: unknown[]): string {
  return createHmac("sha256", resolveJwtSecret())
    .update(JSON.stringify(["de.portal.submission.v1", domain, ...values]))
    .digest("hex");
}

function contextFor(actor: PortalPrincipal): string {
  return digest("authority", [
    actor.id, actor.clientId ?? null, actor.impersonatingCompanyId ?? null,
    actor.role, actor.orgRole, actor.storeRole, [...new Set(actor.clientRoles ?? [])].sort(),
    actor.departmentId ?? null, actor.managerUserId ?? null, !!actor.isCompanyItContact,
  ]);
}

function sameOrigin(req: Request): boolean {
  // Cookies cover several DE hosts. A sibling subdomain is a separate origin.
  const site = req.get("Sec-Fetch-Site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const source = req.get("Origin") ?? req.get("Referer");
  if (source === undefined) return true; // proof uses a custom header even in older clients
  try {
    const expected = new URL(`${req.protocol}://${req.get("Host")}`);
    const actual = new URL(source);
    return actual.origin === expected.origin;
  } catch {
    return false;
  }
}

function reject(res: Response, originFailure: boolean): false {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-DE-CSRF-Status", originFailure ? "origin-forbidden" : "mismatch");
  res.status(403).json(originFailure
    ? { code: "CSRF_ORIGIN_FORBIDDEN", error: "Open this page on its original site to submit your change." }
    : { code: "CSRF_TOKEN_MISMATCH", error: "Verify your current sign-in and review your change before submitting again." });
  return false;
}

function binding(req: Request, actor: PortalPrincipal) {
  const context = contextFor(actor);
  const proof = digest("session", [context, req.cookies.portalAuth, req.cookies.sessionId ?? null]);
  return { context, proof };
}

/** Only called on an authorized session read; ambient reads receive no proof. */
export function issuePortalSubmission(req: Request, res: Response, actor: PortalPrincipal): boolean {
  const credential = req.cookies?.portalAuth;
  if (req.method !== "GET" || typeof credential !== "string" || !credential
    || req.get("X-DE-CSRF-Request") !== "1") return true;
  if (!sameOrigin(req)) return reject(res, true);
  const { context, proof } = binding(req, actor);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-DE-CSRF-Token", proof);
  res.setHeader("X-DE-CSRF-Context", context);
  return true;
}

/** Runs after cookie/JWT validation and live account lookup, before audit and side effects. */
export function verifyPortalSubmission(req: Request, res: Response, actor: PortalPrincipal): boolean {
  const credential = req.cookies?.portalAuth;
  if (typeof credential !== "string" || !credential) return true; // explicit bearer-only API client
  if (SAFE_METHODS.has(req.method)) {
    const path = (req.originalUrl || req.url || "").split("?")[0];
    return !/^\/api\/portal\/me\/?$/i.test(path) || issuePortalSubmission(req, res, actor);
  }
  if (!sameOrigin(req)) return reject(res, true);
  const submitted = req.get("X-CSRF-Token");
  if (!submitted || submitted.length !== 64 || !/^[0-9a-f]{64}$/.test(submitted)) return reject(res, false);
  if (!timingSafeEqual(Buffer.from(binding(req, actor).proof), Buffer.from(submitted))) return reject(res, false);
  return true;
}
