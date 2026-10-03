import { listManualRecords, type ManualRecord } from "../../portalManualRecords";
import type { VpnData, VpnDevice, VpnDeviceStatus } from "./types";

/**
 * "manual" (PORTAL_VPN_PROVIDER=manual): WireGuard / OpenVPN devices DE staff
 * enter for a company through the admin manual-records API
 * (server/portalManualRecords.ts, kind "vpn_device"). Records are stored per
 * portal company, so no client map is needed: a company reads its own rows.
 *
 * Record `data` fields (all strings, all optional except name):
 *   name      device or profile name, e.g. "Front desk laptop"
 *   os        OS / device type, e.g. "Windows 11", "iPhone"
 *   protocol  "wireguard" | "openvpn"
 *   status    "active" | "blocked" (profile issued and enabled, or disabled / revoked)
 *   lastSeen  ISO date or date-time the device last connected, as DE staff know it
 *   user      the person the device belongs to
 *   notes     staff note
 * Config files and keys are out of scope: never store a private key or a
 * config file here. Unknown fields in stored data are dropped when read.
 */

export const MANUAL_VPN_FIELDS = ["name", "os", "protocol", "status", "lastSeen", "user", "notes"] as const;
export const MANUAL_VPN_PROTOCOLS = ["wireguard", "openvpn"] as const;
export const MANUAL_VPN_STATUSES = ["active", "blocked"] as const;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function isoOrNull(v: unknown): string | null {
  const s = str(v, 40);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function mapManualVpnRecord(rec: Pick<ManualRecord, "id" | "data">): VpnDevice {
  const d = rec.data || {};
  const protocol = str(d.protocol, 20)?.toLowerCase() ?? null;
  const status = str(d.status, 20)?.toLowerCase() ?? null;
  return {
    id: rec.id,
    name: str(d.name, 120) || "Unnamed device",
    os: str(d.os, 60),
    status: ((MANUAL_VPN_STATUSES as readonly string[]).includes(status ?? "") ? status : "unknown") as VpnDeviceStatus,
    lastSeen: isoOrNull(d.lastSeen),
    user: str(d.user, 120),
    protocol: (MANUAL_VPN_PROTOCOLS as readonly string[]).includes(protocol ?? "") ? protocol : null,
    notes: str(d.notes, 500),
  };
}

export async function loadManualVpnData(clientId: string): Promise<VpnData> {
  const records = await listManualRecords(clientId, "vpn_device");
  return {
    provider: "manual",
    providerName: "DE-managed VPN",
    service: { status: "staff_managed", checkedAt: new Date().toISOString() },
    reportsLiveStatus: false,
    devices: records.filter((r) => r.clientId === clientId).map(mapManualVpnRecord),
  };
}
