import type { Express, Request, RequestHandler, Response } from "express";
import { effectiveClientId, readIntegrationStatus } from "../../portalIntegrations";
import { loadVpnData } from "./index";

/**
 * GET /api/portal/vpn: the VPN page's data for the signed-in user's company.
 *
 * Always answers { success, status }. When status.mode is "live" it also
 * answers one of:
 *   { needsCompany: true }  no company in view (DE admin in admin view)
 *   { notMapped: true }     company has no entry in PORTAL_VPN_CLIENT_MAP
 *   { data }                VpnData (./types.ts) for that company's scope only
 *   HTTP 502 { error }      vendor or configuration failure; detail goes to the server log only
 * With the "manual" provider, a DE admin viewing as a company also gets
 * { manage: { clientId } } so the page can offer the admin manual-records form.
 * Sample and hidden pages need no data.
 */
export const VPN_PATH = "/api/portal/vpn";
export const VPN_UNAVAILABLE_MESSAGE = "VPN data isn't available right now.";

export function registerPortalVpnRoutes(
  app: Express,
  opts: {
    guards: RequestHandler[];
    /** Test seams; production reads process.env and the global fetch. */
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  },
) {
  app.get(VPN_PATH, ...opts.guards, async (req: Request, res: Response) => {
    const env = opts.env ?? process.env;
    const status = readIntegrationStatus("vpn", env);
    if (status.mode !== "live" || !status.provider) return res.json({ success: true, status });
    const user = (req as any).user;
    const clientId = effectiveClientId(user);
    if (!clientId) return res.json({ success: true, status, needsCompany: true });
    try {
      const result = await loadVpnData({ provider: status.provider, clientId, env, fetchImpl: opts.fetchImpl });
      const manage = status.provider === "manual" && user?.role === "admin" ? { manage: { clientId } } : {};
      return res.json({ success: true, status, ...result, ...manage });
    } catch (err) {
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
      console.warn(`[portal-vpn] ${status.provider} failed for client ${clientId}: ${reason}`);
      return res.status(502).json({ success: false, status, error: VPN_UNAVAILABLE_MESSAGE });
    }
  });
}
