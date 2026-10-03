import type { Express, Request, RequestHandler, Response } from "express";
import { effectiveClientId, readIntegrationStatus } from "../../portalIntegrations";

/**
 * GET /api/portal/shipping: the shipping page's data for the signed-in user's company.
 *
 * Always answers { success, status }. When status.mode is "live" it also
 * answers { data } from the configured adapter (see ./index.ts), scoped to
 * effectiveClientId(req.user). Sample and hidden pages need no data.
 */
export const SHIPPING_PATH = "/api/portal/shipping";

export function registerPortalShippingRoutes(app: Express, opts: { guards: RequestHandler[] }) {
  app.get(SHIPPING_PATH, ...opts.guards, async (req: Request, res: Response) => {
    const status = readIntegrationStatus("shipping");
    if (status.mode !== "live") return res.json({ success: true, status });
    const clientId = effectiveClientId((req as any).user);
    if (!clientId) return res.json({ success: true, status, needsCompany: true });
    // Filled in by the shipping adapter work.
    return res.json({ success: true, status, data: null });
  });
}
