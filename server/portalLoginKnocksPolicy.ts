/** Public beacons are low-value telemetry, separate from authentication audit. */
export const PAGE_HIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function boundedKnockText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || null;
}

export function normalizeKnockPath(value: unknown): string {
  const path = boundedKnockText(value, 2048);
  if (!path?.startsWith("/") || path.startsWith("//")) return "/portal/login";
  // Never store OAuth codes, email addresses or other query/fragment data.
  return path.split(/[?#]/, 1)[0].slice(0, 256) || "/portal/login";
}

export function normalizeKnockMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 20)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || /password|secret|token|cookie|authorization/i.test(key)) continue;
    if (typeof entry === "boolean" || (typeof entry === "number" && Number.isFinite(entry))) out[key] = entry;
    else if (typeof entry === "string") out[key] = boundedKnockText(entry, 256);
  }
  return JSON.stringify(out).length <= 2048 ? out : { truncated: true };
}
