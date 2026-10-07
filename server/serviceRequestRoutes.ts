import express, { type Express, type Request, type RequestHandler, type Response } from "express";
import {
  addServiceRequestAttachment,
  createServiceRequest,
  getServiceRequest,
  getServiceRequestAttachment,
  listServiceRequestAttachments,
  listServiceRequestsForAdmin,
  listServiceRequestsForUser,
  updateServiceRequest,
  type StoredAttachment,
  type StoredServiceRequest,
} from "./serviceRequestStore";
import { queueServiceRequestForHub } from "./serviceRequestHubSync";
import { listManualRecords } from "./portalManualRecords";
import { classificationFor, getLicensePolicy } from "./licensingStore";
import { isItContact, personContext, planRequestRouting, type OrgUser } from "./orgRouting";
import { APPROVER_ROLE_LABELS, type ApprovalFlow, type Approver, type ContactPlan, type RoutingPerson } from "@shared/orgDirectory";
import { accountTypeLabel, platformLabel, requestableLicenses, type AccountType } from "@shared/licensing";
import { announcementFromRecord, builtInAnnouncements, type PortalAnnouncement } from "@shared/portalAnnouncements";
import {
  AMENDABLE_STATUSES,
  APPROVAL_STATUS,
  BASKET_STATUS,
  HOLD_STATUS,
  canHold,
  checkHoldUntil,
  type ServiceRequestHold,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  TYPE_LABELS,
  USER_CANCELLABLE,
  allowedStaffTransitions,
  isServiceRequestType,
  returnReasonLabel,
  todayIso,
  validateServiceRequestFields,
  type AnyRequestFields,
  type LicenseFields,
  type LoanerFields,
  type ReturnFields,
  type ServiceRequestAsset,
  type ServiceRequestPerson,
  type ServiceRequestRecord,
  type ServiceRequestSite,
  type ServiceRequestStatus,
  type ServiceRequestStatusEvent,
  type ServiceRequestType,
} from "@shared/serviceRequests";
import {
  PORTAL_TICKET_MAX_FILE_BYTES,
  PORTAL_TICKET_MAX_FILES,
  isAllowedPortalTicketExtension,
  portalTicketFileExtension,
  sanitizePortalTicketFilename,
} from "@shared/portalTicketFileRules";

/**
 * Portal service requests: Request Loaner Computer and Return Computer.
 *
 * Tenant rule: the company always comes from the signed-in user (or, for a DE
 * admin, the company they are impersonating), never from the request body. A
 * client user sees only requests in their own company that they submitted or
 * that were requested for them. Status after submission is staff authority:
 * DE admins here, or the Hub through the signed write-back route. The
 * requester can only cancel, and only before a device or pickup is arranged.
 */

export type ServiceRequestUser = {
  id: string;
  role?: string | null;
  clientId?: string | null;
  email?: string | null;
  fullName?: string | null;
  impersonatingCompanyId?: string | null;
};

type AuthedRequest = Request & { user?: ServiceRequestUser };

/** A portal user as routes see them. The org fields drive leader / IT contact routing (server/orgRouting.ts). */
export type DirectoryUser = OrgUser;
export type DirectoryClient = { id: string; companyName: string; hubAccountId?: string | null };

export type ServiceRequestRouteDeps = {
  /** authMiddleware (+ validateInput) for the requester routes. */
  guards: RequestHandler[];
  /** authMiddleware + requireAdmin for the staff routes. */
  adminGuards: RequestHandler[];
  getClient: (id: string) => DirectoryClient | undefined;
  findUser: (id: string) => DirectoryUser | undefined;
  listClientUsers: (clientId: string) => DirectoryUser[];
  /** Optional Zoho Desk ticket for a submitted request; returns the ticket id or null. Must not throw. */
  createDeskTicket?: (input: { subject: string; description: string; email: string }) => Promise<string | null>;
  /** Existing portal departments (names for routing). Optional. */
  listDepartments?: (clientId: string) => Promise<Array<{ id: string; name: string }>>;
  /** Approval and leader-copy emails. Optional; must not throw. */
  notify?: {
    approvalNeeded?: (input: RequestEmail & { to: Approver[] }) => Promise<unknown>;
    leaderCopy?: (input: RequestEmail & { to: RoutingPerson[]; contactSummary: string }) => Promise<unknown>;
  };
  now?: () => Date;
};

export type RequestEmail = { requestId: string; number: string; typeLabel: string; requestedForName: string; submittedByName: string };

export const SERVICE_REQUESTS_PATH = "/api/portal/service-requests";
export const ADMIN_SERVICE_REQUESTS_PATH = "/api/portal/admin/service-requests";
export const HUB_SERVICE_REQUEST_STATUS_PATH = "/api/integrations/v1/hub/service-requests/:id/status";

// ---------- helpers ----------

/** The company a request is filed under, from the session only. */
export function effectiveClientId(user: ServiceRequestUser | undefined): string | null {
  if (!user) return null;
  if (user.role === "admin") return (user.impersonatingCompanyId || "").trim() || null;
  return (user.clientId || "").trim() || null;
}

function person(deps: ServiceRequestRouteDeps, userId: string): ServiceRequestPerson {
  const u = deps.findUser(userId);
  return { userId, name: u?.fullName || "Unknown user", email: u?.email || "" };
}

export async function listClientSites(clientId: string, client?: DirectoryClient & Record<string, any>): Promise<ServiceRequestSite[]> {
  const records = await listManualRecords(clientId, "site");
  const sites: ServiceRequestSite[] = [];
  for (const r of records) {
    const d = r.data as Record<string, unknown>;
    const code = typeof d.code === "string" ? d.code.trim() : "";
    if (!code) continue;
    sites.push({
      id: r.id,
      code,
      name: typeof d.name === "string" ? d.name : undefined,
      street: String(d.street ?? ""),
      city: String(d.city ?? ""),
      state: String(d.state ?? ""),
      country: String(d.country ?? "United States of America"),
      zip: String(d.zip ?? ""),
    });
  }
  // A company with no LIDs entered yet still has its account address: offer it
  // as "HQ" so the form is usable on day one. Staff-entered sites replace it.
  if (!sites.length && client && (client.address || client.city)) {
    sites.push({
      id: "hq",
      code: "HQ",
      name: client.companyName,
      street: String(client.address ?? ""),
      city: String(client.city ?? ""),
      state: String(client.state ?? ""),
      country: "United States of America",
      zip: String(client.zipCode ?? ""),
    });
  }
  return sites.sort((a, b) => a.code.localeCompare(b.code));
}

