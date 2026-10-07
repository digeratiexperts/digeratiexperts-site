import { randomUUID } from "crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { storeOrderChangeRequests, storeOrderHolds } from "@shared/schema";
import { isItContact, personContext, type OrgRoutingDeps } from "./orgRouting";
import { checkHoldUntil } from "@shared/serviceRequests";
import {
  HOLDABLE,
  ORDER_ACTOR_LABELS,
  ORDER_HOLD_MAX_DAYS,
  ORDER_TERMINAL,
  UNPAID_CANCELLABLE,
  isHoldActive,
  orderAbilities,
  type OrderActorRole,
  type StoreOrderChangeRequest,
  type StoreOrderHold,
} from "@shared/storeOrderControls";

/**
 * Cancel, amend and hold for Procurement Store orders.
 *
 *   GET  /api/portal/orders/:id/controls          hold, change requests and what I can do
 *   POST /api/portal/orders/:id/cancel            unpaid: cancelled now; paid: a cancellation request to DE
 *   POST /api/portal/orders/:id/change-request    ask DE to amend (optionally holding fulfilment meanwhile)
 *   POST /api/portal/orders/:id/hold              pause fulfilment until a date
 *   POST /api/portal/orders/:id/resume            end the hold now
 *   GET  /api/portal/admin/order-requests         DE: change requests (open by default)
 *   POST /api/portal/admin/order-requests/:id     DE: mark done or declined, with a note
 *
 * Nothing here edits prices, line items or payment: DE applies amendments and
 * refunds through the Store. Fulfilment skips held orders (isStoreOrderHeld).
 * Who may act: the person who ordered, their site / department leader or
 * backup, the company IT contact, or a DE admin; others in the company can
 * see the order but not change it.
 */

const useDb = () => Boolean(dbReady && db);
const memHolds = new Map<string, StoreOrderHold & { clientId: string | null }>();
const memRequests = new Map<string, StoreOrderChangeRequest>();

export function _resetStoreOrderControlsMemory() {
  memHolds.clear();
  memRequests.clear();
}

const todayIso = (d: Date) => d.toISOString().slice(0, 10);

// ---------- store ----------

export async function getOrderHold(orderId: string): Promise<StoreOrderHold | null> {
  if (useDb()) {
    const [row] = await db.select().from(storeOrderHolds).where(eq(storeOrderHolds.orderId, orderId)).limit(1);
    return row
      ? {
          orderId: row.orderId,
          until: String(row.heldUntil).slice(0, 10),
          reason: row.reason,
          by: { userId: row.heldByUserId ?? null, name: row.heldByName, role: row.heldByRole as OrderActorRole },
          at: new Date(row.createdAt).toISOString(),
        }
      : null;
  }
  const h = memHolds.get(orderId);
  return h ? { orderId: h.orderId, until: h.until, reason: h.reason, by: h.by, at: h.at } : null;
}

/** Fulfilment asks this before claiming a paid order. A past hold no longer counts. */
export async function isStoreOrderHeld(orderId: string, now = new Date()): Promise<boolean> {
  try {
    return isHoldActive(await getOrderHold(orderId), todayIso(now));
  } catch (error: any) {
    // A missing table must not stop fulfilment; log and carry on.
    console.warn("[store-order-controls] hold check failed:", error?.message || error);
    return false;
  }
}

async function setOrderHold(hold: StoreOrderHold, clientId: string | null): Promise<void> {
  if (useDb()) {
    const values = {
      orderId: hold.orderId,
      clientId,
      heldUntil: hold.until,
      reason: hold.reason,
      heldByUserId: hold.by.userId,
      heldByName: hold.by.name,
      heldByRole: hold.by.role,
      createdAt: new Date(hold.at),
    };
    await db.insert(storeOrderHolds).values(values).onConflictDoUpdate({ target: storeOrderHolds.orderId, set: values });
    return;
  }
  memHolds.set(hold.orderId, { ...hold, clientId });
}

async function clearOrderHold(orderId: string): Promise<void> {
  if (useDb()) {
    await db.delete(storeOrderHolds).where(eq(storeOrderHolds.orderId, orderId));
    return;
  }
  memHolds.delete(orderId);
}

