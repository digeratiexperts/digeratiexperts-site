import type { Express, NextFunction, Request, Response } from "express";
import { MARKETPLACE_ELIGIBILITY } from "@shared/checkoutEligibility";
import { resolvePortalMarketplaceScope } from "@shared/marketplaceScope";

type AuthedRequest = Request & {
  user?: { role?: string; clientId?: string | null };
};

export const WAREHOUSE_PATH = "/internal/warehouse";

export function registerPortalMarketplaceRoutes(
  app: Express,
  authMiddleware: (req: AuthedRequest, res: Response, next: NextFunction) => unknown,
): void {
  app.get(
    "/api/portal/marketplace",
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      res.setHeader("Cache-Control", "no-store");

      // authMiddleware resolves role from the live portal record (never the JWT
      // claim), so this branch cannot be reached with a stale admin token.
      // DE staff are not clients: they get no Request Approval flow and no
      // tenant scope here — this surface stays empty and points at the warehouse.
      if (req.user?.role === "admin") {
        res.json({
          eligibility: MARKETPLACE_ELIGIBILITY,
          items: [],
          status: "staff",
          trustedClientIds: [],
          failClosed: true,
          reason:
            "DE staff account — this surface is the client view. Use the Digital Warehouse.",
          warehouseUrl: WAREHOUSE_PATH,
        });
        return;
      }

      const scope = resolvePortalMarketplaceScope({
        clientId: req.user?.clientId ?? null,
        // Hub catalog is not connected yet — authority is unavailable, not a grant.
        hubCatalog: "not_attempted",
      });
      res.json({
        eligibility: MARKETPLACE_ELIGIBILITY,
        items: scope.items,
        status: scope.status,
        trustedClientIds: scope.trustedClientIds,
        failClosed: scope.failClosed,
        reason: scope.reason,
      });
    },
  );
}