export async function listAssignedAssets(clientId: string, userId: string): Promise<ServiceRequestAsset[]> {
  const records = await listManualRecords(clientId, "computer_asset");
  return records
    .map((r) => {
      const d = r.data as Record<string, unknown>;
      return {
        id: r.id,
        assetTag: String(d.assetTag ?? "").trim(),
        serialNumber: typeof d.serialNumber === "string" ? d.serialNumber : undefined,
        model: typeof d.model === "string" ? d.model : undefined,
        assignedUserId: String(d.assignedUserId ?? ""),
      };
    })
    .filter((a) => a.assetTag && a.assignedUserId === userId);
}

async function toRecord(deps: ServiceRequestRouteDeps, r: StoredServiceRequest): Promise<ServiceRequestRecord> {
  const attachments = await listServiceRequestAttachments(r.id);
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    status: r.status,
    accountId: r.accountId,
    accountName: deps.getClient(r.accountId)?.companyName || "",
    requestedFor: person(deps, r.requestedForUserId),
    submittedBy: person(deps, r.submittedByUserId),
    payload: r.payload,
    site: r.site,
    customAddress: r.customAddress,
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      uploadedAt: a.uploadedAt,
    })),
    statusHistory: r.statusHistory,
    revision: r.revision,
    hubSyncStatus: r.hubSyncStatus,
    hubSyncedAt: r.hubSyncedAt,
    deskTicketId: r.deskTicketId,
    submittedAt: r.submittedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function approvalFlowOf(r: Pick<StoredServiceRequest, "payload">): ApprovalFlow | null {
  const f = (r.payload as Record<string, unknown>).approvalFlow as ApprovalFlow | undefined;
  return f && typeof f === "object" ? f : null;
}

function isApproverOf(userId: string, r: StoredServiceRequest): boolean {
  const f = approvalFlowOf(r);
  return Boolean(f && f.required && f.approvers.some((a) => a.userId === userId));
}

function canView(user: ServiceRequestUser, r: StoredServiceRequest): boolean {
  if (user.role === "admin") return true;
  if (!user.clientId || user.clientId !== r.accountId) return false;
  // The approver (site / department leader, backup, manager or IT contact) sees what they decide on.
  return r.submittedByUserId === user.id || r.requestedForUserId === user.id || (r.status !== BASKET_STATUS && isApproverOf(user.id, r));
}

async function syncToHub(deps: ServiceRequestRouteDeps, r: StoredServiceRequest, attachments?: StoredAttachment[]) {
  if (r.status === BASKET_STATUS) return;
  const client = deps.getClient(r.accountId);
  await queueServiceRequestForHub({
    request: r,
    hubAccountId: client?.hubAccountId ?? null,
    accountName: client?.companyName || "",
    requestedFor: person(deps, r.requestedForUserId),
    submittedBy: person(deps, r.submittedByUserId),
    attachments: attachments ?? (await listServiceRequestAttachments(r.id)),
  });
}

function deskDescription(deps: ServiceRequestRouteDeps, r: StoredServiceRequest): string {
  const client = deps.getClient(r.accountId);
  const company = client?.companyName || "";
  const p = r.payload as Record<string, any>;
  const lines = [
    `${TYPE_LABELS[r.type]} ${r.number}`,
    `Company: ${company}`,
    `Requested for: ${person(deps, r.requestedForUserId).name}`,
    `Submitted by: ${person(deps, r.submittedByUserId).name}`,
    `Contact phone: ${p.contactPhone ?? ""}`,
  ];
  if (r.type === "license_request") {
    lines.push(
      `Operation: ${p.operation === "remove" ? "Remove" : "Add"} licence`,
      `Account: ${p.accountKind === "person" ? person(deps, r.requestedForUserId).name : `${p.accountName} (${accountTypeLabel(String(p.accountKind))})`}`,
      `Account type: ${accountTypeLabel(String(p.accountType))}${p.tier ? ` · ${p.tier}` : ""}`,
      `Platform: ${platformLabel(String(p.platform))}`,
      `Licence: ${p.licenseName}`,
      `Group: ${p.group || "(not set in the policy)"}`,
      `Approval: ${p.approval}`,
      `Business justification: ${p.businessJustification}`,
    );
  } else if (r.type === "loaner_computer") {
    lines.push(`Device: ${p.deviceKind}`, `Needed from: ${p.neededFrom}`, `Loan until: ${p.loanUntil}`, `Reason: ${p.reason}`);
    if (p.accessories) lines.push(`Accessories: ${p.accessories}`);
    if (p.additionalNotes) lines.push(`Notes: ${p.additionalNotes}`);
  } else {
    lines.push(`Reason: ${returnReasonLabel(String(p.returnReason), company)}`);
    if (p.asset) lines.push(`Computer: ${p.asset.assetTag}${p.asset.serialNumber ? ` (S/N ${p.asset.serialNumber})` : ""}`);
    if (p.manualAsset) lines.push(`Computer (not in assigned assets): ${[p.manualAsset.assetTag, p.manualAsset.serialNumber, p.manualAsset.description].filter(Boolean).join(" / ")}`);
    lines.push(`Accessories: ${p.accessories}`);
    if (p.preferredReturnDate) lines.push(`Preferred return date: ${p.preferredReturnDate}`);
    if (p.additionalComments) lines.push(`Comments: ${p.additionalComments}`);
  }
  const a = r.site ?? r.customAddress;
  if (a) lines.push(`Location: ${r.site ? `${r.site.code} — ` : "(not a company location) "}${a.street}, ${a.city}, ${a.state} ${a.zip}, ${a.country}`);
  const plan = p.contactPlan as ContactPlan | undefined;
  if (plan) {
    lines.push("", `Person ID: ${plan.personId}${plan.supportTier === "vip" ? " · VIP" : ""}`, `Contact: ${plan.summary}`);
    if (plan.cc.length) lines.push(`CC: ${plan.cc.map((c) => `${c.name} <${c.email}>`).join(", ")}`);
  }
  const flow = approvalFlowOf(r);
  if (flow?.required && flow.decidedBy) {
    lines.push(`Approved by: ${flow.decidedBy.name} (${APPROVER_ROLE_LABELS[flow.decidedBy.role]})${flow.note ? ` — ${flow.note}` : ""}`);
  } else if (flow && !flow.required) {
    lines.push(`Approval: ${flow.reason}`);
  }
  if (client?.hubAccountId) lines.push("", `canonicalAccountId: ${client.hubAccountId}`);
  return lines.join("\n");
}

