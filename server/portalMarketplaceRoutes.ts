import type { Express, NextFunction, Request, Response } from "express";
import { MARKETPLACE_ELIGIBILITY } from "@shared/checkoutEligibility";
import { resolvePortalMarketplaceScope } from "@shared/marketplaceScope";

type AuthedRequest = Request & {
  user?: { role?: string; clientId?: string | null };
};

export function registerPortalMarketplaceRoutes(
  app: Express,
  authMiddleware: (req: AuthedRequest, res: Response, next: NextFunction) => unknown,
): void {
  app.get(
    "/api/portal/marketplace",
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      const scope = resolvePortalMarketplaceScope({
        clientId: req.user?.clientId ?? null,
        // Hub catalog is not connected yet — authority is unavailable, not a grant.
        hubCatalog: "not_attempted",
      });
      res.setHeader("Cache-Control", "no-store");
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
