/**
 * Canonical ProActive Ecosystem pricing — single source of truth.
 * Homepage, pricing page, store ProActive SKUs, advisor, and industry copy
 * must import from here. Do not hard-code package floors elsewhere.
 *
 * Numbers align with TechSales CANONICAL_TIERS:
 * IT 125/1600 · Office 165/2400 · Business 245/5400 · Enterprise 345/9000
 */

export type ProActiveTierKey = "it" | "office" | "business" | "enterprise";
export type PricingTierKey = ProActiveTierKey;

export type ProActiveTier = {
  id: ProActiveTierKey;
  /** Short marketing name */
  name: string;
  /** Full product name */
  label: string;
  /** Alias of label — local homepage / cards */
  fullName: string;
  /** Short tier badge (Entry / Foundation / …) */
  tier: string;
  /** Published per-user / month starting rate */
  user: number;
  /** Monthly recurring revenue floor */
  monthlyMinimum: number;
  /** Alias of monthlyMinimum — local pages / advisor */
  monthlyMin: number;
  /** @deprecated alias of monthlyMinimum */
  siteMin: number;
  idealBuyer: string;
  note: string;
  learnMoreUrl: string;
  inclusions: readonly string[];
};

const tiers = {
  it: {
    id: "it" as const,
    name: "IT",
    label: "ProActive IT",
    fullName: "ProActive IT",
    tier: "Entry",
    user: 125,
    monthlyMinimum: 1600,
    monthlyMin: 1600,
    siteMin: 1600,
    idealBuyer: "Smaller, less complex environments that need essential protection and a documented baseline",
    note: "Essential managed IT with the DE Security Foundation included — a fit when the environment is smaller and less complex.",
    learnMoreUrl: "/solutions/proactive-it-ecosystem",
    inclusions: [
      "Service desk & issue ownership",
      "DE Security Foundation included",
      "Managed endpoint, identity, email, and security monitoring baseline",
      "Security awareness and phishing resilience",
      "Documented environment basics",
      "Clear upgrade path into Office",
    ],
  },
  office: {
    id: "office" as const,
    name: "Office",
    label: "ProActive Office",
    fullName: "ProActive Office",
    tier: "Foundation",
    user: 165,
    monthlyMinimum: 2400,
    monthlyMin: 2400,
    siteMin: 2400,
    idealBuyer: "Broader managed workplace — more users, devices, and a professionally operated network",
    note: "Managed workplace and stronger protection when Office is the right operating depth — not a ranking.",
    learnMoreUrl: "/solutions/proactive-office-ecosystem",
    inclusions: [
      "Everything meaningful in IT, plus",
      "Managed network & connectivity",
      "Stronger MFA / SSO / password hygiene",
      "Advanced email anti-phishing",
      "DE Security Foundation with 24/7 managed detection and response",
      "Security awareness and phishing resilience",
      "Endpoint backup",
      "Annual technology + cyber review",
    ],
  },
  business: {
    id: "business" as const,
    name: "Business",
    label: "ProActive Business",
    fullName: "ProActive Business",
    tier: "Operations",
    user: 245,
    monthlyMinimum: 5400,
    monthlyMin: 5400,
    siteMin: 5400,
    idealBuyer: "Deeper infrastructure, cyber operations, recovery, governance, and strategy",
    note: "The fit when Office would need heavy modification — deeper ops, not universally better.",
    learnMoreUrl: "/solutions/proactive-business-ecosystem",
    inclusions: [
      "Everything in Office, plus",
      "DE Security Foundation with 24/7 managed detection and response",
      "Enhanced security operations / threat detection",
      "Security awareness training",
      "Backup & disaster recovery posture",
      "Compliance / risk reporting support",
      "Semi-annual technology + security reviews",
    ],
  },
  enterprise: {
    id: "enterprise" as const,
    name: "Enterprise",
    label: "ProActive Enterprise",
    fullName: "ProActive Enterprise",
    tier: "Compliance",
    user: 345,
    monthlyMinimum: 9000,
    monthlyMin: 9000,
    siteMin: 9000,
    idealBuyer: "Multi-site, regulated, or security-sensitive environments that need the greatest operating depth",
    note: "Greatest operating depth for complex, regulated, or security-sensitive environments.",
    learnMoreUrl: "/solutions/proactive-enterprise-ecosystem",
    inclusions: [
      "Everything in Business, plus",
      "Unified security posture reporting",
      "Advanced compliance / risk reporting",
      "Custom BCDR architecture support",
      "Privileged access program elements",
      "Quarterly executive reviews",
    ],
  },
} satisfies Record<ProActiveTierKey, ProActiveTier>;