/** Submit-time side effects: Desk ticket (optional, non-blocking), then the Hub copy. */
async function afterSubmit(deps: ServiceRequestRouteDeps, r: StoredServiceRequest): Promise<StoredServiceRequest> {
  let current = r;
  // A request re-approved after an amendment already has its ticket.
  if (deps.createDeskTicket && !r.deskTicketId) {
    try {
      const ticketId = await deps.createDeskTicket({
        subject: `${TYPE_LABELS[r.type]} ${r.number}`,
        description: deskDescription(deps, r),
        email: person(deps, r.submittedByUserId).email,
      });
      if (ticketId) {
        current = (await updateServiceRequest(r.id, r.revision, { deskTicketId: ticketId })) ?? current;
      }
    } catch (error) {
      console.warn("[service-requests] Desk ticket not created:", error instanceof Error ? error.message : error);
    }
  }
  await syncToHub(deps, current);
  const plan = (current.payload as Record<string, unknown>).contactPlan as ContactPlan | undefined;
  if (plan?.cc.length && deps.notify?.leaderCopy) {
    try {
      await deps.notify.leaderCopy({ ...emailFor(deps, current), to: plan.cc, contactSummary: plan.summary });
    } catch (error) {
      console.warn("[service-requests] leader copy not sent:", error instanceof Error ? error.message : error);
    }
  }
  return (await getServiceRequest(current.id)) ?? current;
}

function emailFor(deps: ServiceRequestRouteDeps, r: StoredServiceRequest): RequestEmail {
  return {
    requestId: r.id,
    number: r.number,
    typeLabel: TYPE_LABELS[r.type],
    requestedForName: person(deps, r.requestedForUserId).name,
    submittedByName: person(deps, r.submittedByUserId).name,
  };
}

/**
 * Submission through the company structure: attach the contact plan and the
 * approval flow, then either park the request for its approver (no Desk
 * ticket yet; the Hub sees it as awaiting approval) or send it on.
 * `r` is stored (new, with no history yet, or a basket item); its status is replaced here.
 */
async function submitThroughStructure(
  deps: ServiceRequestRouteDeps,
  r: StoredServiceRequest,
  at: Date,
): Promise<StoredServiceRequest> {
  let routing: { contactPlan?: ContactPlan; approvalFlow: ApprovalFlow };
  try {
    routing = await planRequestRouting(deps, {
      clientId: r.accountId,
      type: r.type,
      requestedForUserId: r.requestedForUserId,
      submittedByUserId: r.submittedByUserId,
      payload: r.payload,
      siteId: r.site?.id ?? null,
      today: todayIso(at),
      now: at,
    });
  } catch (error) {
    // A directory problem never blocks a request: it goes straight to DE.
    console.warn("[service-requests] routing unavailable:", error instanceof Error ? error.message : error);
    routing = { approvalFlow: { required: false, reason: "Company structure unavailable; DE reviews it" } };
  }
  const payload = { ...r.payload, ...(routing.contactPlan ? { contactPlan: routing.contactPlan } : {}), approvalFlow: routing.approvalFlow };
  const flow = routing.approvalFlow;
  const waiting = flow.required && flow.state === "pending";
  const status: ServiceRequestStatus = waiting ? APPROVAL_STATUS : "submitted";
  const note = waiting
    ? `Waiting for approval from ${flow.approvers.map((a) => `${a.name} (${APPROVER_ROLE_LABELS[a.role]})`).join(" or ")}`
    : flow.required && flow.decidedBy
      ? "Approved by the person who submitted it"
      : null;
  const updated = await updateServiceRequest(r.id, r.revision, {
    status,
    payload,
    submittedAt: at.toISOString(),
    statusHistory: [...r.statusHistory, historyEvent(status, "requester", at, note)],
  });
  if (!updated) return r;
  if (!waiting) return afterSubmit(deps, updated);

  await syncToHub(deps, updated);
  if (deps.notify?.approvalNeeded && flow.required) {
    try {
      await deps.notify.approvalNeeded({ ...emailFor(deps, updated), to: flow.approvers });
    } catch (error) {
      console.warn("[service-requests] approval email not sent:", error instanceof Error ? error.message : error);
    }
  }
  return (await getServiceRequest(updated.id)) ?? updated;
}

/**
 * Resolve the validated fields into what is stored: the site snapshot (so a
 * later LID edit does not rewrite history), the asset snapshot, and labels.
 */
async function resolveSubmission(
  deps: ServiceRequestRouteDeps,
  clientId: string,
  type: ServiceRequestType,
  input: AnyRequestFields,
): Promise<
  | { ok: true; payload: Record<string, unknown>; site: ServiceRequestSite | null; requestedForUserId: string }
  | { ok: false; status: number; errors: Record<string, string> }
