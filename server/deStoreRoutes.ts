import type { Express, NextFunction, Request, Response } from "express";
import { DAY_5_DELAY_NOTICE_SUMMARY, SHIPPING_PROMISE, whereWeSellAddressStep, WHERE_WE_SELL_SHORT } from "@shared/deStoreLegalCopy";
import { listStoreCatalog, offeringLabel, offeringSummary, type StoreCatalogSku } from "@shared/deStoreCatalog";
import type { BuyerRole, OrderLineInput, PostalAddress } from "@shared/deStoreContract";
import {
  isDeStoreConsumerCheckoutEnabled,
  isDeStoreEnabled,
  isDeStorePreviewCatalogEnabled,
  readSiteStateListConfig,
} from "./config/deStore";
import { csrfOriginGuard } from "./deStoreCsrf";
import { requestIp, requestUserAgent } from "./deStoreClickwrap";
import { placeStoreOrder, quoteStoreOrder, type StoreCheckoutCommand } from "./deStoreCheckout";
import { getStoreFulfillmentRecord, recordHubFulfillmentEvent } from "./deStoreFulfillment";
import { hubStoreClient, type HubStoreClient } from "./integrations/hubStoreClient";
import { verifySignedRequest } from "./integrations/deSyncAuth";
import { apiGeneralRateLimiter, paymentRateLimiter } from "./middleware/rateLimiter";
import type { PaymentCaptureResult } from "./deStoreCheckout";

type AuthedRequest = Request & {
  user?: { email?: string; clientId?: string | null };
};

export interface DeStoreRouteDeps {
  isEnabled: () => boolean;
  consumerCheckout: () => boolean;
  previewCatalog: () => boolean;
  stateList: typeof readSiteStateListConfig;
  hub: HubStoreClient;
  capturePayment: (input: {
    calculationId: string;
    totalCents: number;
    currency: "USD";
    email: string;
    paymentConfirmation?: string;
  }) => Promise<PaymentCaptureResult>;
  now?: () => Date;
}

export const defaultDeStoreCapturePayment: DeStoreRouteDeps["capturePayment"] = async () => ({
  ok: false,
  code: "payment_not_configured",
  error: "Hosted payment is not configured. No payment has been taken.",
});

export const defaultDeStoreRouteDeps: DeStoreRouteDeps = {
  isEnabled: () => isDeStoreEnabled(),
  consumerCheckout: () => isDeStoreConsumerCheckoutEnabled(),
  previewCatalog: () => isDeStorePreviewCatalogEnabled(),
  stateList: () => readSiteStateListConfig(),
  hub: hubStoreClient,
  capturePayment: defaultDeStoreCapturePayment,
};

function notFound(_req: Request, res: Response) {
  return res.status(404).json({ error: "Not found" });
}

function parseBuyerRole(value: unknown): BuyerRole | null {
  return value === "managed" || value === "comanaged" || value === "self_managed" ? value : null;
}

function asAddress(value: unknown): PostalAddress | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.street1 !== "string" || typeof record.city !== "string") return null;
  return {
    name: typeof record.name === "string" ? record.name : undefined,
    company: typeof record.company === "string" ? record.company : undefined,
    street1: record.street1,
    street2: typeof record.street2 === "string" ? record.street2 : undefined,
    city: record.city,
    region: String(record.region ?? ""),
    postalCode: String(record.postalCode ?? ""),
    country: String(record.country ?? "US"),
  };
}

function publicSku(sku: StoreCatalogSku) {
  return {
    sku: sku.sku,
    offering: sku.offering,
    name: sku.name,
    description: sku.description,
    taxCategory: sku.taxCategory,
    buyerRoles: sku.buyerRoles,
    isKit: sku.isKit,
    isRouter: sku.isRouter,
    fccCoveredListCheckRequired: sku.fccCoveredListCheckRequired,
    refurbishedGrade: sku.refurbishedGrade,
    termMonths: sku.termMonths,
    previewOnly: sku.previewOnly,
  };
}

