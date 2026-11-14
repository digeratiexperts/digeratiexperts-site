import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import {
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  AUTORENEW_TERMS_VERSION,
  autoRenewConsentRequiredSkus,
  buildAutoRenewTermsText,
  frequencyFromPricingType,
  isAutoRenewGatedSku,
  termMonthsForFrequency,
  type AutoRenewCustomerType,
  type AutoRenewFrequency,
} from "@shared/autoRenewContract";
import { isAutoRenewContractEnabled } from "./config/autoRenewContract";
import { getClient } from "./portalAuthStore";
import { canonicalizeCheckoutLineItems, type CanonicalCheckoutLineItem } from "./secureStoreCheckout";
import { toPriceOverrides, resolveClientPricingRows } from "./storeClientPricing";
import { notificationService } from "./services/notificationService";
import {
  AutoRenewConsentError,
  assertValidAutoRenewConsent,
  websiteCreateSubscriptionRequestSchema,
} from "./integrations/hubSubscriptionsContract";
import { hubSubscriptionsClient, type HubSubscriptionsClient } from "./integrations/hubSubscriptionsClient";
import { paymentRateLimiter } from "./middleware/rateLimiter";

type StoreRole = "public" | "prospect" | "managed" | "comanaged" | "admin";

type AuthedRequest = Request & {
  userId?: string;
  user?: {
    id?: string;
    email?: string;
    fullName?: string;
    role?: string;
    storeRole?: StoreRole;
    clientId?: string | null;
  };
};

type AuthMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => unknown;

export interface AutoRenewRouteDeps {
  isEnabled: () => boolean;
  getClient: typeof getClient;
  hub: HubSubscriptionsClient;
  sendSubscriptionConfirmation: typeof notificationService.sendSubscriptionConfirmation;
  resolvePricing: (clientId: string | null | undefined) => Promise<ReturnType<typeof toPriceOverrides>>;
  storeGuards?: RequestHandler[];
  portalGuards?: RequestHandler[];
  portalCancelGuards?: RequestHandler[];
}

export const STORE_SUBSCRIPTIONS_PATH = "/api/store/subscriptions";
export const PORTAL_SUBSCRIPTIONS_PATH = "/api/portal/subscriptions";
export const PORTAL_SUBSCRIPTION_CANCEL_PATH = "/api/portal/subscriptions/:id/cancel";

export const CSRF_REQUEST_HEADER = "x-csrf-token";

function firstHeaderValue(value: unknown, max = 200): string {
  if (Array.isArray(value)) return stringValue(value[0], max);
  return stringValue(value, max);
}

function requestHosts(req: Request): string[] {
  const hosts = new Set<string>();
  const host = firstHeaderValue(req.get("host"), 200).toLowerCase();
  if (host) hosts.add(host);
  const forwarded = firstHeaderValue(req.headers["x-forwarded-host"], 200).toLowerCase();
  const forwardedHost = forwarded.split(",")[0]?.trim() ?? "";
  if (forwardedHost) hosts.add(forwardedHost);
  return [...hosts];
}

function sameOriginHost(req: Request, candidateHost: string): boolean {
  return requestHosts(req).includes(candidateHost.toLowerCase());
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  const secFetchSite = stringValue(req.get("sec-fetch-site"), 40).toLowerCase();
  if (secFetchSite === "cross-site") {
    return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Cross-site request rejected." });
  }
  const origin = stringValue(req.get("origin"), 300);
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!originHost || !sameOriginHost(req, originHost)) {
        return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Cross-origin request rejected." });
      }
    } catch {
      return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Invalid origin." });
    }
  } else {
    const referer = stringValue(req.get("referer"), 500);
    if (referer) {
      try {
        const refHost = new URL(referer).host.toLowerCase();
        if (!refHost || !sameOriginHost(req, refHost)) {
          return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Cross-origin referer rejected." });
        }
      } catch {
        return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Invalid referer." });
      }
    }
  }

  // Custom header required so browsers preflight these JSON POSTs.
  const headerToken = firstHeaderValue(req.headers[CSRF_REQUEST_HEADER], 200);
  if (!headerToken) {
    return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Missing CSRF header." });
  }
  if (req.cookies && req.cookies["x-csrf-token"] && req.cookies["x-csrf-token"] !== headerToken) {
    return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "CSRF token mismatch." });
  }
  return next();
}

