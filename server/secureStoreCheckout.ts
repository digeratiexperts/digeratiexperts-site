import type { Express, NextFunction, Request, Response } from "express";
import { storeProducts, type StoreProduct } from "../client/src/data/storeProducts";
import {
  resolveClientPricingRows,
  resolveUnitPrice,
  StoreClientPricingUnavailableError,
  toPriceOverrides,
} from "./storeClientPricing";
import { paymentRateLimiter } from "./middleware/rateLimiter";
import { sendStorePricingUnavailable } from "./storeClientPricingHttp";

type StoreRole = "public" | "prospect" | "managed" | "comanaged" | "admin";

type CheckoutRequest = Request & {
  userId?: string;
  user?: {
    id?: string;
    email?: string;
    fullName?: string;
    role?: string;
    storeRole?: StoreRole;
    clientId?: string | null;
  };
  portalClientContext?: {
    clientId: string | null;
    companyName: string | null;
    contactEmail: string | null;
    primaryContact: string | null;
    serviceType: string | null;
    impersonating: boolean;
  };
};

type AuthMiddleware = (req: CheckoutRequest, res: Response, next: NextFunction) => unknown;
type RoleMiddlewareFactory = (...roles: StoreRole[]) => AuthMiddleware;
type SecureStoreCheckoutDependencies = {
  resolveClientPricingRows?: typeof resolveClientPricingRows;
};

export interface CanonicalCheckoutLineItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  pricingType: StoreProduct["pricingType"];
  total: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function stringValue(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isPurchasableForRole(product: StoreProduct, role: StoreRole): boolean {
  if (!product.isCheckoutEnabled || product.isContractOnly) return false;
  if (role === "admin") return true;
  if (role !== "comanaged") return false;
  return product.requiredClientType === "public" || product.requiredClientType === "comanaged";
}

export function canonicalizeCheckoutLineItems(
  suppliedItems: unknown,
  role: StoreRole,
  priceOverrides: Record<string, number> = {},
): CanonicalCheckoutLineItem[] {
  if (!Array.isArray(suppliedItems) || suppliedItems.length === 0) {
    throw new Error("Line items are required");
  }
  if (suppliedItems.length > 50) {
    throw new Error("Too many line items");
  }

  const canonical: CanonicalCheckoutLineItem[] = [];
  for (const raw of suppliedItems) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid line item");
    }

    const item = raw as Record<string, unknown>;
    const productId = stringValue(item.productId, 100);
    const sku = stringValue(item.sku, 100);
    if (!productId || !sku) {
      throw new Error("Every line item must include productId and sku");
    }

    const product = storeProducts.find((candidate) => candidate.id === productId);
    if (!product || product.sku !== sku) {
      throw new Error(`Unknown or mismatched store product: ${sku || productId}`);
    }
    if (!isPurchasableForRole(product, role)) {
      throw new Error(`Product is not eligible for online checkout: ${product.sku}`);
    }

    const rawQuantity = Number(item.quantity);
    if (!Number.isSafeInteger(rawQuantity) || rawQuantity < product.minimumQuantity || rawQuantity > 10000) {
      throw new Error(`Invalid quantity for ${product.sku}`);
    }

    const unitPrice = resolveUnitPrice(Number(product.basePrice), priceOverrides[product.id]);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`Product does not have a valid checkout price: ${product.sku}`);
    }

    canonical.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: rawQuantity,
      unitPrice,
      pricingType: product.pricingType,
      total: money(unitPrice * rawQuantity),
    });
  }

  return canonical;
}

export function canonicalCheckoutTotal(items: CanonicalCheckoutLineItem[]): number {
  return money(items.reduce((sum, item) => sum + item.total, 0));
}

