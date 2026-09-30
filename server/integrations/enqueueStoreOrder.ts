import { buildCommercialSnapshot } from "./commercialSnapshot";
import { enqueueWebsiteCommand } from "./enqueueWebsiteCommand";

type StoreOrderLine = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  pricingType: string;
  total: number;
};

export async function enqueueStoreOrderCreated(order: {
  id: string;
  orderNumber: string;
  status: string;
  clientId?: string | null;
  billingEmail?: string | null;
  billingName?: string | null;
  billingCompany?: string | null;
  lineItems: StoreOrderLine[];
}): Promise<void> {
  if (!order.orderNumber || !Array.isArray(order.lineItems) || order.lineItems.length === 0) return;
  let hubAccountId: string | null = null;
  if (order.clientId) {
    const { getClient } = await import("../portalAuthStore");
    hubAccountId = getClient(order.clientId)?.hubAccountId || null;
  }
  await enqueueWebsiteCommand(
    {
      id: order.id,
      name: order.billingName || "",
      email: order.billingEmail || "",
      company: order.billingCompany || "",
      source: "store_order",
      canonicalAccountId: hubAccountId,
      portalClientId: order.clientId || null,
      commercial: buildCommercialSnapshot({
        reference: order.orderNumber,
        status: order.status,
        portalClientId: order.clientId || null,
        company: order.billingCompany,
        email: order.billingEmail,
        lineItems: order.lineItems,
      }),
    },
    "store.order_created",
  );
}