> {
  const target = deps.findUser(input.requestedForUserId);
  if (!target || target.clientId !== clientId || target.isActive === false) {
    return { ok: false, status: 400, errors: { requestedForUserId: "Choose a person in your company" } };
  }

  if (type === "license_request") {
    // The licence must be one the company's policy offers this account; the
    // group comes from the policy, never from the browser.
    const f = input as LicenseFields;
    const policy = await getLicensePolicy(clientId);
    const who =
      f.accountKind === "person"
        ? await classificationFor(target.id, clientId)
        : { accountType: f.accountKind as AccountType, tier: null };
    const match = requestableLicenses(policy, who).find((l) => l.platform === f.platform && l.licenseKey === f.licenseKey);
    if (!match) return { ok: false, status: 400, errors: { licenseKey: "That licence isn't offered to this account in your company's policy" } };
    if (f.operation === "add" && match.assignment === "automatic") {
      return { ok: false, status: 400, errors: { licenseKey: "This account is licensed automatically. No request is needed." } };
    }
    if (f.operation === "add" && match.assignment === "not_eligible") {
      return { ok: false, status: 400, errors: { licenseKey: "This account type isn't eligible for that licence" } };
    }
    const payload: Record<string, unknown> = {
      ...f,
      accountName: f.accountKind === "person" ? "" : f.accountName,
      accountType: who.accountType,
      tier: who.tier,
      licenseName: match.name,
      licenseKind: match.kind,
      group: match.group,
      approval: match.approval,
    };
    return { ok: true, payload, site: null, requestedForUserId: target.id };
  }
  const fields = input as LoanerFields | ReturnFields;

  let site: ServiceRequestSite | null = null;
  if (!fields.addressNotClientLocation) {
    const sites = await listClientSites(clientId, deps.getClient(clientId) as any);
    site = sites.find((s) => s.id === fields.siteId) ?? null;
    if (!site) return { ok: false, status: 400, errors: { siteId: "Choose one of your company's sites" } };
  }

  const payload: Record<string, unknown> = { ...fields };
  delete payload.customAddress;
  if (type === "return_computer") {
    const f = fields as ReturnFields;
    if (!f.assetNotListed) {
      const assets = await listAssignedAssets(clientId, target.id);
      const asset = assets.find((a) => a.id === f.assetId);
      if (!asset) return { ok: false, status: 400, errors: { assetId: "Choose a computer assigned to this person" } };
      payload.asset = { id: asset.id, assetTag: asset.assetTag, serialNumber: asset.serialNumber ?? null, model: asset.model ?? null };
      payload.manualAsset = null;
    } else {
      payload.assetId = null;
    }
  }
  return { ok: true, payload, site, requestedForUserId: target.id };
}

function historyEvent(status: ServiceRequestStatus, by: string, now: Date, note?: string | null): ServiceRequestStatusEvent {
  return { status, at: now.toISOString(), by, note: note ?? null };
}

// ---------- hold, resume, amend ----------

export type ActorRole = "de_admin" | "requester" | "leader" | "backup_leader" | "it_contact";

export const ACTOR_ROLE_LABELS: Record<ActorRole | "staff" | "hub" | "system", string> = {
  de_admin: "Digerati Experts",
  requester: "Requester",
  leader: "Leader",
  backup_leader: "Backup leader",
  it_contact: "IT contact",
  staff: "Digerati Experts",
  hub: "Digerati Experts (Hub)",
  system: "Automatic",
};

/**
 * Who may act on a request for someone: the requester or the person it's for,
 * that person's site / department leader or backup, the company IT contact,
 * or a DE admin. Null for anyone else (another company included).
 */
export async function actorRole(deps: ServiceRequestRouteDeps, user: ServiceRequestUser, r: StoredServiceRequest): Promise<ActorRole | null> {
  if (user.role === "admin") return "de_admin";
  if (!user.clientId || user.clientId !== r.accountId) return null;
  if (r.submittedByUserId === user.id || r.requestedForUserId === user.id) return "requester";
  try {
    const ctx = await personContext(deps, r.accountId, r.requestedForUserId, r.site?.id ?? null);
    if (ctx.unitLeader?.leaderUserId === user.id) return "leader";
    if (ctx.unitLeader?.backupUserId === user.id) return "backup_leader";
  } catch {
    /* directory unavailable: fall through to the IT contact check */
  }
  return isItContact(deps.findUser(user.id)) ? "it_contact" : null;
}

export function holdOf(r: Pick<StoredServiceRequest, "payload">): ServiceRequestHold | null {
  const h = (r.payload as Record<string, unknown>).hold as ServiceRequestHold | undefined;
  return h && typeof h === "object" ? h : null;
}

type Actor = { userId: string | null; name: string; role: ActorRole | "staff" | "hub" | "system" };

export async function placeHold(
  deps: ServiceRequestRouteDeps,
  r: StoredServiceRequest,
  input: { until: string; reason: string },
  by: Actor,
  at: Date,
): Promise<StoredServiceRequest | null> {
  const hold: ServiceRequestHold = { until: input.until, reason: input.reason, resumeStatus: r.status, by, at: at.toISOString() };
  const updated = await updateServiceRequest(r.id, r.revision, {
    status: HOLD_STATUS,
    payload: { ...r.payload, hold },
    statusHistory: [
      ...r.statusHistory,
      historyEvent(HOLD_STATUS, `${by.name} (${ACTOR_ROLE_LABELS[by.role]})`, at, `Until ${input.until}${input.reason ? `: ${input.reason}` : ""}`),
    ],
  });
  if (updated) await syncToHub(deps, updated);
  return updated;
}

export async function resumeHold(deps: ServiceRequestRouteDeps, r: StoredServiceRequest, by: Actor, at: Date, note?: string | null): Promise<StoredServiceRequest | null> {
  const hold = holdOf(r);
  if (r.status !== HOLD_STATUS || !hold) return null;
  const payload = { ...r.payload, lastHold: { ...hold, endedAt: at.toISOString(), endedBy: by } } as Record<string, unknown>;
  delete payload.hold;
  const updated = await updateServiceRequest(r.id, r.revision, {
    status: hold.resumeStatus,
    payload,
    statusHistory: [
      ...r.statusHistory,
      historyEvent(hold.resumeStatus, `${by.name} (${ACTOR_ROLE_LABELS[by.role]})`, at, note || (by.role === "system" ? `Hold ended (${hold.until})` : "Hold lifted")),
    ],
  });
  if (updated) await syncToHub(deps, updated);
  return updated;
}

/** Resume a hold whose end date has come. Returns the current request either way. */
export async function resumeIfDue(deps: ServiceRequestRouteDeps, r: StoredServiceRequest, at: Date): Promise<StoredServiceRequest> {
  const hold = holdOf(r);
  if (r.status !== HOLD_STATUS || !hold || hold.until > todayIso(at)) return r;
  return (await resumeHold(deps, r, { userId: null, name: "Automatic", role: "system" }, at)) ?? (await getServiceRequest(r.id)) ?? r;
}

/** Resume due holds across all companies every few minutes. Returns a stop function. */
export function startHoldSweeper(deps: ServiceRequestRouteDeps, everyMs = 10 * 60_000): () => void {
  const tick = async () => {
    try {
      const at = (deps.now ?? (() => new Date()))();
      for (const r of (await listServiceRequestsForAdmin(null)).filter((x) => x.status === HOLD_STATUS)) await resumeIfDue(deps, r, at);
    } catch (error) {
      console.warn("[service-requests] hold sweep failed:", error instanceof Error ? error.message : error);
    }
  };
  const timer = setInterval(() => void tick(), everyMs);
  (timer as { unref?: () => void }).unref?.();
  void tick();
  return () => clearInterval(timer);
}

