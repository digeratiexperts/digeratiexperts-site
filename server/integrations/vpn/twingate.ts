import { VENDOR_TIMEOUT_MS, VpnConfigError, VpnVendorError, type Env } from "./errors";
import type { VpnData, VpnDevice, VpnDeviceStatus } from "./types";

/**
 * Twingate (PORTAL_VPN_PROVIDER=twingate), Admin API (GraphQL).
 *
 * Docs:
 *   https://www.twingate.com/docs/api-overview   endpoint https://<network>.twingate.com/api/graphql/,
 *                                                header X-API-KEY, 60 reads / 20 writes per minute, 429 when exceeded
 *   https://www.twingate.com/docs/api            schema: Group.users, User.devices (DeviceConnection),
 *                                                Device.osName / activeState (ACTIVE | ARCHIVED | BLOCKED) /
 *                                                lastSuccessfulLoginAt; Device.lastConnectedAt is deprecated and empty
 *   https://www.twingate.com/docs/introduction-to-the-python-cli  Twingate's CLI, whose published queries
 *     (github.com/Twingate-Labs/Twingate-CLI src/tgcli/queries/{groups,devices}.py) use the same fields
 *   https://github.com/Twingate/terraform-provider-twingate  (Twingate's provider: group(id) { users(after, first) },
 *     pageInfo { endCursor hasNextPage }, header "X-Api-Key")
 *
 * Scope: a Twingate Group per client company. Groups are how Twingate grants
 * Resource access to Users ("Groups are how users are authorized to access
 * Resources", docs.twingate.com/docs/groups), so DE already needs one per
 * company. The map value is the group id; the page shows the devices of that
 * group's users, nothing else. Archived devices are left out.
 *
 * Env:
 *   PORTAL_VPN_TWINGATE_NETWORK   the network subdomain ("acme" for acme.twingate.com)
 *   PORTAL_VPN_TWINGATE_API_KEY   Admin API token (Admin Console: Settings > API > Generate Token)
 */

const MAX_USER_PAGES = 10; // keeps one page view well under the 60 reads/min limit
const NETWORK_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const GROUP_ID_PATTERN = /^[A-Za-z0-9+/=_-]{1,128}$/;

export const TWINGATE_GROUP_DEVICES_QUERY = `
query PortalVpnGroupDevices($groupId: ID!, $after: String) {
  group(id: $groupId) {
    id
    name
    users(after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          email
          firstName
          lastName
          devices {
            pageInfo { hasNextPage }
            edges {
              node { id name osName deviceType activeState lastSuccessfulLoginAt }
            }
          }
        }
      }
    }
  }
}`;

type TwingateDevice = {
  id?: string;
  name?: string | null;
  osName?: string | null;
  deviceType?: string | null;
  activeState?: string | null;
  lastSuccessfulLoginAt?: string | null;
};

type TwingateUser = {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  devices?: { pageInfo?: { hasNextPage?: boolean }; edges?: { node?: TwingateDevice | null }[] } | null;
};

export type TwingateGroupPage = {
  data?: {
    group?: {
      id?: string;
      name?: string;
      users?: {
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
        edges?: { node?: TwingateUser | null }[];
      } | null;
    } | null;
  } | null;
  errors?: unknown[];
};

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function statusOf(state: unknown): VpnDeviceStatus | null {
  if (state === "ACTIVE") return "active";
  if (state === "BLOCKED") return "blocked";
  if (state === "ARCHIVED") return null; // removed by an admin; not shown
  return "unknown";
}

function userLabel(u: TwingateUser): string | null {
  const name = [u.firstName, u.lastName].filter((p) => typeof p === "string" && p.trim()).join(" ").trim();
  return u.email || name || null;
}

/** Maps the users of one group page to devices. Returns whether any user's device list was cut short. */
export function mapTwingateGroupUsers(users: TwingateUser[]): { devices: VpnDevice[]; truncated: boolean } {
  const devices: VpnDevice[] = [];
  let truncated = false;
  for (const u of users) {
    if (!u) continue;
    if (u.devices?.pageInfo?.hasNextPage) truncated = true;
    for (const edge of u.devices?.edges ?? []) {
      const d = edge?.node;
      if (!d || !d.id) continue;
      const status = statusOf(d.activeState);
      if (!status) continue;
      devices.push({
        id: String(d.id),
        name: d.name || "Unnamed device",
        os: d.osName || d.deviceType || null,
        status,
        lastSeen: isoOrNull(d.lastSuccessfulLoginAt),
        user: userLabel(u),
      });
    }
  }
  return { devices, truncated };
}

export async function loadTwingateVpnData(opts: { groupId: string; env: Env; fetchImpl?: typeof fetch }): Promise<VpnData> {
  if (!GROUP_ID_PATTERN.test(opts.groupId)) {
    throw new VpnConfigError("client map value for twingate must be a Twingate group id");
  }
  const network = (opts.env.PORTAL_VPN_TWINGATE_NETWORK || "").trim();
  const apiKey = (opts.env.PORTAL_VPN_TWINGATE_API_KEY || "").trim();
  if (!network || !NETWORK_PATTERN.test(network)) throw new VpnConfigError("PORTAL_VPN_TWINGATE_NETWORK is not set or not a subdomain");
  if (!apiKey) throw new VpnConfigError("PORTAL_VPN_TWINGATE_API_KEY is not set");
  const fetchImpl = opts.fetchImpl ?? fetch;

  const devices: VpnDevice[] = [];
  let truncated = false;
  let after: string | null = null;
  for (let page = 0; page < MAX_USER_PAGES; page++) {
    // POST https://<network>.twingate.com/api/graphql/ with header X-API-KEY
    // https://www.twingate.com/docs/api-overview ; schema https://www.twingate.com/docs/api
    let res: Response;
    try {
      res = await fetchImpl(`https://${network}.twingate.com/api/graphql/`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify({ query: TWINGATE_GROUP_DEVICES_QUERY, variables: { groupId: opts.groupId, after } }),
        signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
      });
    } catch (err) {
      throw new VpnVendorError(`twingate graphql request failed (${err instanceof Error ? err.name : "error"})`);
    }
    if (!res.ok) throw new VpnVendorError(`twingate graphql HTTP ${res.status}`);
    const body = (await res.json().catch(() => null)) as TwingateGroupPage | null;
    if (!body) throw new VpnVendorError("twingate graphql response was not JSON");
    if (Array.isArray(body.errors) && body.errors.length) {
      throw new VpnVendorError(`twingate graphql returned ${body.errors.length} error(s)`);
    }
    const group = body.data?.group;
    // A group id that does not exist (or another network's id) answers null: fail closed.
    if (!group) throw new VpnConfigError("twingate group in the client map was not found");
    if (group.id && group.id !== opts.groupId) throw new VpnVendorError("twingate answered for a different group");
    const users = (group.users?.edges ?? []).map((e) => e?.node).filter(Boolean) as TwingateUser[];
    const mapped = mapTwingateGroupUsers(users);
    devices.push(...mapped.devices);
    truncated ||= mapped.truncated;
    const info = group.users?.pageInfo;
    if (!info?.hasNextPage || !info.endCursor) {
      after = null;
      break;
    }
    after = info.endCursor;
  }
  if (after) truncated = true;
  if (truncated) console.warn(`[portal-vpn] twingate: device list for group ${opts.groupId} was cut short by pagination limits`);

  return {
    provider: "twingate",
    providerName: "Twingate",
    service: { status: "reachable", checkedAt: new Date().toISOString() },
    reportsLiveStatus: false,
    devices: devices.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
