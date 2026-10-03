import { VpnProviderUnavailableError, type Env } from "./errors";
import type { VpnLoadResult } from "./types";

/**
 * Timus Networks (PORTAL_VPN_PROVIDER=timus). DE's chosen VPN / ZTNA vendor
 * (VENDOR_SETUP_STATUS.md, "Portal tools waiting on vendors").
 *
 * NOT BUILT YET: no published endpoint reference. What Timus publishes
 * (researched 2026-10-03, see README.md "timus" for the full list):
 *   - Timus Manager has an "API Access" screen (Settings > Configurations >
 *     API Access) that issues a Client ID + Client Secret per "Application
 *     Type"; the documented use is the Active Directory Directory Connector:
 *     https://support.timusnetworks.com/hc/en-us/articles/42998633001235-API-Access
 *     https://support.timusnetworks.com/hc/en-us/articles/31713918653459-Active-Directory-Integration
 *   - A partner community thread asks Timus for API access to users, teams,
 *     device details and site statistics (status "Answered"):
 *     https://support.timusnetworks.com/hc/en-us/community/posts/40152281306387-API-enhancements
 *   - No public API reference, base URL, endpoint list, OpenAPI file, Postman
 *     collection, SDK or Terraform provider was found. Timus's npm scope
 *     (@timus-networks/*) holds UI components only.
 * The VPN page needs each customer's devices with their connection state, and
 * none of that is documented, so this adapter makes no vendor call. It answers
 * "not available" (the route logs this line and answers the generic HTTP 502)
 * until Timus sends API docs (docs/vendor-requests/TIMUS-API-REQUEST.md).
 *
 * Reserved, unused until this adapter is built (deliberately not read here):
 *   PORTAL_VPN_TIMUS_API_KEY    credential, shape per Timus's answer
 *   PORTAL_VPN_TIMUS_BASE_URL   API base URL, per Timus's answer
 *   PORTAL_VPN_CLIENT_MAP       portal clientId -> Timus customer / tenant id
 * When docs arrive only this file changes (plus its tests and fixtures):
 * `const tenant = opts.scope(); if (!tenant) return { notMapped: true };`
 * then read the env, call the documented devices endpoint for that tenant
 * only, and map to VpnDevice. index.ts already passes clientId, env, fetchImpl
 * and the PORTAL_VPN_CLIENT_MAP lookup.
 */
export const TIMUS_UNAVAILABLE_REASON = "Timus API not documented yet";

export async function loadTimusVpnData(_opts: {
  clientId: string;
  env: Env;
  fetchImpl?: typeof fetch;
  /** The company's PORTAL_VPN_CLIENT_MAP value (Timus tenant id), or null. Not called yet. */
  scope: () => string | null;
}): Promise<VpnLoadResult> {
  throw new VpnProviderUnavailableError(TIMUS_UNAVAILABLE_REASON);
}