export const defaultAutoRenewRouteDeps: AutoRenewRouteDeps = {
  isEnabled: () => isAutoRenewContractEnabled(),
  getClient,
  hub: hubSubscriptionsClient,
  sendSubscriptionConfirmation: (data) => notificationService.sendSubscriptionConfirmation(data),
  resolvePricing: async (clientId) => toPriceOverrides(await resolveClientPricingRows(clientId)),
};

function stringValue(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requestIp(req: Request): string {
  const forwarded = stringValue(req.headers["x-forwarded-for"], 200).split(",")[0]?.trim();
  return forwarded || stringValue(req.ip, 200) || stringValue(req.socket?.remoteAddress, 200) || "unknown";
}

function requestUserAgent(req: Request): string {
  return stringValue(req.get("user-agent"), 1000) || "unknown";
}

function storeRole(req: AuthedRequest): StoreRole {
  return (req.user?.storeRole || "public") as StoreRole;
}

function resolvePortalClient(
  req: AuthedRequest,
  lookup: typeof getClient,
  claimedPortalClientId?: string,
) {
  const sessionClientId = stringValue(req.user?.clientId, 100);
  const claimed = stringValue(claimedPortalClientId, 100);
  if (claimed && sessionClientId && claimed !== sessionClientId) {
    return { ok: false as const, error: "portalClientId does not match the signed-in account", status: 403 as const };
  }
  const portalClientId = sessionClientId || claimed;
  if (!portalClientId) {
    return {
      ok: false as const,
      error: "A linked Client Portal account is required to start this subscription",
      status: 409 as const,
    };
  }
  const client = lookup(portalClientId);
  const accountId = stringValue(client?.hubAccountId, 100);
  if (!accountId) {
    return {
      ok: false as const,
      error: "This Client Portal account is not linked to a Hub account yet. Request a quote so we can finish setup.",
      status: 409 as const,
      code: "HUB_ACCOUNT_REQUIRED" as const,
      portalClientId,
    };
  }
  return { ok: true as const, portalClientId, accountId, client };
}

export function subscriptionPlanFromLines(items: CanonicalCheckoutLineItem[]): {
  skuIds: string[];
  priceCents: number;
  frequency: AutoRenewFrequency;
  termMonths: number;
} | { error: string } {
  if (items.length === 0) return { error: "Line items are required" };
  const nonGated = items.filter((item) => !isAutoRenewGatedSku(item.sku));
  if (nonGated.length > 0) {
    return {
      error:
        "Auto-renew checkout can only include Phishing Simulation Starter or Security Awareness Training. Remove other items or request a quote.",
    };
  }
  const frequencies = new Set<AutoRenewFrequency>();
  for (const item of items) {
    const frequency = frequencyFromPricingType(item.pricingType);
    if (!frequency) return { error: `Cannot determine billing frequency for ${item.sku}` };
    frequencies.add(frequency);
  }
  if (frequencies.size !== 1) {
    return { error: "Items in this cart renew on different schedules. Request a quote or check out each plan separately." };
  }
  const frequency = [...frequencies][0]!;
  const priceCents = items.reduce((sum, item) => sum + Math.round(item.total * 100), 0);
  if (priceCents <= 0) return { error: "Subscription price is invalid" };
  return {
    skuIds: items.map((item) => item.sku),
    priceCents,
    frequency,
    termMonths: termMonthsForFrequency(frequency),
  };
}

export function publicCapabilitiesPayload(enabled = isAutoRenewContractEnabled()) {
  return { autoRenewContractEnabled: enabled };
}

export function registerAutoRenewRoutes(
  app: Express,
  authMiddleware: AuthMiddleware,
  requireRole: (...roles: StoreRole[]) => AuthMiddleware,
  deps: AutoRenewRouteDeps = defaultAutoRenewRouteDeps,
) {
  const storeGuards = deps.storeGuards ?? [
    csrfOriginGuard,
    paymentRateLimiter as any,
    authMiddleware as any,
    requireRole("comanaged", "admin") as any,
  ];
  const portalGuards = deps.portalGuards ?? [authMiddleware as any];
  const portalCancelGuards = deps.portalCancelGuards ?? [csrfOriginGuard, authMiddleware as any];

  app.get("/api/public/capabilities", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json(publicCapabilitiesPayload(deps.isEnabled()));
  });

  app.post(
    STORE_SUBSCRIPTIONS_PATH,
    storeGuards,
    async (req: AuthedRequest, res: Response) => {
      if (!deps.isEnabled()) {
        return res.status(404).json({
          code: "AUTORENEW_CONTRACT_DISABLED",
          error: "Subscription checkout is not available. Request a quote for these items.",
        });
      }

      const body = req.body || {};
      const parsed = websiteCreateSubscriptionRequestSchema.safeParse({
        portalClientId: body.portalClientId,
        skuIds: body.skuIds,
        priceCents: body.priceCents,
        currency: body.currency,
        frequency: body.frequency,
        termMonths: body.termMonths,
        customerType: body.customerType,
        customerState: body.customerState,
        consent: body.consent,
      });
      if (!parsed.success) {
        return res.status(400).json({
          code: "AUTORENEW_CONSENT_INVALID",
          error: "Subscription details or auto-renew consent are incomplete.",
          fields: parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean),
        });
      }

      const role = storeRole(req);
      let lineItems: CanonicalCheckoutLineItem[];
      try {
        const overrides = await deps.resolvePricing(req.user?.clientId);
        lineItems = canonicalizeCheckoutLineItems(req.body?.lineItems, role, overrides);
      } catch (error: any) {
        return res.status(400).json({ error: error?.message || "Invalid checkout cart" });
      }

      const plan = subscriptionPlanFromLines(lineItems);
      if ("error" in plan) {
        return res.status(409).json({ code: "AUTORENEW_CART_INVALID", error: plan.error });
      }
      if (plan.priceCents !== parsed.data.priceCents || plan.frequency !== parsed.data.frequency || plan.termMonths !== parsed.data.termMonths) {
        return res.status(409).json({
          code: "AUTORENEW_PRICE_MISMATCH",
          error: "Subscription pricing changed. Refresh the store and review the terms before continuing.",
        });
      }
      const expectedSkus = [...plan.skuIds].sort().join(",");
      const suppliedSkus = [...parsed.data.skuIds].sort().join(",");
      if (expectedSkus !== suppliedSkus) {
        return res.status(409).json({
          code: "AUTORENEW_PRICE_MISMATCH",
          error: "Subscription items changed. Refresh the store and review the terms before continuing.",
        });
      }

      let consent;
      try {
        consent = assertValidAutoRenewConsent({
          priceCents: plan.priceCents,
          currency: parsed.data.currency,
          frequency: plan.frequency,
          termMonths: plan.termMonths,
          consent: parsed.data.consent,
        });
      } catch (error) {
        if (error instanceof AutoRenewConsentError) {
          return res.status(400).json({ code: error.code, error: error.message, fields: error.fields });
        }
        throw error;
      }

      const resolved = resolvePortalClient(req, deps.getClient, parsed.data.portalClientId);
      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
      }

      const idempotencyKey =
        stringValue(req.get("idempotency-key"), 100) ||
        `website-sub-${resolved.portalClientId}-${plan.skuIds.join("-")}-${consent.autoRenewConsentAt}`;

      const created = await deps.hub.create(
        {
          portalClientId: resolved.portalClientId,
          skuIds: plan.skuIds,
          priceCents: plan.priceCents,
          currency: parsed.data.currency,
          frequency: plan.frequency,
          termMonths: plan.termMonths,
          customerType: parsed.data.customerType as AutoRenewCustomerType,
          customerState: parsed.data.customerState.toUpperCase(),
          consent: {
            ...consent,
            ip: requestIp(req),
            userAgent: requestUserAgent(req),
          },
        },
        idempotencyKey,
      );

      if (!created.ok) {
        const status = created.reason === "not_configured" ? 503 : created.reason === "refused" ? created.status || 409 : 503;
        return res.status(status).json({
          code: created.code || "HUB_SUBSCRIPTION_FAILED",
          error:
            created.error ||
            "The subscription could not be created right now. Request a quote and we will finish setup.",
        });
      }

      const billing = req.body?.billing || {};
      const email = stringValue(billing.email || req.user?.email, 200);
      const name = stringValue(billing.name || req.user?.fullName, 200) || "there";
      if (email) {
        void deps
          .sendSubscriptionConfirmation({
            email,
            name,
            subscriptionId: created.data.subscriptionId,
            status: created.data.status,
            renewsAt: created.data.renewsAt ?? null,
            items: lineItems.map((item) => ({ name: item.name, sku: item.sku, quantity: item.quantity, price: item.unitPrice })),
            totalCents: plan.priceCents,
            currency: parsed.data.currency,
            frequency: plan.frequency,
            termMonths: plan.termMonths,
            termsVersion: AUTORENEW_TERMS_VERSION,
            termsText: consent.termsTextSnapshot,
            cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
            confirmationUrl: created.data.confirmation?.url,
          })
          .catch((error) => {
            console.error("[AUTORENEW CONFIRMATION EMAIL ERROR]", error);
          });
      }

      return res.status(201).json({
        subscriptionId: created.data.subscriptionId,
        status: created.data.status,
        renewsAt: created.data.renewsAt ?? null,
        termsVersion: created.data.confirmation?.termsVersion || AUTORENEW_TERMS_VERSION,
        confirmation: created.data.confirmation,
        terms: {
          version: AUTORENEW_TERMS_VERSION,
          text: consent.termsTextSnapshot,
          cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
          checkboxLabelText: AUTO_RENEW_CHECKBOX_LABEL_TEXT,
        },
      });
    },
  );

  app.get(PORTAL_SUBSCRIPTIONS_PATH, portalGuards, async (req: AuthedRequest, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!deps.isEnabled()) {
      return res.json({ autoRenewContractEnabled: false, subscriptions: [] });
    }
    const resolved = resolvePortalClient(req, deps.getClient);
    if (!resolved.ok) {
      return res.json({ autoRenewContractEnabled: true, subscriptions: [], message: resolved.error });
    }
    const listed = await deps.hub.list(resolved.accountId);
    if (!listed.ok) {
      const status = listed.reason === "refused" ? listed.status || 502 : 503;
      return res.status(status).json({
        autoRenewContractEnabled: true,
        subscriptions: [],
        error: listed.error || "Subscriptions could not be loaded from billing right now.",
      });
    }
    return res.json({
      autoRenewContractEnabled: true,
      accountLinked: true,
      subscriptions: listed.data.subscriptions,
    });
  });

  app.post(
    PORTAL_SUBSCRIPTION_CANCEL_PATH,
    portalCancelGuards,
    async (req: AuthedRequest, res: Response) => {
      if (!deps.isEnabled()) {
        return res.status(404).json({
          code: "AUTORENEW_CONTRACT_DISABLED",
          error: "Online subscription cancellation is not available yet.",
        });
      }
      const subscriptionId = stringValue(req.params.id, 100);
      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription id is required" });
      }
      const resolved = resolvePortalClient(req, deps.getClient, req.body?.portalClientId);
      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
      }
      const portalUserId = stringValue(req.user?.id || req.userId, 100);
      if (!portalUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const requestedAt = stringValue(req.body?.requestedAt, 80) || new Date().toISOString();
      const reason = stringValue(req.body?.reason, 2000) || undefined;
      const idempotencyKey = stringValue(req.get("idempotency-key"), 100) || `portal-cancel-${subscriptionId}-${requestedAt}`;
      const cancelled = await deps.hub.cancel(
        subscriptionId,
        {
          portalClientId: resolved.portalClientId,
          portalUserId,
          ...(reason ? { reason } : {}),
          requestedAt,
        },
        idempotencyKey,
      );
      if (!cancelled.ok) {
        const status = cancelled.reason === "refused" ? cancelled.status || 409 : cancelled.reason === "not_configured" ? 503 : 503;
        return res.status(status).json({
          code: cancelled.code || "HUB_CANCEL_FAILED",
          error: cancelled.error || "The subscription could not be canceled right now. Try again, or email billing@digeratiexperts.com.",
        });
      }
      return res.json(cancelled.data);
    },
  );
}

export { autoRenewConsentRequiredSkus, buildAutoRenewTermsText };
