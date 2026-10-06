/** Client-side portal org role helpers (mirrors server portalOrg capabilities). */

export type OrgRole = "staff" | "manager" | "dept_it_contact" | "company_it_contact";

export type PortalUserSession = {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
  orgRole?: OrgRole | string;
  clientId?: string | null;
  departmentId?: string | null;
  managerUserId?: string | null;
  manager?: { id: string; email: string; fullName: string } | null;
  companyDomains?: string[];
  isCompanyItContact?: boolean;
  capabilities?: {
    chat?: boolean;
    approvals?: boolean;
    manageOrg?: boolean;
    clientWide?: boolean;
  };
  client?: { companyName?: string | null } | null;
};

export function readPortalUser(): PortalUserSession | null {
  try {
    const raw = localStorage.getItem("portalUser");
    return raw ? (JSON.parse(raw) as PortalUserSession) : null;
  } catch {
    return null;
  }
}

export function readImpersonatingCompany(): { id?: string; companyName?: string } | null {
  try {
    const raw = localStorage.getItem("impersonatingCompany");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as { id?: string; companyName?: string };
  } catch {
    return null;
  }
}

export function isDeAdmin(user: PortalUserSession | null): boolean {
  return user?.role === "admin";
}

export function resolveOrgRole(user: PortalUserSession | null): OrgRole {
  if (!user) return "staff";
  if (isDeAdmin(user)) return "company_it_contact";
  if (user.isCompanyItContact) return "company_it_contact";
  const r = (user.orgRole || "staff") as OrgRole;
  if (["staff", "manager", "dept_it_contact", "company_it_contact"].includes(r)) return r;
  return "staff";
}

export function canChat(user: PortalUserSession | null): boolean {
  if (user?.capabilities?.chat !== undefined) return !!user.capabilities.chat;
  if (isDeAdmin(user)) return true;
  const r = resolveOrgRole(user);
  return r === "company_it_contact" || r === "dept_it_contact";
}

export function canApprovals(user: PortalUserSession | null): boolean {
  if (user?.capabilities?.approvals !== undefined) return !!user.capabilities.approvals;
  if (isDeAdmin(user)) return true;
  const r = resolveOrgRole(user);
  return r === "manager" || r === "dept_it_contact" || r === "company_it_contact";
}

export function canManageOrg(user: PortalUserSession | null): boolean {
  if (user?.capabilities?.manageOrg !== undefined) return !!user.capabilities.manageOrg;
  if (isDeAdmin(user)) return true;
  return resolveOrgRole(user) === "company_it_contact" || !!user?.isCompanyItContact;
}

/** Nav visibility for staff-minimal vs expanded IT Contact surfaces */
export type NavKey =
  | "dashboard"
  | "tickets"
  | "forms"
  | "requests"
  | "infrastructure"
  | "chat"
  | "approvals"
  | "people"
  | "surveys"
  | "billing"
  | "services"
  | "company"
  | "files"
  | "kb"
  | "settings"
  | "contracts"
  | "learning"
  | "other";

export function navAllowed(user: PortalUserSession | null, key: NavKey): boolean {
  if (isDeAdmin(user)) return true;
  const role = resolveOrgRole(user);
  const staffKeys: NavKey[] = [
    "dashboard",
    "tickets",
    "forms",
    "requests",
    "infrastructure",
    "contracts",
    "kb",
    "learning",
    "settings",
  ];
  if (role === "staff") return staffKeys.includes(key);
  if (role === "manager") {
    return [...staffKeys, "approvals"].includes(key);
  }
  // IT contacts — broader client portal
  return true;
}
