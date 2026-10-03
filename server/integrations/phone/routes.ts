import type { Express, Request, RequestHandler, Response } from "express";
import { effectiveClientId, readIntegrationStatus } from "../../portalIntegrations";
import { loadPhoneData } from "./index";

/**
 * GET /api/portal/phone: the phone page's data for the signed-in user's company.
 *
 * Always answers { success, status }. When status.mode is "live" it also
 * answers one of:
 *   { needsCompany: true }  no company in view (DE admin in admin view)
 *   { notMapped: true }     company has no entry in PORTAL_PHONE_CLIENT_MAP
 *   { data }                PhoneData (./types.ts), read with that company's own token
 *   HTTP 502 { error }      vendor or configuration failure; detail goes to the server log only
 * Sample and hidden pages need no data.
 */
export const PHONE_PATH = "/api/portal/phone";
export const PHONE_UNAVAILABLE_MESSAGE = "Phone data isn't available right now.";

export function registerPortalPhoneRoutes(
  app: Express,
  opts: {
    guards: RequestHandler[];
    /** Test seams; production reads process.env and the global fetch. */
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  },
) {
  app.get(PHONE_PATH, ...opts.guards, async (req: Request, res: Response) => {
    const env = opts.env ?? process.env;
    const status = readIntegrationStatus("phone", env);
    if (status.mode !== "live" || !status.provider) return res.json({ success: true, status });
    const user = (req as any).user;
    const clientId = effectiveClientId(user);
    if (!clientId) return res.json({ success: true, status, needsCompany: true });
    try {
      const result = await loadPhoneData({
        provider: status.provider,
        clientId,
        userEmail: typeof user?.email === "string" ? user.email : null,
        env,
        fetchImpl: opts.fetchImpl,
      });
      return res.json({ success: true, status, ...result });
    } catch (err) {
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
      console.warn(`[portal-phone] ${status.provider} failed for client ${clientId}: ${reason}`);
      return res.status(502).json({ success: false, status, error: PHONE_UNAVAILABLE_MESSAGE });
    }
  });
}
