import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { logSecurityEvent } from "./middleware/security";
import { getUser as portalAuthGetUser } from "./portalAuthStore";
import { storage } from "./storage";
import {
  mapWidgetTicketCreateFailure,
  widgetTicketNotConfigured,
} from "./widgetTicketFailure";
import { splitVisitorName, zohoClient, zohoDeskService } from "./zoho";
import { isZohoOAuthError } from "./zoho/zohoOAuthErrors";
import { PRIMARY_PHONE } from "@shared/companyContact";

/**
 * The public DE Desk "Get Support" ticket, and a status probe for the desk it
 * writes to. Zoho Desk is the system of record; the portal row is a secondary
 * mirror and never decides the outcome the visitor sees.
 *
 * Lifted out of routes.ts so the failure paths can be exercised over real HTTP
 * with the Desk mocked. Until then the only test on this path covered
 * splitVisitorName, and every Desk failure — an expired refresh token, a
 * missing scope, a rejected payload — was flattened into one generic 502 with
 * the cause visible only in the production log.
 */

export const WIDGET_TICKET_PATH = "/api/portal/zoho/ticket";
export const DESK_STATUS_PATH = "/api/zoho/desk/status";

// The number comes from the canonical contact module: shared/publicPhone.test.ts
// fails the build if it is spelled out anywhere else.
export const DESK_UNAVAILABLE_MESSAGE =
  `Our support desk is temporarily unavailable. Your message is still here — please try again in a few minutes, or call ${PRIMARY_PHONE.display}.`;
export const TICKET_REJECTED_MESSAGE = "We couldn't open the ticket right now. Please try again.";

export type DeskFailureKind = "unavailable" | "rejected";

export interface DeskFailure {
  kind: DeskFailureKind;
  /** HTTP status Zoho answered with, when it answered at all. */
  status?: number;
  /** Zoho's own errorCode, e.g. INVALID_OAUTH. Never a token. */
  errorCode?: string;
  message: string;
}

const AUTH_ERROR_CODES = new Set([
  "INVALID_OAUTH",
  "INVALID_TOKEN",
  "UNAUTHORIZED",
  "OAUTH_SCOPE_MISMATCH",
  "INVALID_OAUTHSCOPE",
]);

/**
 * Sort a Desk failure into the two things a visitor needs to know apart:
 * "the desk cannot be reached right now" (our side: credentials, scope,
 * connectivity — retrying later may work, and someone at DE needs to look) vs
 * "the desk refused this ticket" (their input, or a Zoho-side validation).
 *
 * Reads only the shape of the error. Nothing here touches a token.
 */
export function classifyDeskFailure(error: unknown): DeskFailure {
  if (isZohoOAuthError(error) && error.product === "desk") {
    return {
      kind: "unavailable",
      errorCode: error.zohoError || error.code,
      message: error.message,
    };
  }

  const err = (error ?? {}) as {
    message?: unknown;
    response?: { status?: unknown; data?: { errorCode?: unknown; message?: unknown } };
  };
  const message = typeof err.message === "string" ? err.message : String(error ?? "unknown error");
  const status = typeof err.response?.status === "number" ? err.response.status : undefined;
  const errorCode =
    typeof err.response?.data?.errorCode === "string" ? err.response.data.errorCode : undefined;

  const refreshFailed = /refresh zoho desk access token|no access token in zoho desk/i.test(message);
  const authStatus = status === 401 || status === 403;
  const authCode = !!errorCode && (AUTH_ERROR_CODES.has(errorCode) || /oauth|scope|token/i.test(errorCode));
  const unreachable = status === undefined && !errorCode && /ECONN|ETIMEDOUT|ENOTFOUND|socket hang up|network/i.test(message);

  return {
    kind: refreshFailed || authStatus || authCode || unreachable ? "unavailable" : "rejected",
    status,
    errorCode,
    message,
  };
}

const widgetTicketRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many support requests. Please try again later.",
});

const deskStatusRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many requests.",
});

