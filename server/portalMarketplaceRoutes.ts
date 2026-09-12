import type { Express, NextFunction, Request, Response } from "express";
import { MARKETPLACE_ELIGIBILITY } from "@shared/checkoutEligibility";

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
      if (req.user?.role === "admin") {
        res.json({
          eligibility: MARKETPLACE_ELIGIBILITY,
          items: [],
          status: "staff",
          reason:
            "DE staff account — this surface is the client view. Use the Digital Warehouse.",
          warehouseUrl: WAREHOUSE_PATH,
        });
        return;
      }

      const clientId = req.user?.clientId ?? null;
      res.json({
        eligibility: MARKETPLACE_ELIGIBILITY,
        items: [],
        status: clientId ? "unavailable" : "unmapped",
        reason: clientId
          ? "Tenant catalog is not available from Hub yet."
          : "This account is not mapped to a client tenant.",
      });
    },
  );
}
