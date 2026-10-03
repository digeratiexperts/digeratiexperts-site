import type { Express, Request, RequestHandler, Response } from "express";
import { effectiveClientId, readIntegrationStatus } from "../../portalIntegrations";
import { loadShippingData } from "./index";
import type { Env } from "./types";

/**
 * GET /api/portal/shipping: the Ship Center data for the company in view.
 *
 * Always answers { success, status }. When status.mode is "live":
 *   { needsCompany: true }  no company in view (DE admin in admin view)
 *   { notMapped: true }     the company has no PORTAL_SHIPPING_CLIENT_MAP entry
 *   { data }                ShippingData (./types.ts), this company's only;
 *                           for a DE admin on the "manual" provider also
 *                           { manage: { clientId } } so the page can offer the
 *                           admin manual-records form for that company
 *   HTTP 502 { error }      vendor or configuration fault; details are logged
 *                           server-side, never sent to the browser
 */
export const SHIPPING_PATH = "/api/portal/shipping";

export const SHIPPING_UNAVAILABLE_MESSAGE = "Shipment tracking is unavailable right now. Please try again later.";

export function registerPortalShippingRoutes(
  app: Express,
  opts: { guards: RequestHandler[]; env?: Env; fetchImpl?: typeof fetch },
) {
  app.get(SHIPPING_PATH, ...opts.guards, async (req: Request, res: Response) => {
    const env = opts.env ?? process.env;
    const status = readIntegrationStatus("shipping", env);
    if (status.mode !== "live" || !status.provider) return res.json({ success: true, status });
    const user = (req as Request & { user?: Parameters<typeof effectiveClientId>[0] }).user;
    const clientId = effectiveClientId(user);
    if (!clientId) return res.json({ success: true, status, needsCompany: true });
    try {
      const result = await loadShippingData({ provider: status.provider, clientId, env, fetchImpl: opts.fetchImpl });
      if ("notMapped" in result) return res.json({ success: true, status, notMapped: true });
      const manage = status.provider === "manual" && user?.role === "admin" ? { manage: { clientId } } : {};
      return res.json({ success: true, status, data: result.data, ...manage });
    } catch (err) {
      const name = err instanceof Error ? err.name : "Error";
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[portal shipping] ${status.provider} for client ${clientId}: ${name}: ${message}`);
      return res.status(502).json({ success: false, status, error: SHIPPING_UNAVAILABLE_MESSAGE });
    }
  });
}
