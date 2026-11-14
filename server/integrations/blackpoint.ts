/**
 * Blackpoint Cyber (CompassOne) API helpers for MSP lifecycle.
 *
 * Env (do not invent — use what DE supplies):
 *   BLACKPOINT_API_KEY or BLACKPOINT_API_TOKEN
 *   BLACKPOINT_API_BASE (default https://api.blackpointcyber.com/v1)
 *   BLACKPOINT_INSTALLER_URL (optional partner/agent install link for onboard package)
 *
 * Note: Public Blackpoint partner APIs are mostly read/tenant-scoped. Onboard/offboard
 * here records lifecycle + returns installer guidance; suspend/remove of MDR coverage
 * often requires partner portal actions when write APIs are unavailable.
 */

const BP_BASE = (
  process.env.BLACKPOINT_API_BASE ||
  process.env.BLACKPOINT_BASE_URL ||
  "https://api.blackpointcyber.com/v1"
).replace(/\/$/, "");

function bpToken(): string {
  return (process.env.BLACKPOINT_API_KEY || process.env.BLACKPOINT_API_TOKEN || "").trim();
}

function bpHeaders(): Record<string, string> | null {
  const token = bpToken();
  if (!token) return null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function blackpointConfigured(): boolean {
  return !!bpHeaders();
}

export type BpTenant = {
  id?: string;
  uid?: string;
  name?: string;
  accountName?: string;
  [key: string]: unknown;
};

async function bpFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const headers = bpHeaders();
  if (!headers) return { ok: false, status: 0, error: "24/7 MDR add-on API key not configured" };
  try {
    const res = await fetch(`${BP_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || text.slice(0, 300) || res.statusText,
        data,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || "24/7 MDR add-on request failed" };
  }
}

/** Probe common partner/tenant list paths — Blackpoint surfaces vary by partner program. */
export async function blackpointTestConnection(): Promise<{
  success: boolean;
  message: string;
  endpoint?: string;
}> {
  if (!blackpointConfigured()) {
    return { success: false, message: "24/7 MDR add-on API key not configured" };
  }
  const candidates = ["/tenants", "/accounts", "/partners/me", "/me", "/organizations"];
  for (const path of candidates) {
    const r = await bpFetch(path);
    if (r.ok) {
      return { success: true, message: `24/7 MDR add-on API connected via ${path}`, endpoint: path };
    }
    // 401/403 = key present but wrong scope; still "configured"
    if (r.status === 401 || r.status === 403) {
      return {
        success: false,
        message: `24/7 MDR add-on auth rejected (${r.status}) on ${path}: ${r.error}`,
        endpoint: path,
      };
    }
  }
  return {
    success: false,
    message: "24/7 MDR add-on API key set but no known tenant endpoint responded OK - check partner API docs and base URL",
  };
}

export async function blackpointListTenants(): Promise<{
  success: boolean;
  tenants: BpTenant[];
  message: string;
}> {
  const paths = ["/tenants", "/accounts"];
  for (const path of paths) {
    const r = await bpFetch<any>(path);
    if (!r.ok) continue;
    const raw = r.data;
    const list: BpTenant[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.tenants)
          ? raw.tenants
          : Array.isArray(raw?.accounts)
            ? raw.accounts
            : [];
    return { success: true, tenants: list, message: `Listed ${list.length} via ${path}` };
  }
  return { success: false, tenants: [], message: "Could not list 24/7 MDR add-on tenants" };
}

export async function blackpointFindTenantByName(companyName: string): Promise<BpTenant | null> {
  const name = companyName.trim().toLowerCase();
  if (!name) return null;
  const listed = await blackpointListTenants();
  if (!listed.success) return null;
  return (
    listed.tenants.find((t) => {
      const n = String(t.name || t.accountName || "").toLowerCase();
      return n === name || n.includes(name) || name.includes(n);
    }) || null
  );
}

export async function blackpointOnboardPackage(input: {
  companyName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}): Promise<{
  success: boolean;
  message: string;
  tenant?: BpTenant | null;
  installerUrl?: string | null;
  checklist: string[];
}> {
  if (!blackpointConfigured()) {
    return {
      success: false,
      message: "24/7 MDR add-on API key not configured",
      checklist: [],
    };
  }
  const tenant = await blackpointFindTenantByName(input.companyName);
  const installerUrl = (process.env.BLACKPOINT_INSTALLER_URL || "").trim() || null;
  const checklist = [
    tenant
      ? `Matched MDR tenant: ${tenant.name || tenant.accountName || tenant.id || tenant.uid}`
      : `No tenant match for "" - create or map the tenant in the partner portal`,
    installerUrl
      ? "Agent installer URL available for device onboard"
      : "Set the 24/7 MDR add-on installer URL (or per-tenant link) for agent deploy packaging",
    input.email ? `Notify user ${input.email} after agent install` : "Collect end-user email for install notice",
    "Confirm MDR coverage is active for the tenant in the partner portal",
  ];
  return {
    success: true,
    message: tenant
      ? "24/7 MDR add-on onboard package prepared (tenant matched)"
      : "24/7 MDR add-on onboard package prepared (tenant mapping needed)",
    tenant,
    installerUrl,
    checklist,
  };
}

export async function blackpointOffboardPackage(input: {
  companyName: string;
  email?: string;
}): Promise<{
  success: boolean;
  message: string;
  tenant?: BpTenant | null;
  checklist: string[];
}> {
  if (!blackpointConfigured()) {
    return { success: false, message: "24/7 MDR add-on API key not configured", checklist: [] };
  }
  const tenant = await blackpointFindTenantByName(input.companyName);
  const checklist = [
    tenant
      ? `Tenant: ${tenant.name || tenant.accountName || tenant.id || tenant.uid}`
      : `No tenant match for "" - verify in the partner portal`,
    input.email ? `Remove / deactivate agent for user ${input.email}` : "Identify devices/users to remove from MDR",
    "Uninstall the 24/7 MDR add-on agent from endpoints (or quarantine via the partner portal)",
    "Confirm alerts silenced / license seat released in partner portal",
  ];
  return {
    success: true,
    message: "24/7 MDR add-on offboard checklist prepared",
    tenant,
    checklist,
  };
}