function toRequest(r: any): StoreOrderChangeRequest {
  return {
    id: r.id,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    clientId: r.clientId ?? null,
    kind: r.kind,
    details: r.details,
    status: r.status,
    requestedBy: { userId: r.requestedByUserId ?? null, name: r.requestedByName, role: r.requestedByRole },
    createdAt: new Date(r.createdAt).toISOString(),
    resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
    resolvedByName: r.resolvedByName ?? null,
    resolutionNote: r.resolutionNote ?? null,
  };
}

export async function listChangeRequests(filter: { orderId?: string; status?: string }): Promise<StoreOrderChangeRequest[]> {
  if (useDb()) {
    const where =
      filter.orderId && filter.status
        ? sql`${storeOrderChangeRequests.orderId} = ${filter.orderId} AND ${storeOrderChangeRequests.status} = ${filter.status}`
        : filter.orderId
          ? eq(storeOrderChangeRequests.orderId, filter.orderId)
          : filter.status
            ? eq(storeOrderChangeRequests.status, filter.status)
            : undefined;
    const q = db.select().from(storeOrderChangeRequests);
    return (await (where ? q.where(where) : q).orderBy(desc(storeOrderChangeRequests.createdAt))).map(toRequest);
  }
  return [...memRequests.values()]
    .filter((r) => (!filter.orderId || r.orderId === filter.orderId) && (!filter.status || r.status === filter.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r }));
}

async function createChangeRequest(input: Omit<StoreOrderChangeRequest, "id" | "status" | "createdAt" | "resolvedAt" | "resolvedByName" | "resolutionNote">): Promise<StoreOrderChangeRequest> {
  if (useDb()) {
    const [row] = await db
      .insert(storeOrderChangeRequests)
      .values({
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        clientId: input.clientId,
        kind: input.kind,
        details: input.details,
        requestedByUserId: input.requestedBy.userId,
        requestedByName: input.requestedBy.name,
        requestedByRole: input.requestedBy.role,
      })
      .returning();
    return toRequest(row);
  }
  const rec: StoreOrderChangeRequest = {
    ...input,
    id: randomUUID(),
    status: "open",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedByName: null,
    resolutionNote: null,
  };
  memRequests.set(rec.id, rec);
  return { ...rec };
}

async function resolveChangeRequest(id: string, status: "done" | "declined", by: string, note: string): Promise<StoreOrderChangeRequest | null> {
  if (useDb()) {
    const [row] = await db
      .update(storeOrderChangeRequests)
      .set({ status, resolvedAt: new Date(), resolvedByName: by, resolutionNote: note || null })
      .where(sql`${storeOrderChangeRequests.id} = ${id} AND ${storeOrderChangeRequests.status} = 'open'`)
      .returning();
    return row ? toRequest(row) : null;
  }
  const r = memRequests.get(id);
  if (!r || r.status !== "open") return null;
  Object.assign(r, { status, resolvedAt: new Date().toISOString(), resolvedByName: by, resolutionNote: note || null });
  return { ...r };
}

// ---------- routes ----------

export type StoreOrderLike = { id: string; orderNumber: string; status: string | null; userId: string | null; clientId: string | null };

type AuthedRequest = Request & { user?: { id: string; role?: string | null; clientId?: string | null; fullName?: string | null } };

export type StoreOrderControlsDeps = OrgRoutingDeps & {
  guards: RequestHandler[];
  adminGuards: RequestHandler[];
  getOrder: (id: string) => Promise<StoreOrderLike | undefined>;
  /** Set an unpaid order to cancelled; false if it was no longer unpaid (or storage can't). */
  cancelUnpaidOrder: (id: string, reason: string) => Promise<boolean>;
  /** Tell DE about a new change request. Optional; must not throw. */
  notifyDe?: (r: StoreOrderChangeRequest) => Promise<unknown>;
  now?: () => Date;
};

