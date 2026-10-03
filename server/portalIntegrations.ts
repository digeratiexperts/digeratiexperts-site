import type { Express, Request, RequestHandler, Response } from "express";

/**
 * Which data source backs the portal's VPN, phone and shipping pages.
 *
 * Joe, 2026-10-02/03: connect VPN Access, Cytracom Phone and Ship Center to
 * real data ("2. d"), sources still to be chosen, and "write all of them" so
 * the choice becomes configuration. Each page reads one environment variable:
 *
 *   PORTAL_VPN_PROVIDER       sample | hidden | tailscale | twingate | perimeter81 | manual
 *   PORTAL_PHONE_PROVIDER     sample | hidden | cytracom
 *   PORTAL_SHIPPING_PROVIDER  sample | hidden | shipstation | easypost | shippo | manual
 *
 * Unset or unknown means "sample": the page keeps today's sample content and
 * its "Sample data" notice, so nothing changes in production until a value is
 * set. "hidden" removes the page from the portal nav and shows a short
 * "not available" notice on its route. "manual" serves records DE staff enter
 * in the portal (WireGuard / OpenVPN devices, staff-entered tracking numbers).
 * Any other value names a vendor adapter; its credentials are read by that
 * adapter and never sent to the browser.
 */

export type IntegrationArea = "vpn" | "phone" | "shipping";
export type IntegrationMode = "sample" | "hidden" | "live";

export const INTEGRATION_PROVIDERS: Record<IntegrationArea, readonly string[]> = {
  vpn: ["tailscale", "twingate", "perimeter81", "manual"],
  phone: ["cytracom"],
  shipping: ["shipstation", "easypost", "shippo", "manual"],
};

const ENV_KEYS: Record<IntegrationArea, string> = {
  vpn: "PORTAL_VPN_PROVIDER",
  phone: "PORTAL_PHONE_PROVIDER",
  shipping: "PORTAL_SHIPPING_PROVIDER",
};

export type IntegrationStatus = {
  mode: IntegrationMode;
  /** The vendor adapter when mode is "live", else null. */
  provider: string | null;
};

export function readIntegrationStatus(
  area: IntegrationArea,
  env: Record<string, string | undefined> = process.env,
): IntegrationStatus {
  const raw = (env[ENV_KEYS[area]] || "").trim().toLowerCase();
  if (raw === "hidden" || raw === "off" || raw === "none") return { mode: "hidden", provider: null };
  if (INTEGRATION_PROVIDERS[area].includes(raw)) return { mode: "live", provider: raw };
  return { mode: "sample", provider: null };
}

export function readAllIntegrationStatus(env: Record<string, string | undefined> = process.env) {
  return {
    vpn: readIntegrationStatus("vpn", env),
    phone: readIntegrationStatus("phone", env),
    shipping: readIntegrationStatus("shipping", env),
  };
}

type Caller =
  | { role?: string | null; clientId?: string | null; impersonatingCompanyId?: string | null }
  | undefined;

/**
 * The client company a portal request is about: a DE admin viewing as a
 * company gets that company, everyone else their own. Null for an admin in
 * admin view (no company) and for users without a company.
 */
export function effectiveClientId(caller: Caller): string | null {
  if (!caller) return null;
  if (caller.role === "admin") {
    const viewing = typeof caller.impersonatingCompanyId === "string" ? caller.impersonatingCompanyId.trim() : "";
    if (viewing) return viewing;
  }
  const own = typeof caller.clientId === "string" ? caller.clientId.trim() : "";
  return own || null;
}

export const INTEGRATIONS_PATH = "/api/portal/integrations";

export function registerPortalIntegrationStatusRoute(app: Express, opts: { guards: RequestHandler[] }) {
  app.get(INTEGRATIONS_PATH, ...opts.guards, (_req: Request, res: Response) => {
    res.json({ success: true, integrations: readAllIntegrationStatus() });
  });
}