function validateInput(req: Request, res: Response, next: NextFunction) {
  if (JSON.stringify(req.body ?? {}).length > 1024 * 1024) {
    return res.status(413).json({ error: "Payload too large" });
  }
  next();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The status probe reaches Zoho over the network. Cache it so a dashboard or
// a monitor polling it cannot turn into a Zoho rate-limit problem of its own.
const DESK_STATUS_TTL_MS = 60 * 1000;
let deskStatusCache: { at: number; body: DeskStatus } | null = null;

export interface DeskStatus {
  configured: boolean;
  connected: boolean;
  /** Present only when not connected. */
  reason?: DeskFailureKind | "not_configured";
  errorCode?: string;
  status?: number;
  checkedAt: string;
}

export function resetDeskStatusCacheForTests(): void {
  deskStatusCache = null;
}

async function probeDesk(): Promise<DeskStatus> {
  const checkedAt = new Date().toISOString();
  if (!zohoClient.isDeskConfigured()) {
    return { configured: false, connected: false, reason: "not_configured", checkedAt };
  }
  try {
    // The cheapest authenticated read Desk offers. If the refresh token, its
    // scopes or the network are wrong, this is where it shows.
    const client = await zohoClient.getDeskClient();
    await client.get("/organizations");
    return { configured: true, connected: true, checkedAt };
  } catch (error) {
    const failure = classifyDeskFailure(error);
    console.error("[DESK STATUS] Zoho Desk unreachable:", {
      kind: failure.kind,
      status: failure.status,
      errorCode: failure.errorCode,
      message: failure.message,
    });
    return {
      configured: true,
      connected: false,
      reason: failure.kind,
      errorCode: failure.errorCode,
      status: failure.status,
      checkedAt,
    };
  }
}

export interface WidgetTicketRouteOptions {
  /** Tests pass a pass-through so five requests do not trip the real limiter. */
  ticketRateLimiter?: RequestHandler;
  statusRateLimiter?: RequestHandler;
}

export function registerWidgetTicketRoute(app: Express, options: WidgetTicketRouteOptions = {}): void {
  const ticketLimiter = options.ticketRateLimiter ?? widgetTicketRateLimiter;
  const statusLimiter = options.statusRateLimiter ?? deskStatusRateLimiter;

  app.get(DESK_STATUS_PATH, statusLimiter, async (_req: Request, res: Response) => {
    const now = Date.now();
    if (deskStatusCache && now - deskStatusCache.at < DESK_STATUS_TTL_MS) {
      return res.json({ ...deskStatusCache.body, cached: true });
    }
    const body = await probeDesk();
    deskStatusCache = { at: now, body };
    res.status(body.connected ? 200 : 503).json({ ...body, cached: false });
  });

  app.post(WIDGET_TICKET_PATH, ticketLimiter, validateInput, async (req: Request, res: Response) => {
    try {
      const { email, subject, description, priority, sessionId: advisorSessionId, name } = req.body ?? {};

      if (!email || !subject || !description) {
        return res.status(400).json({ error: "Email, subject, and description are required" });
      }
      if (!EMAIL_RE.test(String(email))) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      if (String(subject).length > 200 || String(description).length > 5000) {
        return res.status(400).json({ error: "Subject or description too long" });
      }

      const priorityValue = priority || "Medium";
      const priorityLower = String(priorityValue).toLowerCase();

      if (!zohoClient.isDeskConfigured()) {
        console.error("[WIDGET TICKET] Zoho Desk is not configured");
        const failure = widgetTicketNotConfigured();
        return res.status(failure.status).json({
          ...failure.body,
          error: DESK_UNAVAILABLE_MESSAGE,
          retryable: true,
        });
      }

      const { firstName, lastName } = splitVisitorName(
        typeof name === "string" ? name : undefined,
        String(email),
      );

      let zohoTicket: { id?: string; ticketNumber?: string } | undefined;
      try {
        zohoTicket = await zohoDeskService.createTicket({
          subject,
          description,
          email,
          firstName,
          lastName,
          priority: priorityValue,
        });
      } catch (zohoErr) {
        const failure = classifyDeskFailure(zohoErr);
        const mapped = mapWidgetTicketCreateFailure(zohoErr);
        // Enough to act on from the log, and nothing that could be a credential.
        console.error("[WIDGET TICKET] Zoho Desk create failed:", {
          kind: failure.kind,
          status: failure.status,
          errorCode: failure.errorCode,
          message: failure.message,
          code: mapped.body.code,
        });
        if (failure.kind === "unavailable") {
          return res.status(503).json({
            ...mapped.body,
            code: "desk_auth_unavailable",
            error: DESK_UNAVAILABLE_MESSAGE,
            retryable: true,
          });
        }
        return res.status(mapped.status).json({
          ...mapped.body,
          error: TICKET_REJECTED_MESSAGE,
          retryable: true,
        });
      }

      if (!zohoTicket?.id) {
        console.error("[WIDGET TICKET] Zoho Desk returned no ticket id");
        return res.status(502).json({
          success: false as const,
          code: "desk_create_failed" as const,
          error: TICKET_REJECTED_MESSAGE,
          retryable: true,
        });
      }

      const zohoTicketId = zohoTicket.id;
      const ticketNumber =
        zohoTicket.ticketNumber ||
        `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      console.log(`✅ Widget ticket created in Zoho Desk: ${zohoTicketId}`);

      // Secondary: mirror to the portal when the email maps to a portal account.
      // Zoho is the record; a mirror failure is logged, never shown as a
      // ticket failure, because the ticket exists. (When the database is on
      // its memory fallback this mirror is not durable — tracked as #248.)
      try {
        if (typeof advisorSessionId === "string" && advisorSessionId.trim()) {
          try {
            const { upsertDeskSession } = await import("./services/msp-advisor");
            await upsertDeskSession({
              sessionId: advisorSessionId.trim(),
              email: String(email).toLowerCase(),
            });
          } catch {}
        }

        const portalUser = portalAuthGetUser(String(email));
        if (portalUser?.clientId && portalUser?.id) {
          let descriptionWithChat = String(description);
          if (typeof advisorSessionId === "string" && advisorSessionId.trim()) {
            descriptionWithChat = `${description}\n\n---\nDE Desk session: ${advisorSessionId.trim()}`;
          }
          const localTicket = await storage.createPortalTicket({
            clientId: portalUser.clientId,
            createdBy: portalUser.id,
            ticketNumber,
            subject,
            description: descriptionWithChat,
            status: "open",
            priority:
              priorityLower === "high" || priorityLower === "urgent"
                ? "high"
                : priorityLower === "low"
                  ? "low"
                  : "medium",
            category: "de-desk",
          });
          try {
            await storage.updatePortalTicket(localTicket.id, { assignedTo: `zoho:${zohoTicketId}` });
          } catch {}
          console.log(`✅ Widget ticket mirrored to portal: ${ticketNumber}`);
        }
      } catch (localErr: any) {
        console.warn("Could not mirror widget ticket to portal:", localErr?.message || localErr);
      }

      res.json({
        success: true,
        ticketNumber,
        zohoTicketId,
        message: "Your support request has been received.",
      });
      logSecurityEvent("WIDGET_TICKET_CREATED", req, { email, ticketNumber, zohoTicketId });
    } catch (error: any) {
      console.error("[WIDGET TICKET ERROR]", error?.message || error);
      res.status(500).json({ error: "Failed to create ticket. Please try again.", retryable: true });
    }
  });
}