export function registerStoreOrderControlRoutes(app: Express, deps: StoreOrderControlsDeps): void {
  const now = () => (deps.now ?? (() => new Date()))();

  const canSee = (user: AuthedRequest["user"], o: StoreOrderLike) =>
    Boolean(user) && (user!.role === "admin" || (o.userId && o.userId === user!.id) || (o.clientId && o.clientId === user!.clientId));

  async function roleFor(user: AuthedRequest["user"], o: StoreOrderLike): Promise<OrderActorRole | null> {
    if (!user) return null;
    if (user.role === "admin") return "de_admin";
    if (o.userId && o.userId === user.id) return "orderer";
    if (!o.clientId || o.clientId !== user.clientId) return null;
    if (o.userId) {
      try {
        const ctx = await personContext(deps, o.clientId, o.userId);
        if (ctx.unitLeader?.leaderUserId === user.id) return "leader";
        if (ctx.unitLeader?.backupUserId === user.id) return "backup_leader";
      } catch {
        /* directory unavailable */
      }
    }
    return isItContact(deps.findUser(user.id)) ? "it_contact" : null;
  }

  const actor = (user: NonNullable<AuthedRequest["user"]>, role: OrderActorRole) => ({
    userId: user.id,
    name: deps.findUser(user.id)?.fullName || user.fullName || ORDER_ACTOR_LABELS[role],
    role,
  });

  /** Loads the order and checks the caller may see it (404) and act on it (403). */
  async function load(req: AuthedRequest, res: Response, act: boolean): Promise<{ order: StoreOrderLike; role: OrderActorRole | null } | null> {
    const order = await deps.getOrder(req.params.id);
    if (!order || !canSee(req.user, order)) {
      res.status(404).json({ error: "Order not found" });
      return null;
    }
    const role = await roleFor(req.user, order);
    if (act && !role) {
      res.status(403).json({ error: "Only the person who ordered, their leader, your IT contact or DE can change this order" });
      return null;
    }
    return { order, role };
  }

  async function controls(order: StoreOrderLike, role: OrderActorRole | null) {
    const hold = await getOrderHold(order.id);
    const active = isHoldActive(hold, todayIso(now()));
    const requests = await listChangeRequests({ orderId: order.id });
    const openCancel = requests.some((r) => r.kind === "cancel" && r.status === "open");
    const can = orderAbilities(String(order.status ?? "pending"), active, openCancel);
    return {
      status: order.status,
      hold: active ? hold : null,
      changeRequests: requests,
      canAct: Boolean(role),
      can: role ? can : { ...can, cancelNow: false, requestCancel: false, requestAmend: false, hold: false, resume: false },
      holdMaxDays: ORDER_HOLD_MAX_DAYS,
    };
  }

  async function newRequest(order: StoreOrderLike, kind: "cancel" | "amend", details: string, by: ReturnType<typeof actor>) {
    const r = await createChangeRequest({ orderId: order.id, orderNumber: order.orderNumber, clientId: order.clientId, kind, details, requestedBy: by });
    if (deps.notifyDe) {
      try {
        await deps.notifyDe(r);
      } catch {
        /* never fails the request */
      }
    }
    return r;
  }

  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  app.get("/api/portal/orders/:id/controls", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const got = await load(req, res, false);
    if (!got) return;
    res.json({ success: true, ...(await controls(got.order, got.role)) });
  });

  app.post("/api/portal/orders/:id/cancel", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const got = await load(req, res, true);
    if (!got) return;
    const { order } = got;
    const status = String(order.status ?? "pending");
    const reason = text(req.body?.reason, 1000);
    if (!reason) return res.status(400).json({ error: "Say why you're cancelling", fieldErrors: { reason: "Say why you're cancelling" } });
    if ((ORDER_TERMINAL as readonly string[]).includes(status)) return res.status(409).json({ error: "This order is already closed" });
    const by = actor(req.user!, got.role!);
    if ((UNPAID_CANCELLABLE as readonly string[]).includes(status) && (await deps.cancelUnpaidOrder(order.id, `${by.name}: ${reason}`))) {
      await clearOrderHold(order.id);
      return res.json({ success: true, cancelled: true, ...(await controls({ ...order, status: "cancelled" }, got.role)) });
    }
    const existing = (await listChangeRequests({ orderId: order.id, status: "open" })).find((r) => r.kind === "cancel");
    if (existing) return res.status(409).json({ error: "A cancellation request is already with DE" });
    const request = await newRequest(order, "cancel", reason, by);
    res.status(201).json({ success: true, cancelled: false, request, ...(await controls(order, got.role)) });
  });

  app.post("/api/portal/orders/:id/change-request", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const got = await load(req, res, true);
    if (!got) return;
    const { order } = got;
    if ((ORDER_TERMINAL as readonly string[]).includes(String(order.status))) return res.status(409).json({ error: "This order is already closed" });
    const details = text(req.body?.details, 4000);
    if (!details) return res.status(400).json({ error: "Describe the change", fieldErrors: { details: "Describe the change" } });
    const by = actor(req.user!, got.role!);
    const t = now();
    // Optionally pause fulfilment while DE reviews the change.
    if (req.body?.holdUntil && (HOLDABLE as readonly string[]).includes(String(order.status))) {
      const bad = checkOrderHoldUntil(req.body.holdUntil, todayIso(t));
      if (bad) return res.status(400).json({ error: bad, fieldErrors: { holdUntil: bad } });
      await setOrderHold({ orderId: order.id, until: req.body.holdUntil, reason: `Waiting on a change: ${details.slice(0, 200)}`, by, at: t.toISOString() }, order.clientId);
    }
    const request = await newRequest(order, "amend", details, by);
    res.status(201).json({ success: true, request, ...(await controls(order, got.role)) });
  });

  app.post("/api/portal/orders/:id/hold", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const got = await load(req, res, true);
    if (!got) return;
    const { order } = got;
    const t = now();
    const c = await controls(order, got.role);
    if (!c.can.hold) return res.status(409).json({ error: c.can.note || "This order can't be put on hold now" });
    const bad = checkOrderHoldUntil(req.body?.until, todayIso(t));
    if (bad) return res.status(400).json({ error: bad, fieldErrors: { until: bad } });
    const reason = text(req.body?.reason, 500);
    if (!reason) return res.status(400).json({ error: "Say why it's on hold", fieldErrors: { reason: "Say why it's on hold" } });
    await setOrderHold({ orderId: order.id, until: String(req.body?.until), reason, by: actor(req.user!, got.role!), at: t.toISOString() }, order.clientId);
    res.json({ success: true, ...(await controls(order, got.role)) });
  });

  app.post("/api/portal/orders/:id/resume", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const got = await load(req, res, true);
    if (!got) return;
    if (!isHoldActive(await getOrderHold(got.order.id), todayIso(now()))) return res.status(409).json({ error: "This order is not on hold" });
    await clearOrderHold(got.order.id);
    res.json({ success: true, ...(await controls(got.order, got.role)) });
  });

  app.get("/api/portal/admin/order-requests", ...deps.adminGuards, async (req: Request, res: Response) => {
    const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : req.query.status === "all" ? undefined : "open";
    res.json({ success: true, requests: await listChangeRequests({ status }) });
  });

  app.post("/api/portal/admin/order-requests/:id", ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const decision = req.body?.decision;
    if (decision !== "done" && decision !== "declined") return res.status(400).json({ error: "Mark it done or declined" });
    const note = text(req.body?.note, 1000);
    if (decision === "declined" && !note) return res.status(400).json({ error: "Say why, so the client knows" });
    const by = deps.findUser(req.user!.id)?.fullName || req.user?.fullName || "Digerati Experts";
    const r = await resolveChangeRequest(req.params.id, decision, by, note);
    if (!r) return res.status(404).json({ error: "No open request with that id" });
    res.json({ success: true, request: r });
  });
}

function checkOrderHoldUntil(until: unknown, today: string): string | null {
  const bad = checkHoldUntil(until, today);
  if (bad) return bad.replace(/\d+ days/, `${ORDER_HOLD_MAX_DAYS} days`);
  const d = Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return d > ORDER_HOLD_MAX_DAYS ? `An order can be held for up to ${ORDER_HOLD_MAX_DAYS} days` : null;
}
