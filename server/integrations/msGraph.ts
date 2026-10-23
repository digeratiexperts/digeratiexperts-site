/**
 * Microsoft Graph: licence assignment in a client's Microsoft 365 tenant.
 *
 * One multi-tenant app registration in DE's tenant, consented in each client
 * tenant (Organization.Read.All + User.ReadWrite.All, application
 * permissions). Client-credentials tokens are taken per client tenant.
 *   Commercial and GCC: MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET,
 *     login.microsoftonline.com + graph.microsoft.com.
 *   GCC High: MS_GRAPH_GOV_CLIENT_ID / MS_GRAPH_GOV_CLIENT_SECRET (an app in
 *     Azure Government), login.microsoftonline.us + graph.microsoft.us.
 * Secrets come from the server environment only. Every call returns
 * { ok, error } and never throws.
 */
import type { MicrosoftCloud } from "@shared/vendorPush";

type Endpoints = { login: string; graph: string; idVar: string; secretVar: string };
const CLOUDS: Record<MicrosoftCloud, Endpoints> = {
  commercial: { login: "https://login.microsoftonline.com", graph: "https://graph.microsoft.com", idVar: "MS_GRAPH_CLIENT_ID", secretVar: "MS_GRAPH_CLIENT_SECRET" },
  gcc: { login: "https://login.microsoftonline.com", graph: "https://graph.microsoft.com", idVar: "MS_GRAPH_CLIENT_ID", secretVar: "MS_GRAPH_CLIENT_SECRET" },
  gcc_high: { login: "https://login.microsoftonline.us", graph: "https://graph.microsoft.us", idVar: "MS_GRAPH_GOV_CLIENT_ID", secretVar: "MS_GRAPH_GOV_CLIENT_SECRET" },
};

const creds = (cloud: MicrosoftCloud) => {
  const c = CLOUDS[cloud];
  const id = (process.env[c.idVar] || "").trim();
  const secret = (process.env[c.secretVar] || "").trim();
  return id && secret ? { id, secret, ...c } : null;
};

export function msGraphConfigured(cloud: MicrosoftCloud): boolean {
  return creds(cloud) !== null;
}

export function msGraphMissingVars(cloud: MicrosoftCloud): string {
  return `${CLOUDS[cloud].idVar} / ${CLOUDS[cloud].secretVar}`;
}

const tokens = new Map<string, { token: string; expires: number }>();

async function token(tenant: string, cloud: MicrosoftCloud): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const c = creds(cloud);
  if (!c) return { ok: false, error: `${msGraphMissingVars(cloud)} not set on the server` };
  const key = `${cloud}|${tenant.toLowerCase()}`;
  const hit = tokens.get(key);
  if (hit && hit.expires > Date.now() + 60_000) return { ok: true, token: hit.token };
  try {
    const res = await fetch(`${c.login}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.id,
        client_secret: c.secret,
        grant_type: "client_credentials",
        scope: `${c.graph}/.default`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      return { ok: false, error: data.error_description?.split("\r\n")[0] || data.error || `Token request failed (${res.status})` };
    }
    tokens.set(key, { token: data.access_token, expires: Date.now() + Number(data.expires_in || 3000) * 1000 });
    return { ok: true, token: data.access_token };
  } catch (error: any) {
    return { ok: false, error: `Could not reach Microsoft sign-in: ${error?.message || error}` };
  }
}

async function graph<T>(
  tenant: string,
  cloud: MicrosoftCloud,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const t = await token(tenant, cloud);
  if (!t.ok) return { ok: false, status: 0, error: t.error };
  try {
    const res = await fetch(`${CLOUDS[cloud].graph}/v1.0${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: data?.error?.message || `Graph answered ${res.status}` };
    return { ok: true, status: res.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, error: `Could not reach Microsoft Graph: ${error?.message || error}` };
  }
}

export type MsSku = { skuId: string; skuPartNumber: string; enabled: number; consumed: number };

/** The tenant's subscriptions, so a part number becomes a skuId (and an empty subscription is caught). */
export async function msSubscribedSkus(tenant: string, cloud: MicrosoftCloud): Promise<{ ok: boolean; skus?: MsSku[]; error?: string }> {
  const r = await graph<{ value: any[] }>(tenant, cloud, "/subscribedSkus");
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    skus: (r.data?.value || []).map((s) => ({
      skuId: String(s.skuId),
      skuPartNumber: String(s.skuPartNumber),
      enabled: Number(s.prepaidUnits?.enabled ?? 0),
      consumed: Number(s.consumedUnits ?? 0),
    })),
  };
}

/** Adds one licence to one user (by UPN/email). Already-assigned counts as done. */
export async function msAssignLicense(
  tenant: string,
  cloud: MicrosoftCloud,
  userPrincipalName: string,
  skuId: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await graph(tenant, cloud, `/users/${encodeURIComponent(userPrincipalName)}/assignLicense`, {
    method: "POST",
    body: JSON.stringify({ addLicenses: [{ skuId, disabledPlans: [] }], removeLicenses: [] }),
  });
  if (r.ok) return { ok: true };
  if (r.status === 404) return { ok: false, error: `No user ${userPrincipalName} in this tenant` };
  if (/usage location/i.test(r.error || "")) return { ok: false, error: "The user has no usage location set in Entra; set it, then send again" };
  return { ok: false, error: r.error };
}
