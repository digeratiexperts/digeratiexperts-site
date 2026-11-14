import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { StoreClientIdentity } from "./storeClientPricing";

type StoreClientRequest = Request & {
  user?: {
    clientId?: string | null;
  };
  portalClientContext?: {
    clientId: string | null;
    impersonating: boolean;
  };
};

type ResolveAuthenticatedStoreClient = (
  user: StoreClientRequest["user"],
  loadClient: (clientId: string) => Promise<StoreClientIdentity | undefined>,
) => Promise<StoreClientIdentity | undefined>;

type StoreClientInfoDependencies = {
  resolveAuthenticatedStoreClient: ResolveAuthenticatedStoreClient;
  loadClient: (clientId: string) => Promise<StoreClientIdentity | undefined>;
  isUnavailableError: (error: unknown) => boolean;
};

type StoreClientPricingDependencies = StoreClientInfoDependencies & {
  resolveClientPricingRows: (clientId: string) => Promise<unknown[]>;
};

const STORE_PRICING_RETRY_SECONDS = 30;

function effectiveStoreClientUser(req: StoreClientRequest): StoreClientRequest["user"] {
  if (req.portalClientContext?.impersonating) {
    return { clientId: req.portalClientContext.clientId };
  }
  return req.portalClientContext?.clientId
    ? { clientId: req.portalClientContext.clientId }
    : req.user;
}

export function sendStorePricingUnavailable(res: Response, error: string): Response {
  res.setHeader("Retry-After", String(STORE_PRICING_RETRY_SECONDS));
  res.setHeader("Cache-Control", "no-store");
  return res.status(503).json({ error, retryable: true });
}

export function createStoreClientInfoHandler(
  dependencies: StoreClientInfoDependencies,
): RequestHandler {
  return async (request, res) => {
    const req = request as StoreClientRequest;
    try {
      const client = await dependencies.resolveAuthenticatedStoreClient(
        effectiveStoreClientUser(req),
        dependencies.loadClient,
      );
      if (!client) {
        res.json({ clientType: "public", clientId: null });
        return;
      }

      const serviceType = client.serviceType || "public";
      const clientType = serviceType === "managed"
        ? "managed"
        : serviceType === "comanaged"
          ? "comanaged"
          : "public";

      res.json({
        clientType,
        clientId: client.id,
        companyName: client.companyName,
      });
    } catch (error) {
      console.error("[ERROR] Failed to get client info:", error);
      if (dependencies.isUnavailableError(error)) {
        sendStorePricingUnavailable(res, "Client information is temporarily unavailable");
        return;
      }
      res.status(500).json({ error: "Failed to get client info" });
    }
  };
}

export function createStoreClientPricingHandler(
  dependencies: StoreClientPricingDependencies,
): RequestHandler {
  return async (request, res) => {
    const req = request as StoreClientRequest;
    try {
      const client = await dependencies.resolveAuthenticatedStoreClient(
        effectiveStoreClientUser(req),
        dependencies.loadClient,
      );
      if (!client) {
        res.json({ pricing: [] });
        return;
      }

      const pricing = await dependencies.resolveClientPricingRows(client.id);
      res.json({ pricing });
    } catch (error) {
      console.error("[ERROR] Failed to get client pricing:", error);
      if (dependencies.isUnavailableError(error)) {
        sendStorePricingUnavailable(res, "Client pricing is temporarily unavailable");
        return;
      }
      res.status(500).json({ error: "Failed to get client pricing" });
    }
  };
}

export function requireDemoClientPricingAdministration(
  isEnabled: () => boolean,
): (req: Request, res: Response, next: NextFunction) => void {
  return (_req, res, next) => {
    if (!isEnabled()) {
      res.status(409).json({
        error: "Demo client pricing administration is disabled in this environment",
      });
      return;
    }
    next();
  };
}
