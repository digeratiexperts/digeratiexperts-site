/**
 * Site-side sales allow/deny list. Enforcement is off and the list is empty
 * until Joseph turns the flag on and supplies the regions.
 */
import {
  normalizeUsRegion,
  type PostalAddress,
  type StateListMode,
} from "./deStoreContract";
import { blockedStateMessage } from "./deStoreLegalCopy";

export interface StateListConfig {
  enabled: boolean;
  mode: StateListMode;
  regions: string[];
}

export type AddressField = "billTo" | "shipTo" | "serviceAddress";

export interface StateBlockResult {
  blocked: boolean;
  regions: string[];
  fields: AddressField[];
  message?: string;
}

const ADDRESS_FIELDS: AddressField[] = ["billTo", "shipTo", "serviceAddress"];

export function parseRegionList(raw: string | null | undefined): { ok: true; regions: string[] } | { ok: false; error: string } {
  const tokens = (raw ?? "")
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const regions: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const code = normalizeUsRegion(token);
    if (!code) {
      return { ok: false, error: `Invalid US state or territory code: ${token}` };
    }
    if (!seen.has(code)) {
      seen.add(code);
      regions.push(code);
    }
  }
  return { ok: true, regions };
}

export function parseStateListMode(raw: string | null | undefined): StateListMode {
  return (raw ?? "").trim().toLowerCase() === "allow" ? "allow" : "deny";
}

function regionOf(address: PostalAddress | null | undefined): string | null {
  if (!address) return null;
  if ((address.country || "US").trim().toUpperCase() !== "US") return null;
  return normalizeUsRegion(address.region);
}

export function evaluateSiteStateList(
  addresses: { billTo: PostalAddress; shipTo: PostalAddress; serviceAddress?: PostalAddress | null },
  config: StateListConfig,
): StateBlockResult {
  if (!config.enabled) {
    return { blocked: false, regions: [], fields: [] };
  }

  const blockedRegions: string[] = [];
  const fields: AddressField[] = [];
  const listed = new Set(config.regions);

  for (const field of ADDRESS_FIELDS) {
    const address = addresses[field];
    if (!address) continue;
    const region = regionOf(address);
    if (!region) continue;
    const isListed = listed.has(region);
    const blocked = config.mode === "allow" ? !isListed : isListed;
    if (blocked) {
      fields.push(field);
      if (!blockedRegions.includes(region)) blockedRegions.push(region);
    }
  }

  if (!fields.length) {
    return { blocked: false, regions: [], fields: [] };
  }

  return {
    blocked: true,
    regions: blockedRegions,
    fields,
    message: blockedStateMessage(blockedRegions),
  };
}
