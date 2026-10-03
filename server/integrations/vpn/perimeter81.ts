import { VpnProviderUnavailableError } from "./errors";

/**
 * Perimeter 81 / Check Point Harmony SASE (PORTAL_VPN_PROVIDER=perimeter81).
 *
 * NOT BUILT. Harmony SASE's public API (gateway https://api.perimeter81.com/api/rest,
 * reference https://support.perimeter81.com/apidocs) documents Users (members),
 * Groups, Addons and Networks. Its getting-started page lists Devices as a path
 * class that "will be released soon":
 *   https://support.perimeter81.com/docs/api-getting-started
 *   https://support.perimeter81.com/v1/docs/api-getting-started
 * The VPN page needs each company's devices with their connection state, which
 * no documented endpoint returns, so this adapter does not call the vendor. It
 * answers "not available" (the route logs this line and answers HTTP 502) until
 * Check Point documents a devices endpoint. See README.md.
 */
export const PERIMETER81_UNAVAILABLE_REASON =
  "perimeter81: Harmony SASE's public API documents no devices endpoint (Devices is listed as 'will be released soon'); no data source to read";

export async function loadPerimeter81VpnData(): Promise<never> {
  throw new VpnProviderUnavailableError(PERIMETER81_UNAVAILABLE_REASON);
}
