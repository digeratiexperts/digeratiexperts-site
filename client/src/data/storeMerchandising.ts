/**
 * Merchandising layer for the IT Store — maps real catalog SKUs to
 * outcomes, rails, and soft "included in" hints. Does not invent products.
 */
import { CANONICAL_CSRA_ONE_TIME, CANONICAL_CSRA_STORE_SKU } from "@shared/canonicalCsra";
import { getStoreProductBySku } from "./storeCatalog";
import {
  storeProducts,
  categoryLabels,
  type ProductCategory,
  type PricingType,
  type StoreProduct,
} from "./storeProducts";
import { getVendorForSku } from "./vendorLogos";

/**
 * Locked storefront taxonomy (nouns, not verbs that imply a result):
 * Protect · Recover · Communicate · Operate · Compliance
 *
 * Retired public ids (still accepted on ?outcome= URLs):
 * modernize → communicate; support_it / outsource / secure_remote → operate
 */
export type StoreOutcomeId =
  | "protect"
  | "recover"
  | "communicate"
  | "operate"
  | "compliance";

/** Old catalog URL values → current outcome. */
export const legacyStoreOutcomeAliases: Record<string, StoreOutcomeId> = {
  modernize: "communicate",
  support_it: "operate",
  outsource: "operate",
  secure_remote: "operate",
};

export function resolveStoreOutcomeId(raw: string | null | undefined): StoreOutcomeId | null {
  if (!raw) return null;
  if (raw === "protect" || raw === "recover" || raw === "communicate" || raw === "operate" || raw === "compliance") {
    return raw;
  }
  return legacyStoreOutcomeAliases[raw] ?? null;
}

/**
 * Reserved Compliance children — readiness work only, not certification claims.
 * Do not merchandise these as HIPAA/PCI/SOC 2 “compliant” badges until DE wires real SKUs.
 */
export const complianceReadinessTracks = [
  { id: "hipaa_readiness", label: "HIPAA Readiness" },
  { id: "pci_readiness", label: "PCI DSS Readiness" },
  { id: "soc2_readiness", label: "SOC 2 Readiness" },
  { id: "cyber_insurance_readiness", label: "Cyber Insurance Readiness" },
] as const;

export type MerchandisingRailId =
  | "popular"
  | "microsoft365"
  | "comanaged"
  | "cyber_insurance"
  | "best_value";

export type StoreSortOption = "recommended" | "price_asc" | "price_desc" | "popular";

/** Catalog toolbar — vendor / compliance focus / org size (elevate, do not replace category/billing/outcome). */
export type StoreComplianceId =
  | "cyber_insurance"
  | "policy_docs"
  | "risk_assessment"
  | "awareness"
  | "continuity";

export type StoreSizeId = "small" | "mid" | "large";

/** List-price bands for catalog refine (basePrice / unit — not cart totals). */
export type StorePriceBandId = "under_50" | "50_150" | "150_500" | "500_plus";

/** Buy path: instant checkout vs quote-first / high-touch. */
export type StorePurchasePathId = "checkout" | "quote";

export const storeComplianceFilters: { id: StoreComplianceId; label: string; blurb: string }[] = [
  { id: "cyber_insurance", label: "Cyber insurance", blurb: "Controls insurers commonly ask about" },
  { id: "policy_docs", label: "Policies & docs", blurb: "Templates and documented controls" },
  { id: "risk_assessment", label: "Risk assessment", blurb: "CSRA, quick scans, DMARC" },
  { id: "awareness", label: "Awareness training", blurb: "Phishing + security habits" },
  { id: "continuity", label: "Continuity / IR", blurb: "BCP, IR runbooks, BCDR" },
];

export const storeSizeFilters: { id: StoreSizeId; label: string; blurb: string }[] = [
  { id: "small", label: "Small (≈1–49)", blurb: "Starter onboardings, Office-scale stacks" },
  { id: "mid", label: "Mid-size (≈50–199)", blurb: "Business-scale and multi-site ready" },
  { id: "large", label: "Large / multi-site", blurb: "Enterprise, large onboardings, multi-site" },
];

export const storePriceBandFilters: {
  id: StorePriceBandId;
  label: string;
  blurb: string;
  min: number;
  max: number;
}[] = [
  { id: "under_50", label: "Under $50", blurb: "Entry unit rates", min: 0, max: 50 },
  { id: "50_150", label: "$50 – $149", blurb: "Common per-unit services", min: 50, max: 150 },
  { id: "150_500", label: "$150 – $499", blurb: "Mid-tier services & kits", min: 150, max: 500 },
  { id: "500_plus", label: "$500+", blurb: "Projects, hardware, blocks", min: 500, max: Number.POSITIVE_INFINITY },
];

export const storePurchasePathFilters: {
  id: StorePurchasePathId;
  label: string;
  blurb: string;
}[] = [
  { id: "checkout", label: "Can checkout", blurb: "Add to Solution and purchase online" },
  { id: "quote", label: "Quote first", blurb: "Custom, zero-list, or high-touch SKUs" },
];

export interface StoreOutcome {
  id: StoreOutcomeId;
  label: string;
  blurb: string;
  /** Categories that primarily serve this outcome */
  categories: ProductCategory[];
  /** Extra SKUs to always include when filtering by this outcome */
  skuHints: string[];
  /** Search keywords (problems / vendors) that map here */
  keywords: string[];
  accent: string;
}

export interface MerchandisingRail {
  id: MerchandisingRailId;
  title: string;
  subtitle: string;
  skus: string[];
}

/** Soft, substantiable trust claims only — no fake cert badges. */
export const storeTrustClaims = [
  { label: "Arizona-based MSP", detail: "Chandler / East Valley" },
  { label: "Security-first", detail: "MSP / MSSP mindset" },
  { label: "Microsoft-aligned", detail: "M365 & identity patterns" },
  { label: "Audit readiness", detail: "Evidence & control support" },
] as const;

export const storeOutcomes: StoreOutcome[] = [
  {
    id: "protect",
    label: "Protect",
    blurb: "Endpoint, email, and identity defenses",
    categories: ["comanaged_subscriptions", "digital_assessments", "digital_training"],
    skuHints: [
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-DIG-ASMT-QUICK-OT",
      "DE-DIG-ASMT-PHISH-MO",
    ],
    keywords: ["security", "edr", "phishing", "threat", "malware", "ransomware", "firewall"],
    accent: "text-rose-300",
  },
  {
    id: "recover",
    label: "Recover",
    blurb: "Continuity, IR, and cutover support",
    categories: ["digital_templates", "networking_projects", "professional_services"],
    skuHints: [
      "DE-DIG-TPL-BCP-OT",
      "DE-DIG-TPL-IR-RUNBOOK-OT",
      "DE-SVC-NET-CUTOVER-OT",
      "DE-SVC-MGD-BCDR-MO",
    ],
    keywords: ["backup", "disaster", "recovery", "bcdr", "continuity", "incident response", "ir"],
    accent: "text-orange-300",
  },
  {
    id: "communicate",
    label: "Communicate",
    blurb: "Calling, meetings, and unified communications",
    categories: ["ucaas_subscriptions", "ucaas_setup"],
    skuHints: [
      "DE-SVC-UC-SEAT-STD-MO",
      "DE-SVC-UC-SEAT-PRO-MO",
    ],
    keywords: ["ucaas", "voip", "calling", "meetings", "phone", "teams voice", "communications"],
    accent: "text-sky-300",
  },
  {
    id: "operate",
    label: "Operate",
    blurb: "Helpdesk, network, and managed operating packages",
    categories: [
      "contract_services",
      "comanaged_onboarding",
      "networking_managed",
      "networking_projects",
      "hardware_provisioning",
      "professional_services",
    ],
    skuHints: [
      "DE-SVC-CM-HELPDESK-ASSIST-MO",
      "DE-SVC-NET-MANAGED-CORE-MO",
      "DE-SVC-MGD-OFFICE-MO",
      "DE-SVC-MGD-BUSINESS-MO",
      "DE-SVC-MGD-ENTERPRISE-MO",
      "DE-SVC-BLK-5HR-OT",
      "DE-HW-PROV-ENDPOINT-OT",
    ],
    keywords: ["helpdesk", "support", "managed", "network", "wifi", "provisioning", "msp", "vCIO"],
    accent: "text-emerald-300",
  },
  {
    id: "compliance",
    label: "Compliance",
    blurb: "Policies, assessments, and audit readiness",
    categories: ["digital_templates", "digital_assessments"],
    skuHints: [
      "DE-DIG-TPL-POLICY-CORE-OT",
      "DE-DIG-TPL-POLICY-ADV-OT",
      "DE-DIG-ASMT-CSRA-OT",
      "DE-DIG-TRN-AWARE-BASIC-YR",
    ],
    keywords: ["compliance", "policy", "audit", "readiness", "risk assessment", "evidence"],
    accent: "text-amber-300",
  },
];

