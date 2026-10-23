import type { NextFunction, Request, Response } from "express";
import {
  accountClassOf,
  can,
  isDeStaff,
  isSuperAdmin,
  type PermissionKey,
} from "@shared/permissions";
import { writeAudit } from "./portalAccessStore";

/**
 * Lane A (Wave 1): route guards on top of the one permission helper
 * (`shared/permissions` → can()) and the break-glass audit flag
 * (lane-a-update-2.md §1: "the audit flag on admin actions").
 */

export type AuthedRequest = Request & { user?: any; userId?: string };

/**
 * The company an action targets: the company a DE actor is switched into,
 * otherwise the caller's own company. Route code passes this to can() so a
 * client principal can never act on another company's data.
 */
export function actingCompanyId(req: AuthedRequest): string | null {
  const u = req.user;
  return u?.impersonatingCompanyId || u?.clientId || null;
}

/**
 * Server-side route guard. `targetCompanyId` overrides the default scope for
 * routes that act on a named company (e.g. /api/portal/admin/companies/:id/...).
 */
export function requirePermission(
  permission: PermissionKey,
  targetCompanyId?: (req: AuthedRequest) => string | null,
) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const companyId = targetCompanyId ? targetCompanyId(req) : actingCompanyId(req);
    if (can(req.user, permission, companyId)) return next();
    return res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
  };
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Portal API calls that are noise, not actions (public beacons, MFA entry). */
const NO_AUDIT = [
  /^\/api\/portal\/login-knocks\//,
  /^\/api\/portal\/login$/,
  /^\/api\/portal\/logout$/,
  /^\/api\/portal\/signup$/,
  /^\/api\/portal\/forgot-password$/,
  /^\/api\/portal\/reset-password$/,
  /^\/api\/portal\/mfa\//,
];

function auditedAction(req: AuthedRequest): string | null {
  if (!MUTATING.has(req.method)) return null; // reads are not audited (see lane log D6)
  const path = req.originalUrl?.split("?")[0] || req.url || req.path;
  if (NO_AUDIT.some((re) => re.test(path))) return null;
  return `${req.method} ${path}`;
}

/**
 * Break-glass / DE staff action audit. Runs from authMiddleware, after the live
 * record is attached and before the handler, so "no audit row, no action" holds
 * for the break-glass account. Every audited row carries
 * `breakGlass = (actor is the break-glass account)`.
 */
export async function auditMutation(req: AuthedRequest, res: Response): Promise<boolean> {
  const user = req.user;
  if (!user || !isDeStaff(user)) return true; // client actions are not in this audit
  const action = auditedAction(req);
  if (!action) return true;
  const params = (req.params || {}) as Record<string, string>;
  try {
    await writeAudit({
      actorUserId: user.id ?? null,
      actorEmail: user.email ?? null,
      accountClass: accountClassOf(user),
      breakGlass: isSuperAdmin(user),
      action,
      targetType: params.companyId || params.id ? "company" : null,
      targetId: params.companyId || params.id || null,
      clientId: actingCompanyId(req),
      ip: typeof req.ip === "string" ? req.ip : null,
      userAgent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      meta: { params: Object.keys(params).length ? params : undefined },
    });
    return true;
  } catch (err: any) {
    console.warn("[portalAudit] write failed:", err?.message);
    if (isSuperAdmin(user)) {
      // Fail closed: a break-glass action that cannot be recorded does not run.
      res.status(503).json({
        code: "AUDIT_UNAVAILABLE",
        error: "The audit log is unavailable, so this action was not recorded. Try again shortly.",
      });
      return false;
    }
    return true; // DE staff actions degrade to console logging
  }
}