export function registerSecureZohoStoreCheckout(
  app: Express,
  authMiddleware: AuthMiddleware,
  requireRole: RoleMiddlewareFactory,
  dependencies: SecureStoreCheckoutDependencies = {},
) {
  const resolvePricing = dependencies.resolveClientPricingRows || resolveClientPricingRows;
  app.post(
    "/api/store/checkout/zoho",
    [paymentRateLimiter, authMiddleware as any, requireRole("comanaged", "admin") as any],
    async (req: CheckoutRequest, res: Response) => {
      try {
        const { billing } = req.body || {};
        const impersonating = !!req.portalClientContext?.impersonating;
        const clientId = impersonating
          ? req.portalClientContext?.clientId || null
          : req.portalClientContext?.clientId || req.user?.clientId || null;
        if (impersonating && (
          !clientId ||
          !req.portalClientContext?.companyName ||
          !req.portalClientContext.contactEmail ||
          !req.portalClientContext.serviceType
        )) {
          return res.status(409).json({
            error: "The active client must have authoritative company, contact, and service details before checkout",
          });
        }
        const billingName = stringValue(
          impersonating
            ? req.portalClientContext?.primaryContact || req.portalClientContext?.companyName
            : billing?.name,
          150,
        );
        const billingEmail = stringValue(
          impersonating ? req.portalClientContext?.contactEmail : billing?.email,
          254,
        ).toLowerCase();
        const billingCompany = stringValue(
          impersonating ? req.portalClientContext?.companyName : billing?.company,
          200,
        );
        if (!billingName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
          return res.status(400).json({ error: "Valid billing name and email are required" });
        }

        const role = (impersonating
          ? req.portalClientContext?.serviceType === "comanaged"
            ? "comanaged"
            : req.portalClientContext?.serviceType === "managed"
              ? "managed"
              : "public"
          : req.user?.storeRole || "public") as StoreRole;
        const pricingRows = await resolvePricing(clientId);
        const priceOverrides = toPriceOverrides(pricingRows);
        let lineItems: CanonicalCheckoutLineItem[];
        try {
          lineItems = canonicalizeCheckoutLineItems(req.body?.lineItems, role, priceOverrides);
        } catch (error: any) {
          console.warn("[SECURITY] CHECKOUT_CART_REJECTED", {
            userId: req.userId,
            clientId,
            reason: error?.message || "invalid_cart",
          });
          return res.status(400).json({ error: error?.message || "Invalid checkout cart" });
        }

        const trustedTotal = canonicalCheckoutTotal(lineItems);
        const suppliedTotal = Number(req.body?.total);
        const suppliedSubtotal = Number(req.body?.subtotal);
        if (
          (Number.isFinite(suppliedTotal) && money(suppliedTotal) !== trustedTotal) ||
          (Number.isFinite(suppliedSubtotal) && money(suppliedSubtotal) !== trustedTotal)
        ) {
          console.warn("[SECURITY] CHECKOUT_PRICE_MISMATCH", {
            userId: req.userId,
            clientId,
            trustedTotal,
            suppliedTotal: Number.isFinite(suppliedTotal) ? money(suppliedTotal) : null,
            suppliedSubtotal: Number.isFinite(suppliedSubtotal) ? money(suppliedSubtotal) : null,
          });
          return res.status(409).json({
            error: "Cart pricing changed. Refresh the store and review the order before paying.",
          });
        }

        const { zohoPayments } = await import("./zohoPayments");
        if (!zohoPayments.isConfigured()) {
          return res.status(503).json({
            error: "Payment processing is not configured. Please contact support.",
          });
        }

        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;
        const baseUrl = process.env.APP_URL || "https://digeratiexperts.com";

        const { db } = await import("./db");
        const { storeOrders } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        const [order] = await db
          .insert(storeOrders)
          .values({
            orderNumber,
            userId: req.userId || null,
            clientId,
            status: "awaiting_payment",
            paymentMethod: "zoho",
            lineItems,
            subtotal: trustedTotal.toFixed(2),
            tax: "0",
            total: trustedTotal.toFixed(2),
            billingEmail,
            billingName,
            billingCompany: billingCompany || null,
          })
          .returning();

        try {
          const session = await zohoPayments.createPaymentSession({
            orderNumber,
            customerEmail: billingEmail,
            customerName: billingName,
            lineItems: lineItems.map((item) => ({
              name: item.name,
              description: `SKU: ${item.sku}`,
              amount: item.unitPrice,
              quantity: item.quantity,
            })),
            totalAmount: trustedTotal,
            successUrl: `${baseUrl}/store/order-confirmation?orderId=${order.id}`,
            cancelUrl: `${baseUrl}/store/checkout`,
            metadata: {
              orderId: order.id,
            },
          });

          await db
            .update(storeOrders)
            .set({ zohoPaymentSessionId: session.payment_session_id })
            .where(eq(storeOrders.id, order.id));

          console.info("[SECURITY] CHECKOUT_STARTED", {
            orderId: order.id,
            orderNumber,
            cartTotal: trustedTotal,
            itemCount: lineItems.length,
            userId: req.userId,
            clientId,
            paymentMethod: "zoho",
          });

          return res.json({ url: session.url, orderId: order.id });
        } catch (error) {
          await db
            .update(storeOrders)
            .set({ status: "pending", updatedAt: new Date() })
            .where(eq(storeOrders.id, order.id))
            .catch(() => undefined);
          throw error;
        }
      } catch (error: any) {
        console.error("[ZOHO SECURE CHECKOUT ERROR]", error);
        if (error instanceof StoreClientPricingUnavailableError) {
          return sendStorePricingUnavailable(
            res,
            "Checkout pricing is temporarily unavailable. Please retry shortly.",
          );
        }
        return res.status(500).json({ error: error?.message || "Failed to create checkout session" });
      }
    },
  );
}
