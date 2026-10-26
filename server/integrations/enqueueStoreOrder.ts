import { buildCommercialSnapshot } from "./commercialSnapshot";
import { enqueueWebsiteCommand } from "./enqueueWebsiteCommand";
import type { WebsiteLeadLike } from "./enqueueWebsiteCommand";

type StoreOrderLine = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  pricingType: string;
  total: number;
};

export type StoreOrderCommand = {
  id: string;
  orderNumber: string;
  status: string;
  clientId?: string | null;
  billingEmail?: string | null;
  billingName?: string | null;
  billingCompany?: string | null;
  lineItems: StoreOrderLine[];
};

/** The existing client-safe order body, shared with the paid transaction. */
export function buildStoreOrderCreatedPayload(order: StoreOrderCommand): WebsiteLeadLike | null {
  if (!order.orderNumber || !Array.isArray(order.lineItems) || order.lineItems.length === 0) return null;
  return {
    id: order.id,
    name: order.billingName || "",
    email: order.billingEmail || "",
    company: order.billingCompany || "",
    phone: "",
    message: "",
    source: "store_order",
    ...(order.clientId ? { portalClientId: order.clientId } : {}),
    commercial: buildCommercialSnapshot({
      reference: order.orderNumber,
      status: order.status,
      portalClientId: order.clientId || null,
      company: order.billingCompany,
      email: order.billingEmail,
      lineItems: order.lineItems,
    }),
  };
}

export async function enqueueStoreOrderCreated(order: StoreOrderCommand): Promise<void> {
  const payload = buildStoreOrderCreatedPayload(order);
  if (!payload) return;
  let hubAccountId: string | null = null;
  if (order.clientId) {
    const { getClient } = await import("../portalAuthStore");
    hubAccountId = getClient(order.clientId)?.hubAccountId || null;
  }
  await enqueueWebsiteCommand(
    {
      ...payload,
      canonicalAccountId: hubAccountId,
    },
    "store.order_created",
  );
}
