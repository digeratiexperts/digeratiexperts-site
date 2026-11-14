/**
 * Durable portal approval workflow — manager → optional skip-level → IT contact.
 */
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, dbReady, initPromise } from "./db";
import {
  portalApprovalRequests,
  portalApprovalSteps,
} from "@shared/schema";
import {
  ensureOrgSchema,
  findCompanyItContact,
  findDeptItContact,
  findUserById,
  needsSkipLevel,
  type OrgUserFields,
} from "./portalOrg";
import { randomBytes } from "crypto";

export type ApprovalPriority = "low" | "medium" | "high" | "critical";
type ApprovalRequestRow = typeof portalApprovalRequests.$inferSelect;
type ApprovalStepRow = typeof portalApprovalSteps.$inferSelect;

export type CreateApprovalInput = {
  clientId: string;
  requester: OrgUserFields;
  type: string;
  title: string;
  description: string;
  priority?: ApprovalPriority;
  amountCents?: number | null;
  payload?: Record<string, unknown>;
};

function requestNumber(): string {
  return `APR-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function initPortalApprovals(): Promise<void> {
  await initPromise;
  await ensureOrgSchema();
}

async function buildSteps(requester: OrgUserFields, clientId: string, priority?: string, amountCents?: number | null) {
  const steps: Array<{
    stepOrder: number;
    stepType: "manager" | "skip_level" | "dept_it" | "company_it";
    approverUserId: string | null;
  }> = [];
  let order = 1;
  let noManagerAssigned = false;

  const managerId = requester.managerUserId || null;
  const manager = managerId ? findUserById(managerId) : null;

  if (manager && manager.clientId === clientId && manager.id !== requester.id) {
    steps.push({ stepOrder: order++, stepType: "manager", approverUserId: manager.id });
    if (needsSkipLevel(priority, amountCents)) {
      const skip = manager.managerUserId ? findUserById(manager.managerUserId) : null;
      if (
        skip &&
        skip.clientId === clientId &&
        skip.id !== requester.id &&
        skip.id !== manager.id
      ) {
        steps.push({ stepOrder: order++, stepType: "skip_level", approverUserId: skip.id });
      }
    }
  } else {
    noManagerAssigned = true;
  }

  const deptIt = await findDeptItContact(clientId, requester.departmentId);
  if (deptIt && deptIt.id !== requester.id) {
    steps.push({ stepOrder: order++, stepType: "dept_it", approverUserId: deptIt.id });
  }

  const companyIt = await findCompanyItContact(clientId);
  if (companyIt && companyIt.id !== requester.id) {
    const already = steps.some((s) => s.approverUserId === companyIt.id);
    if (!already) {
      steps.push({ stepOrder: order++, stepType: "company_it", approverUserId: companyIt.id });
    }
  } else if (noManagerAssigned && steps.length === 0 && companyIt) {
    steps.push({ stepOrder: order++, stepType: "company_it", approverUserId: companyIt.id });
  }

  if (steps.length === 0 && companyIt) {
    steps.push({ stepOrder: 1, stepType: "company_it", approverUserId: companyIt.id });
    noManagerAssigned = true;
  }

  return { steps, noManagerAssigned };
}

export async function createApprovalRequest(input: CreateApprovalInput) {
  if (!dbReady || !db) throw new Error("Database unavailable");
  await ensureOrgSchema();

  const { steps, noManagerAssigned } = await buildSteps(
    input.requester,
    input.clientId,
    input.priority,
    input.amountCents,
  );
  if (steps.length === 0) {
    throw new Error("No approvers available. Ask your Company IT Contact to assign managers.");
  }

  const [request] = await db
    .insert(portalApprovalRequests)
    .values({
      requestNumber: requestNumber(),
      clientId: input.clientId,
      requesterUserId: input.requester.id,
      type: input.type,
      title: input.title,
      description: input.description,
      priority: input.priority || "medium",
      amountCents: input.amountCents ?? null,
      status: "pending",
      payload: input.payload || {},
      noManagerAssigned,
    })
    .returning();

  const insertedSteps = await db
    .insert(portalApprovalSteps)
    .values(
      steps.map((s) => ({
        requestId: request.id,
        stepOrder: s.stepOrder,
        stepType: s.stepType,
        approverUserId: s.approverUserId,
        status: "pending" as const,
      })),
    )
    .returning();

  return { request, steps: insertedSteps };
}

export async function getApprovalWithSteps(
  id: string,
): Promise<{ request: ApprovalRequestRow; steps: ApprovalStepRow[] } | null> {
  if (!dbReady || !db) return null;
  await ensureOrgSchema();
  const [request] = await db
    .select()
    .from(portalApprovalRequests)
    .where(eq(portalApprovalRequests.id, id))
    .limit(1);
  if (!request) return null;
  const steps: ApprovalStepRow[] = await db
    .select()
    .from(portalApprovalSteps)
    .where(eq(portalApprovalSteps.requestId, id))
    .orderBy(portalApprovalSteps.stepOrder);
  return { request, steps };
}

export async function listApprovalsForUser(user: OrgUserFields, scope: "mine" | "team" | "company" = "mine") {
  if (!dbReady || !db || !user.clientId) return [];
  await ensureOrgSchema();
  const { listClientUsers } = await import("./portalOrg");

  const map = new Map<string, ApprovalRequestRow>();

  const addRows = (rows: ApprovalRequestRow[]) => {
    for (const r of rows) map.set(r.id, r);
  };

  // Always include own submissions
  addRows(
    await db
      .select()
      .from(portalApprovalRequests)
      .where(
        and(
          eq(portalApprovalRequests.clientId, user.clientId),
          eq(portalApprovalRequests.requesterUserId, user.id),
        ),
      )
      .limit(50),
  );

  // Pending (or historical) steps assigned to me
  const mySteps: ApprovalStepRow[] = await db
    .select()
    .from(portalApprovalSteps)
    .where(eq(portalApprovalSteps.approverUserId, user.id));
  const myReqIds: string[] = Array.from(new Set(mySteps.map((s: ApprovalStepRow) => s.requestId)));
  if (myReqIds.length) {
    addRows(
      await db
        .select()
        .from(portalApprovalRequests)
        .where(
          and(
            eq(portalApprovalRequests.clientId, user.clientId),
            inArray(portalApprovalRequests.id, myReqIds),
          ),
        ),
    );
  }

  if (scope === "team" || scope === "company") {
    const reports = listClientUsers(user.clientId)
      .filter((u) => u.managerUserId === user.id)
      .map((u) => u.id);
    if (reports.length) {
      addRows(
        await db
          .select()
          .from(portalApprovalRequests)
          .where(
            and(
              eq(portalApprovalRequests.clientId, user.clientId),
              inArray(portalApprovalRequests.requesterUserId, reports),
            ),
          )
          .limit(100),
      );
    }
  }

  if (
    scope === "company" ||
    user.role === "admin" ||
    user.orgRole === "company_it_contact" ||
    user.isCompanyItContact
  ) {
    addRows(
      await db
        .select()
        .from(portalApprovalRequests)
        .where(eq(portalApprovalRequests.clientId, user.clientId))
        .orderBy(desc(portalApprovalRequests.createdAt))
        .limit(100),
    );
  }

  const requests = Array.from(map.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const enriched = [];
  for (const request of requests) {
    const steps = await db
      .select()
      .from(portalApprovalSteps)
      .where(eq(portalApprovalSteps.requestId, request.id))
      .orderBy(portalApprovalSteps.stepOrder);
    const requester = findUserById(request.requesterUserId);
    enriched.push({
      ...request,
      requesterName: requester?.fullName || request.requesterUserId,
      steps: (steps as ApprovalStepRow[]).map((s: ApprovalStepRow) => {
        const candidate = s.approverUserId ? findUserById(s.approverUserId) : null;
        const approver = candidate?.clientId === user.clientId ? candidate : null;
        return {
          ...s,
          approverName: approver?.fullName || s.approverUserId,
        };
      }),
    });
  }
  return enriched;
}

export type ActResult = {
  request: ApprovalRequestRow;
  steps: ApprovalStepRow[];
  finalized: boolean;
  rejected: boolean;
};

export async function actOnApproval(opts: {
  requestId: string;
  actor: OrgUserFields;
  action: "approve" | "reject" | "request-info";
  note?: string;
}): Promise<ActResult> {
  if (!dbReady || !db) throw new Error("Database unavailable");
  await ensureOrgSchema();

  const bundle = await getApprovalWithSteps(opts.requestId);
  if (!bundle) throw new Error("Approval request not found");
  const { request, steps } = bundle;

  if (request.clientId !== opts.actor.clientId && opts.actor.role !== "admin") {
    throw new Error("Forbidden");
  }
  if (request.status !== "pending" && request.status !== "info_requested") {
    throw new Error("Request is no longer actionable");
  }

  const current = (steps as ApprovalStepRow[]).find((s: ApprovalStepRow) => s.status === "pending");
  if (!current) throw new Error("No pending approval step");

  const isAssignee = current.approverUserId === opts.actor.id;
  const isCompanyIt =
    opts.actor.isCompanyItContact || opts.actor.orgRole === "company_it_contact" || opts.actor.role === "admin";
  if (!isAssignee && !isCompanyIt) {
    throw new Error("You are not the current approver for this request");
  }

  const newStepStatus =
    opts.action === "approve" ? "approved" : opts.action === "reject" ? "rejected" : "info_requested";

  await db
    .update(portalApprovalSteps)
    .set({
      status: newStepStatus,
      note: opts.note || null,
      actedAt: new Date(),
    })
    .where(eq(portalApprovalSteps.id, current.id));

  if (opts.action === "reject") {
    const [updated] = await db
      .update(portalApprovalRequests)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(portalApprovalRequests.id, request.id))
      .returning();
    const refreshed = await getApprovalWithSteps(request.id);
    return { request: updated, steps: refreshed!.steps, finalized: true, rejected: true };
  }

  if (opts.action === "request-info") {
    const [updated] = await db
      .update(portalApprovalRequests)
      .set({ status: "info_requested", updatedAt: new Date() })
      .where(eq(portalApprovalRequests.id, request.id))
      .returning();
    const refreshed = await getApprovalWithSteps(request.id);
    return { request: updated, steps: refreshed!.steps, finalized: false, rejected: false };
  }

  // approve — advance or finalize
  const remaining = (steps as ApprovalStepRow[]).filter(
    (s: ApprovalStepRow) => s.id !== current.id && s.status === "pending",
  );
  if (remaining.length === 0) {
    const [updated] = await db
      .update(portalApprovalRequests)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(portalApprovalRequests.id, request.id))
      .returning();
    const refreshed = await getApprovalWithSteps(request.id);
    return { request: updated, steps: refreshed!.steps, finalized: true, rejected: false };
  }

  const [updated] = await db
    .update(portalApprovalRequests)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(portalApprovalRequests.id, request.id))
    .returning();
  const refreshed = await getApprovalWithSteps(request.id);
  return { request: updated, steps: refreshed!.steps, finalized: false, rejected: false };
}

export async function attachFulfillmentTicket(requestId: string, ticketId: string) {
  if (!dbReady || !db) return;
  await db
    .update(portalApprovalRequests)
    .set({ fulfillmentTicketId: ticketId, updatedAt: new Date() })
    .where(eq(portalApprovalRequests.id, requestId));
}
