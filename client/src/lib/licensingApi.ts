import { portalFetch } from "@/lib/portalApi";
import type { AccountType, CatalogLicense, LicensePolicy, RequestableLicense } from "@shared/licensing";

/** Licensing API client (server/licensingRoutes.ts). */

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & { problems?: string[] };
    err.problems = body.problems;
    throw err;
  }
  return body as T;
}

export type LicensingOverview = {
  company: { id: string; name: string };
  catalog: CatalogLicense[];
  platforms: Array<{ key: string; label: string; directory: string }>;
  policy: LicensePolicy;
  me: { accountType: AccountType; tier: string | null; assigned: boolean; licenses: RequestableLicense[] };
  canManagePeople: boolean;
  canEditPolicy: boolean;
};

export type LicensingPerson = {
  userId: string;
  name: string;
  email: string;
  accountType: AccountType;
  tier: string | null;
  assigned: boolean;
  base: Array<{ platform: string; license: string | null; assignment: string }>;
};

export const licensingApi = {
  overview: () => request<LicensingOverview>("/api/portal/licensing"),
  entitlements: (params: { accountKind: string; userId?: string }) =>
    request<{ classification: { accountType: AccountType; tier: string | null }; platforms: LicensePolicy["platforms"]; licenses: RequestableLicense[] }>(
      `/api/portal/licensing/entitlements?${new URLSearchParams(params as Record<string, string>)}`,
    ),
  people: () => request<{ tiers: string[]; people: LicensingPerson[] }>("/api/portal/licensing/people"),
  setPerson: (userId: string, accountType: AccountType, tier: string | null) =>
    request(`/api/portal/licensing/people/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify({ accountType, tier }) }),
  savePolicy: (clientId: string, policy: LicensePolicy) =>
    request<{ policy: LicensePolicy }>(`/api/portal/admin/licensing/policy?clientId=${encodeURIComponent(clientId)}`, {
      method: "PUT",
      body: JSON.stringify({ policy }),
    }),
};
