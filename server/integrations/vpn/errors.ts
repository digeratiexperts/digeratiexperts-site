/**
 * Faults the VPN route logs server-side and answers with a generic HTTP 502.
 * Messages may name env vars and HTTP statuses; they never carry credentials
 * or vendor response bodies, and they never reach the browser.
 */

/** Missing or malformed configuration (env vars, client map entry). */
export class VpnConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VpnConfigError";
  }
}

/** The vendor answered with an error, an unexpected shape, or not at all. */
export class VpnVendorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VpnVendorError";
  }
}

/** The provider has no documented API for what the page needs. */
export class VpnProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VpnProviderUnavailableError";
  }
}

export type Env = Record<string, string | undefined>;

export const VENDOR_TIMEOUT_MS = 10_000;