export function registerDeStoreRoutes(app: Express, deps: DeStoreRouteDeps = defaultDeStoreRouteDeps) {
  const allowIfEnabled = (req: Request, res: Response, next: NextFunction) => {
    if (!deps.isEnabled()) return notFound(req, res);
    return next();
  };

  app.get("/api/store/v1/status", allowIfEnabled, (_req, res) => {
    const stateList = deps.stateList();
    res.json({
      enabled: true,
      consumerCheckout: deps.consumerCheckout(),
      previewCatalog: deps.previewCatalog(),
      shippingPromise: SHIPPING_PROMISE,
      day5DelayNotice: DAY_5_DELAY_NOTICE_SUMMARY,
      whereWeSellShort: WHERE_WE_SELL_SHORT,
      whereWeSellAddressStep: whereWeSellAddressStep(stateList.enabled ? stateList.regions : []),
      stateList: {
        enabled: stateList.enabled,
        mode: stateList.mode,
        regions: stateList.enabled ? stateList.regions : [],
      },
      offerings: [
        { id: "proactive_ecosystem", label: offeringLabel("proactive_ecosystem"), summary: offeringSummary("proactive_ecosystem") },
        { id: "refurbished_kits", label: offeringLabel("refurbished_kits"), summary: offeringSummary("refurbished_kits") },
        { id: "standalone_services", label: offeringLabel("standalone_services"), summary: offeringSummary("standalone_services") },
      ],
    });
  });

  app.get("/api/store/v1/catalog", allowIfEnabled, (req, res) => {
    const offering = typeof req.query.offering === "string" ? req.query.offering : undefined;
    const items = listStoreCatalog({ previewEnabled: deps.previewCatalog() }).filter((item) =>
      offering ? item.offering === offering : true,
    );
    res.json({ items: items.map(publicSku) });
  });

  app.post("/api/store/v1/tax/quote", allowIfEnabled, csrfOriginGuard, paymentRateLimiter, async (req, res) => {
    const buyerRole = parseBuyerRole(req.body?.buyerRole);
    const billTo = asAddress(req.body?.billTo);
    const shipTo = asAddress(req.body?.shipTo);
    const serviceAddress = req.body?.serviceAddress ? asAddress(req.body.serviceAddress) : null;
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    if (!buyerRole || !billTo || !shipTo) {
      return res.status(400).json({
        code: "invalid_address",
        error: "A buyer role, billing address, and shipping address are required. No payment has been taken.",
      });
    }
    const result = await quoteStoreOrder(
      {
        email,
        buyerRole,
        accountId: typeof req.body?.accountId === "number" ? req.body.accountId : undefined,
        addresses: { billTo, shipTo, serviceAddress },
        lines: Array.isArray(req.body?.lines) ? (req.body.lines as OrderLineInput[]) : [],
        idempotencyKey: typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined,
      },
      {
        now: deps.now ?? (() => new Date()),
        ip: requestIp(req),
        userAgent: requestUserAgent(req),
        stateList: deps.stateList(),
        hub: deps.hub,
      },
    );
    if (!result.ok) {
      return res.status(result.status).json({
        code: result.code,
        error: result.error,
        blockedRegions: result.blockedRegions,
      });
    }
    return res.status(200).json(result.quote);
  });

  app.post("/api/store/v1/checkout", allowIfEnabled, csrfOriginGuard, paymentRateLimiter, async (req, res) => {
    const buyerRole = parseBuyerRole(req.body?.buyerRole);
    const billTo = asAddress(req.body?.billTo);
    const shipTo = asAddress(req.body?.shipTo);
    const serviceAddress = req.body?.serviceAddress ? asAddress(req.body.serviceAddress) : null;
    const email = typeof req.body?.email === "string" ? req.body.email : String((req as AuthedRequest).user?.email ?? "");
    if (!buyerRole || !billTo || !shipTo) {
      return res.status(400).json({
        code: "invalid_address",
        error: "A buyer role, billing address, and shipping address are required. No payment has been taken.",
      });
    }
    const command: StoreCheckoutCommand = {
      email,
      buyerRole,
      accountId: typeof req.body?.accountId === "number" ? req.body.accountId : undefined,
      addresses: { billTo, shipTo, serviceAddress },
      lines: Array.isArray(req.body?.lines) ? (req.body.lines as OrderLineInput[]) : [],
      clickwrap: req.body?.clickwrap ?? {},
      paymentConfirmation: typeof req.body?.paymentConfirmation === "string" ? req.body.paymentConfirmation : undefined,
      idempotencyKey: typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined,
    };
    const result = await placeStoreOrder(command, {
      now: deps.now ?? (() => new Date()),
      ip: requestIp(req),
      userAgent: requestUserAgent(req),
      stateList: deps.stateList(),
      consumerCheckout: deps.consumerCheckout(),
      hub: deps.hub,
      capturePayment: deps.capturePayment,
    });
    if (!result.ok) {
      return res.status(result.status).json({
        code: result.code,
        error: result.error,
        missing: result.missing,
        blockedRegions: result.blockedRegions,
      });
    }
    return res.status(200).json({
      siteOrderId: result.siteOrderId,
      calculationId: result.calculationId,
      paymentRef: result.paymentRef,
      totalCents: result.totalCents,
      acceptancesRecorded: result.acceptancesRecorded,
    });
  });

  app.get("/api/store/v1/orders/:id", allowIfEnabled, (req, res) => {
    const record = getStoreFulfillmentRecord(String(req.params.id ?? ""));
    if (!record) return notFound(req, res);
    return res.json(record);
  });

  app.post("/api/store/webhooks/hub", allowIfEnabled, apiGeneralRateLimiter, (req, res) => {
    const verified = verifySignedRequest(req, "hub_to_website");
    if (!verified.ok) {
      return res.status(verified.status).json({ error: verified.error });
    }
    const body = req.body ?? {};
    const eventType = String(body.eventType ?? "");
    const siteOrderId = String(body.siteOrderId ?? body.payload?.siteOrderId ?? "");
    const eventId = String(body.eventId ?? verified.eventId ?? "");
    if (!eventType || !siteOrderId || !eventId) {
      return res.status(400).json({ code: "invalid_event", error: "eventType, eventId, and siteOrderId are required." });
    }
    const record = recordHubFulfillmentEvent({
      eventId,
      eventType: eventType as any,
      occurredAt: String(body.occurredAt ?? new Date().toISOString()),
      hubOrderId: typeof body.hubOrderId === "string" ? body.hubOrderId : typeof body.payload?.hubOrderId === "string" ? body.payload.hubOrderId : undefined,
      siteOrderId,
      payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    });
    return res.status(200).json({ ok: true, eventId, siteOrderId: record.siteOrderId, hubOrderId: record.hubOrderId });
  });
}