const humanize = (k: string) => k.replace(/([A-Z])/g, " $1").toLowerCase();

/** Field names that differ between two payloads (routing and server snapshots ignored). */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const skip = new Set(["contactPlan", "approvalFlow", "hold", "lastHold", "asset"]);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => !skip.has(k) && JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)).map(humanize);
}

/**
 * Apply a staff or Hub status change. Same status twice is a no-op (a Hub
 * retry), anything outside the transition table is 409.
 */
export async function applyStaffStatus(
  deps: ServiceRequestRouteDeps,
  id: string,
  input: { status: unknown; note?: unknown; revision?: unknown; holdUntil?: unknown },
  by: "staff" | "hub",
): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await getServiceRequest(id);
  if (!r) return { status: 404, body: { error: "Request not found" } };
  if (r.status === BASKET_STATUS) return { status: 409, body: { error: "This request has not been submitted" } };
  const next = String(input.status ?? "") as ServiceRequestStatus;
  if (!(next in STATUS_LABELS)) return { status: 400, body: { error: "Unknown status" } };
  if (input.revision !== undefined && Number(input.revision) !== r.revision) {
    return { status: 409, body: { error: "This request changed since you loaded it", revision: r.revision } };
  }
  if (next === r.status) return { status: 200, body: { success: true, unchanged: true, request: await toRecord(deps, r) } };
  const at = (deps.now ?? (() => new Date()))();
  const actor: Actor = { userId: null, name: by === "hub" ? "Digerati Experts (Hub)" : "Digerati Experts", role: by };
  if (next === HOLD_STATUS) {
    if (!canHold(r.status)) return { status: 409, body: { error: `A request that is ${STATUS_LABELS[r.status].toLowerCase()} can't be put on hold` } };
    const bad = checkHoldUntil(input.holdUntil, todayIso(at));
    if (bad) return { status: 400, body: { error: bad } };
    const held = await placeHold(deps, r, { until: String(input.holdUntil), reason: typeof input.note === "string" ? input.note.trim().slice(0, 500) : "" }, actor, at);
    if (!held) return { status: 409, body: { error: "This request changed since you loaded it" } };
    return { status: 200, body: { success: true, request: await toRecord(deps, held) } };
  }
  if (r.status === HOLD_STATUS && next === holdOf(r)?.resumeStatus) {
    const resumed = await resumeHold(deps, r, actor, at, typeof input.note === "string" ? input.note.trim().slice(0, 1000) : null);
    if (!resumed) return { status: 409, body: { error: "This request changed since you loaded it" } };
    return { status: 200, body: { success: true, request: await toRecord(deps, resumed) } };
  }
  if (!allowedStaffTransitions(r.type, r.status).includes(next)) {
    return { status: 409, body: { error: `Cannot move from ${STATUS_LABELS[r.status]} to ${STATUS_LABELS[next]}` } };
  }
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 1000) : null;
  const now = (deps.now ?? (() => new Date()))();
  const updated = await updateServiceRequest(r.id, r.revision, {
    status: next,
    statusHistory: [...r.statusHistory, historyEvent(next, by, now, note)],
  });
  if (!updated) return { status: 409, body: { error: "This request changed since you loaded it" } };
  await syncToHub(deps, updated);
  return { status: 200, body: { success: true, request: await toRecord(deps, (await getServiceRequest(id)) ?? updated) } };
}

// ---------- routes ----------

