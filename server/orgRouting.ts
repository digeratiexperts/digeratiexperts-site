import { ensurePerson, getOrgProfile, getPerson, getUnitLeader } from "./orgDirectoryStore";
import {
  displayPersonId,
  resolveApprovers,
  resolveContactPlan,
  resolveUnit,
  type ApprovalFlow,
  type ApprovalRule,
  type ContactPlan,
  type OrgProfile,
  type PersonProfile,
  type RoutingPerson,
  type RoutingUnit,
  type UnitLeader,
} from "@shared/orgDirectory";

/**
 * Request routing from the company structure: who DE contacts (and copies)
 * for a request, and who approves it. Used at submission; the result is
 * stored on the request so later structure changes don't rewrite history.
 */

export type OrgUser = {
  id: string;
  clientId: string | null;
  fullName: string;
  email: string;
  isActive?: boolean;
  departmentId?: string | null;
  managerUserId?: string | null;
  isCompanyItContact?: boolean | null;
  orgRole?: string | null;
};

export type OrgRoutingDeps = {
  getClient: (id: string) => { id: string; companyName: string } | undefined;
  findUser: (id: string) => OrgUser | undefined;
  listClientUsers: (clientId: string) => OrgUser[];
  /** Existing portal departments, for names. Optional (tests, memory mode). */
  listDepartments?: (clientId: string) => Promise<Array<{ id: string; name: string }>>;
};

export function isItContact(u: OrgUser | undefined): boolean {
  return Boolean(u && (u.isCompanyItContact || u.orgRole === "company_it_contact"));
}

type Who = RoutingPerson & { awayUntil: string | null };

async function who(deps: OrgRoutingDeps, clientId: string, userId: string | null | undefined): Promise<Who | null> {
  if (!userId) return null;
  const u = deps.findUser(userId);
  if (!u || u.clientId !== clientId || u.isActive === false) return null;
  const p = await getPerson(userId);
  return { userId: u.id, name: u.fullName, email: u.email, awayUntil: p?.clientId === clientId ? p.awayUntil : null };
}

export async function unitName(deps: OrgRoutingDeps, clientId: string, unit: { kind: "site" | "department"; id: string }): Promise<string> {
  if (unit.kind === "department") {
    const list = deps.listDepartments ? await deps.listDepartments(clientId).catch(() => []) : [];
    return list.find((d) => d.id === unit.id)?.name ?? "";
  }
  const { listClientSites } = await import("./serviceRequestRoutes");
  const sites = await listClientSites(clientId, deps.getClient(clientId) as any);
  const s = sites.find((x) => x.id === unit.id);
  return s ? s.name || s.code : "";
}

export type PersonContext = {
  profile: OrgProfile;
  person: PersonProfile;
  personId: string;
  unit: RoutingUnit | null;
  unitLeader: UnitLeader | null;
  leader: Who | null;
  backup: Who | null;
};

/** Everything routing needs about one person. Creates their directory row (and DE ID) if missing. */
export async function personContext(
  deps: OrgRoutingDeps,
  clientId: string,
  userId: string,
  requestSiteId: string | null = null,
): Promise<PersonContext> {
  const client = deps.getClient(clientId);
  const profile = await getOrgProfile(clientId, client?.companyName ?? "");
  const person = await ensurePerson(userId, clientId, profile.idPrefix);
  const u = deps.findUser(userId);
  const ref = resolveUnit({ profile, person, departmentId: u?.departmentId ?? null, requestSiteId });
  const unitLeader = ref ? await getUnitLeader(clientId, ref.kind, ref.id) : null;
  const unit = ref ? { ...ref, name: await unitName(deps, clientId, ref) } : null;
  return {
    profile,
    person,
    personId: displayPersonId(profile, person),
    unit,
    unitLeader,
    leader: await who(deps, clientId, unitLeader?.leaderUserId),
    backup: await who(deps, clientId, unitLeader?.backupUserId),
  };
}

/** Which approval a request needs, before looking for approvers. */
export function approvalRuleFor(
  type: string,
  payload: Record<string, unknown>,
  profile: Pick<OrgProfile, "approvalRequiredFor">,
): ApprovalRule | null {
  if (type === "license_request") {
    if (payload.operation === "remove") return null;
    if (payload.approval === "manager") return "leader";
    if (payload.approval === "it_contact") return "it_contact";
    return null;
  }
  return (profile.approvalRequiredFor as readonly string[]).includes(type) ? "leader" : null;
}

export type RequestRouting = { contactPlan: ContactPlan; approvalFlow: ApprovalFlow };

export async function planRequestRouting(
  deps: OrgRoutingDeps,
  input: {
    clientId: string;
    type: string;
    requestedForUserId: string;
    submittedByUserId: string;
    payload: Record<string, unknown>;
    siteId: string | null;
    today: string;
    now: Date;
  },
): Promise<RequestRouting> {
  const ctx = await personContext(deps, input.clientId, input.requestedForUserId, input.siteId);
  const target = deps.findUser(input.requestedForUserId);
  const primary: RoutingPerson = { userId: input.requestedForUserId, name: target?.fullName ?? "", email: target?.email ?? "" };

  const contactPlan = resolveContactPlan({
    personId: ctx.personId,
    tier: ctx.person.supportTier,
    primary,
    phone: typeof input.payload.contactPhone === "string" ? input.payload.contactPhone : null,
    awayUntil: ctx.person.awayUntil,
    today: input.today,
    unit: ctx.unit,
    leader: ctx.leader,
    backup: ctx.backup,
    ccLeader: ctx.unitLeader?.ccLeader ?? true,
  });

  const rule = approvalRuleFor(input.type, input.payload, ctx.profile);
  if (!rule) return { contactPlan, approvalFlow: { required: false, reason: "No approval needed for this request" } };
  if (ctx.person.supportTier === "vip" && ctx.profile.vipSkipsApproval) {
    return { contactPlan, approvalFlow: { required: false, reason: "VIP: no approval needed (company setting)" } };
  }

  const itContacts: Who[] = [];
  for (const u of deps.listClientUsers(input.clientId)) {
    if (!isItContact(u) || u.isActive === false || u.clientId !== input.clientId) continue;
    const w = await who(deps, input.clientId, u.id);
    if (w) itContacts.push(w);
  }
  const approvers = resolveApprovers({
    rule,
    requestedForUserId: input.requestedForUserId,
    today: input.today,
    leader: ctx.leader,
    backup: ctx.backup,
    manager: await who(deps, input.clientId, target?.managerUserId),
    itContacts,
  });
  if (!approvers.length) {
    return { contactPlan, approvalFlow: { required: false, reason: "No leader or IT contact is set up to approve; DE reviews it" } };
  }

  // An approver filing the request for someone else has approved it by filing it.
  const self = approvers.find((a) => a.userId === input.submittedByUserId);
  if (self) {
    return {
      contactPlan,
      approvalFlow: {
        required: true,
        rule,
        state: "approved",
        approvers,
        decidedBy: { userId: self.userId, name: self.name, email: self.email, role: "requester" },
        decidedAt: input.now.toISOString(),
        note: "Submitted by an approver",
      },
    };
  }
  return { contactPlan, approvalFlow: { required: true, rule, state: "pending", approvers } };
}
