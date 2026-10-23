/**
 * Pushing licences from the License Patch Bay into the vendor consoles:
 * Microsoft 365 (Graph assignLicense) and Google Workspace (Enterprise
 * License Manager). DE patches seats to people in the patch bay; this builds
 * the list of "give person X licence Y" calls, and nothing is sent until an
 * admin presses Send.
 *
 * Each pool licence carries the vendor's SKU code in its `sku` field:
 *   Microsoft: the subscription's skuPartNumber, e.g. "SPB" (Business Premium).
 *     At send time the client tenant's subscribedSkus turns it into a skuId,
 *     so a wrong or missing subscription fails safe with a reason.
 *   Google: "<productId>/<skuId>", e.g. "Google-Apps/1010020027".
 * VENDOR_SKU_DEFAULTS fills the well-known ones; anything else DE enters.
 */

export type PushVendor = "microsoft" | "google";
export type MicrosoftCloud = "commercial" | "gcc" | "gcc_high";

export const MICROSOFT_CLOUDS: Array<{ key: MicrosoftCloud; label: string }> = [
  { key: "commercial", label: "Commercial" },
  { key: "gcc", label: "GCC" },
  { key: "gcc_high", label: "GCC High" },
];

/** How a company is reached in each vendor console. */
export type VendorLink =
  | { vendor: "microsoft"; tenant: string; cloud: MicrosoftCloud }
  | { vendor: "google"; adminEmail: string };

/**
 * Default SKU codes by catalog key / starter key. Only codes DE is sure of;
 * the send checks Microsoft codes against the tenant before assigning.
 */
export const VENDOR_SKU_DEFAULTS: Record<string, string> = {
  "catalog:ms_m365_e5": "SPE_E5",
  "catalog:ms_m365_e3": "SPE_E3",
  "catalog:ms_o365_e1": "STANDARDPACK",
  "catalog:ms_m365_f3": "SPE_F1",
  "catalog:ms_m365_bp": "SPB",
  "catalog:ms_m365_bs": "O365_BUSINESS_PREMIUM",
  "catalog:ms_m365_bb": "O365_BUSINESS_ESSENTIALS",
  "catalog:ms_visio_p2": "VISIOCLIENT",
  "catalog:ms_project_p3": "PROJECTPROFESSIONAL",
  "catalog:ms_powerbi_pro": "POWER_BI_PRO",
  "catalog:ms_teams_phone": "MCOEV",
  "starter:entra-p1": "AAD_PREMIUM",
  "starter:intune-p1": "INTUNE_A",
  "catalog:gws_business_starter": "Google-Apps/1010020027",
  "catalog:gws_business_standard": "Google-Apps/1010020028",
  "catalog:gws_business_plus": "Google-Apps/1010020025",
  "catalog:gws_enterprise_standard": "Google-Apps/1010020026",
  "catalog:gws_enterprise_plus": "Google-Apps/1010020020",
};

export const MS_SKU_PART = /^[A-Za-z0-9_.-]{2,64}$/;
export const GOOGLE_SKU = /^[A-Za-z0-9-]{2,40}\/[A-Za-z0-9-]{2,40}$/;
export const MS_TENANT = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9-]+(\.[a-z0-9-]+)+)$/i;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Which console a pool licence belongs in, from its catalog key or vendor name. */
export function pushVendorOf(item: { vendor: string; catalogKey?: string | null }): PushVendor | null {
  const key = item.catalogKey || "";
  if (/^(ms|gcc|gcch)_/.test(key)) return "microsoft";
  if (key.startsWith("gws_")) return "google";
  const v = item.vendor.trim().toLowerCase();
  if (v === "microsoft") return "microsoft";
  if (v === "google") return "google";
  return null;
}

export function splitGoogleSku(sku: string): { productId: string; skuId: string } | null {
  if (!GOOGLE_SKU.test(sku)) return null;
  const [productId, skuId] = sku.split("/");
  return { productId, skuId };
}

export type PushPlanInput = {
  pool: Array<{ itemId: string; kind: "license" | "app"; vendor: string; product: string; catalogKey: string | null; sku: string | null }>;
  people: Array<{ id: string; name: string; email: string; licenses: Array<{ itemId: string }> }>;
  departments: Array<{ name: string; seats: Array<{ itemId: string; count: number }> }>;
};

export type PushStep = {
  vendor: PushVendor;
  itemId: string;
  product: string;
  sku: string | null;
  person: string;
  email: string;
  status: "ready" | "skip";
  reason?: string;
};

export type PushPlan = { steps: PushStep[]; parkedInDepartments: number };

/** Every person-held licence that belongs in a vendor console, ready or with the reason it can't go. */
export function planVendorPush(input: PushPlanInput, vendor: PushVendor, linked: boolean): PushPlan {
  const items = new Map(
    input.pool.filter((p) => p.kind === "license" && pushVendorOf(p) === vendor).map((p) => [p.itemId, p]),
  );
  const steps: PushStep[] = [];
  for (const person of input.people) {
    for (const held of person.licenses) {
      const item = items.get(held.itemId);
      if (!item) continue;
      const sku = item.sku?.trim() || null;
      let reason: string | undefined;
      if (!linked) reason = vendor === "microsoft" ? "Link the company's Microsoft tenant first" : "Link the company's Google admin first";
      else if (!sku) reason = vendor === "microsoft" ? "No Microsoft SKU part number on this licence" : "No Google product/SKU id on this licence";
      else if (vendor === "microsoft" && !MS_SKU_PART.test(sku)) reason = `"${sku}" is not a Microsoft SKU part number`;
      else if (vendor === "google" && !splitGoogleSku(sku)) reason = `"${sku}" is not a Google product/SKU id`;
      else if (!EMAIL.test(person.email)) reason = "This person has no email address";
      steps.push({
        vendor,
        itemId: item.itemId,
        product: item.product,
        sku,
        person: person.name,
        email: person.email,
        status: reason ? "skip" : "ready",
        reason,
      });
    }
  }
  const parkedInDepartments = input.departments.reduce(
    (n, d) => n + d.seats.filter((s) => items.has(s.itemId)).reduce((m, s) => m + s.count, 0),
    0,
  );
  return { steps, parkedInDepartments };
}
