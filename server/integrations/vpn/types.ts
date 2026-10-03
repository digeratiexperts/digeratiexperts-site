/**
 * Normalized VPN data the portal's VPN Access page renders in live mode
 * (GET /api/portal/vpn). Vendor field names stay inside each adapter.
 */

export type VpnProviderId = "tailscale" | "twingate" | "perimeter81" | "manual";

/**
 * A device's state as far as the provider reports it.
 *   online   connected right now (Tailscale `connectedToControl`)
 *   offline  not connected right now
 *   pending  joined but waiting for an admin to approve it (Tailscale `authorized: false`)
 *   active   allowed to connect; the provider does not report live connection state
 *            (Twingate `activeState: ACTIVE`, a staff-entered profile marked active)
 *   blocked  refused by the provider or disabled by DE staff
 *   unknown  anything else
 */
export type VpnDeviceStatus = "online" | "offline" | "pending" | "active" | "blocked" | "unknown";

export type VpnDevice = {
  /** Vendor device id, or the manual record id for the "manual" provider. */
  id: string;
  name: string;
  /** Operating system or device type as the provider names it, e.g. "windows", "macOS". */
  os: string | null;
  status: VpnDeviceStatus;
  /**
   * ISO time the device was last seen / last signed in. Null when the provider
   * does not say (Tailscale leaves it empty while a device is connected).
   */
  lastSeen: string | null;
  /** The person the device belongs to (email or name). */
  user: string | null;
  /** "manual" only: "wireguard" | "openvpn". */
  protocol?: string | null;
  /** "manual" only: staff note. */
  notes?: string | null;
};

export type VpnData = {
  provider: VpnProviderId;
  /** Display name, e.g. "Tailscale". */
  providerName: string;
  service: {
    /**
     * reachable      DE's vendor account answered just now for this company's scope
     * staff_managed  "manual": DE staff maintain the list; nothing is polled
     */
    status: "reachable" | "staff_managed";
    /** ISO time the data was read. */
    checkedAt: string;
  };
  /** True when `online` / `offline` come live from the vendor. */
  reportsLiveStatus: boolean;
  devices: VpnDevice[];
};

/** The adapter's answer for one company. */
export type VpnLoadResult = { notMapped: true } | { data: VpnData };
