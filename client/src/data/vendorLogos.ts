/**
 * Vendor logo assets for store merchandising (brief point 9).
 * Files live at /images/vendors/<slug>.png — copied from DE-supplied assets.
 * Catalog has no vendor fields yet; map real SKUs / categories to known DE stack.
 */

export const VENDOR_LOGO_BASE = "/images/vendors";

/** Clean slug → display name for logos we shipped. */
/**
 * Published partner marks only. C7 quarantine (Evidence archive) holds
 * unpublished / unmapped logos — do not re-add without a partner ruling.
 */
export const vendorLogoCatalog: Record<string, string> = {
  "1password": "1Password",
  augmentt: "Augmentt",
  axcient: "Axcient",
  bitdefender: "Bitdefender",
  blackpoint: "Blackpoint",
  bvoip: "bvoip",
  cis: "CIS",
  coro: "Coro",
  "cove-data-protection": "Cove Data Protection",
  cytracom: "Cytracom",
  "d-h-distributing": "D&H Distributing",
  hudu: "Hudu",
  huntress: "Huntress",
  jumpcloud: "JumpCloud",
  kaseya: "Kaseya",
  keeper: "Keeper",
  lenovo: "Lenovo",
  mimecast: "Mimecast",
  nerdio: "Nerdio",
  ninjaone: "NinjaOne",
  ninjio: "NINJIO",
  opti9: "Opti9",
  proofpoint: "Proofpoint",
  qualys: "Qualys",
  seedpodcyber: "Seedpod Cyber",
  sonicwall: "SonicWall",
  sophos: "Sophos",
  "td-synnex": "TD Synnex",
  telivy: "Telivy",
  threatlocker: "ThreatLocker",
  todyl: "Todyl",
  "uplevel-systems": "Uplevel Systems",
  wazuh: "Wazuh",
  zoho: "Zoho",
};

/** SKU → vendor slug (DE architecture stack, not invented products). */
export const skuVendorMap: Record<string, string> = {
  // Managed packages — stack vendors as merchandising identity
  "DE-SVC-MGD-OFFICE-MO": "ninjaone",
  "DE-SVC-MGD-BUSINESS-MO": "blackpoint",
  "DE-SVC-MGD-ENTERPRISE-MO": "blackpoint",
  "DE-SVC-MGD-WORKPLACE-MO": "ninjaone",
  "DE-SVC-MGD-CYBER-MO": "blackpoint",
  "DE-SVC-MGD-BCDR-MO": "opti9",
  "DE-SVC-COMANAGED-CUSTOM-MO": "ninjaone",
  // Co-managed
  "DE-SVC-CM-ENDPOINT-CORE-MO": "coro",
  "DE-SVC-CM-ENDPOINT-EDR-MO": "coro",
  "DE-SVC-CM-EMAIL-SEC-MO": "mimecast",
  "DE-SVC-CM-IDENTITY-CORE-MO": "jumpcloud",
  "DE-SVC-CM-SAAS-MGMT-MO": "augmentt",
  "DE-SVC-CM-HELPDESK-ASSIST-MO": "ninjaone",
  "DE-SVC-CM-SERVER-MON-MO": "ninjaone",
  "DE-SVC-CM-ONBOARD-S-OT": "hudu",
  "DE-SVC-CM-ONBOARD-M-OT": "hudu",
  "DE-SVC-CM-ONBOARD-L-OT": "hudu",
  "DE-SVC-CM-DOC-PACK-OT": "hudu",
  // Network / SASE
  "DE-SVC-NET-MANAGED-CORE-MO": "todyl",
  "DE-SVC-NET-MANAGED-ADV-MO": "todyl",
  "DE-SVC-NET-MANAGED-MSITE-MO": "todyl",
  "DE-SVC-NET-ENG-HR": "sonicwall",
  "DE-SVC-NET-ONSITE-HR": "sonicwall",
  "DE-SVC-NET-CUTOVER-OT": "todyl",
  // UCaaS
  "DE-SVC-UC-SEAT-STD-MO": "cytracom",
  "DE-SVC-UC-SEAT-PRO-MO": "cytracom",
  "DE-SVC-UC-AUTOATT-MO": "cytracom",
  "DE-SVC-UC-SMS-MO": "cytracom",
  "DE-SVC-UC-ONBOARD-S-OT": "cytracom",
  "DE-SVC-UC-ONBOARD-M-OT": "cytracom",
  "DE-SVC-UC-ONBOARD-L-OT": "cytracom",
  "DE-SVC-UC-PORT-OT": "cytracom",
  "DE-SVC-UC-CALLFLOW-OT": "cytracom",
  // Hardware
  "DE-HW-PROV-ENDPOINT-OT": "lenovo",
  "DE-HW-PROV-NET-OT": "sonicwall",
  "DE-HW-PROV-VOIP-OT": "cytracom",
  "DE-HW-NET-FW-SMB-OT": "sonicwall",
  "DE-HW-NET-SW-24-OT": "sonicwall",
  "DE-HW-NET-AP-BIZ-OT": "sonicwall",
  "DE-HW-ENDPOINT-PC-BASE-OT": "lenovo",
  "DE-HW-ENDPOINT-LT-BASE-OT": "lenovo",
  "DE-HW-UC-PHONE-STD-OT": "cytracom",
  "DE-HW-UC-PHONE-EXEC-OT": "cytracom",
  "DE-HW-SHIP-HANDLE-OT": "d-h-distributing",
  // Digital / awareness / assessments
  "DE-DIG-TRN-AWARE-BASIC-YR": "ninjio",
  "DE-DIG-TRN-AWARE-PRO-YR": "ninjio",
  "DE-DIG-TRN-ONBOARD-OT": "ninjio",
  "DE-DIG-ASMT-PHISH-MO": "ninjio",
  "DE-DIG-ASMT-CSRA-OT": "telivy",
  "DE-DIG-ASMT-QUICK-OT": "seedpodcyber",
  "DE-DIG-ASMT-DMARC-OT": "mimecast",
  "DE-DIG-TPL-POLICY-CORE-OT": "cis",
  "DE-DIG-TPL-POLICY-ADV-OT": "cis",
  "DE-DIG-TPL-IR-RUNBOOK-OT": "blackpoint",
  "DE-DIG-TPL-BCP-OT": "opti9",
  // Professional
  "DE-SVC-CONSULT-VCIO-HR": "zoho",
};

