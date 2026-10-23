import type { NextFunction, Request, Response } from "express";
import {
  accountClassOf,
  can,
  isDeStaff,
  isSuperAdmin,
  type PermissionKey,
} from "@shared/permissions";
import { writeAudit } from "./portalAccessStore";
import { sendEmail } from "./services/notificationService";
import { logger } from "./logger";

/**
 * Lane A (Wave 1): route guards on top of the one permission helper
 * (`shared/permissions` → can()) and the break-glass audit flag
 * (lane-a-update-2.md §1, corrected by lane-a-update-3.md §1-2).
 */

export type AuthedRequest = Request & { user?: any; userId?: string };

/**
 * Break-glass alerts go ONLY to the configured address (lane-a-update-3.md §2).
 * Nothing is sent when it is unset — there is no invented default.
 */
export function breakGlassAlertRecipient(): string | null {
  const to = (process.env.PORTAL_BREAK_GLASS_ALERT_EMAIL || "").trim();
  return to ? to : null;
}

const escapeAlert = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (ch) =>
    (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<string, string>)[ch]!,
  );

/** Fire-and-forget alert about a break-glass event. Warns loudly when unsent. */
export function sendBreakGlassAlert(subject: string, lines: string[]): void {
  const to = breakGlassAlertRecipient();
  if (!to) {
    logger.warn(`Break-glass alert NOT sent (PORTAL_BREAK_GLASS_ALERT_EMAIL unset): ${subject}`, {
      lines,
    });
    return;
  }
  const body = lines.join("\n");
  void sendEmail({
    to,
    subject,
    htmlBody: `<p>${escapeAlert(subject)}</p><ul>${lines
      .map((line) => `<li>${escapeAlert(line)}</li>`)
      .join("")}</ul>`,
    textBody: `${subject}\n${body}`,
  }).catch((err: unknown) =>
    logger.warn("Break-glass alert send failed", { error: String(err), subject }),
  );
}

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
 * record is attached and before the handler, so the row describes the action
 * that is about to run. Every audited row carries
 * `breakGlass = (actor is the break-glass account)`.
 *
 * lane-a-update-3.md §1: a failed audit write NEVER blocks the break-glass
 * account — it is logged loudly, alerted, and the action proceeds. A fail-closed
 * rule is Joe's to make (see "Waiting on Joe").
 */
export async function auditMutation(req: AuthedRequest, _res: Response): Promise<boolean> {
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
    // Loud, then keep going: the emergency account must never be locked out by
    // its own audit log (lane-a-update-3.md §1).
    const message = String(err?.message || err);
    console.error(`[portalAudit] AUDIT WRITE FAILED (${action}) — action still allowed:`, message);
    logger.error("Break-glass / DE staff audit write failed", { action, actor: user.email, error: message });
    if (isSuperAdmin(user)) {
      sendBreakGlassAlert("Break-glass audit write failed", [
        `Account: ${user.email}`,
        `Action: ${action}`,
        "The audit row could not be written. The action was still allowed, so this entry is missing from the audit log.",
      ]);
    }
    return true;
  }
}
