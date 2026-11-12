import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { HubTenant, HubTicketClient, HubTicketFailure } from "./integrations/hubTicketClient";
import {
  HUB_SECURE_FIELD_KINDS,
  HUB_SECURE_FIELD_MAX_TTL_HOURS,
  HUB_SECURE_FIELD_MAX_VALUE_LENGTH,
  type HubSecureField,
  type HubSecureFieldSubmitter,
} from "./integrations/hubSecureFieldsContract";

/**
 * DE Desk secure fields on the website and in the Client Portal
 * (Intelligence-Hub #1179, slice 2). The existing surfaces keep working as
 * they are; these routes only let them hand a password, Wi-Fi key, licence key
 * or PIN to the Hub ticket instead of the chat:
 *
 *   GET  /api/portal/tickets/:id/secure-fields      metadata for a ticket the caller can see
 *   POST /api/portal/tickets/:id/secure-fields      store a value (client, or DE staff on the portal's DE side)
 *   POST /api/portal/zoho/ticket/secure-field       the website DE Desk "Get Support" visitor, right after their ticket
 *
 * Rules:
 * - The Hub is the source of truth and holds the value, encrypted. The website
 *   never stores it, never logs it, never puts it in a chat message, ticket
 *   comment, email, or the Zoho Desk path, and never sends it back to a
 *   browser. Answers carry metadata only.
 * - The value is read from the raw JSON body. These routes do not run the
 *   HTML-escaping input sanitiser: escaping would silently change the secret.
 * - No reveal here. The portal-to-Hub webhook is signed per account, not per
 *   staff user, so the Hub cannot tell which person at DE is asking, and a
 *   reveal must name a verified person in its audit. DE staff reveal from the
 *   ticket in the Hub. A client never has a plaintext path.
 * - Tenant: the portal routes reach the Hub with the caller's own company
 *   (resolveTarget does the same checks as the ticket detail route), and the
 *   Hub checks the ticket belongs to that account. The widget route only
 *   accepts the short-lived token minted for the ticket the visitor just made.
 */

export const PORTAL_SECURE_FIELDS_PATH = "/api/portal/tickets/:id/secure-fields";
export const WIDGET_SECURE_FIELD_PATH = "/api/portal/zoho/ticket/secure-field";
export const WIDGET_SECURE_FIELD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const SECURE_FIELDS_UNAVAILABLE =
  "Secure sharing isn't available on this ticket yet. Please don't paste the password in chat; DE will send you a secure request.";
const SECURE_FIELDS_DOWN = "Secure sharing is unavailable right now. Nothing was stored. Please try again in a moment, and don't paste it in chat.";

/** What the browser sends. Value checked here only for size; the Hub validates the rest. */
export const secureFieldInputSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    kind: z.enum(HUB_SECURE_FIELD_KINDS).optional(),
    secretValue: z.string().min(1).max(HUB_SECURE_FIELD_MAX_VALUE_LENGTH),
    ttlHours: z.number().int().min(1).max(HUB_SECURE_FIELD_MAX_TTL_HOURS).optional(),
  })
  .strict();

const widgetInputSchema = secureFieldInputSchema.extend({ token: z.string().min(10).max(600) }).strict();

/** Field-level messages only: never the input, which can be the secret. */
function inputProblems(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
}

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

/** A Hub failure as an answer the browser can show. Never echoes the request. */
export function sendHubFailure(res: Response, failure: HubTicketFailure): void {
  if (failure.reason === "refused" && (failure.status === 404 || failure.status === 409)) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (failure.reason === "refused" && failure.status === 400) {
    res.status(400).json({
      error: "That couldn't be stored. Check the description doesn't contain the secret itself, then try again.",
      code: "invalid_secure_field",
    });
    return;
  }
  res.status(503).json({ error: SECURE_FIELDS_DOWN, code: "secure_fields_unavailable" });
}

export interface SecureFieldTarget {
  tenant: HubTenant & { accountId: string };
  hubTicketId: number;
  /** DE staff (portal admin). Recorded on the Hub as not Hub-verified. */
  isDeStaff: boolean;
  /** The signed-in person's own name, never a value from the request body. */
  authorName: string;
}

export interface PortalSecureFieldRouteOptions {
  /** [authMiddleware] in production. */
  guards: RequestHandler[];
  hubTickets: Pick<HubTicketClient, "listSecureFields" | "createSecureField">;
  /** Resolve the caller's ticket like the ticket detail route, or answer and return null. */
  resolveTarget: (req: Request, res: Response, ticketId: string) => Promise<SecureFieldTarget | null>;
  /** Called after a value is stored (metadata only), e.g. the security log. */
  onStored?: (req: Request, meta: { ticketId: string; hubTicketId: number; secureFieldId: number; submittedBy: HubSecureFieldSubmitter }) => void;
}

/** Metadata the browser gets back. The value never comes back, and neither does the ciphertext. */
export function toBrowserSecureField(field: HubSecureField) {
  return {
    id: field.id,
    label: field.label,
    kind: field.kind,
    status: field.status,
    submittedBy: field.submittedBy,
    expiresAt: field.expiresAt,
    expiredAt: field.expiredAt,
    revealCount: field.revealCount,
    lastRevealedAt: field.lastRevealedAt,
    createdAt: field.createdAt,
  };
}

