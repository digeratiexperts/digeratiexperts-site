import type { PortalCompanyProfile } from "@shared/portalCompanyProfile";
import type { PortalAuthClient, PortalAuthUser } from "./portalAuthStore";

type Viewer = { role?: string | null; clientId?: string | null; impersonatingCompanyId?: string | null };

/** Same session-only company rule as service requests. Never infer a tenant from email or a browser parameter. */
export function selectedPortalCompanyId(user: Viewer | undefined): string | null {
  if (!user) return null;
  return (user.role === "admin" ? user.impersonatingCompanyId : user.clientId)?.trim() || null;
}

export function portalCompanyProfile(
  user: Viewer | undefined,
  getClient: (id: string) => PortalAuthClient | undefined,
  users: Iterable<Pick<PortalAuthUser, "id" | "clientId" | "fullName" | "email" | "isActive" | "isCompanyItContact">>,
): PortalCompanyProfile {
  const canChooseCompany = user?.role === "admin";
  const clientId = selectedPortalCompanyId(user);
  const empty = { canChooseCompany, company: null, team: [] };
  if (!clientId) return { ...empty, status: canChooseCompany ? "choose_company" : "company_unlinked" };
  const client = getClient(clientId);
  if (!client || client.id !== clientId) return { ...empty, status: "company_unavailable" };
  const team = new Map<string, PortalCompanyProfile["team"][number]>();
  for (const member of users) {
    if (member.clientId !== clientId || member.isActive === false) continue;
    team.set(member.id, { id: member.id, name: member.fullName, email: member.email, isItContact: !!member.isCompanyItContact });
  }
  return {
    status: "ready", canChooseCompany,
    company: { id: client.id, name: client.companyName, email: client.contactEmail || "", phone: client.contactPhone || "", industry: client.industry || "" },
    team: [...team.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