/** Rails use only real catalog SKUs. */
export const merchandisingRails: MerchandisingRail[] = [
  {
    id: "popular",
    title: "Popular",
    subtitle: "Frequently added building blocks",
    skus: [
      "DE-SVC-CM-ENDPOINT-CORE-MO",
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-SVC-CM-IDENTITY-CORE-MO",
      "DE-SVC-CM-HELPDESK-ASSIST-MO",
      "DE-DIG-ASMT-QUICK-OT",
    ],
  },
  {
    id: "microsoft365",
    title: "Recommended for Microsoft 365",
    subtitle: "Identity, email, SaaS, and awareness",
    skus: [
      "DE-SVC-CM-IDENTITY-CORE-MO",
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-SVC-CM-SAAS-MGMT-MO",
      "DE-DIG-ASMT-DMARC-OT",
      "DE-DIG-ASMT-PHISH-MO",
      "DE-DIG-TRN-AWARE-PRO-YR",
    ],
  },
  {
    id: "comanaged",
    title: "Co-Managed Essentials",
    subtitle: "Tools that extend an existing IT team",
    skus: [
      "DE-SVC-CM-ENDPOINT-CORE-MO",
      "DE-SVC-CM-SERVER-MON-MO",
      "DE-SVC-CM-HELPDESK-ASSIST-MO",
      "DE-SVC-CM-ONBOARD-S-OT",
      "DE-SVC-CM-DOC-PACK-OT",
      "DE-SVC-CONSULT-VCIO-HR",
    ],
  },
  {
    id: "cyber_insurance",
    title: "Cyber Insurance Essentials",
    subtitle: "Controls insurers commonly ask about",
    skus: [
      "DE-DIG-ASMT-CSRA-OT",
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-DIG-ASMT-PHISH-MO",
      "DE-DIG-TPL-IR-RUNBOOK-OT",
      "DE-DIG-TRN-AWARE-BASIC-YR",
    ],
  },
  {
    id: "best_value",
    title: "Best Value",
    subtitle: "High-leverage packs and starters",
    skus: [
      "DE-DIG-TPL-POLICY-CORE-OT",
      "DE-DIG-ASMT-QUICK-OT",
      "DE-SVC-CM-ONBOARD-S-OT",
      "DE-SVC-BLK-5HR-OT",
      "DE-DIG-TRN-ONBOARD-OT",
      "DE-SVC-UC-SEAT-STD-MO",
    ],
  },
];

/**
 * Soft package inclusion hints — co-managed / digital SKUs that map to
 * capabilities already covered inside ProActive Ecosystem tiers.
 */
export const includedInHints: Record<string, string> = {
  "DE-SVC-CM-ENDPOINT-CORE-MO": "Included in ProActive Ecosystem – Office+",
  "DE-SVC-CM-ENDPOINT-EDR-MO": "Included in ProActive Ecosystem – Business+",
  "DE-SVC-CM-EMAIL-SEC-MO": "Included in ProActive Ecosystem – Business+",
  "DE-SVC-CM-IDENTITY-CORE-MO": "Included in ProActive Ecosystem – Office+",
  "DE-SVC-CM-SAAS-MGMT-MO": "Related to ProActive Ecosystem – Office+",
  "DE-SVC-CM-HELPDESK-ASSIST-MO": "Included in ProActive Ecosystem plans",
  "DE-DIG-TRN-AWARE-BASIC-YR": "Included in ProActive Ecosystem – Business+",
  "DE-DIG-TRN-AWARE-PRO-YR": "Included in ProActive Ecosystem – Enterprise",
  "DE-DIG-TPL-POLICY-CORE-OT": "Related to ProActive Ecosystem – Business compliance foundations",
};

/** Popularity rank for sort (lower = more popular). Unknown SKUs sort last. */
export const popularSkuRank: Record<string, number> = Object.fromEntries(
  merchandisingRails
    .find((r) => r.id === "popular")!
    .skus.map((sku, i) => [sku, i + 1])
    .concat(
      merchandisingRails
        .find((r) => r.id === "cyber_insurance")!
        .skus.map((sku, i) => [sku, i + 20])
    )
);

export const billingTypeLabels: Partial<Record<PricingType, string>> = {
  one_time: "One-time",
  monthly: "Monthly",
  yearly: "Yearly",
  per_hour: "Hourly",
  per_user: "Per user",
  per_endpoint: "Per endpoint",
  per_device: "Per device",
  per_location: "Per location",
  per_seat: "Per seat",
};

/** Soft compliance focus tags — maps real SKUs / categories, does not invent certs. */
const complianceSkuHints: Record<StoreComplianceId, string[]> = {
  cyber_insurance: [
    "DE-DIG-ASMT-CSRA-OT",
    "DE-SVC-CM-ENDPOINT-EDR-MO",
    "DE-SVC-CM-EMAIL-SEC-MO",
    "DE-DIG-ASMT-PHISH-MO",
    "DE-DIG-TPL-IR-RUNBOOK-OT",
    "DE-DIG-TRN-AWARE-BASIC-YR",
    "DE-SVC-CM-IDENTITY-CORE-MO",
  ],
  policy_docs: [
    "DE-DIG-TPL-POLICY-CORE-OT",
    "DE-DIG-TPL-POLICY-ADV-OT",
    "DE-SVC-CM-DOC-PACK-OT",
    "DE-DIG-TPL-IR-RUNBOOK-OT",
    "DE-DIG-TPL-BCP-OT",
  ],
  risk_assessment: [
    "DE-DIG-ASMT-QUICK-OT",
    "DE-DIG-ASMT-CSRA-OT",
    "DE-DIG-ASMT-DMARC-OT",
    "DE-DIG-ASMT-PHISH-MO",
  ],
  awareness: [
    "DE-DIG-TRN-AWARE-BASIC-YR",
    "DE-DIG-TRN-AWARE-PRO-YR",
    "DE-DIG-TRN-ONBOARD-OT",
    "DE-DIG-ASMT-PHISH-MO",
  ],
  continuity: [
    "DE-DIG-TPL-BCP-OT",
    "DE-DIG-TPL-IR-RUNBOOK-OT",
    "DE-SVC-MGD-BCDR-MO",
    "DE-SVC-NET-CUTOVER-OT",
  ],
};

/** Org-size fit hints — tier / onboarding size naming already in catalog. */
const sizeSkuHints: Record<StoreSizeId, string[]> = {
  small: [
    "DE-SVC-MGD-OFFICE-MO",
    "DE-SVC-MGD-WORKPLACE-MO",
    "DE-SVC-CM-ONBOARD-S-OT",
    "DE-SVC-UC-ONBOARD-S-OT",
    "DE-SVC-BLK-5HR-OT",
    "DE-DIG-ASMT-QUICK-OT",
    "DE-DIG-TPL-POLICY-CORE-OT",
    "DE-SVC-UC-SEAT-STD-MO",
    "DE-SVC-CM-ENDPOINT-CORE-MO",
    "DE-HW-NET-FW-SMB-OT",
  ],
  mid: [
    "DE-SVC-MGD-BUSINESS-MO",
    "DE-SVC-MGD-CYBER-MO",
    "DE-SVC-CM-ONBOARD-M-OT",
    "DE-SVC-UC-ONBOARD-M-OT",
    "DE-SVC-BLK-10HR-OT",
    "DE-SVC-CM-ENDPOINT-EDR-MO",
    "DE-SVC-CM-EMAIL-SEC-MO",
    "DE-SVC-CM-IDENTITY-CORE-MO",
    "DE-SVC-NET-MANAGED-CORE-MO",
    "DE-DIG-ASMT-CSRA-OT",
    "DE-DIG-TRN-AWARE-BASIC-YR",
  ],
  large: [
    "DE-SVC-MGD-ENTERPRISE-MO",
    "DE-SVC-CM-ONBOARD-L-OT",
    "DE-SVC-UC-ONBOARD-L-OT",
    "DE-SVC-BLK-20HR-OT",
    "DE-SVC-NET-MANAGED-ADV-MO",
    "DE-SVC-NET-MANAGED-MSITE-MO",
    "DE-DIG-TRN-AWARE-PRO-YR",
    "DE-DIG-TPL-POLICY-ADV-OT",
    "DE-SVC-CONSULT-VCIO-HR",
    "DE-SVC-COMANAGED-CUSTOM-MO",
  ],
};

