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
import { announcementFromRecord, builtInAnnouncements, type PortalAnnouncement } from "@shared/portalAnnouncements";
import {
  BASKET_STATUS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  TYPE_LABELS,
  USER_CANCELLABLE,
  allowedStaffTransitions,
  isServiceRequestType,
  returnReasonLabel,
  todayIso,
  validateServiceRequestFields,
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

export type DirectoryUser = { id: string; clientId: string | null; fullName: string; email: string; isActive?: boolean };
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
  now?: () => Date;
};

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

function canView(user: ServiceRequestUser, r: StoredServiceRequest): boolean {
  if (user.role === "admin") return true;
  if (!user.clientId || user.clientId !== r.accountId) return false;
  return r.submittedByUserId === user.id || r.requestedForUserId === user.id;
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
  if (r.type === "loaner_computer") {
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
  if (client?.hubAccountId) lines.push("", `canonicalAccountId: ${client.hubAccountId}`);
  return lines.join("\n");
}

/** Submit-time side effects: Desk ticket (optional, non-blocking), then the Hub copy. */
async function afterSubmit(deps: ServiceRequestRouteDeps, r: StoredServiceRequest): Promise<StoredServiceRequest> {
  let current = r;
  if (deps.createDeskTicket) {
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
  return (await getServiceRequest(current.id)) ?? current;
}

/**
 * Resolve the validated fields into what is stored: the site snapshot (so a
 * later LID edit does not rewrite history), the asset snapshot, and labels.
 */
async function resolveSubmission(
  deps: ServiceRequestRouteDeps,
  clientId: string,
  type: ServiceRequestType,
  fields: LoanerFields | ReturnFields,
): Promise<
  | { ok: true; payload: Record<string, unknown>; site: ServiceRequestSite | null; requestedForUserId: string }
  | { ok: false; status: number; errors: Record<string, string> }
> {
  const target = deps.findUser(fields.requestedForUserId);
  if (!target || target.clientId !== clientId || target.isActive === false) {
    return { ok: false, status: 400, errors: { requestedForUserId: "Choose a person in your company" } };
  }

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

/**
 * Apply a staff or Hub status change. Same status twice is a no-op (a Hub
 * retry), anything outside the transition table is 409.
 */
export async function applyStaffStatus(
  deps: ServiceRequestRouteDeps,
  id: string,
  input: { status: unknown; note?: unknown; revision?: unknown },
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
    const visible = rows.filter((r) => r.status !== BASKET_STATUS || r.submittedByUserId === req.user!.id);
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
    const created = await createServiceRequest({
      type,
      accountId: clientId,
      requestedForUserId: resolved.requestedForUserId,
      submittedByUserId: req.user!.id,
      status,
      payload: resolved.payload,
      siteId: resolved.site?.id ?? null,
      site: resolved.site,
      customAddress: checked.data.addressNotClientLocation ? checked.data.customAddress ?? null : null,
      statusHistory: [historyEvent(status, "requester", t)],
      submittedAt: mode === "submit" ? t.toISOString() : null,
    });
    const final = mode === "submit" ? await afterSubmit(deps, created) : created;
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
      const updated = await updateServiceRequest(r.id, r.revision, {
        status: "submitted",
        submittedAt: t.toISOString(),
        statusHistory: [...r.statusHistory, historyEvent("submitted", "requester", t)],
      });
      if (!updated) continue;
      submitted.push(await toRecord(deps, await afterSubmit(deps, updated)));
    }
    res.json({ success: true, requests: submitted });
  });

  app.get(`${SERVICE_REQUESTS_PATH}/:id`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    // 404 rather than 403 for another company's request: do not confirm it exists.
    if (!r || !canView(req.user!, r)) return res.status(404).json({ error: "Request not found" });
    if (r.status === BASKET_STATUS && r.submittedByUserId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json({ success: true, request: await toRecord(deps, r) });
  });

  // Requester cancel (also removes a basket item).
  app.post(`${SERVICE_REQUESTS_PATH}/:id/cancel`, ...guards, async (req: AuthedRequest, res: Response) => {
    const r = await getServiceRequest(req.params.id);
    if (!r || !canView(req.user!, r)) return res.status(404).json({ error: "Request not found" });
    if (r.status === BASKET_STATUS && r.submittedByUserId !== req.user!.id) {
      return res.status(404).json({ error: "Request not found" });
    }
    if (r.submittedByUserId !== req.user!.id && r.requestedForUserId !== req.user!.id) {
      return res.status(403).json({ error: "Only the requester can cancel this request" });
    }
    if (!USER_CANCELLABLE.includes(r.status)) {
      return res.status(409).json({ error: `A request that is ${STATUS_LABELS[r.status].toLowerCase()} can no longer be cancelled here. Contact the team.` });
    }
    const wasInBasket = r.status === BASKET_STATUS;
    const t = now();
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : null;
    const updated = await updateServiceRequest(r.id, r.revision, {
      status: "cancelled",
      statusHistory: [...r.statusHistory, historyEvent("cancelled", "requester", t, note)],
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
