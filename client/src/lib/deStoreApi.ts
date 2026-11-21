export const CSRF_REQUEST_HEADER = "x-csrf-token";

function csrfToken(): string {
  const fromCookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("x-csrf-token="));
  if (fromCookie) return decodeURIComponent(fromCookie.slice("x-csrf-token=".length));
  return "store-checkout";
}

export async function deStoreFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.method && init.method !== "GET") {
    headers.set(CSRF_REQUEST_HEADER, csrfToken());
    if (!headers.has("Content-Type") && typeof init.body === "string") {
      headers.set("Content-Type", "application/json");
    }
  }
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

export type DeStoreStatus = {
  enabled: boolean;
  consumerCheckout: boolean;
  previewCatalog: boolean;
  shippingPromise: string;
  day5DelayNotice: string;
  whereWeSellShort: string;
  whereWeSellAddressStep: string;
  stateList: { enabled: boolean; mode: "deny" | "allow"; regions: string[] };
  offerings: Array<{ id: "proactive_ecosystem" | "refurbished_kits" | "standalone_services"; label: string; summary: string }>;
};

export type DeStoreCatalogItem = {
  sku: string;
  offering: string;
  name: string;
  description: string;
  taxCategory: string;
  buyerRoles: Array<"managed" | "comanaged" | "self_managed">;
  isKit: boolean;
  isRouter: boolean;
  fccCoveredListCheckRequired: boolean;
  refurbishedGrade?: "A" | "B" | "C";
  termMonths?: number;
  previewOnly?: boolean;
};

export async function loadDeStoreStatus(): Promise<DeStoreStatus | null> {
  const res = await deStoreFetch("/api/store/v1/status");
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as DeStoreStatus;
}

export async function loadDeStoreCatalog(offering?: string): Promise<DeStoreCatalogItem[]> {
  const path = offering
    ? `/api/store/v1/catalog?offering=${encodeURIComponent(offering)}`
    : "/api/store/v1/catalog";
  const res = await deStoreFetch(path);
  if (!res.ok) return [];
  const body = (await res.json()) as { items?: DeStoreCatalogItem[] };
  return body.items ?? [];
}
