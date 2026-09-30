import { pricingBucket, type CommercePricingType } from "@shared/storeCommerce";

/**
 * Client-safe commercial block for Hub quote and order intake.
 * Tax stays null until a tax calculation exists. Missing tax is not $0.
 */

type CommercialLineInput = {
  productId?: string;
  sku?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  pricingType?: string;
  total?: number;
};

const PRICING_TYPES = new Set<CommercePricingType>([
  "one_time",
  "monthly",
  "yearly",
  "per_hour",
  "per_user",
  "per_endpoint",
  "per_device",
  "per_location",
  "per_seat",
]);

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function bucketFor(pricingType?: string): "dueToday" | "monthly" | "annual" {
  if (!pricingType || !PRICING_TYPES.has(pricingType as CommercePricingType)) return "dueToday";
  return pricingBucket(pricingType as CommercePricingType);
}

export function buildCommercialSnapshot(input: {
  reference: string;
  status: string;
  portalClientId?: string | null;
  company?: string | null;
  email?: string | null;
  lineItems: CommercialLineInput[];
  occurredAt?: string;
}): Record<string, unknown> {
  const lineItems = input.lineItems.map((item) => {
    const quantity = money(Number(item.quantity) || 0);
    const unitPrice = money(Number(item.unitPrice) || 0);
    const lineTotal = money(Number(item.total) || quantity * unitPrice);
    const bucket = bucketFor(item.pricingType);
    return {
      productId: item.productId || "",
      sku: item.sku || "",
      name: item.name || "Item",
      quantity,
      unitPrice,
      recurringAmount: bucket === "monthly" ? lineTotal : 0,
      oneTimeAmount: bucket === "dueToday" ? lineTotal : 0,
      annualAmount: bucket === "annual" ? lineTotal : 0,
    };
  });
  const recurring = money(lineItems.reduce((sum, item) => sum + item.recurringAmount, 0));
  const oneTime = money(lineItems.reduce((sum, item) => sum + item.oneTimeAmount, 0));
  const annual = money(lineItems.reduce((sum, item) => sum + item.annualAmount, 0));
  return {
    reference: input.reference,
    status: input.status,
    portalClientId: input.portalClientId || null,
    company: input.company || "",
    email: input.email || "",
    lineItems,
    totals: {
      recurring,
      oneTime,
      annual,
      tax: null,
      total: money(recurring + oneTime + annual),
    },
    occurredAt: input.occurredAt || new Date().toISOString(),
  };
}