export function registerServiceRequestRoutes(app: Express, deps: ServiceRequestRouteDeps): void {
  const now = () => (deps.now ?? (() => new Date()))();
  const { guards } = deps;

  const requireCompany = (req: AuthedRequest, res: Response): string | null => {
    const clientId = effectiveClientId(req.user);
    if (!clientId || !deps.getClient(clientId)) {
      res.status(400).json({
        error:
          req.user?.role === "admin"
            ? "Open a company (impersonate) before filing a request for it."
            : "Your account is not linked to a company yet.",
      });
      return null;
    }
    return clientId;
  };

  // Form context: company name (for the "not a [company] location" label),
  // the signed-in user as the default Requested for, and the company's sites.
  app.get(`${SERVICE_REQUESTS_PATH}/context`, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const client = deps.getClient(clientId)!;
    const me = deps.findUser(req.user!.id);
    const sites = await listClientSites(clientId, client as any);
    res.json({
      success: true,
      company: { id: client.id, name: client.companyName },
      me: me && me.clientId === clientId ? { userId: me.id, name: me.fullName, email: me.email } : null,
      sites,
      defaultSiteId: sites.length === 1 ? sites[0].id : null,
    });
  });

  // Self-Service carousel: this company's active announcements first, then the built-in DE slides.
  app.get("/api/portal/self-service/announcements", ...guards, async (req: AuthedRequest, res: Response) => {
    const today = todayIso(now());
    const clientId = effectiveClientId(req.user);
    const company: PortalAnnouncement[] = [];
    if (clientId && deps.getClient(clientId)) {
      for (const r of await listManualRecords(clientId, "announcement")) {
        const slide = announcementFromRecord(r.id, r.data as Record<string, unknown>, today);
        if (slide) company.push(slide);
      }
    }
    res.json({ success: true, announcements: [...company, ...builtInAnnouncements(today)] });
  });

  // Requested for: people in the same company only.
  app.get(`${SERVICE_REQUESTS_PATH}/people`, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const people = deps
      .listClientUsers(clientId)
      .filter((u) => u.clientId === clientId && u.isActive !== false)
      .filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 25)
      .map((u) => ({ userId: u.id, name: u.fullName, email: u.email }));
    res.json({ success: true, people });
  });

  // Return Computer: computers assigned to the Requested for person.
  app.get(`${SERVICE_REQUESTS_PATH}/assets`, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const userId = String(req.query.userId ?? "").trim();
    const target = userId ? deps.findUser(userId) : undefined;
    if (!target || target.clientId !== clientId) return res.status(404).json({ error: "Person not found" });
    res.json({ success: true, assets: await listAssignedAssets(clientId, target.id) });
  });

  app.get(SERVICE_REQUESTS_PATH, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const rows = await listServiceRequestsForUser(clientId, req.user!.id);
    const t = now();
    const visible = await Promise.all(
      rows.filter((r) => r.status !== BASKET_STATUS || r.submittedByUserId === req.user!.id).map((r) => resumeIfDue(deps, r, t)),
    );
    res.json({ success: true, requests: await Promise.all(visible.map((r) => toRecord(deps, r))) });
  });

  app.get(`${SERVICE_REQUESTS_PATH}/basket`, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const rows = (await listServiceRequestsForUser(clientId, req.user!.id)).filter(
      (r) => r.status === BASKET_STATUS && r.submittedByUserId === req.user!.id,
    );
    res.json({ success: true, requests: await Promise.all(rows.map((r) => toRecord(deps, r))) });
  });

  // Order Now (mode "submit") or Add to Cart (mode "basket").
  app.post(SERVICE_REQUESTS_PATH, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const type = req.body?.type;
    if (!isServiceRequestType(type)) return res.status(400).json({ error: "Unknown request type" });
    const mode = req.body?.mode === "basket" ? "basket" : "submit";
    const t = now();
    const checked = validateServiceRequestFields(type, req.body?.fields, todayIso(t));
    if (!checked.data) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: checked.errors });
    const resolved = await resolveSubmission(deps, clientId, type, checked.data);
    if (!resolved.ok) return res.status(resolved.status).json({ error: "Please fix the highlighted fields", fieldErrors: resolved.errors });

    const status: ServiceRequestStatus = mode === "basket" ? BASKET_STATUS : "submitted";
    // Submitted requests are stored as submitted, then routed (which may park them for approval).
    const created = await createServiceRequest({
      type,
      accountId: clientId,
      requestedForUserId: resolved.requestedForUserId,
      submittedByUserId: req.user!.id,
      status,
      payload: resolved.payload,
      siteId: resolved.site?.id ?? null,
      site: resolved.site,
      customAddress:
        "addressNotClientLocation" in checked.data && checked.data.addressNotClientLocation ? checked.data.customAddress ?? null : null,
      statusHistory: mode === "basket" ? [historyEvent(status, "requester", t)] : [],
      submittedAt: mode === "submit" ? t.toISOString() : null,
    });
    const final = mode === "submit" ? await submitThroughStructure(deps, created, t) : created;
    res.status(201).json({ success: true, request: await toRecord(deps, final) });
  });

  // Submit everything in the signed-in user's basket together.
  app.post(`${SERVICE_REQUESTS_PATH}/basket/submit`, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const t = now();
    const today = todayIso(t);
    const items = (await listServiceRequestsForUser(clientId, req.user!.id)).filter(
      (r) => r.status === BASKET_STATUS && r.submittedByUserId === req.user!.id,
    );
    if (!items.length) return res.status(400).json({ error: "Your request basket is empty" });

    // Dates may have gone stale while an item sat in the basket: re-check every
    // item first and submit none if any fails, so the basket stays whole.
    const stale: Array<{ id: string; number: string; fieldErrors: Record<string, string> }> = [];
    for (const r of items) {
      const fields = { ...r.payload, customAddress: r.customAddress };
      const checked = validateServiceRequestFields(r.type, fields, today);
      if (!checked.data) stale.push({ id: r.id, number: r.number, fieldErrors: checked.errors });
    }
    if (stale.length) {
      return res.status(400).json({ error: "Some requests in your basket need updating before they can be submitted", stale });
    }

    const submitted: ServiceRequestRecord[] = [];
    for (const r of items) {
      submitted.push(await toRecord(deps, await submitThroughStructure(deps, r, t)));
    }
    res.json({ success: true, requests: submitted });
  });

  // Requests waiting for me to approve (site / department leader, backup, manager, IT contact),
  // and the ones I decided recently. A DE admin sees the open company's queue.
  app.get(`${SERVICE_REQUESTS_PATH}/approvals`, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const me = req.user!.id;
    const isAdmin = req.user!.role === "admin";
    const rows = (await listServiceRequestsForAdmin(clientId)).filter((r) => r.accountId === clientId);
    const pending = rows.filter((r) => r.status === APPROVAL_STATUS && (isAdmin || isApproverOf(me, r)));
    const decided = rows
      .filter((r) => {
        const f = approvalFlowOf(r);
        return Boolean(f?.required && f.decidedBy && f.decidedBy.userId === me && f.decidedBy.role !== "requester");
      })
      .slice(0, 20);
    res.json({
      success: true,
      pending: await Promise.all(pending.map((r) => toRecord(deps, r))),
      decided: await Promise.all(decided.map((r) => toRecord(deps, r))),
    });
  });

  // Approve or reject. Only a listed approver in the same company, or a DE admin.
  app.post(`${SERVICE_REQUESTS_PATH}/:id/approval`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    if (!r || !canView(req.user!, r)) return res.status(404).json({ error: "Request not found" });
    const flow = approvalFlowOf(r);
    const isAdmin = req.user!.role === "admin";
    if (r.status !== APPROVAL_STATUS || !flow?.required || flow.state !== "pending") {
      return res.status(409).json({ error: "This request is not waiting for approval" });
    }
    const approver = flow.approvers.find((a) => a.userId === req.user!.id);
    if (!approver && !isAdmin) return res.status(403).json({ error: "You are not an approver for this request" });
    const decision = req.body?.decision;
    if (decision !== "approve" && decision !== "reject") return res.status(400).json({ error: "Choose approve or reject" });
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";
    if (decision === "reject" && !note) return res.status(400).json({ error: "Say why, so the requester knows what to change" });

    const t = now();
    const decider = approver
      ? { userId: approver.userId, name: approver.name, email: approver.email, role: approver.role }
      : { ...person(deps, req.user!.id), role: "de_admin" as const };
    const nextFlow: ApprovalFlow = { ...flow, state: decision === "approve" ? "approved" : "rejected", decidedBy: decider, decidedAt: t.toISOString(), note: note || null };
    const status: ServiceRequestStatus = decision === "approve" ? "submitted" : "rejected";
    const by = `${decider.name} (${APPROVER_ROLE_LABELS[decider.role]})`;
    const updated = await updateServiceRequest(r.id, r.revision, {
      status,
      payload: { ...r.payload, approvalFlow: nextFlow },
      statusHistory: [...r.statusHistory, historyEvent(status, by, t, decision === "approve" ? note || "Approved" : note)],
    });
    if (!updated) return res.status(409).json({ error: "This request changed; reload and try again" });
    const final = decision === "approve" ? await afterSubmit(deps, updated) : (await syncToHub(deps, updated), updated);
    res.json({ success: true, request: await toRecord(deps, (await getServiceRequest(final.id)) ?? final) });
  });

  // My team's requests: people in the sites / departments I lead (or back up), or the
  // whole company for the IT contact. Leaders hold, amend or cancel on their behalf.
  app.get(`${SERVICE_REQUESTS_PATH}/team`, ...guards, async (req: AuthedRequest, res: Response) => {
    const clientId = requireCompany(req, res);
    if (!clientId) return;
    const rows = (await listServiceRequestsForAdmin(clientId)).filter((r) => r.accountId === clientId && r.status !== BASKET_STATUS);
    const out: StoredServiceRequest[] = [];
    for (const r of rows) {
      const role = await actorRole(deps, req.user!, r);
      if (role && role !== "requester") out.push(r);
    }
    res.json({ success: true, requests: await Promise.all(out.map((r) => toRecord(deps, r))) });
  });

  // Put on hold until a date; it resumes on that date (or when someone resumes it).
  app.post(`${SERVICE_REQUESTS_PATH}/:id/hold`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    const role = r ? await actorRole(deps, req.user!, r) : null;
    if (!r || !role) return res.status(404).json({ error: "Request not found" });
    if (!canHold(r.status)) return res.status(409).json({ error: `A request that is ${STATUS_LABELS[r.status].toLowerCase()} can't be put on hold` });
    const t = now();
    const bad = checkHoldUntil(req.body?.until, todayIso(t));
    if (bad) return res.status(400).json({ error: bad, fieldErrors: { until: bad } });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    if (!reason) return res.status(400).json({ error: "Say why it's on hold", fieldErrors: { reason: "Say why it's on hold" } });
    const held = await placeHold(deps, r, { until: String(req.body?.until), reason }, { ...person(deps, req.user!.id), role }, t);
    if (!held) return res.status(409).json({ error: "This request changed; reload and try again" });
    res.json({ success: true, request: await toRecord(deps, held) });
  });

  app.post(`${SERVICE_REQUESTS_PATH}/:id/resume`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    const role = r ? await actorRole(deps, req.user!, r) : null;
    if (!r || !role) return res.status(404).json({ error: "Request not found" });
    if (r.status !== HOLD_STATUS) return res.status(409).json({ error: "This request is not on hold" });
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : null;
    const resumed = await resumeHold(deps, r, { ...person(deps, req.user!.id), role }, now(), note);
    if (!resumed) return res.status(409).json({ error: "This request changed; reload and try again" });
    res.json({ success: true, request: await toRecord(deps, resumed) });
  });

  // Amend: change the details until the work is under way. A change that needs approval
  // again (made by someone who can't approve it) goes back to the approver.
  app.patch(`${SERVICE_REQUESTS_PATH}/:id`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    const role = r ? await actorRole(deps, req.user!, r) : null;
    if (!r || !role) return res.status(404).json({ error: "Request not found" });
    if (!AMENDABLE_STATUSES.includes(r.status)) {
      return res.status(409).json({ error: `A request that is ${STATUS_LABELS[r.status].toLowerCase()} can no longer be amended. Contact the team, or cancel it.` });
    }
    if (req.body?.revision !== undefined && Number(req.body.revision) !== r.revision) {
      return res.status(409).json({ error: "This request changed since you opened it; reload and try again" });
    }
    const t = now();
    const checked = validateServiceRequestFields(r.type, req.body?.fields, todayIso(t));
    if (!checked.data) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: checked.errors });
    const resolved = await resolveSubmission(deps, r.accountId, r.type, checked.data);
    if (!resolved.ok) return res.status(resolved.status).json({ error: "Please fix the highlighted fields", fieldErrors: resolved.errors });
    const customAddress = "addressNotClientLocation" in checked.data && checked.data.addressNotClientLocation ? checked.data.customAddress ?? null : null;
    const changed = changedFields(r.payload, resolved.payload);
    if (resolved.requestedForUserId !== r.requestedForUserId) changed.unshift("requested for");
    if (JSON.stringify(customAddress) !== JSON.stringify(r.customAddress ?? null) && !changed.includes("custom address")) changed.push("address");
    if (!changed.length) return res.json({ success: true, unchanged: true, request: await toRecord(deps, r) });

    const routing = await planRequestRouting(deps, {
      clientId: r.accountId,
      type: r.type,
      requestedForUserId: resolved.requestedForUserId,
      submittedByUserId: req.user!.role === "admin" ? r.submittedByUserId : req.user!.id,
      payload: resolved.payload,
      siteId: resolved.site?.id ?? null,
      today: todayIso(t),
      now: t,
    }).catch(() => null);
    const flow = routing?.approvalFlow ?? approvalFlowOf(r) ?? { required: false as const, reason: "Company structure unavailable; DE reviews it" };
    const needsApproval = flow.required && flow.state === "pending" && role !== "de_admin";
    // Waiting for approval and no longer needing it (an approver amended it, or the change removed the need): send it on.
    const status: ServiceRequestStatus = needsApproval ? APPROVAL_STATUS : r.status === APPROVAL_STATUS ? "submitted" : r.status;
    const by = `${person(deps, req.user!.id).name} (${ACTOR_ROLE_LABELS[role]})`;
    const note = `Amended: ${changed.join(", ")}${needsApproval && r.status !== APPROVAL_STATUS ? ". Needs approval again." : ""}${typeof req.body?.note === "string" && req.body.note.trim() ? ` — ${req.body.note.trim().slice(0, 500)}` : ""}`;
    const updated = await updateServiceRequest(r.id, r.revision, {
      status,
      requestedForUserId: resolved.requestedForUserId,
      payload: { ...resolved.payload, ...(routing ? { contactPlan: routing.contactPlan } : {}), approvalFlow: flow },
      siteId: resolved.site?.id ?? null,
      site: resolved.site,
      customAddress,
      statusHistory: [...r.statusHistory, historyEvent(status, by, t, note)],
    });
    if (!updated) return res.status(409).json({ error: "This request changed; reload and try again" });
    if (r.status === APPROVAL_STATUS && status === "submitted") await afterSubmit(deps, updated);
    else await syncToHub(deps, updated);
    if (needsApproval && deps.notify?.approvalNeeded && flow.required) {
      try {
        await deps.notify.approvalNeeded({ ...emailFor(deps, updated), to: flow.approvers });
      } catch {
        /* never fails the amendment */
      }
    }
    res.json({ success: true, request: await toRecord(deps, (await getServiceRequest(r.id)) ?? updated) });
  });

  app.get(`${SERVICE_REQUESTS_PATH}/:id`, ...guards, async (req: AuthedRequest, res: Response) => {
    let r = await getServiceRequest(req.params.id);
    // 404 rather than 403 for another company's request: do not confirm it exists.
    if (!r || (!canView(req.user!, r) && !(r.status !== BASKET_STATUS && (await actorRole(deps, req.user!, r))))) {
      return res.status(404).json({ error: "Request not found" });
    }
    r = await resumeIfDue(deps, r, now());
    if (r.status === BASKET_STATUS && r.submittedByUserId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json({ success: true, request: await toRecord(deps, r) });
  });

  // Requester cancel (also removes a basket item).
  app.post(`${SERVICE_REQUESTS_PATH}/:id/cancel`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    const role = r ? await actorRole(deps, req.user!, r) : null;
    if (!r || !role) return res.status(404).json({ error: "Request not found" });
    if (r.status === BASKET_STATUS && r.submittedByUserId !== req.user!.id) {
      return res.status(404).json({ error: "Request not found" });
    }
    // On hold: cancellable if it was when it was held.
    const effective = r.status === HOLD_STATUS ? holdOf(r)?.resumeStatus ?? r.status : r.status;
    if (!USER_CANCELLABLE.includes(effective)) {
      return res.status(409).json({ error: `A request that is ${STATUS_LABELS[r.status].toLowerCase()} can no longer be cancelled here. Contact the team.` });
    }
    const wasInBasket = r.status === BASKET_STATUS;
    const t = now();
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : null;
    const updated = await updateServiceRequest(r.id, r.revision, {
      status: "cancelled",
      statusHistory: [
        ...r.statusHistory,
        historyEvent("cancelled", role === "requester" ? "requester" : `${person(deps, req.user!.id).name} (${ACTOR_ROLE_LABELS[role]})`, t, note),
      ],
    });
    if (!updated) return res.status(409).json({ error: "This request changed; reload and try again" });
    if (!wasInBasket) await syncToHub(deps, updated);
    res.json({ success: true, request: await toRecord(deps, (await getServiceRequest(r.id)) ?? updated) });
  });

  // Add attachments (raw body, filename in X-Filename). Same file rules as portal tickets.
  app.post(
    `${SERVICE_REQUESTS_PATH}/:id/attachments`,
    ...guards,
    express.raw({ type: "*/*", limit: PORTAL_TICKET_MAX_FILE_BYTES }),
    async (req: AuthedRequest, res: Response) => {
      const r = await getServiceRequest(req.params.id);
      if (!r || !canView(req.user!, r)) return res.status(404).json({ error: "Request not found" });
      if (r.submittedByUserId !== req.user!.id) return res.status(403).json({ error: "Only the requester can add attachments" });
      if (TERMINAL_STATUSES.includes(r.status)) return res.status(409).json({ error: "This request is closed" });
      const rawName = decodeURIComponent(String(req.header("x-filename") || ""));
      const fileName = sanitizePortalTicketFilename(rawName);
      if (!rawName || !isAllowedPortalTicketExtension(fileName)) {
        return res.status(400).json({ error: "Allowed file types: PNG, JPG, PDF, TXT, LOG" });
      }
      const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!data.length) return res.status(400).json({ error: "The file is empty" });
      if (data.length > PORTAL_TICKET_MAX_FILE_BYTES) return res.status(413).json({ error: "Each file must be 10 MB or smaller" });
      const existing = await listServiceRequestAttachments(r.id);
      if (existing.length >= PORTAL_TICKET_MAX_FILES) {
        return res.status(400).json({ error: `Up to ${PORTAL_TICKET_MAX_FILES} attachments per request` });
      }
      const ext = portalTicketFileExtension(fileName);
      const contentType =
        ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "text/plain";
      const attachment = await addServiceRequestAttachment({
        requestId: r.id,
        accountId: r.accountId,
        fileName,
        contentType,
        data,
        uploadedBy: req.user!.id,
      });
      if (r.status !== BASKET_STATUS) {
        // A new attachment is a change the Hub must apply, so it gets a new revision.
        const bumped = (await updateServiceRequest(r.id, r.revision, {})) ?? (await getServiceRequest(r.id)) ?? r;
        await syncToHub(deps, bumped, [...existing, attachment]);
      }
      res.status(201).json({
        success: true,
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt,
        },
      });
    },
  );

  app.get(`${SERVICE_REQUESTS_PATH}/:id/attachments/:attachmentId`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    if (!r || !canView(req.user!, r)) return res.status(404).json({ error: "Not found" });
    const a = await getServiceRequestAttachment(req.params.attachmentId);
    if (!a || a.requestId !== r.id) return res.status(404).json({ error: "Not found" });
    res.setHeader("Content-Type", a.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${a.fileName.replace(/"/g, "")}"`);
    res.send(a.data);
  });

  // ----- DE staff -----

  app.get(ADMIN_SERVICE_REQUESTS_PATH, ...deps.adminGuards, async (req: Request, res: Response) => {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId.trim() : "";
    const rows = (await listServiceRequestsForAdmin(clientId || null)).filter((r) => r.status !== BASKET_STATUS);
    res.json({ success: true, requests: await Promise.all(rows.map((r) => toRecord(deps, r))) });
  });

  app.post(`${ADMIN_SERVICE_REQUESTS_PATH}/:id/status`, ...deps.adminGuards, async (req: Request, res: Response) => {
    const out = await applyStaffStatus(deps, req.params.id, req.body ?? {}, "staff");
    res.status(out.status).json(out.body);
  });
}

/**
 * Hub → Portal status write-back. The Hub stays a copy: staff changing a
 * status in the Hub call this signed route (hub_to_portal secret) and the
 * Portal applies the same transition rules, then queues the new revision back
 * to the Hub.
 */
export function registerHubServiceRequestStatusRoute(
  app: Express,
  deps: ServiceRequestRouteDeps,
  hubAuth: RequestHandler,
): void {
  app.post(HUB_SERVICE_REQUEST_STATUS_PATH, hubAuth, async (req: Request, res: Response) => {
    const out = await applyStaffStatus(deps, req.params.id, req.body ?? {}, "hub");
    res.status(out.status).json(out.body);
  });
}
