import type { Express, NextFunction, Request, Response } from "express";
import { orderConfirmationToken } from "./orderConfirmationToken";
import { storeProducts, type StoreProduct } from "../client/src/data/storeProducts";
import {
  removeClientPricing,
  resolveClientPricingRows,
  resolveUnitPrice,
  setClientPricing,
  toPriceOverrides,
} from "./storeClientPricing";
import { paymentRateLimiter } from "./middleware/rateLimiter";

type StoreRole = "public" | "prospect" | "managed" | "comanaged" | "admin";

const RECURRING_STORE_CATEGORIES = new Set<StoreProduct["category"]>([
  "comanaged_subscriptions",
  "networking_managed",
  "ucaas_subscriptions",
]);

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
};

type AuthMiddleware = (req: CheckoutRequest, res: Response, next: NextFunction) => unknown;
type RoleMiddlewareFactory = (...roles: StoreRole[]) => AuthMiddleware;

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

/**
 * These catalog families are recurring services. Until the Store creates or
 * amends an authoritative Zoho subscription, they must not be charged through
 * a one-time hosted Payment Session.
 */
export function isRecurringSubscriptionProduct(product: StoreProduct): boolean {
  return RECURRING_STORE_CATEGORIES.has(product.category);
}

export function recurringCheckoutSkus(items: CanonicalCheckoutLineItem[]): string[] {
  return items
    .filter((item) => {
      const product = storeProducts.find((candidate) => candidate.id === item.productId);
      return !!product && isRecurringSubscriptionProduct(product);
    })
    .map((item) => item.sku);
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
) {
  // Registration happens during server boot. In production this starts the
  // existing paid-order reconciler immediately, so a restart does not leave
  // already-paid work stranded until another webhook happens to arrive.
  void import("./services/orderFulfillment")
    .then(({ startOrderFulfillmentReconciliation }) => startOrderFulfillmentReconciliation())
    .catch((error) => {
      console.error("[ORDER FULFILLMENT RECONCILER START ERROR]", error);
    });

  // Canonical client-pricing routes register before routes.ts. Authorization
  // comes from authMiddleware's live Portal record; the browser never supplies
  // the tenant whose negotiated pricing is returned.
  app.get(
    "/api/store/client-pricing",
    [authMiddleware as any],
    async (req: CheckoutRequest, res: Response) => {
      try {
        const pricing = await resolveClientPricingRows(req.user?.clientId);
        return res.json({ pricing });
      } catch (error: any) {
        console.error("[STORE CLIENT PRICING ERROR]", error);
        return res.status(503).json({
          error: "Client pricing is temporarily unavailable. Catalog pricing remains visible until pricing can be verified.",
        });
      }
    },
  );

  app.post(
    "/api/admin/client-pricing/set",
    [authMiddleware as any],
    async (req: CheckoutRequest, res: Response) => {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      try {
        const { clientId, productId, customPrice, discountPercent } = req.body || {};
        const result = await setClientPricing({ clientId, productId, customPrice, discountPercent });
        console.info("[SECURITY] CLIENT_PRICING_SET", {
          adminId: req.userId,
          adminEmail: req.user?.email,
          clientId,
          productId,
          source: result.source,
          oldPrice: result.previous?.customPrice ?? null,
          oldDiscount: result.previous?.discountPercent ?? null,
          newPrice: result.current?.customPrice ?? null,
          newDiscount: result.current?.discountPercent ?? null,
        });
        return res.json({
          success: true,
          clientId,
          productId,
          pricing: result.current,
          source: result.source,
        });
      } catch (error: any) {
        const message = error?.message || "Failed to set client pricing";
        const status = /required|unknown store product|must be|valid client price/i.test(message)
          ? 400
          : /database|pricing lookup failed/i.test(message)
            ? 503
            : 500;
        console.error("[CLIENT PRICING SET ERROR]", error);
        return res.status(status).json({ error: message });
      }
    },
  );

  app.get(
    "/api/admin/client-pricing/:clientId",
    [authMiddleware as any],
    async (req: CheckoutRequest, res: Response) => {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      try {
        const clientId = stringValue(req.params.clientId, 100);
        if (!clientId) return res.status(400).json({ error: "Client ID is required" });
        const pricing = await resolveClientPricingRows(clientId);
        return res.json({ clientId, pricing });
      } catch (error: any) {
        console.error("[GET CLIENT PRICING ERROR]", error);
        return res.status(503).json({ error: "Client pricing is temporarily unavailable" });
      }
    },
  );

  app.delete(
    "/api/admin/client-pricing/:clientId/:productId",
    [authMiddleware as any],
    async (req: CheckoutRequest, res: Response) => {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      try {
        const clientId = stringValue(req.params.clientId, 100);
        const productId = stringValue(req.params.productId, 100);
        const result = await removeClientPricing(clientId, productId);
        console.info("[SECURITY] CLIENT_PRICING_REMOVED", {
          adminId: req.userId,
          adminEmail: req.user?.email,
          clientId,
          productId,
          source: result.source,
          oldPrice: result.previous?.customPrice ?? null,
          oldDiscount: result.previous?.discountPercent ?? null,
        });
        return res.json({ success: true, clientId, productId, source: result.source });
      } catch (error: any) {
        const message = error?.message || "Failed to remove client pricing";
        const status = /required/i.test(message)
          ? 400
          : /database|pricing lookup failed/i.test(message)
            ? 503
            : 500;
        console.error("[DELETE CLIENT PRICING ERROR]", error);
        return res.status(status).json({ error: message });
      }
    },
  );

  app.post(
    "/api/store/checkout/zoho",
    [authMiddleware as any, requireRole("comanaged", "admin") as any, paymentRateLimiter as any],
    async (req: CheckoutRequest, res: Response) => {
      try {
        const { billing } = req.body || {};
        const billingName = stringValue(billing?.name, 150);
        const billingEmail = stringValue(billing?.email, 254).toLowerCase();
        const billingCompany = stringValue(billing?.company, 200);
        if (!billingName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
          return res.status(400).json({ error: "Valid billing name and email are required" });
        }

        const role = (req.user?.storeRole || "public") as StoreRole;
        const pricingRows = await resolveClientPricingRows(req.user?.clientId);
        const priceOverrides = toPriceOverrides(pricingRows);
        let lineItems: CanonicalCheckoutLineItem[];
        try {
          lineItems = canonicalizeCheckoutLineItems(req.body?.lineItems, role, priceOverrides);
        } catch (error: any) {
          console.warn("[SECURITY] CHECKOUT_CART_REJECTED", {
            userId: req.userId,
            clientId: req.user?.clientId,
            reason: error?.message || "invalid_cart",
          });
          return res.status(400).json({ error: error?.message || "Invalid checkout cart" });
        }

        const recurringSkus = recurringCheckoutSkus(lineItems);
        if (recurringSkus.length > 0) {
          console.warn("[SECURITY] RECURRING_CHECKOUT_BLOCKED", {
            userId: req.userId,
            clientId: req.user?.clientId,
            skus: recurringSkus,
          });
          return res.status(409).json({
            code: "SUBSCRIPTION_BILLING_REQUIRED",
            quoteRequired: true,
            skus: recurringSkus,
            error:
              "Recurring services require subscription billing setup before online payment. Request a quote for these items.",
          });
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
            clientId: req.user?.clientId,
            trustedTotal,
            suppliedTotal: Number.isFinite(suppliedTotal) ? money(suppliedTotal) : null,
            suppliedSubtotal: Number.isFinite(suppliedSubtotal) ? money(suppliedSubtotal) : null,
          });
          return res.status(409).json({
            error: "Cart pricing changed. Refresh the store and review the order before paying.",
          });
        }

        const dbModule = await import("./db");
        await dbModule.initPromise;
        if (!dbModule.dbReady || !dbModule.db) {
          console.error("[SECURITY] CHECKOUT_DATABASE_UNAVAILABLE", {
            userId: req.userId,
            clientId: req.user?.clientId,
          });
          return res.status(503).json({
            code: "DURABLE_DATABASE_REQUIRED",
            error: "Checkout is temporarily unavailable because durable order storage is not connected.",
          });
        }
        const db = dbModule.db;

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

        const { storeOrders } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        const [order] = await db
          .insert(storeOrders)
          .values({
            orderNumber,
            userId: req.userId || null,
            clientId: req.user?.clientId || null,
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

        void import("./integrations/enqueueStoreOrder")
          .then(({ enqueueStoreOrderCreated }) => enqueueStoreOrderCreated({
            id: order.id,
            orderNumber: order.orderNumber,
            status: "awaiting_payment",
            clientId: order.clientId,
            billingEmail: order.billingEmail,
            billingName: order.billingName,
            billingCompany: order.billingCompany,
            lineItems,
          }))
          .catch((error) => console.warn("[store-order] Hub enqueue skipped:", error?.message || error));

        const confirmationToken = orderConfirmationToken(order.id);

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
            successUrl: `${baseUrl}/internal/warehouse/order-confirmation?orderId=${order.id}${
              confirmationToken ? `&ct=${confirmationToken}` : ""
            }`,
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
            clientId: req.user?.clientId,
            paymentMethod: "zoho",
          });

          return res.json({ url: session.url, orderId: order.id, confirmationToken });
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
        return res.status(500).json({ error: error?.message || "Failed to create checkout session" });
      }
    },
  );

  // Register before legacy routes.ts so this server-authoritative handler wins.
  app.post(
    "/api/store/orders",
    [authMiddleware as any, requireRole("comanaged", "admin") as any, paymentRateLimiter as any],
    async (req: CheckoutRequest, res: Response) => {
      try {
        const role = (req.user?.storeRole || "public") as StoreRole;
        const pricingRows = await resolveClientPricingRows(req.user?.clientId);
        const priceOverrides = toPriceOverrides(pricingRows);
        const { buildPendingStoreOrderValues } = await import("./storePendingOrder");
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;

        let orderValues;
        try {
          orderValues = buildPendingStoreOrderValues({
            body: req.body,
            role,
            priceOverrides,
            userId: req.userId || null,
            clientId: req.user?.clientId || null,
            orderNumber,
          });
        } catch (error: any) {
          console.warn("[SECURITY] STORE_ORDER_REJECTED", {
            userId: req.userId,
            clientId: req.user?.clientId,
            reason: error?.message || "invalid_order",
          });
          return res.status(400).json({ error: error?.message || "Invalid order" });
        }

        const dbModule = await import("./db");
        await dbModule.initPromise;
        if (!dbModule.dbReady || !dbModule.db) {
          console.error("[SECURITY] STORE_ORDER_DATABASE_UNAVAILABLE", {
            userId: req.userId,
            clientId: req.user?.clientId,
          });
          return res.status(503).json({
            code: "DURABLE_DATABASE_REQUIRED",
            error: "Order creation is temporarily unavailable because durable storage is not connected.",
          });
        }

        const { storeOrders } = await import("@shared/schema");
        const [order] = await dbModule.db
          .insert(storeOrders)
          .values(orderValues)
          .returning();

        void import("./integrations/enqueueStoreOrder")
          .then(({ enqueueStoreOrderCreated }) => enqueueStoreOrderCreated({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            clientId: order.clientId,
            billingEmail: order.billingEmail,
            billingName: order.billingName,
            billingCompany: order.billingCompany,
            lineItems: orderValues.lineItems,
          }))
          .catch((error) => console.warn("[store-order] Hub enqueue skipped:", error?.message || error));

        console.info("[SECURITY] STORE_ORDER_CREATED", {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: orderValues.userId,
          clientId: orderValues.clientId,
          status: orderValues.status,
          total: orderValues.total,
          paymentMethod: orderValues.paymentMethod,
          itemCount: orderValues.lineItems.length,
        });

        return res.json({ orderId: order.id, orderNumber: order.orderNumber });
      } catch (error: any) {
        console.error("[SECURE STORE ORDER ERROR]", error);
        return res.status(500).json({ error: error?.message || "Failed to create order" });
      }
    },
  );
}
