/**
 * GCC High / GCCH public pricing is on hold until licensing eligibility and
 * the government-cloud channel are settled. Do not publish dollar prices for
 * these offerings, and do not sell them through store checkout.
 */

export const GCCH_PRICING_HOLD_LABEL = "Pricing after eligibility review";
export const GCCH_PRICING_HOLD_HREF = "/contact";

export const GCCH_CHECKOUT_BLOCKED_MESSAGE =
  "GCC High offerings are not available for online purchase. Pricing is provided after eligibility review.";

const GCCH_OFFERING_RE = /\bgcch\b|gcc[-_\s]?high/i;

/** User rates and monthly floors that must not be published for GCC High offerings. */
export const HELD_GCCH_USER_RATES = [425, 575] as const;
export const HELD_GCCH_MONTHLY_FLOORS = [7_500, 12_500] as const;

export function isGcchOfferingText(...parts: Array<string | null | undefined>): boolean {
  return GCCH_OFFERING_RE.test(parts.filter((part) => !!part).join(" "));
}

export function isGcchStoreItem(item: {
  sku?: string | null;
  name?: string | null;
  id?: string | null;
  description?: string | null;
  shortDescription?: string | null;
}): boolean {
  return isGcchOfferingText(item.sku, item.name, item.id, item.description, item.shortDescription);
}

function priceTokenPattern(amount: number): RegExp {
  const raw = String(amount);
  const grouped = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = String(amount * 100);
  return new RegExp(
    [
      String.raw`\$\s*${grouped}\b`,
      String.raw`\$\s*${raw}\b`,
      String.raw`\b${grouped}\s*/\s*user`,
      String.raw`\b${raw}\s*/\s*user`,
      String.raw`\b(?:user|perUser|per_user|basePrice|monthlyMinimum|siteMin|unitPrice|priceCents|unitAmountCents)\s*[:=]\s*\$?${raw}\b`,
      String.raw`\b${cents}\b`,
    ].join("|"),
    "i",
  );
}

const HELD_PRICE_PATTERNS = [
  ...HELD_GCCH_USER_RATES.map(priceTokenPattern),
  ...HELD_GCCH_MONTHLY_FLOORS.map(priceTokenPattern),
];

export function containsHeldGcchDollarPrice(text: string): boolean {
  return HELD_PRICE_PATTERNS.some((pattern) => pattern.test(text));
}

export function findHeldGcchPricingViolations(text: string): string[] {
  if (!isGcchOfferingText(text) || !containsHeldGcchDollarPrice(text)) return [];
  const hits: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (isGcchOfferingText(line) && containsHeldGcchDollarPrice(line)) {
      hits.push(line.trim());
    }
  }
  if (hits.length === 0) {
    hits.push("file mentions a GCC High offering and a held dollar price");
  }
  return hits;
}