export function getProductVendorSlug(product: StoreProduct): string | null {
  return getVendorForSku(product.sku, product.category)?.slug ?? null;
}

export function getProductVendorName(product: StoreProduct): string | null {
  return getVendorForSku(product.sku, product.category)?.name ?? null;
}

/** Vendors present in a product list — for toolbar options. */
export function listVendorsForProducts(
  products: StoreProduct[]
): { slug: string; name: string }[] {
  const map = new Map<string, string>();
  for (const p of products) {
    const v = getVendorForSku(p.sku, p.category);
    if (v) map.set(v.slug, v.name);
  }
  return Array.from(map.entries())
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function productMatchesVendor(product: StoreProduct, vendorSlug: string): boolean {
  return getProductVendorSlug(product) === vendorSlug;
}

export function productMatchesCompliance(
  product: StoreProduct,
  complianceId: StoreComplianceId
): boolean {
  const hints = complianceSkuHints[complianceId];
  if (hints?.includes(product.sku)) return true;
  const hay = `${product.name} ${product.shortDescription} ${product.description} ${product.features.join(" ")}`.toLowerCase();
  switch (complianceId) {
    case "cyber_insurance":
      return /insurance|underwriter|csra|edr|phishing|mfa|identity/i.test(hay);
    case "policy_docs":
      return (
        product.category === "digital_templates" ||
        /policy|documentation|runbook|playbook/i.test(hay)
      );
    case "risk_assessment":
      return product.category === "digital_assessments" || /assessment|dmarc|risk/i.test(hay);
    case "awareness":
      return product.category === "digital_training" || /awareness|phishing|training/i.test(hay);
    case "continuity":
      return /bcdr|backup|continuity|disaster|incident response|cutover|ir-runbook|bcp/i.test(
        `${hay} ${product.sku}`
      );
    default:
      return false;
  }
}

export function productMatchesSize(product: StoreProduct, sizeId: StoreSizeId): boolean {
  if (sizeSkuHints[sizeId]?.includes(product.sku)) return true;

  const sku = product.sku;
  // Exclude SKUs that are clearly sized for a different band.
  if (sizeId === "small") {
    if (/ONBOARD-L-OT|MGD-ENTERPRISE|MSITE|BLK-20HR|AWARE-PRO|POLICY-ADV|UC-ONBOARD-L/i.test(sku)) {
      return false;
    }
  } else if (sizeId === "mid") {
    if (
      /ONBOARD-S-OT|ONBOARD-L-OT|MGD-OFFICE|MGD-WORKPLACE|MGD-ENTERPRISE|BLK-5HR|BLK-20HR|MSITE|UC-ONBOARD-[SL]/i.test(
        sku
      )
    ) {
      return false;
    }
  } else if (sizeId === "large") {
    if (/ONBOARD-S-OT|MGD-OFFICE|MGD-WORKPLACE|FW-SMB|BLK-5HR|UC-ONBOARD-S/i.test(sku)) {
      return false;
    }
  }

  // Size-agnostic building blocks (most co-managed / digital / hardware) fit all bands.
  return true;
}

export function productMatchesPriceBand(
  product: StoreProduct,
  bandId: StorePriceBandId
): boolean {
  const band = storePriceBandFilters.find((b) => b.id === bandId);
  if (!band) return false;
  const price = product.basePrice;
  return price >= band.min && price < band.max;
}

/** Checkout = online purchasable with a list price; quote = custom / zero-list / contract. */
export function productMatchesPurchasePath(
  product: StoreProduct,
  pathId: StorePurchasePathId
): boolean {
  const isQuoteFirst =
    product.isContractOnly ||
    product.basePrice === 0 ||
    !product.isCheckoutEnabled ||
    product.category === "professional_services" ||
    product.category === "contract_services";
  if (pathId === "quote") return isQuoteFirst;
  return product.isCheckoutEnabled && !product.isContractOnly && product.basePrice > 0;
}

export function getProductBySku(sku: string): StoreProduct | undefined {
  return storeProducts.find((p) => p.sku === sku);
}

export function getProductsForRail(railId: MerchandisingRailId): StoreProduct[] {
  const rail = merchandisingRails.find((r) => r.id === railId);
  if (!rail) return [];
  return rail.skus
    .map((sku) => getProductBySku(sku))
    .filter((p): p is StoreProduct => !!p);
}

export function productMatchesOutcome(product: StoreProduct, outcomeId: StoreOutcomeId): boolean {
  const outcome = storeOutcomes.find((o) => o.id === outcomeId);
  if (!outcome) return false;
  if (outcome.skuHints.includes(product.sku)) return true;
  if (outcome.categories.includes(product.category)) return true;
  const haystack = `${product.name} ${product.shortDescription} ${product.description} ${product.features.join(" ")}`.toLowerCase();
  return outcome.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

export function searchProducts(products: StoreProduct[], query: string): StoreProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;

  const outcomeHits = new Set(
    storeOutcomes
      .filter((o) =>
        o.label.toLowerCase().includes(q) ||
        o.blurb.toLowerCase().includes(q) ||
        o.keywords.some((kw) => kw.includes(q) || q.includes(kw))
      )
      .map((o) => o.id)
  );

  return products.filter((p) => {
    const blob = [
      p.name,
      p.sku,
      p.shortDescription,
      p.description,
      p.features.join(" "),
      p.category,
    ]
      .join(" ")
      .toLowerCase();

    if (blob.includes(q)) return true;
    if (Array.from(outcomeHits).some((id) => productMatchesOutcome(p, id))) return true;
    // Vendor / problem shorthand
    if (q.includes("microsoft") || q.includes("m365") || q.includes("365")) {
      return (
        blob.includes("identity") ||
        blob.includes("email") ||
        blob.includes("saas") ||
        blob.includes("mfa") ||
        blob.includes("sso") ||
        blob.includes("phishing") ||
        blob.includes("dmarc")
      );
    }
    return false;
  });
}

export function sortProducts(products: StoreProduct[], sort: StoreSortOption): StoreProduct[] {
  const sorted = [...products];
  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => a.basePrice - b.basePrice || a.sortOrder - b.sortOrder);
    case "price_desc":
      return sorted.sort((a, b) => b.basePrice - a.basePrice || a.sortOrder - b.sortOrder);
    case "popular":
      return sorted.sort((a, b) => {
        const ra = popularSkuRank[a.sku] ?? 999;
        const rb = popularSkuRank[b.sku] ?? 999;
        return ra - rb || a.sortOrder - b.sortOrder;
      });
    case "recommended":
    default:
      return sorted.sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

export function getIncludedInHint(sku: string): string | undefined {
  return includedInHints[sku];
}

/** Outcome-first lead copy for cards — buyer understands before the stack. */
export const outcomeLeads: Record<string, string> = {
  "DE-SVC-CM-ENDPOINT-CORE-MO":
    "Protect employee computers with managed endpoint baseline coverage for your IT team.",
  "DE-SVC-CM-ENDPOINT-EDR-MO":
    "Protect every employee computer from ransomware and modern endpoint attacks.",
  "DE-SVC-CM-EMAIL-SEC-MO":
    "Stop phishing and mailbox compromises before they become business incidents.",
  "DE-SVC-CM-IDENTITY-CORE-MO":
    "Harden sign-ins with managed identity, MFA, and access controls.",
  "DE-SVC-CM-SAAS-MGMT-MO":
    "Keep Microsoft 365 and SaaS apps governed, patched, and supportable.",
  "DE-SVC-CM-HELPDESK-ASSIST-MO":
    "Give your IT team overflow helpdesk capacity without hiring full-time.",
  "DE-SVC-CM-SERVER-MON-MO":
    "Monitor servers and catch failures before users feel the outage.",
  "DE-SVC-UC-SEAT-STD-MO":
    "Modernize phone service with cloud seats your team can actually use.",
  "DE-SVC-UC-SEAT-PRO-MO":
    "Upgrade communications with advanced cloud phone features and support.",
  "DE-SVC-NET-MANAGED-CORE-MO":
    "Keep sites online with managed network monitoring and change control.",
  "DE-DIG-ASMT-QUICK-OT":
    "Get a fast, practical read on identity, endpoint, email, and backup gaps.",
  "DE-DIG-ASMT-CSRA-OT":
    "Document cyber risk in language insurers and auditors understand.",
  "DE-DIG-ASMT-PHISH-MO":
    "Measure phishing susceptibility and train people where risk is highest.",
  "DE-DIG-TRN-AWARE-BASIC-YR":
    "Build security habits across the company with recurring awareness training.",
  "DE-DIG-TPL-POLICY-CORE-OT":
    "Stand up core IT/security policies without starting from a blank page.",
  "DE-DIG-TPL-IR-RUNBOOK-OT":
    "Know who does what when an incident hits — before you need it.",
  "DE-DIG-TPL-BCP-OT":
    "Define how the business continues when systems or sites are disrupted.",
  "DE-SVC-MGD-BCDR-MO":
    "Protect critical data and shorten recovery when something fails.",
};

export function getOutcomeLead(product: StoreProduct): string {
  return outcomeLeads[product.sku] || product.shortDescription || product.description;
}

/** Outcome label only when the SKU is explicitly hinted — never invented. */
export function getBestForLabel(product: StoreProduct): string | null {
  const hinted = storeOutcomes.find((outcome) => outcome.skuHints.includes(product.sku));
  return hinted?.label ?? null;
}

/** Soft discovery tags for cards (not rainbow category paint). */
export const productTags: Record<string, string[]> = {
  "DE-SVC-CM-ENDPOINT-CORE-MO": ["Endpoint", "Co-Managed", "Security"],
  "DE-SVC-CM-ENDPOINT-EDR-MO": ["Endpoint", "EDR", "Security"],
  "DE-SVC-CM-EMAIL-SEC-MO": ["Email", "Security", "M365"],
  "DE-SVC-CM-IDENTITY-CORE-MO": ["Identity", "MFA", "Access"],
  "DE-SVC-CM-SAAS-MGMT-MO": ["Microsoft 365", "SaaS", "Governance"],
  "DE-SVC-CM-HELPDESK-ASSIST-MO": ["Helpdesk", "Co-Managed", "Support"],
  "DE-SVC-UC-SEAT-STD-MO": ["UCaaS", "Communications"],
  "DE-SVC-UC-SEAT-PRO-MO": ["UCaaS", "Communications"],
  "DE-SVC-NET-MANAGED-CORE-MO": ["Network", "Managed"],
  "DE-DIG-ASMT-QUICK-OT": ["Assessment", "Security"],
  "DE-DIG-ASMT-CSRA-OT": ["Assessment", "Insurance", "Compliance"],
  "DE-DIG-ASMT-PHISH-MO": ["Phishing", "Training"],
  "DE-DIG-TRN-AWARE-BASIC-YR": ["Training", "Awareness"],
  "DE-DIG-TPL-POLICY-CORE-OT": ["Compliance", "Policies"],
  "DE-DIG-TPL-IR-RUNBOOK-OT": ["Incident Response", "Continuity"],
};

export function getProductTags(product: StoreProduct): string[] {
  if (productTags[product.sku]) return productTags[product.sku];
  const tags: string[] = [categoryLabels[product.category]];
  if (product.pricingType.includes("user") || product.pricingUnit === "user") tags.push("Per user");
  if (product.pricingType.includes("endpoint") || product.pricingUnit === "endpoint") tags.push("Per endpoint");
  if (["monthly", "yearly", "per_user", "per_endpoint", "per_seat", "per_location"].includes(product.pricingType)) {
    tags.push("Recurring");
  } else if (product.pricingType === "one_time") {
    tags.push("One-time");
  }
  return tags.slice(0, 3);
}

export interface ProductRelationship {
  worksWith?: string[];
  required?: string[];
  includedIn?: string;
  upgradeTo?: string[];
}

/** Product relationships from real catalog SKUs only. */
export const productRelationships: Record<string, ProductRelationship> = {
  "DE-SVC-CM-ENDPOINT-CORE-MO": {
    worksWith: ["DE-SVC-CM-ENDPOINT-EDR-MO", "DE-SVC-CM-IDENTITY-CORE-MO", "DE-SVC-CM-EMAIL-SEC-MO"],
    includedIn: "ProActive Ecosystem – Office+",
    upgradeTo: ["DE-SVC-CM-ENDPOINT-EDR-MO"],
  },
  "DE-SVC-CM-ENDPOINT-EDR-MO": {
    worksWith: [
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-SVC-CM-IDENTITY-CORE-MO",
      "DE-DIG-TRN-AWARE-BASIC-YR",
      "DE-HW-PROV-ENDPOINT-OT",
    ],
    includedIn: "ProActive Ecosystem – Business+",
  },
  "DE-SVC-CM-EMAIL-SEC-MO": {
    worksWith: [
      "DE-SVC-CM-IDENTITY-CORE-MO",
      "DE-DIG-ASMT-PHISH-MO",
      "DE-DIG-ASMT-DMARC-OT",
      "DE-DIG-TRN-AWARE-BASIC-YR",
    ],
    includedIn: "ProActive Ecosystem – Business+",
  },
  "DE-SVC-CM-IDENTITY-CORE-MO": {
    worksWith: [
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-SVC-CM-SAAS-MGMT-MO",
      "DE-SVC-CM-ENDPOINT-CORE-MO",
    ],
    includedIn: "ProActive Ecosystem – Office+",
  },
  "DE-SVC-CM-SAAS-MGMT-MO": {
    worksWith: ["DE-SVC-CM-IDENTITY-CORE-MO", "DE-SVC-CM-EMAIL-SEC-MO", "DE-DIG-ASMT-DMARC-OT"],
  },
  "DE-SVC-CM-HELPDESK-ASSIST-MO": {
    worksWith: [
      "DE-SVC-CM-ENDPOINT-CORE-MO",
      "DE-SVC-CM-SERVER-MON-MO",
      "DE-SVC-BLK-5HR-OT",
    ],
    upgradeTo: ["DE-SVC-BLK-10HR-OT"],
  },
  "DE-SVC-CM-SERVER-MON-MO": {
    worksWith: [
      "DE-SVC-CM-HELPDESK-ASSIST-MO",
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-SVC-MGD-BCDR-MO",
    ],
  },
  "DE-SVC-CM-ONBOARD-S-OT": {
    worksWith: ["DE-SVC-CM-DOC-PACK-OT", "DE-SVC-CM-ENDPOINT-CORE-MO"],
    upgradeTo: ["DE-SVC-CM-ONBOARD-M-OT"],
  },
  "DE-SVC-CM-ONBOARD-M-OT": {
    worksWith: ["DE-SVC-CM-DOC-PACK-OT", "DE-SVC-CM-ENDPOINT-EDR-MO"],
    upgradeTo: ["DE-SVC-CM-ONBOARD-L-OT"],
  },
  "DE-SVC-CM-ONBOARD-L-OT": {
    worksWith: ["DE-SVC-CM-DOC-PACK-OT", "DE-SVC-CONSULT-VCIO-HR"],
  },
  "DE-SVC-CM-DOC-PACK-OT": {
    worksWith: ["DE-DIG-TPL-POLICY-CORE-OT", "DE-SVC-CM-ONBOARD-S-OT"],
  },
  "DE-SVC-MGD-OFFICE-MO": {
    worksWith: ["DE-SVC-MGD-BCDR-MO", "DE-DIG-ASMT-QUICK-OT"],
    upgradeTo: ["DE-SVC-MGD-BUSINESS-MO"],
  },
  "DE-SVC-MGD-BUSINESS-MO": {
    worksWith: ["DE-SVC-MGD-BCDR-MO", "DE-DIG-ASMT-CSRA-OT", "DE-DIG-TRN-AWARE-BASIC-YR"],
    upgradeTo: ["DE-SVC-MGD-ENTERPRISE-MO"],
  },
  "DE-SVC-MGD-ENTERPRISE-MO": {
    worksWith: ["DE-SVC-CONSULT-VCIO-HR", "DE-DIG-TPL-POLICY-ADV-OT", "DE-SVC-MGD-BCDR-MO"],
  },
  "DE-SVC-MGD-WORKPLACE-MO": {
    worksWith: ["DE-SVC-CM-IDENTITY-CORE-MO", "DE-HW-PROV-ENDPOINT-OT"],
    upgradeTo: ["DE-SVC-MGD-OFFICE-MO"],
  },
  "DE-SVC-MGD-CYBER-MO": {
    worksWith: ["DE-DIG-ASMT-CSRA-OT", "DE-DIG-TRN-AWARE-PRO-YR", "DE-SVC-MGD-BCDR-MO"],
    upgradeTo: ["DE-SVC-MGD-BUSINESS-MO"],
  },
  "DE-SVC-MGD-BCDR-MO": {
    worksWith: ["DE-DIG-TPL-BCP-OT", "DE-DIG-TPL-IR-RUNBOOK-OT"],
    includedIn: "ProActive Ecosystem – Business+",
  },
  "DE-SVC-COMANAGED-CUSTOM-MO": {
    worksWith: [
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-SVC-CM-HELPDESK-ASSIST-MO",
      "DE-SVC-CONSULT-VCIO-HR",
    ],
  },
  "DE-DIG-ASMT-QUICK-OT": {
    worksWith: ["DE-DIG-ASMT-CSRA-OT", "DE-SVC-CM-ENDPOINT-CORE-MO", "DE-DIG-TPL-POLICY-CORE-OT"],
    upgradeTo: ["DE-DIG-ASMT-CSRA-OT"],
  },
  "DE-DIG-ASMT-CSRA-OT": {
    worksWith: [
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-DIG-TPL-IR-RUNBOOK-OT",
      "DE-DIG-ASMT-PHISH-MO",
      "DE-DIG-TPL-POLICY-CORE-OT",
    ],
  },
  "DE-DIG-ASMT-DMARC-OT": {
    worksWith: ["DE-SVC-CM-EMAIL-SEC-MO", "DE-SVC-CM-IDENTITY-CORE-MO", "DE-DIG-ASMT-PHISH-MO"],
  },
  "DE-DIG-ASMT-PHISH-MO": {
    worksWith: ["DE-DIG-TRN-AWARE-BASIC-YR", "DE-SVC-CM-EMAIL-SEC-MO", "DE-DIG-ASMT-DMARC-OT"],
    upgradeTo: ["DE-DIG-TRN-AWARE-PRO-YR"],
  },
  "DE-DIG-TPL-POLICY-CORE-OT": {
    worksWith: ["DE-DIG-TPL-POLICY-ADV-OT", "DE-DIG-TPL-IR-RUNBOOK-OT", "DE-DIG-ASMT-CSRA-OT"],
    upgradeTo: ["DE-DIG-TPL-POLICY-ADV-OT"],
  },
  "DE-DIG-TPL-POLICY-ADV-OT": {
    worksWith: ["DE-DIG-TPL-IR-RUNBOOK-OT", "DE-DIG-TPL-BCP-OT", "DE-SVC-CONSULT-SEC-HR"],
  },
  "DE-DIG-TPL-IR-RUNBOOK-OT": {
    worksWith: ["DE-DIG-TPL-BCP-OT", "DE-SVC-MGD-BCDR-MO", "DE-DIG-ASMT-CSRA-OT"],
  },
  "DE-DIG-TPL-BCP-OT": {
    worksWith: ["DE-DIG-TPL-IR-RUNBOOK-OT", "DE-SVC-MGD-BCDR-MO"],
  },
  "DE-DIG-TRN-AWARE-BASIC-YR": {
    worksWith: ["DE-DIG-ASMT-PHISH-MO", "DE-SVC-CM-EMAIL-SEC-MO", "DE-DIG-TRN-ONBOARD-OT"],
    upgradeTo: ["DE-DIG-TRN-AWARE-PRO-YR"],
    includedIn: "ProActive Ecosystem – Business+",
  },
  "DE-DIG-TRN-AWARE-PRO-YR": {
    worksWith: ["DE-DIG-ASMT-PHISH-MO", "DE-DIG-ASMT-CSRA-OT", "DE-SVC-CM-EMAIL-SEC-MO"],
    includedIn: "ProActive Ecosystem – Enterprise",
  },
  "DE-DIG-TRN-ONBOARD-OT": {
    worksWith: ["DE-DIG-TRN-AWARE-BASIC-YR", "DE-SVC-CM-ONBOARD-S-OT"],
  },
  "DE-SVC-UC-SEAT-STD-MO": {
    worksWith: ["DE-SVC-UC-SEAT-PRO-MO", "DE-SVC-UC-AUTOATT-MO", "DE-HW-UC-PHONE-STD-OT"],
    upgradeTo: ["DE-SVC-UC-SEAT-PRO-MO"],
  },
  "DE-SVC-UC-SEAT-PRO-MO": {
    worksWith: ["DE-SVC-UC-AUTOATT-MO", "DE-SVC-UC-SMS-MO", "DE-HW-UC-PHONE-EXEC-OT"],
  },
  "DE-SVC-UC-AUTOATT-MO": {
    worksWith: ["DE-SVC-UC-SEAT-STD-MO", "DE-SVC-UC-CALLFLOW-OT", "DE-SVC-UC-SMS-MO"],
  },
  "DE-SVC-UC-SMS-MO": {
    worksWith: ["DE-SVC-UC-SEAT-PRO-MO", "DE-SVC-UC-AUTOATT-MO"],
  },
  "DE-SVC-UC-ONBOARD-S-OT": {
    worksWith: ["DE-SVC-UC-SEAT-STD-MO", "DE-SVC-UC-PORT-OT"],
    upgradeTo: ["DE-SVC-UC-ONBOARD-M-OT"],
  },
  "DE-SVC-UC-ONBOARD-M-OT": {
    worksWith: ["DE-SVC-UC-SEAT-PRO-MO", "DE-SVC-UC-CALLFLOW-OT"],
    upgradeTo: ["DE-SVC-UC-ONBOARD-L-OT"],
  },
  "DE-SVC-UC-ONBOARD-L-OT": {
    worksWith: ["DE-SVC-UC-SEAT-PRO-MO", "DE-SVC-UC-CALLFLOW-OT", "DE-SVC-UC-PORT-OT"],
  },
  "DE-SVC-UC-PORT-OT": {
    worksWith: ["DE-SVC-UC-ONBOARD-S-OT", "DE-SVC-UC-SEAT-STD-MO"],
  },
  "DE-SVC-UC-CALLFLOW-OT": {
    worksWith: ["DE-SVC-UC-AUTOATT-MO", "DE-SVC-UC-SEAT-PRO-MO"],
  },
  "DE-SVC-NET-MANAGED-CORE-MO": {
    worksWith: ["DE-SVC-NET-MANAGED-ADV-MO", "DE-HW-NET-FW-SMB-OT", "DE-HW-NET-AP-BIZ-OT"],
    upgradeTo: ["DE-SVC-NET-MANAGED-ADV-MO"],
  },
  "DE-SVC-NET-MANAGED-ADV-MO": {
    worksWith: ["DE-SVC-NET-MANAGED-MSITE-MO", "DE-HW-NET-FW-SMB-OT", "DE-SVC-NET-ENG-HR"],
    upgradeTo: ["DE-SVC-NET-MANAGED-MSITE-MO"],
  },
  "DE-SVC-NET-MANAGED-MSITE-MO": {
    worksWith: ["DE-SVC-NET-CUTOVER-OT", "DE-HW-NET-SW-24-OT", "DE-SVC-NET-ONSITE-HR"],
  },
  "DE-SVC-NET-ENG-HR": {
    worksWith: ["DE-SVC-NET-ONSITE-HR", "DE-HW-PROV-NET-OT", "DE-SVC-NET-MANAGED-CORE-MO"],
  },
  "DE-SVC-NET-ONSITE-HR": {
    worksWith: ["DE-SVC-NET-ENG-HR", "DE-SVC-FIELD-INSTALL-HR", "DE-HW-NET-FW-SMB-OT"],
  },
  "DE-SVC-NET-CUTOVER-OT": {
    worksWith: ["DE-SVC-NET-MANAGED-CORE-MO", "DE-DIG-TPL-BCP-OT"],
  },
  "DE-HW-PROV-ENDPOINT-OT": {
    worksWith: ["DE-HW-ENDPOINT-LT-BASE-OT", "DE-SVC-CM-ENDPOINT-CORE-MO", "DE-HW-SHIP-HANDLE-OT"],
  },
  "DE-HW-PROV-NET-OT": {
    worksWith: ["DE-HW-NET-FW-SMB-OT", "DE-SVC-NET-MANAGED-CORE-MO", "DE-SVC-FIELD-INSTALL-HR"],
  },
  "DE-HW-PROV-VOIP-OT": {
    worksWith: ["DE-HW-UC-PHONE-STD-OT", "DE-SVC-UC-SEAT-STD-MO", "DE-SVC-UC-ONBOARD-S-OT"],
  },
  "DE-HW-NET-FW-SMB-OT": {
    worksWith: ["DE-HW-NET-SW-24-OT", "DE-HW-NET-AP-BIZ-OT", "DE-SVC-NET-MANAGED-CORE-MO"],
  },
  "DE-HW-NET-SW-24-OT": {
    worksWith: ["DE-HW-NET-FW-SMB-OT", "DE-HW-NET-AP-BIZ-OT", "DE-SVC-FIELD-INSTALL-HR"],
  },
  "DE-HW-NET-AP-BIZ-OT": {
    worksWith: ["DE-HW-NET-FW-SMB-OT", "DE-SVC-NET-MANAGED-CORE-MO"],
  },
  "DE-HW-ENDPOINT-PC-BASE-OT": {
    worksWith: ["DE-HW-PROV-ENDPOINT-OT", "DE-SVC-CM-ENDPOINT-CORE-MO"],
    upgradeTo: ["DE-HW-ENDPOINT-LT-BASE-OT"],
  },
  "DE-HW-ENDPOINT-LT-BASE-OT": {
    worksWith: ["DE-HW-PROV-ENDPOINT-OT", "DE-SVC-CM-ENDPOINT-EDR-MO", "DE-HW-SHIP-HANDLE-OT"],
  },
  "DE-HW-UC-PHONE-STD-OT": {
    worksWith: ["DE-SVC-UC-SEAT-STD-MO", "DE-HW-UC-HDST-STD-OT"],
    upgradeTo: ["DE-HW-UC-PHONE-EXEC-OT"],
  },
  "DE-HW-UC-PHONE-EXEC-OT": {
    worksWith: ["DE-SVC-UC-SEAT-PRO-MO", "DE-HW-UC-HDST-STD-OT", "DE-HW-PROV-VOIP-OT"],
  },
  "DE-HW-UC-HDST-STD-OT": {
    worksWith: ["DE-HW-UC-PHONE-STD-OT", "DE-SVC-UC-SEAT-STD-MO"],
  },
  "DE-HW-SHIP-HANDLE-OT": {
    worksWith: ["DE-HW-PROV-ENDPOINT-OT", "DE-SVC-FIELD-INSTALL-HR"],
  },
  "DE-HW-INFRA-UPS-1500-OT": {
    worksWith: ["DE-HW-NET-FW-SMB-OT", "DE-SVC-FIELD-INSTALL-HR"],
  },
  "DE-SVC-FIELD-INSTALL-HR": {
    worksWith: ["DE-HW-SHIP-HANDLE-OT", "DE-SVC-NET-ONSITE-HR", "DE-HW-PROV-NET-OT"],
  },
  "DE-SVC-CONSULT-VCIO-HR": {
    worksWith: ["DE-SVC-CONSULT-SEC-HR", "DE-DIG-ASMT-CSRA-OT", "DE-SVC-BLK-10HR-OT"],
  },
  "DE-SVC-CONSULT-SEC-HR": {
    worksWith: ["DE-DIG-ASMT-CSRA-OT", "DE-DIG-TPL-POLICY-ADV-OT", "DE-SVC-CONSULT-VCIO-HR"],
  },
  "DE-SVC-CONSULT-SYS-HR": {
    worksWith: ["DE-SVC-CM-SERVER-MON-MO", "DE-SVC-BLK-5HR-OT", "DE-SVC-CONSULT-VCIO-HR"],
  },
  "DE-SVC-BLK-5HR-OT": {
    worksWith: ["DE-SVC-CM-HELPDESK-ASSIST-MO", "DE-SVC-CONSULT-SYS-HR"],
    upgradeTo: ["DE-SVC-BLK-10HR-OT"],
  },
  "DE-SVC-BLK-10HR-OT": {
    worksWith: ["DE-SVC-CM-HELPDESK-ASSIST-MO", "DE-SVC-CONSULT-VCIO-HR"],
    upgradeTo: ["DE-SVC-BLK-20HR-OT"],
  },
  "DE-SVC-BLK-20HR-OT": {
    worksWith: ["DE-SVC-CONSULT-VCIO-HR", "DE-SVC-CONSULT-SEC-HR", "DE-SVC-CM-HELPDESK-ASSIST-MO"],
  },
};

export function getProductRelationships(sku: string): ProductRelationship | undefined {
  return productRelationships[sku];
}

/**
 * Related catalog picks: relationship SKUs first (works-with / upgrade),
 * then same-category fillers. Never invents products outside the catalog.
 */
export function getRelatedProducts(
  product: StoreProduct,
  opts: { limit?: number; excludeClientOnly?: boolean } = {}
): StoreProduct[] {
  const limit = opts.limit ?? 4;
  const rel = getProductRelationships(product.sku);
  const seen = new Set<string>([product.id]);
  const out: StoreProduct[] = [];

  const pushSku = (sku: string) => {
    if (out.length >= limit) return;
    const p = getProductBySku(sku);
    if (!p || seen.has(p.id)) return;
    if (opts.excludeClientOnly && p.isClientOnly) return;
    seen.add(p.id);
    out.push(p);
  };

  for (const sku of rel?.worksWith || []) pushSku(sku);
  for (const sku of rel?.upgradeTo || []) pushSku(sku);
  for (const sku of rel?.required || []) pushSku(sku);

  if (out.length < limit) {
    for (const p of storeProducts) {
      if (out.length >= limit) break;
      if (p.category !== product.category || seen.has(p.id)) continue;
      if (opts.excludeClientOnly && p.isClientOnly) continue;
      seen.add(p.id);
      out.push(p);
    }
  }

  return out;
}

const CONFIGURABLE_PRICING: PricingType[] = [
  "per_endpoint",
  "per_user",
  "per_device",
  "per_seat",
  "per_location",
];

/** Qty/unit configurable before blind Add — unit-priced catalog SKUs. */
export function isConfigurableProduct(product: StoreProduct): boolean {
  if (product.isContractOnly || !product.isCheckoutEnabled) return false;
  return CONFIGURABLE_PRICING.includes(product.pricingType) || !!product.pricingUnit;
}

export function configUnitLabel(product: StoreProduct): string {
  if (product.pricingUnit) return product.pricingUnit;
  switch (product.pricingType) {
    case "per_endpoint":
      return "endpoints";
    case "per_user":
      return "users";
    case "per_device":
      return "devices";
    case "per_seat":
      return "seats";
    case "per_location":
      return "locations";
    default:
      return "units";
  }
}

export type CoverageDimension =
  | "endpoint"
  | "identity"
  | "email"
  | "backup"
  | "network"
  | "compliance";

export const coverageDimensions: {
  id: CoverageDimension;
  label: string;
  match: (p: StoreProduct) => boolean;
  improveSku: string;
}[] = [
  {
    id: "endpoint",
    label: "Endpoint",
    match: (p) =>
      /endpoint|edr|device/i.test(`${p.name} ${p.sku} ${p.shortDescription}`) ||
      p.pricingType === "per_endpoint",
    improveSku: "DE-SVC-CM-ENDPOINT-EDR-MO",
  },
  {
    id: "identity",
    label: "Identity",
    match: (p) => /identity|mfa|sso|access/i.test(`${p.name} ${p.sku} ${p.shortDescription}`),
    improveSku: "DE-SVC-CM-IDENTITY-CORE-MO",
  },
  {
    id: "email",
    label: "Email",
    match: (p) => /email|phish|dmarc|mailbox/i.test(`${p.name} ${p.sku} ${p.shortDescription}`),
    improveSku: "DE-SVC-CM-EMAIL-SEC-MO",
  },
  {
    id: "backup",
    label: "Backup",
    match: (p) =>
      /backup|bcdr|disaster|continuity|recover/i.test(`${p.name} ${p.sku} ${p.shortDescription}`),
    improveSku: "DE-SVC-MGD-BCDR-MO",
  },
  {
    id: "network",
    label: "Network",
    match: (p) =>
      p.category.startsWith("networking") ||
      /network|firewall|wifi|sase/i.test(`${p.name} ${p.sku}`),
    improveSku: "DE-SVC-NET-MANAGED-CORE-MO",
  },
  {
    id: "compliance",
    label: "Compliance",
    match: (p) =>
      p.category === "digital_assessments" ||
      p.category === "digital_templates" ||
      p.category === "digital_training" ||
      /compliance|policy|hipaa|audit|assessment/i.test(`${p.name} ${p.sku}`),
    improveSku: "DE-DIG-ASMT-CSRA-OT",
  },
];

export function productMatchesCoverage(
  product: StoreProduct,
  coverageId: CoverageDimension
): boolean {
  const dim = coverageDimensions.find((d) => d.id === coverageId);
  return dim ? dim.match(product) : false;
}

export interface CoverageScore {
  total: number;
  max: number;
  coveredCount: number;
  dimensionCount: number;
  bars: {
    id: CoverageDimension;
    label: string;
    covered: boolean;
    improveSku: string;
    coveredBy?: string;
  }[];
  suggestions: { sku: string; product?: StoreProduct; from: number; to: number; label: string }[];
}

/** Heuristic cart coverage — category presence, not a fake security audit. */
export function computeCoverageScore(products: StoreProduct[]): CoverageScore {
  const bars = coverageDimensions.map((d) => {
    const hit = products.find((p) => d.match(p));
    return {
      id: d.id,
      label: d.label,
      covered: !!hit,
      improveSku: d.improveSku,
      coveredBy: hit?.name,
    };
  });
  const coveredCount = bars.filter((b) => b.covered).length;
  const dimensionCount = bars.length;
  const total = Math.round((coveredCount / dimensionCount) * 100);
  const suggestions = bars
    .filter((b) => !b.covered)
    .map((b) => {
      const product = getProductBySku(b.improveSku);
      const nextCovered = coveredCount + 1;
      return {
        sku: b.improveSku,
        product,
        from: total,
        to: Math.round((nextCovered / dimensionCount) * 100),
        label: b.label,
      };
    })
    .filter((s) => !!s.product)
    .slice(0, 3);

  return { total, max: 100, coveredCount, dimensionCount, bars, suggestions };
}

/**
 * Stack complements from cart relationships — SKUs not already in the cart.
 * Prefer worksWith / upgradeTo from items already chosen.
 */
export function getCartComplements(
  products: StoreProduct[],
  opts: { limit?: number } = {}
): StoreProduct[] {
  const limit = opts.limit ?? 3;
  const inCart = new Set(products.map((p) => p.sku));
  const seen = new Set<string>();
  const out: StoreProduct[] = [];

  const push = (sku: string) => {
    if (out.length >= limit || inCart.has(sku) || seen.has(sku)) return;
    const p = getProductBySku(sku);
    if (!p || p.isContractOnly || !p.isCheckoutEnabled) return;
    seen.add(sku);
    out.push(p);
  };

  for (const product of products) {
    const rel = getProductRelationships(product.sku);
    for (const sku of rel?.upgradeTo || []) push(sku);
    for (const sku of rel?.worksWith || []) push(sku);
  }

  return out;
}

/** Solution cart grouping labels. */
export function solutionGroupFor(product: StoreProduct): string {
  if (
    product.category === "digital_templates" ||
    product.category === "digital_assessments"
  ) {
    return "Compliance & Docs";
  }
  if (product.category === "digital_training") {
    return "Awareness & Training";
  }
  if (
    /security|endpoint|edr|email|identity|phish|mdr|threat/i.test(
      `${product.name} ${product.category}`
    )
  ) {
    return "Security";
  }
  if (
    /backup|bcdr|continuity|disaster|recover|ir-runbook|bcp/i.test(
      `${product.name} ${product.sku}`
    )
  ) {
    return "Continuity";
  }
  if (product.category.startsWith("networking") || product.category.startsWith("ucaas")) {
    return "Communications & Network";
  }
  if (product.category.startsWith("hardware")) {
    return "Hardware & Provisioning";
  }
  if (product.category === "professional_services" || product.category === "comanaged_onboarding") {
    return "Services & Onboarding";
  }
  return categoryLabels[product.category];
}

/** Lightweight static bundles from real SKUs (display-only; no invented discounts). */
export const storeBundles = [
  {
    id: "bundle-secure-basics",
    title: "Secure Basics",
    blurb: "Endpoint + email + identity starting point for co-managed teams.",
    skus: [
      "DE-SVC-CM-ENDPOINT-CORE-MO",
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-SVC-CM-IDENTITY-CORE-MO",
    ],
  },
  {
    id: "bundle-insurance-ready",
    title: "Insurance-Ready Starter",
    blurb: "Assessment, EDR, phishing, and IR documentation commonly requested by underwriters.",
    skus: [
      "DE-DIG-ASMT-CSRA-OT",
      "DE-SVC-CM-ENDPOINT-EDR-MO",
      "DE-DIG-ASMT-PHISH-MO",
      "DE-DIG-TPL-IR-RUNBOOK-OT",
    ],
  },
  {
    id: "bundle-secure-m365",
    title: "Secure Microsoft 365",
    blurb: "Identity, email, SaaS governance, and awareness for M365 tenants.",
    skus: [
      "DE-SVC-CM-IDENTITY-CORE-MO",
      "DE-SVC-CM-EMAIL-SEC-MO",
      "DE-SVC-CM-SAAS-MGMT-MO",
      "DE-DIG-TRN-AWARE-BASIC-YR",
    ],
  },
] as const;

/**
 * Consultative store entry — 3 slides, not a long wizard.
 * Buyer type classifies Solutions (prospects) vs Client Marketplace (existing / in-house IT).
 * Objective maps to the locked Protect · Recover · Communicate · Operate · Compliance taxonomy.
 */
export type StoreBuyerType = "prospect" | "existing_client" | "in_house_it";
export type GuidedObjectiveId = StoreOutcomeId | "specific";
export type StoreCatalogFamily = "solutions" | "marketplace";

export type GuidedBuyingAnswers = {
  buyerType: StoreBuyerType;
  objective: GuidedObjectiveId;
  companySize: "1-10" | "11-49" | "50-199" | "200+";
  locations: "1" | "2-5" | "6+";
  workEmail: string;
};

export type GuidedRecommendation = {
  headline: string;
  summary: string;
  catalogFamily: StoreCatalogFamily;
  familyLabel: string;
  outcomeId: StoreOutcomeId | null;
  proactiveTier: StoreProduct | null;
  csra: StoreProduct | null;
  products: StoreProduct[];
  recommendedSkus: string[];
  seatHint: number;
  recurringEstimate: number;
  oneTimeEstimate: number;
  workEmail: string;
};

export const GUIDED_BUYER_OPTIONS: {
  value: StoreBuyerType;
  label: string;
  blurb: string;
}[] = [
  {
    value: "prospect",
    label: "New to DE",
    blurb: "Looking for managed IT or a first security read — Solutions, not a hardware wall.",
  },
  {
    value: "existing_client",
    label: "Existing DE client",
    blurb: "Add tools from the Client Marketplace without replacing your current stack.",
  },
  {
    value: "in_house_it",
    label: "In-house IT",
    blurb: "Keep your team; we extend helpdesk, security, and co-managed coverage.",
  },
];

export const GUIDED_OBJECTIVE_OPTIONS: {
  value: GuidedObjectiveId;
  label: string;
  blurb: string;
}[] = [
  { value: "protect", label: "Protect the business", blurb: "Endpoint, email, and identity defenses" },
  { value: "operate", label: "Stabilize day-to-day IT", blurb: "Helpdesk, network, and operating coverage" },
  { value: "communicate", label: "Modernize calling & M365", blurb: "Phones, meetings, and cloud identity" },
  { value: "recover", label: "Backup & recover", blurb: "Continuity and incident-ready documentation" },
  { value: "compliance", label: "Insurance / audit readiness", blurb: "CSRA, policies, and evidence — not a cert badge" },
  { value: "specific", label: "Buy a specific product", blurb: "You already know the SKU or category" },
];

export const GUIDED_SIZE_OPTIONS: { value: GuidedBuyingAnswers["companySize"]; label: string }[] = [
  { value: "1-10", label: "1–10 people" },
  { value: "11-49", label: "11–49 people" },
  { value: "50-199", label: "50–199 people" },
  { value: "200+", label: "200+ people" },
];

export const GUIDED_LOCATION_OPTIONS: { value: GuidedBuyingAnswers["locations"]; label: string }[] = [
  { value: "1", label: "Single site" },
  { value: "2-5", label: "2–5 sites" },
  { value: "6+", label: "6+ sites" },
];

export const DEFAULT_GUIDED_ANSWERS: GuidedBuyingAnswers = {
  buyerType: "prospect",
  objective: "protect",
  companySize: "11-49",
  locations: "1",
  workEmail: "",
};

/** Soft cap so the default path stays consultative, not the SKU wall. */
export const GUIDED_ADDON_LIMIT = 5;

export function catalogFamilyForBuyer(buyer: StoreBuyerType): StoreCatalogFamily {
  return buyer === "prospect" ? "solutions" : "marketplace";
}

export function catalogFamilyLabel(family: StoreCatalogFamily): string {
  return family === "solutions" ? "Solutions" : "Client Marketplace";
}

export function guidedOutcomeFromObjective(objective: GuidedObjectiveId): StoreOutcomeId | null {
  return objective === "specific" ? null : objective;
}

export function recommendProactiveSku(size: GuidedBuyingAnswers["companySize"]): string {
  switch (size) {
    case "1-10":
      return "DE-SVC-MGD-IT-MO";
    case "11-49":
      return "DE-SVC-MGD-OFFICE-MO";
    case "50-199":
      return "DE-SVC-MGD-BUSINESS-MO";
    default:
      return "DE-SVC-MGD-ENTERPRISE-MO";
  }
}

function sizeToSeats(size: GuidedBuyingAnswers["companySize"]): number {
  switch (size) {
    case "1-10":
      return 8;
    case "11-49":
      return 24;
    case "50-199":
      return 75;
    default:
      return 150;
  }
}

function resolveCanonicalProduct(sku: string): StoreProduct | undefined {
  return getStoreProductBySku(sku) || getProductBySku(sku);
}

function addonSkusForGuidance(answers: GuidedBuyingAnswers): string[] {
  const family = catalogFamilyForBuyer(answers.buyerType);
  const skus: string[] = [];

  if (answers.objective === "specific") {
    return family === "marketplace"
      ? ["DE-SVC-CM-ENDPOINT-CORE-MO", "DE-SVC-CM-HELPDESK-ASSIST-MO", "DE-SVC-CM-EMAIL-SEC-MO"]
      : ["DE-DIG-ASMT-QUICK-OT", "DE-SVC-CM-ENDPOINT-CORE-MO", "DE-SVC-UC-SEAT-STD-MO"];
  }

  if (family === "solutions") {
    if (answers.objective === "protect") {
      skus.push("DE-SVC-CM-ENDPOINT-EDR-MO", "DE-SVC-CM-EMAIL-SEC-MO", "DE-DIG-ASMT-PHISH-MO");
    } else if (answers.objective === "operate") {
      skus.push(
        "DE-SVC-CM-ENDPOINT-CORE-MO",
        "DE-SVC-CM-HELPDESK-ASSIST-MO",
        "DE-SVC-NET-MANAGED-CORE-MO",
      );
    } else if (answers.objective === "communicate") {
      skus.push("DE-SVC-UC-SEAT-STD-MO", "DE-SVC-CM-IDENTITY-CORE-MO", "DE-SVC-CM-SAAS-MGMT-MO");
    } else if (answers.objective === "recover") {
      skus.push("DE-DIG-TPL-BCP-OT", "DE-DIG-TPL-IR-RUNBOOK-OT", "DE-SVC-MGD-BCDR-MO");
    } else if (answers.objective === "compliance") {
      skus.push("DE-DIG-TPL-POLICY-CORE-OT", "DE-DIG-TRN-AWARE-BASIC-YR", "DE-DIG-TPL-IR-RUNBOOK-OT");
    }
  } else {
    if (answers.objective === "protect") {
      skus.push("DE-SVC-CM-ENDPOINT-EDR-MO", "DE-SVC-CM-EMAIL-SEC-MO", "DE-SVC-CM-IDENTITY-CORE-MO");
    } else if (answers.objective === "operate") {
      skus.push("DE-SVC-CM-HELPDESK-ASSIST-MO", "DE-SVC-CM-SERVER-MON-MO", "DE-SVC-CM-ENDPOINT-CORE-MO");
    } else if (answers.objective === "communicate") {
      skus.push("DE-SVC-UC-SEAT-STD-MO", "DE-SVC-UC-AUTOATT-MO");
    } else if (answers.objective === "recover") {
      skus.push("DE-DIG-TPL-IR-RUNBOOK-OT", "DE-DIG-TPL-BCP-OT");
    } else if (answers.objective === "compliance") {
      skus.push("DE-DIG-TPL-POLICY-CORE-OT", "DE-DIG-TRN-AWARE-BASIC-YR");
    }
    if (answers.buyerType === "in_house_it" && !skus.includes("DE-SVC-CM-HELPDESK-ASSIST-MO")) {
      skus.push("DE-SVC-CM-HELPDESK-ASSIST-MO");
    }
  }

  if (answers.locations !== "1") {
    skus.push("DE-SVC-NET-MANAGED-MSITE-MO");
  }

  return skus;
}

function shouldIncludeCsra(answers: GuidedBuyingAnswers): boolean {
  if (answers.objective === "specific") return false;
  if (answers.buyerType === "prospect") return true;
  return answers.objective === "protect" || answers.objective === "compliance";
}

function estimateLine(product: StoreProduct, seats: number): { recurring: number; oneTime: number } {
  // A one-time fee priced per unit (provisioning per device or phone) scales with the count like a seat price.
  const perUnitOneTime = product.pricingType === "one_time" && !!product.pricingUnit;
  const qty =
    perUnitOneTime ||
    product.pricingType === "per_endpoint" ||
    product.pricingType === "per_user" ||
    product.pricingType === "per_seat" ||
    product.pricingType === "per_device"
      ? seats
      : 1;
  if (product.pricingType === "one_time") {
    return { recurring: 0, oneTime: product.basePrice * qty };
  }
  if (product.pricingType === "per_hour") {
    return { recurring: 0, oneTime: 0 };
  }
  return { recurring: product.basePrice * qty, oneTime: 0 };
}

/**
 * Consultative recommendation from the live catalog.
 * Soft list-price estimates only — checkout still uses server-canonical SKUs/prices.
 * At most one ProActive tier. CSRA stays $2,500 and is never treated as a package credit.
 */
export function buildGuidedRecommendation(answers: GuidedBuyingAnswers): GuidedRecommendation {
  const seats = sizeToSeats(answers.companySize);
  const family = catalogFamilyForBuyer(answers.buyerType);
  const outcomeId = guidedOutcomeFromObjective(answers.objective);

  const proactive =
    family === "solutions" ? resolveCanonicalProduct(recommendProactiveSku(answers.companySize)) ?? null : null;

  const csraRaw = shouldIncludeCsra(answers) ? resolveCanonicalProduct(CANONICAL_CSRA_STORE_SKU) : undefined;
  const csra =
    csraRaw && csraRaw.basePrice === CANONICAL_CSRA_ONE_TIME && csraRaw.sku === CANONICAL_CSRA_STORE_SKU
      ? csraRaw
      : null;

  const addonProducts = Array.from(new Set(addonSkusForGuidance(answers)))
    .map((sku) => resolveCanonicalProduct(sku))
    .filter((p): p is StoreProduct => !!p && p.isCheckoutEnabled && !p.isContractOnly)
    .filter((p) => p.sku !== CANONICAL_CSRA_STORE_SKU)
    .slice(0, GUIDED_ADDON_LIMIT);

  const products = csra && csra.isCheckoutEnabled && !csra.isContractOnly
    ? [csra, ...addonProducts]
    : addonProducts;

  const recommendedSkus = [
    ...(proactive ? [proactive.sku] : []),
    ...products.map((p) => p.sku),
  ];

  let recurringEstimate = 0;
  let oneTimeEstimate = 0;
  for (const product of products) {
    const line = estimateLine(product, seats);
    recurringEstimate += line.recurring;
    oneTimeEstimate += line.oneTime;
  }

  const sizeLabel =
    answers.companySize === "1-10"
      ? "small team"
      : answers.companySize === "11-49"
        ? `${seats}-person firm`
        : answers.companySize === "50-199"
          ? "mid-size organization"
          : "larger organization";

  const familyLabel = catalogFamilyLabel(family);
  const headline =
    answers.objective === "specific"
      ? `A short ${familyLabel} shortlist — not the full catalog`
      : `Recommended ${familyLabel} for your ${sizeLabel}`;

  const summary =
    family === "solutions"
      ? `One ProActive tier (consultative — packages are mutually exclusive), the $2,500 Cybersecurity Risk Assessment when relevant, and a few related add-ons. List rates × ~${seats} seats where unit-priced; checkout uses canonical SKUs and prices.`
      : `Client Marketplace picks for ${
          answers.buyerType === "in_house_it" ? "an in-house IT team" : "an existing DE client"
        }. We are not stacking a second ProActive package. Estimates are list rates; checkout still confirms server prices.`;

  return {
    headline,
    summary,
    catalogFamily: family,
    familyLabel,
    outcomeId,
    proactiveTier: proactive,
    csra,
    products,
    recommendedSkus,
    seatHint: seats,
    recurringEstimate: Math.round(recurringEstimate),
    oneTimeEstimate: Math.round(oneTimeEstimate),
    workEmail: answers.workEmail.trim().toLowerCase(),
  };
}

export function filterProductsForGuidance(
  products: StoreProduct[],
  recommendation: GuidedRecommendation | null,
  opts: { fullCatalog: boolean },
): StoreProduct[] {
  if (opts.fullCatalog || !recommendation) return products;
  const allowed = new Set(recommendation.recommendedSkus);
  return products.filter((product) => allowed.has(product.sku));
}