/** Soft category defaults when a SKU is unmapped (still real DE stack vendors). */
export const categoryVendorFallback: Partial<Record<string, string>> = {
  contract_services: "ninjaone",
  comanaged_subscriptions: "coro",
  comanaged_onboarding: "hudu",
  networking_managed: "todyl",
  networking_projects: "sonicwall",
  ucaas_subscriptions: "cytracom",
  ucaas_setup: "cytracom",
  hardware_provisioning: "lenovo",
  hardware_physical: "lenovo",
  hardware_handling: "d-h-distributing",
  digital_assessments: "seedpodcyber",
  digital_templates: "cis",
  digital_training: "ninjio",
  professional_services: "zoho",
};

export function vendorLogoUrl(slug: string): string {
  return `${VENDOR_LOGO_BASE}/${slug}.png`;
}

export function resolveVendorSlug(
  sku: string,
  category?: string
): string | null {
  const mapped = skuVendorMap[sku];
  if (mapped && vendorLogoCatalog[mapped]) return mapped;
  if (category) {
    const fallback = categoryVendorFallback[category];
    if (fallback && vendorLogoCatalog[fallback]) return fallback;
  }
  return null;
}

export function getVendorForSku(
  sku: string,
  category?: string
): { slug: string; name: string; logoUrl: string } | null {
  const slug = resolveVendorSlug(sku, category);
  if (!slug || !vendorLogoCatalog[slug]) return null;
  return { slug, name: vendorLogoCatalog[slug], logoUrl: vendorLogoUrl(slug) };
}

/** Heuristic fallback from product name/description when SKU unmapped. */
export function inferVendorFromText(text: string): { slug: string; name: string; logoUrl: string } | null {
  const hay = text.toLowerCase();
  const hints: [string, string][] = [
    ["jumpcloud", "jumpcloud"],
    ["mimecast", "mimecast"],
    ["coro", "coro"],
    ["blackpoint", "blackpoint"],
    ["huntress", "huntress"],
    ["sophos", "sophos"],
    ["proofpoint", "proofpoint"],
    ["threatlocker", "threatlocker"],
    ["sonicwall", "sonicwall"],
    ["ninjaone", "ninjaone"],
    ["keeper", "keeper"],
    ["1password", "1password"],
    ["opti9", "opti9"],
    ["axcient", "axcient"],
    ["cove", "cove-data-protection"],
    ["todyl", "todyl"],
    ["cytracom", "cytracom"],
    ["bvoip", "bvoip"],
    ["nerdio", "nerdio"],
    ["wazuh", "wazuh"],
    ["zoho", "zoho"],
    ["qualys", "qualys"],
    ["bitdefender", "bitdefender"],
  ];
  for (const [needle, slug] of hints) {
    if (hay.includes(needle) && vendorLogoCatalog[slug]) {
      return { slug, name: vendorLogoCatalog[slug], logoUrl: vendorLogoUrl(slug) };
    }
  }
  return null;
}