export const pricing = tiers;

/** All four public ProActive tiers in display order */
export const pricingTiers: readonly ProActiveTier[] = [
  pricing.it,
  pricing.office,
  pricing.business,
  pricing.enterprise,
];

/** TechSales catalog alignment constants (for tests / drift detection) */
export const TECHSALES_ALIGNED = {
  source: "Intelligence-Hub/lib/db/src/utils/pricing-catalog.ts CANONICAL_TIERS",
  expected: {
    it: { user: 125, monthlyMinimum: 1600 },
    office: { user: 165, monthlyMinimum: 2400 },
    business: { user: 245, monthlyMinimum: 5400 },
    enterprise: { user: 345, monthlyMinimum: 9000 },
  },
} as const;

export const formatPrice = (amount: number): string => `$${amount.toLocaleString()}`;

export const formatMonthlyMinimum = (tier: ProActiveTierKey): string =>
  `${formatPrice(pricing[tier].monthlyMinimum)}/mo minimum`;

/** Alias used by MSP advisor and local pages */
export const formatMonthlyMin = formatMonthlyMinimum;

/** @deprecated use formatMonthlyMinimum */
export const formatSiteMin = formatMonthlyMinimum;

export const formatUserPrice = (tier: ProActiveTierKey): string =>
  `$${pricing[tier].user}/user/mo`;

export function enforceMonthlyFloor(seatTotal: number, tier: ProActiveTierKey): number {
  return Math.max(seatTotal, pricing[tier].monthlyMinimum);
}

export function monthlyForSeats(tier: ProActiveTierKey, seats: number): number {
  const safeSeats = Math.max(0, Math.floor(seats) || 0);
  return enforceMonthlyFloor(safeSeats * pricing[tier].user, tier);
}

/** Estimate = max(users × rate, monthly minimum × sites). */
export function estimateMonthly(
  tier: PricingTierKey,
  users: number,
  sites = 1,
): number {
  const t = pricing[tier];
  const safeUsers = Math.max(0, Math.floor(users) || 0);
  const safeSites = Math.max(1, Math.floor(sites) || 1);
  return Math.max(safeUsers * t.user, t.monthlyMin * safeSites);
}

export const getPricingFooterText = (): string =>
  `Monthly minimums: IT ${formatPrice(pricing.it.monthlyMin)}, Office ${formatPrice(pricing.office.monthlyMin)}, Business ${formatPrice(pricing.business.monthlyMin)}, Enterprise ${formatPrice(pricing.enterprise.monthlyMin)}. Final scope confirmed after Cyber Risk Assessment.`;

export const getShortPricingText = (): string =>
  `IT ${formatPrice(pricing.it.monthlyMin)}/mo · Office ${formatPrice(pricing.office.monthlyMin)}/mo · Business ${formatPrice(pricing.business.monthlyMin)}/mo · Enterprise ${formatPrice(pricing.enterprise.monthlyMin)}/mo`;

export const PRICING_SCOPE_NOTE =
  "Final pricing depends on users, endpoints, locations, infrastructure, backup requirements, and security/compliance scope. Estimates are not quotes — your Cyber Risk Assessment confirms final scope.";

export const NO_BLACK_BOX_TAGLINE =
  "No Black-Box IT. You know what you're buying, what you're paying, what's included, and who owns it.";

export type PricingTier = ProActiveTier;
