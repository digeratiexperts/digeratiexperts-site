import type { PortalAuthClient, PortalAuthUser } from "./portalAuthStore";

export type PortalTokenIdentity = {
  userId: string;
  email: string;
  clientId?: string | null;
  impersonatingCompanyId?: string | null;
  impersonatingCompanyName?: string | null;
};

type AuthorizedPortalUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  storeRole: string;
  clientId: string | null;
  orgRole: string;
  departmentId: string | null;
  managerUserId: string | null;
  isCompanyItContact: boolean;
  impersonatingCompanyId: string | null;
  impersonatingCompanyName: string | null;
};

type LiveAuthorizationResult =
  | { ok: true; user: AuthorizedPortalUser }
  | { ok: false; status: 401 | 403; error: string };

function normalizeTenantId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function isActiveClient(client: PortalAuthClient | null | undefined): client is PortalAuthClient {
  const status = client?.status?.trim().toLowerCase();
  return status === "active" || status === "prospect";
}

/**
 * Resolve every authorization-sensitive field from the live Portal record.
 * The signed token proves session identity only. Tenant mismatches and
 * unauthorized impersonation fail closed — they are never remapped or stripped.
 */
export function resolveLivePortalAuthorization(
  token: PortalTokenIdentity,
  live: PortalAuthUser | null | undefined,
  getClient: (id: string) => PortalAuthClient | undefined = () => undefined,
): LiveAuthorizationResult {
  if (!live) {
    return { ok: false, status: 401, error: "Portal account no longer exists" };
  }
  if (live.id !== token.userId || live.email.toLowerCase() !== token.email.toLowerCase()) {
    return { ok: false, status: 401, error: "Portal session identity is invalid" };
  }
  if (live.isActive !== true) {
    return { ok: false, status: 403, error: "Portal account is disabled" };
  }

  const tokenClientId = normalizeTenantId(token.clientId);
  const liveClientId = normalizeTenantId(live.clientId);
  if (tokenClientId !== liveClientId) {
    return { ok: false, status: 401, error: "Portal session tenant is invalid" };
  }

  const isAdmin = live.role === "admin";
  const hasImpersonationClaim =
    token.impersonatingCompanyId != null || token.impersonatingCompanyName != null;

  if (hasImpersonationClaim && !isAdmin) {
    return { ok: false, status: 403, error: "Impersonation is not permitted" };
  }

  if (liveClientId && !isActiveClient(getClient(liveClientId))) {
    return { ok: false, status: 403, error: "Portal client account is inactive" };
  }

  let impersonatingClient: PortalAuthClient | undefined;
  if (isAdmin && hasImpersonationClaim) {
    const targetId = normalizeTenantId(token.impersonatingCompanyId);
    if (!targetId) {
      return { ok: false, status: 403, error: "Impersonation is not permitted" };
    }
    impersonatingClient = getClient(targetId);
    if (!impersonatingClient || impersonatingClient.id !== targetId) {
      return { ok: false, status: 403, error: "Impersonation is not permitted" };
    }
  }

  return {
    ok: true,
    user: {
      id: live.id,
      email: live.email,
      fullName: live.fullName,
      role: live.role,
      storeRole: isAdmin ? "admin" : live.storeRole || "prospect",
      clientId: liveClientId,
      orgRole: live.orgRole || (isAdmin ? "company_it_contact" : "staff"),
      departmentId: live.departmentId || null,
      managerUserId: live.managerUserId || null,
      isCompanyItContact: !!live.isCompanyItContact || isAdmin,
      impersonatingCompanyId: impersonatingClient?.id ?? null,
      impersonatingCompanyName: impersonatingClient?.companyName ?? null,
    },
  };
}