export function registerPortalSecureFieldRoutes(app: Express, options: PortalSecureFieldRouteOptions): void {
  const { guards, hubTickets, resolveTarget } = options;

  app.get(PORTAL_SECURE_FIELDS_PATH, guards, async (req: Request, res: Response) => {
    noStore(res);
    try {
      const target = await resolveTarget(req, res, String(req.params.id));
      if (!target) return;
      const listed = await hubTickets.listSecureFields(target.tenant, target.hubTicketId);
      if (!listed.ok) return sendHubFailure(res, listed);
      res.json({
        secureFields: listed.data.secureFields.map(toBrowserSecureField),
        // Reveal is a Hub-only, audited action (see the module comment).
        reveal: "hub_only",
      });
    } catch (err: any) {
      console.warn("[secure-fields] list failed", { error: err?.name || "error" });
      res.status(503).json({ error: SECURE_FIELDS_DOWN, code: "secure_fields_unavailable" });
    }
  });

  app.post(PORTAL_SECURE_FIELDS_PATH, guards, async (req: Request, res: Response) => {
    noStore(res);
    const parsed = secureFieldInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Add a short description and the value.", code: "invalid_secure_field", details: inputProblems(parsed.error) });
    }
    try {
      const target = await resolveTarget(req, res, String(req.params.id));
      if (!target) return;
      const submittedBy: HubSecureFieldSubmitter = target.isDeStaff ? "de_staff" : "client";
      const stored = await hubTickets.createSecureField(target.tenant, target.hubTicketId, {
        ...parsed.data,
        submittedBy,
        authorName: target.authorName,
      });
      if (!stored.ok) return sendHubFailure(res, stored);
      options.onStored?.(req, { ticketId: String(req.params.id), hubTicketId: target.hubTicketId, secureFieldId: stored.data.secureField.id, submittedBy });
      res.status(201).json({ secureField: toBrowserSecureField(stored.data.secureField) });
    } catch (err: any) {
      console.warn("[secure-fields] store failed", { error: err?.name || "error" });
      res.status(503).json({ error: SECURE_FIELDS_DOWN, code: "secure_fields_unavailable" });
    }
  });
}

// ---------------------------------------------------------------------------
// The website DE Desk "Get Support" visitor. Anonymous, so the ticket id alone
// is not enough: the widget ticket route mints a short-lived token bound to
// the Hub ticket it just created (and its account, when the visitor's email
// maps to one), signed with a key derived from the portal JWT secret.

export interface WidgetSecureFieldClaim {
  hubTicketId: number;
  accountId: string | null;
  portalClientId: string | null;
  /** The visitor name typed on the form, if any (display only, recorded as client). */
  name: string | null;
}

function widgetKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("de-desk-widget-secure-field:v1").digest();
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

export function issueWidgetSecureFieldToken(claim: WidgetSecureFieldClaim, secret: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ t: claim.hubTicketId, a: claim.accountId, c: claim.portalClientId, n: claim.name, e: now + WIDGET_SECURE_FIELD_TOKEN_TTL_MS }));
  const sig = createHmac("sha256", widgetKey(secret)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyWidgetSecureFieldToken(token: string, secret: string, now = Date.now()): WidgetSecureFieldClaim | null {
  const [payload, sig, extra] = String(token || "").split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", widgetKey(secret)).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isInteger(data?.t) || data.t <= 0 || typeof data?.e !== "number" || data.e <= now) return null;
    return {
      hubTicketId: data.t,
      accountId: typeof data.a === "string" && data.a ? data.a : null,
      portalClientId: typeof data.c === "string" && data.c ? data.c : null,
      name: typeof data.n === "string" && data.n.trim() ? data.n.trim().slice(0, 120) : null,
    };
  } catch {
    return null;
  }
}

export const widgetSecureFieldRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes." },
});

export interface WidgetSecureFieldRouteOptions {
  hubTickets: Pick<HubTicketClient, "createSecureField">;
  tokenSecret: () => string;
  rateLimiter?: RequestHandler;
}

export function registerWidgetSecureFieldRoute(app: Express, options: WidgetSecureFieldRouteOptions): void {
  const limiter = options.rateLimiter ?? widgetSecureFieldRateLimiter;
  app.post(WIDGET_SECURE_FIELD_PATH, limiter, async (req: Request, res: Response) => {
    noStore(res);
    const parsed = widgetInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Add a short description and the value.", code: "invalid_secure_field", details: inputProblems(parsed.error) });
    }
    let secret: string;
    try {
      secret = options.tokenSecret();
    } catch {
      return res.status(503).json({ error: SECURE_FIELDS_DOWN, code: "secure_fields_unavailable" });
    }
    const { token, ...input } = parsed.data;
    const claim = verifyWidgetSecureFieldToken(token, secret);
    if (!claim) {
      return res.status(403).json({ error: "This secure link has expired. Reply on your ticket and DE will send a new secure request.", code: "secure_field_token_invalid" });
    }
    try {
      const tenant = claim.accountId ? { accountId: claim.accountId, portalClientId: claim.portalClientId } : null;
      const stored = await options.hubTickets.createSecureField(tenant, claim.hubTicketId, {
        ...input,
        submittedBy: "client",
        authorName: claim.name || "Website visitor",
      });
      if (!stored.ok) return sendHubFailure(res, stored);
      console.log("[SECURITY] WIDGET_SECURE_FIELD_STORED", { hubTicketId: claim.hubTicketId, secureFieldId: stored.data.secureField.id });
      res.status(201).json({ secureField: toBrowserSecureField(stored.data.secureField) });
    } catch (err: any) {
      console.warn("[secure-fields] widget store failed", { error: err?.name || "error" });
      res.status(503).json({ error: SECURE_FIELDS_DOWN, code: "secure_fields_unavailable" });
    }
  });
}
