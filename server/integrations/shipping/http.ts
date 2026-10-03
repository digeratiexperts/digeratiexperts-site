import { ShippingVendorError, VENDOR_TIMEOUT_MS } from "./types";

/**
 * GET a vendor JSON endpoint with a 10 s timeout. Any failure becomes a
 * ShippingVendorError whose message names the vendor and HTTP status only:
 * never the response body (it can echo request details) and never a header.
 */
export async function vendorGetJson(
  vendor: string,
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    throw new ShippingVendorError(`${vendor} request failed (${name})`);
  }
  if (!res.ok) {
    // Drain without reading the text into any message.
    await res.body?.cancel().catch(() => undefined);
    throw new ShippingVendorError(`${vendor} answered HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    throw new ShippingVendorError(`${vendor} answered with invalid JSON`);
  }
}

/** HTTP Basic credentials header value. */
export function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * A reference / metadata prefix that names one company. It must be at least
 * three characters and end with a delimiter (- : _ / #), so "ACME-" can never
 * match "ACMECORP-123". Anything else is a configuration fault.
 */
export function isSafeScopePrefix(prefix: string): boolean {
  return prefix.length >= 3 && prefix.length <= 64 && /[-:_/#]$/.test(prefix) && /^[^-:_/#]/.test(prefix);
}
