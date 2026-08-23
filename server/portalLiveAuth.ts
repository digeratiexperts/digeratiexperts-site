import type { PortalAuthUser } from "./portalAuthStore";

export type PortalTokenIdentity = {
  userId: string;
  email: string;
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

/**
 * Resolve every authorization-sensitive field from the live Portal record.
 * The signed token proves session identity only; it never preserves an old
 * role, Store permission, or tenant assignment.
 */
export function resolveLivePortalAuthorization(
  token: PortalTokenIdentity,
  live: PortalAuthUser | null | undefined,
): LiveAuthorizationResult {
  if (!live) {
    return { ok: false, status: 401, error: "Portal account no longer exists" };
  }
  if (live.id !== token.userId || live.email.toLowerCase() !== token.email.toLowerCase()) {
    return { ok: false, status: 401, error: "Portal session identity is invalid" };
  }
  if (live.isActive === false) {
    return { ok: false, status: 403, error: "Portal account is disabled" };
  }

  const isAdmin = live.role === "admin";
  return {
    ok: true,
    user: {
      id: live.id,
      email: live.email,
      fullName: live.fullName,
      role: live.role,
      storeRole: isAdmin ? "admin" : live.storeRole || "prospect",
      clientId: live.clientId || null,
      orgRole: live.orgRole || (isAdmin ? "company_it_contact" : "staff"),
      departmentId: live.departmentId || null,
      managerUserId: live.managerUserId || null,
      isCompanyItContact: !!live.isCompanyItContact || isAdmin,
      impersonatingCompanyId: isAdmin ? token.impersonatingCompanyId || null : null,
      impersonatingCompanyName: isAdmin ? token.impersonatingCompanyName || null : null,
    },
  };
}
