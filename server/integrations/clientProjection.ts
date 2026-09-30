import { findLifecycleDisclosures, LIFECYCLE_DISCLOSURE_KEYS } from "./tenantIdentity";

/**
 * Client projection boundary.
 *
 * Hub payloads are stored for the portal and may be read back after a restart.
 * Copying the payload through would persist vendor, cost, margin, SKU, sourcing,
 * and Account Lifecycle Status. This allowlist is the serialization boundary:
 * unknown keys are dropped, and a second pass drops lifecycle values that rode
 * in on an otherwise allowed field such as status.
 */

const LIFECYCLE_KEYS = new Set<string>(LIFECYCLE_DISCLOSURE_KEYS);

const CLIENT_SCALAR_KEYS = new Set([
  "eventtype",
  "updatedat",
  "status",
  "title",
  "name",
  "summary",
  "description",
  "portalclientid",
  "quoteid",
  "ordernumber",
  "reference",
  "currency",
  "quantity",
  "amount",
  "publicprice",
  "displayprice",
  "effectivestart",
  "effectiveend",
  "startsat",
  "endsat",
  "dueat",
]);

const CLIENT_NESTED_KEYS = new Set(["items", "lines", "services"]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Internal commercial and lifecycle keys never cross onto a client or public surface. */
export function isInternalCommercialKey(key: string): boolean {
  const token = normalizeKey(key);
  if (!token) return true;
  if (LIFECYCLE_KEYS.has(token)) return true;
  if (token.includes("vendor") || token.includes("distributor") || token.includes("margin")) return true;
  if (token.includes("sourcing") || token.includes("cogs") || token.includes("supplier")) return true;
  if (token.endsWith("cost") || token.endsWith("sku")) return true;
  if (token === "wholesale" || token === "buyprice" || token === "sourcedocument") return true;
  return false;
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function isLifecycleValue(value: unknown): boolean {
  return typeof value === "string" && findLifecycleDisclosures(value).length > 0;
}

function pickClientFields(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (isInternalCommercialKey(key)) continue;
    const token = normalizeKey(key);
    if (CLIENT_NESTED_KEYS.has(token)) {
      const nested = sanitizeNested(value);
      if (nested !== undefined) out[key] = nested;
      continue;
    }
    if (!CLIENT_SCALAR_KEYS.has(token) || !isScalar(value) || isLifecycleValue(value)) continue;
    out[key] = value;
  }
  return out;
}

function sanitizeNested(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      return [pickClientFields(item as Record<string, unknown>)];
    });
  }
  if (value && typeof value === "object") return pickClientFields(value as Record<string, unknown>);
  return undefined;
}

/** Allowlist used when a Hub event is written to sync_projections and when that row is read. */
export function toClientProjection(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return pickClientFields(payload as Record<string, unknown>);
}

function stripValue(value: unknown, seen: WeakSet<object>): unknown {
  if (isLifecycleValue(value)) return undefined;
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const next = stripValue(item, seen);
      return next === undefined ? [] : [next];
    });
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isInternalCommercialKey(key)) continue;
    const next = stripValue(child, seen);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

/**
 * Public catalog keeps Hub's published shape, but internal commercial keys and
 * lifecycle values are removed on save and again on the public read.
 */
export function toPublicCatalog(snapshot: unknown): Record<string, unknown> {
  const stripped = stripValue(snapshot, new WeakSet());
  if (!stripped || typeof stripped !== "object" || Array.isArray(stripped)) return {};
  return stripped as Record<string, unknown>;
}
