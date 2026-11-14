/**
 * Public store catalog shape. Published listings stay empty until Joseph
 * confirms prices and, for kits, the Wazuh collection row is filled in.
 * Preview listings are never returned unless the preview catalog flag is on,
 * and even then kit SKUs stay hidden while the Wazuh placeholder remains.
 */
import type { BuyerRole, DeviceClass, StoreOffering, TaxCategory } from "./deStoreContract";
import { PREINSTALLED_SOFTWARE_NOTICE, wazuhCollectionIsFilled } from "./deStoreLegalCopy";

export interface StoreCatalogSku {
  sku: string;
  offering: StoreOffering;
  name: string;
  description: string;
  taxCategory: TaxCategory;
  buyerRoles: BuyerRole[];
  published: boolean;
  previewOnly: boolean;
  isKit: boolean;
  isRouter: boolean;
  fccCoveredListCheckRequired: boolean;
  fccCoveredListCleared: boolean;
  refurbishedGrade?: "A" | "B" | "C";
  deviceClass?: DeviceClass;
  termMonths?: number;
  /** Present only for preview listings; omitted from the published catalog. */
  unitAmountCents?: number;
  components?: Array<{
    lineId: string;
    sku: string;
    description: string;
    taxCategory: TaxCategory;
    unitAmountCents: number;
    deviceClass?: DeviceClass;
    fccCoveredListCheckRequired?: boolean;
    fccCoveredListCleared?: boolean;
  }>;
}

export const KITS_PUBLISHABLE = wazuhCollectionIsFilled(PREINSTALLED_SOFTWARE_NOTICE);

const PREVIEW_SKUS: StoreCatalogSku[] = [
  {
    sku: "DE-STORE-PREVIEW-PROACTIVE",
    offering: "proactive_ecosystem",
    name: "ProActive Ecosystem (preview listing)",
    description:
      "Fully managed Digerati Experts offering. This preview listing is not for sale and has no published price.",
    taxCategory: "managed_service",
    buyerRoles: ["managed"],
    published: false,
    previewOnly: true,
    isKit: false,
    isRouter: false,
    fccCoveredListCheckRequired: false,
    fccCoveredListCleared: false,
    termMonths: 12,
  },
  {
    sku: "DE-STORE-PREVIEW-STANDALONE-DASH",
    offering: "standalone_services",
    name: "Standalone IT department services (preview listing)",
    description:
      "Standalone services and dashboards for IT departments. Available as managed, co-managed, or self-managed once published. This preview listing is not for sale and has no published price.",
    taxCategory: "saas",
    buyerRoles: ["managed", "comanaged", "self_managed"],
    published: false,
    previewOnly: true,
    isKit: false,
    isRouter: false,
    fccCoveredListCheckRequired: false,
    fccCoveredListCleared: false,
    termMonths: 1,
  },
  {
    sku: "DE-STORE-PREVIEW-KIT",
    offering: "refurbished_kits",
    name: "Refurbished IT and security kit (preview listing)",
    description:
      "Preview structure only. Kit listings stay hidden until the Wazuh collection row in the Preinstalled Software Notice is filled in.",
    taxCategory: "hardware",
    buyerRoles: ["managed", "comanaged", "self_managed"],
    published: false,
    previewOnly: true,
    isKit: true,
    isRouter: true,
    fccCoveredListCheckRequired: true,
    fccCoveredListCleared: false,
    refurbishedGrade: "B",
    deviceClass: "laptop",
    components: [
      {
        lineId: "kit-device",
        sku: "DE-STORE-PREVIEW-KIT-DEVICE",
        description: "Refurbished laptop (used)",
        taxCategory: "hardware",
        unitAmountCents: 0,
        deviceClass: "laptop",
      },
      {
        lineId: "kit-router",
        sku: "DE-STORE-PREVIEW-KIT-RTR",
        description: "Business router",
        taxCategory: "hardware",
        unitAmountCents: 0,
        deviceClass: "other",
        fccCoveredListCheckRequired: true,
        fccCoveredListCleared: false,
      },
    ],
  },
];

export function listStoreCatalog(options: { previewEnabled?: boolean } = {}): StoreCatalogSku[] {
  const published = PREVIEW_SKUS.filter((sku) => sku.published);
  if (!options.previewEnabled) return published;
  return PREVIEW_SKUS.filter((sku) => {
    if (sku.isKit && !KITS_PUBLISHABLE) return false;
    return sku.published || sku.previewOnly;
  });
}

export function findStoreCatalogSku(
  sku: string,
  options: { previewEnabled?: boolean } = {},
): StoreCatalogSku | undefined {
  return listStoreCatalog(options).find((item) => item.sku === sku);
}

export function offeringLabel(offering: StoreOffering): string {
  if (offering === "proactive_ecosystem") return "ProActive Ecosystem";
  if (offering === "refurbished_kits") return "Refurbished IT and security kits";
  return "Standalone services for IT departments";
}

export function offeringSummary(offering: StoreOffering): string {
  if (offering === "proactive_ecosystem") {
    return "The fully managed Digerati Experts offering. Agreements are accepted before the system is released or managed under that plan.";
  }
  if (offering === "refurbished_kits") {
    return "Refurbished, preconfigured IT and security kits, drop-shipped to the address you provide. Listings stay hidden until required sanitization and software disclosures are complete.";
  }
  return "Standalone services and dashboards for IT departments, sold as managed, co-managed, or self-managed. You do not need to be a fully managed client to buy these services once they are published.";
}
