/**
 * Crash-safe post-payment order fulfillment.
 *
 * Reliability model:
 * - payment confirmation durably marks an order `paid`
 * - a database compare-and-set gives one worker a claim token
 * - a durable effect ledger survives restarts and records ambiguous provider work
 * - confirmation delivery is reserved before send and never retried automatically;
 *   its unresolved outcome is audited without blocking paid service provisioning
 * - Desk tickets carry a deterministic fulfillment key and are reconciled before creation
 * - Hub delivery uses a deterministic event ID in the existing durable outbox
 * - stale claims return to `paid`; a new token prevents the old worker from completing them
 * - completed/cancelled/refunded orders remain terminal
 */

import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, initPromise, pool } from "../db";
import { storeOrders, syncOutbox, type StoreOrder } from "@shared/schema";
import { notificationService } from "./notificationService";
import { zohoClient } from "../zoho/zohoClient";
import { zohoDeskService } from "../zoho/zohoDesk";
import { ensureDeSyncSchema } from "../integrations/ensureDeSyncSchema";

const ACTIVE_FULFILLMENT_STATUSES = new Set(["provisioning", "processing"]);
const TERMINAL_FULFILLMENT_STATUSES = new Set(["completed", "cancelled", "refunded"]);
const FULFILLED_NOTE_MARKER = "[FULFILLED]";
const STALE_PROVISIONING_MS = 30 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
const RECONCILE_BATCH_SIZE = 25;
const DESK_RECONCILE_PAGE_SIZE = 50;
const DESK_RECONCILE_MAX_PAGES = 100;
const DESK_RECONCILE_CLOCK_SKEW_MS = 5 * 60 * 1000;

let reconciliationTimer: NodeJS.Timeout | null = null;
let fulfillmentSchemaPromise: Promise<void> | null = null;

type LineItem = {
  name?: string;
  sku?: string;
  unitPrice?: number | string;
  price?: number | string;
  quantity?: number | string;
};

export type FulfillmentEffectState = "pending" | "reserved" | "sent" | "failed" | "skipped";
export type DeskTicketEffectState = "pending" | "creating" | "completed" | "failed" | "skipped";
export type ConfirmationOutcome = "sent" | "failed" | "skipped";

export interface FulfillmentState {
  confirmationState: FulfillmentEffectState;
  deskTicketState: DeskTicketEffectState;
  deskTicketId: string | null;
}

export interface FulfillmentClaim {
  order: StoreOrder;
  claimToken: string;
  state: FulfillmentState;
}

export interface FulfillmentPersistence {
  claimPaidOrder(id: string): Promise<FulfillmentClaim | null>;
  loadOrder(id: string): Promise<StoreOrder | null>;
  reserveConfirmationDispatch(id: string, claimToken: string): Promise<boolean>;
  recordConfirmationOutcome(id: string, claimToken: string, outcome: ConfirmationOutcome): Promise<void>;
  markDeskTicketCreating(id: string, claimToken: string): Promise<void>;
  recordDeskTicket(id: string, claimToken: string, ticketId: string | null): Promise<void>;
  recordDeskTicketFailure(id: string, claimToken: string, error: string): Promise<void>;
  completeOrder(id: string, claimToken: string): Promise<boolean>;
  releaseFailedClaim(id: string, claimToken: string, error: string): Promise<void>;
  recoverStaleProvisioningClaims(
    staleCutoff: Date,
  ): Promise<Array<{ id: string; orderNumber: string }>>;
  listPaidOrderIds(limit: number): Promise<string[]>;
}

export interface FulfillmentEffects {
  sendConfirmation(order: StoreOrder): Promise<ConfirmationOutcome>;
  findDeskTicket(order: StoreOrder, idempotencyKey: string): Promise<string | null>;
  createDeskTicket(order: StoreOrder, idempotencyKey: string): Promise<string | null>;
  enqueueHubOrder(order: StoreOrder, idempotencyKey: string): Promise<void>;
}

export interface OrderFulfillmentOrchestrator {
  fulfillPaidOrder(orderId: string | number): Promise<boolean>;
  reconcilePaidOrders(): Promise<{ recovered: number; attempted: number; fulfilled: number }>;
}

function logSecurity(event: string, data: Record<string, unknown>) {
  console.log(`[SECURITY] ${event}`, data);
}

export class FulfillmentEffectError extends Error {
  readonly outcome: "definite_failure" | "ambiguous";

  constructor(outcome: "definite_failure" | "ambiguous", message: string) {
    super(message);
    this.name = "FulfillmentEffectError";
    this.outcome = outcome;
  }
}

export function classifyZohoDeskFailure(error: unknown): "definite_failure" | "ambiguous" {
  const status = Number((error as any)?.response?.status);
  if (
    Number.isInteger(status) &&
    status >= 400 &&
    status < 500 &&
    ![408, 409, 425, 429].includes(status)
  ) {
    return "definite_failure";
  }
  return "ambiguous";
}

export function isFulfillmentTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL_FULFILLMENT_STATUSES.has(status || "");
}

export function isFulfillmentActiveStatus(status: string | null | undefined): boolean {
  return ACTIVE_FULFILLMENT_STATUSES.has(status || "");
}

export function isStaleProvisioning(
  status: string | null | undefined,
  updatedAt: Date | string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (status !== "provisioning" || !updatedAt) return false;
  const updatedMs = new Date(updatedAt).getTime();
  return Number.isFinite(updatedMs) && nowMs - updatedMs >= STALE_PROVISIONING_MS;
}

export function fulfillmentIdempotencyKey(
  orderId: string,
  effect: "confirmation" | "desk-ticket" | "hub-order",
): string {
  return `store-order:${orderId}:${effect}:v1`;
}

/** Produce a stable RFC-4122 UUID for systems whose event contract requires UUIDs. */
export function deterministicFulfillmentEventId(idempotencyKey: string): string {
  // RFC 4122 DNS namespace + a product-specific name yields a standards-valid
  // UUID v5 while remaining stable across processes and deployments.
  const namespace = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
  const bytes = createHash("sha1")
    .update(namespace)
    .update(`digerati-fulfillment:${idempotencyKey}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function alreadyCompleted(order: StoreOrder): boolean {
  if (order.status === "completed") return true;
  return (order.notes || "").includes(FULFILLED_NOTE_MARKER);
}

function parseLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as LineItem[];
}

function formatItemsForEmail(items: LineItem[]) {
  return items.map((item) => ({
    name: item.name || item.sku || "Item",
    price: Number(item.unitPrice ?? item.price ?? 0) || 0,
    quantity: Number(item.quantity ?? 1) || 1,
  }));
}

function buildDeskDescription(
  order: StoreOrder,
  items: LineItem[],
  idempotencyKey: string,
): string {
  const lines = items.map((item) => {
    const qty = Number(item.quantity ?? 1) || 1;
    const price = Number(item.unitPrice ?? item.price ?? 0) || 0;
    const label = item.name || item.sku || "Item";
    return `- ${label} × ${qty} @ $${price.toFixed(2)}`;
  });

  return [
    "Paid store order requires fulfillment.",
    "",
    `Fulfillment key: ${idempotencyKey}`,
    `Order Number: ${order.orderNumber}`,
    `Order ID: ${order.id}`,
    `Total: $${Number(order.total || 0).toFixed(2)}`,
    `Payment method: ${order.paymentMethod || "unknown"}`,
    `Zoho Payment ID: ${order.zohoPaymentId || "n/a"}`,
    `Zoho Session ID: ${order.zohoPaymentSessionId || "n/a"}`,
    `Billing: ${order.billingName || "n/a"} <${order.billingEmail || "n/a"}>`,
    order.billingCompany ? `Company: ${order.billingCompany}` : null,
    `Paid at: ${order.paidAt ? new Date(order.paidAt).toISOString() : "n/a"}`,
    "",
    "Line items:",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

function deskTicketSubject(order: StoreOrder, idempotencyKey: string): string {
  const keySuffix = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 12);
  return `Store order fulfillment: ${order.orderNumber} [${keySuffix}]`;
}

async function findExistingFulfillmentDeskTicket(
  order: StoreOrder,
  idempotencyKey: string,
): Promise<string | null> {
  if (!zohoClient.isDeskConfigured()) return null;

  const subject = deskTicketSubject(order, idempotencyKey);
  const legacySubject = `Store order fulfillment: ${order.orderNumber}`;
  const orderCreatedMs = new Date(order.createdAt).getTime();
  const stopBeforeMs = Number.isFinite(orderCreatedMs)
    ? orderCreatedMs - DESK_RECONCILE_CLOCK_SKEW_MS
    : null;
  for (let page = 0; page < DESK_RECONCILE_MAX_PAGES; page += 1) {
    const from = page * DESK_RECONCILE_PAGE_SIZE;
    const result = await zohoDeskService.getTickets({
      limit: DESK_RECONCILE_PAGE_SIZE,
      from,
      sortBy: "-createdTime",
    });
    const match = result.tickets.find(
      (ticket) =>
        ticket.subject === subject ||
        (ticket.subject === legacySubject && ticket.description?.includes(idempotencyKey)),
    );
    if (match) return match.id;
    if (result.tickets.length < DESK_RECONCILE_PAGE_SIZE) return null;

    const createdTimes = result.tickets
      .map((ticket) => new Date(ticket.createdTime).getTime())
      .filter(Number.isFinite);
    if (stopBeforeMs !== null && createdTimes.length === result.tickets.length) {
      const oldestCreatedMs = Math.min(...createdTimes);
      if (oldestCreatedMs <= stopBeforeMs) return null;
    }
  }
  throw new FulfillmentEffectError(
    "ambiguous",
    "Zoho Desk reconciliation reached its bounded scan limit before the order creation window.",
  );
}

async function createFulfillmentDeskTicket(
  order: StoreOrder,
  idempotencyKey: string,
): Promise<string | null> {
  if (!zohoClient.isDeskConfigured()) {
    throw new FulfillmentEffectError(
      "definite_failure",
      "Zoho Desk is not configured for paid-order fulfillment.",
    );
  }

  let contactId: string | undefined;
  if (order.billingEmail) {
    try {
      const contact = await zohoDeskService.getContactByEmail(order.billingEmail);
      if (contact) contactId = contact.id;
    } catch (contactErr) {
      console.warn("[ORDER FULFILLMENT] Desk contact lookup failed:", contactErr);
    }
  }

  let ticket;
  try {
    ticket = await zohoDeskService.createTicket({
      subject: deskTicketSubject(order, idempotencyKey),
      description: buildDeskDescription(order, parseLineItems(order.lineItems), idempotencyKey),
      contactId,
      email: contactId ? undefined : order.billingEmail || undefined,
      priority: "Medium",
    });
  } catch (error: any) {
    throw new FulfillmentEffectError(
      classifyZohoDeskFailure(error),
      `Zoho Desk ticket creation failed: ${error?.message || "unknown provider error"}`,
    );
  }

  logSecurity("ORDER_FULFILLMENT_DESK_TICKET", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    zohoTicketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    idempotencyKey,
  });
  return ticket.id;
}

async function sendConfirmation(order: StoreOrder): Promise<ConfirmationOutcome> {
  if (!order.billingEmail) {
    console.warn("[ORDER FULFILLMENT] No billing email — skipping confirmation", {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
    return "skipped";
  }

  try {
    const sent = await notificationService.sendOrderConfirmation({
      email: order.billingEmail,
      name: order.billingName || "Customer",
      orderId: order.orderNumber,
      items: formatItemsForEmail(parseLineItems(order.lineItems)),
      total: Number(order.total || 0) || 0,
    });
    const operationsNotified = await notificationService.sendNewLeadNotification({
      name: order.billingName || "Customer",
      email: order.billingEmail,
      company: order.billingCompany || undefined,
      message: `Store purchase paid: ${order.orderNumber} ($${Number(order.total || 0).toFixed(2)})`,
      source: "store_purchase",
    });

    const confirmationOutcome: ConfirmationOutcome = sent ? "sent" : "failed";
    logSecurity("ORDER_CONFIRMATION_EMAIL", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      email: order.billingEmail,
      sent: !!sent,
      operationsNotified: !!operationsNotified,
      delivery: "at_most_once",
      outcome: confirmationOutcome,
    });
    return confirmationOutcome;
  } catch (error: any) {
    // Dispatch is reserved before this call. Do not risk sending a duplicate
    // after an ambiguous provider response; operators can resend deliberately.
    console.warn("[ORDER FULFILLMENT] Confirmation email failed:", error?.message || error);
    return "failed";
  }
}

async function loadOrder(id: string): Promise<StoreOrder | null> {
  if (!db) throw new Error("Database is unavailable for order fulfillment");
  const [order] = await db.select().from(storeOrders).where(eq(storeOrders.id, id)).limit(1);
  return order || null;
}

async function requireDatabasePool(): Promise<any> {
  const ready = await initPromise;
  if (!ready || !pool || !db) {
    throw new Error("Durable database is required for order fulfillment");
  }
  return pool;
}

async function runFulfillmentSchemaBootstrap(): Promise<void> {
  const databasePool = await requireDatabasePool();
  const client = await databasePool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS store_order_fulfillment_state (
        order_id varchar PRIMARY KEY REFERENCES store_orders(id) ON DELETE CASCADE,
        claim_token uuid,
        claim_started_at timestamp,
        confirmation_state text NOT NULL DEFAULT 'pending',
        desk_ticket_state text NOT NULL DEFAULT 'pending',
        desk_ticket_id varchar,
        last_error text,
        completed_at timestamp,
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT store_order_fulfillment_confirmation_state_check
          CHECK (confirmation_state IN ('pending', 'reserved', 'sent', 'failed', 'skipped')),
        CONSTRAINT store_order_fulfillment_desk_state_check
          CHECK (desk_ticket_state IN ('pending', 'creating', 'completed', 'failed', 'skipped'))
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS store_order_fulfillment_recovery_idx
      ON store_order_fulfillment_state (desk_ticket_state, updated_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS store_orders_fulfillment_queue_idx
      ON store_orders (status, updated_at)
      WHERE status IN ('paid', 'provisioning')
    `);
  } finally {
    client.release();
  }
}

/** Additive, retryable bootstrap for the service-owned durable effect ledger. */
export function ensureOrderFulfillmentSchema(): Promise<void> {
  if (!fulfillmentSchemaPromise) {
    fulfillmentSchemaPromise = runFulfillmentSchemaBootstrap().catch((error) => {
      fulfillmentSchemaPromise = null;
      throw error;
    });
  }
  return fulfillmentSchemaPromise;
}

type FulfillmentStateRow = {
  confirmation_state: FulfillmentEffectState;
  desk_ticket_state: DeskTicketEffectState;
  desk_ticket_id: string | null;
};

function mapFulfillmentState(row: FulfillmentStateRow): FulfillmentState {
  return {
    confirmationState: row.confirmation_state,
    deskTicketState: row.desk_ticket_state,
    deskTicketId: row.desk_ticket_id,
  };
}

async function loadFulfillmentState(id: string): Promise<FulfillmentState> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `SELECT confirmation_state, desk_ticket_state, desk_ticket_id
       FROM store_order_fulfillment_state
      WHERE order_id = $1`,
    [id],
  );
  const row = result.rows[0] as FulfillmentStateRow | undefined;
  if (!row) throw new Error("Fulfillment state was not initialized");
  return mapFulfillmentState(row);
}

async function claimPaidOrderDurably(id: string): Promise<FulfillmentClaim | null> {
  await ensureOrderFulfillmentSchema();
  const databasePool = await requireDatabasePool();
  const client = await databasePool.connect();
  const claimToken = randomUUID();

  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `UPDATE store_orders o
          SET status = 'provisioning', updated_at = now()
        WHERE o.id = $1
          AND o.status = 'paid'
          AND NOT EXISTS (
            SELECT 1
              FROM store_order_fulfillment_state s
             WHERE s.order_id = o.id
               AND s.desk_ticket_state = 'failed'
          )
        RETURNING o.id`,
      [id],
    );
    if (claimed.rowCount !== 1) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `INSERT INTO store_order_fulfillment_state (
         order_id, claim_token, claim_started_at, updated_at
       ) VALUES ($1, $2, now(), now())
       ON CONFLICT (order_id) DO UPDATE SET
         claim_token = EXCLUDED.claim_token,
         claim_started_at = EXCLUDED.claim_started_at,
         updated_at = now()`,
      [id, claimToken],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const order = await loadOrder(id);
  if (!order) throw new Error("Claimed order disappeared before fulfillment");
  const state = await loadFulfillmentState(id);
  return { order, claimToken, state };
}

async function assertCurrentClaimOrRecorded(
  id: string,
  claimToken: string,
  recorded: boolean,
): Promise<boolean> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `SELECT s.claim_token, s.confirmation_state, o.status
       FROM store_order_fulfillment_state s
       JOIN store_orders o ON o.id = s.order_id
      WHERE s.order_id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (row?.claim_token === claimToken && row?.status === "provisioning" && recorded) {
    return false;
  }
  throw new Error("Fulfillment claim was lost");
}

async function reserveConfirmationDispatch(id: string, claimToken: string): Promise<boolean> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `UPDATE store_order_fulfillment_state s
        SET confirmation_state = 'reserved', updated_at = now()
      WHERE s.order_id = $1
        AND s.claim_token = $2
        AND s.confirmation_state = 'pending'
        AND EXISTS (
          SELECT 1 FROM store_orders o
           WHERE o.id = s.order_id AND o.status = 'provisioning'
        )
      RETURNING s.order_id`,
    [id, claimToken],
  );
  if (result.rowCount === 1) {
    await touchClaim(id, claimToken);
    return true;
  }

  const state = await loadFulfillmentState(id);
  return assertCurrentClaimOrRecorded(id, claimToken, state.confirmationState === "reserved");
}

async function recordConfirmationOutcome(
  id: string,
  claimToken: string,
  outcome: ConfirmationOutcome,
): Promise<void> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `UPDATE store_order_fulfillment_state s
        SET confirmation_state = $3,
            last_error = CASE WHEN $3 = 'failed' THEN 'Confirmation delivery failed or was ambiguous' ELSE last_error END,
            updated_at = now()
      WHERE s.order_id = $1
        AND s.claim_token = $2
        AND s.confirmation_state = 'reserved'
        AND EXISTS (
          SELECT 1 FROM store_orders o
           WHERE o.id = s.order_id AND o.status = 'provisioning'
        )
      RETURNING s.order_id`,
    [id, claimToken, outcome],
  );
  if (result.rowCount !== 1) throw new Error("Fulfillment claim was lost after confirmation dispatch");
  await touchClaim(id, claimToken);
}

async function touchClaim(id: string, claimToken: string): Promise<void> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `UPDATE store_orders o
        SET updated_at = now()
      WHERE o.id = $1
        AND o.status = 'provisioning'
        AND EXISTS (
          SELECT 1 FROM store_order_fulfillment_state s
           WHERE s.order_id = o.id AND s.claim_token = $2
        )
      RETURNING o.id`,
    [id, claimToken],
  );
  if (result.rowCount !== 1) throw new Error("Fulfillment claim was lost");
}

async function markDeskTicketCreating(id: string, claimToken: string): Promise<void> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `UPDATE store_order_fulfillment_state s
        SET desk_ticket_state = 'creating', updated_at = now()
      WHERE s.order_id = $1
        AND s.claim_token = $2
        AND s.desk_ticket_state = 'pending'
        AND EXISTS (
          SELECT 1 FROM store_orders o
           WHERE o.id = s.order_id AND o.status = 'provisioning'
        )
      RETURNING s.order_id`,
    [id, claimToken],
  );
  if (result.rowCount !== 1) throw new Error("Fulfillment claim was lost before Desk ticket creation");
  await touchClaim(id, claimToken);
}

async function recordDeskTicket(id: string, claimToken: string, ticketId: string | null): Promise<void> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `UPDATE store_order_fulfillment_state s
        SET desk_ticket_state = $3,
            desk_ticket_id = $4,
            updated_at = now()
      WHERE s.order_id = $1
        AND s.claim_token = $2
        AND EXISTS (
          SELECT 1 FROM store_orders o
           WHERE o.id = s.order_id AND o.status = 'provisioning'
        )
      RETURNING s.order_id`,
    [id, claimToken, ticketId ? "completed" : "skipped", ticketId],
  );
  if (result.rowCount !== 1) throw new Error("Fulfillment claim was lost after Desk ticket creation");
  await touchClaim(id, claimToken);
}

async function recordDeskTicketFailure(
  id: string,
  claimToken: string,
  error: string,
): Promise<void> {
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `UPDATE store_order_fulfillment_state s
        SET desk_ticket_state = 'failed',
            last_error = $3,
            updated_at = now()
      WHERE s.order_id = $1
        AND s.claim_token = $2
        AND s.desk_ticket_state = 'creating'
        AND EXISTS (
          SELECT 1 FROM store_orders o
           WHERE o.id = s.order_id AND o.status = 'provisioning'
        )
      RETURNING s.order_id`,
    [id, claimToken, error.slice(0, 2000)],
  );
  if (result.rowCount !== 1) throw new Error("Fulfillment claim was lost while recording Desk failure");
  await touchClaim(id, claimToken);
}

async function completeOrder(id: string, claimToken: string): Promise<boolean> {
  const databasePool = await requireDatabasePool();
  const client = await databasePool.connect();
  const fulfilledAt = new Date().toISOString();
  const fulfilledNote = `${FULFILLED_NOTE_MARKER} at ${fulfilledAt}`;
  const hubEventId = deterministicFulfillmentEventId(
    fulfillmentIdempotencyKey(id, "hub-order"),
  );

  try {
    await client.query("BEGIN");
    // A reserved or failed confirmation is a terminal at-most-once delivery
    // outcome, not a provisioning failure. Pending remains the only state that
    // cannot complete because no durable send decision has been recorded yet.
    const completed = await client.query(
      `UPDATE store_orders o
          SET status = 'completed',
              notes = concat_ws(' | ', nullif(btrim(coalesce(o.notes, '')), ''), $3),
              updated_at = now()
        WHERE o.id = $1
          AND o.status = 'provisioning'
          AND EXISTS (
            SELECT 1 FROM store_order_fulfillment_state s
             WHERE s.order_id = o.id
               AND s.claim_token = $2
               AND s.confirmation_state IN ('reserved', 'sent', 'failed', 'skipped')
               AND s.desk_ticket_state IN ('completed', 'skipped')
          )
          AND EXISTS (
            SELECT 1 FROM sync_outbox x
             WHERE x.event_id = $4 AND x.entity_id = o.id
          )
        RETURNING o.id`,
      [id, claimToken, fulfilledNote, hubEventId],
    );
    if (completed.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `UPDATE store_order_fulfillment_state
          SET completed_at = now(),
              last_error = CASE
                WHEN confirmation_state = 'reserved'
                  THEN 'Confirmation delivery outcome is ambiguous; automatic resend suppressed'
                WHEN confirmation_state = 'failed'
                  THEN 'Confirmation delivery failed or was ambiguous; automatic resend suppressed'
                ELSE NULL
              END,
              updated_at = now()
        WHERE order_id = $1 AND claim_token = $2`,
      [id, claimToken],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function releaseFailedClaim(id: string, claimToken: string, error: string): Promise<void> {
  const databasePool = await requireDatabasePool();
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const released = await client.query(
      `UPDATE store_orders o
          SET status = 'paid', updated_at = now()
        WHERE o.id = $1
          AND o.status = 'provisioning'
          AND EXISTS (
            SELECT 1 FROM store_order_fulfillment_state s
             WHERE s.order_id = o.id AND s.claim_token = $2
          )
        RETURNING o.id, o.order_number`,
      [id, claimToken],
    );
    await client.query(
      `UPDATE store_order_fulfillment_state
          SET last_error = $3, updated_at = now()
        WHERE order_id = $1 AND claim_token = $2`,
      [id, claimToken, error.slice(0, 2000)],
    );
    await client.query("COMMIT");

    if (released.rowCount === 1) {
      logSecurity("ORDER_FULFILLMENT_CLAIM_RELEASED", {
        orderId: released.rows[0].id,
        orderNumber: released.rows[0].order_number,
        reason: "fatal_error",
        newStatus: "paid",
      });
    }
  } catch (releaseError) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw releaseError;
  } finally {
    client.release();
  }
}

async function recoverStaleProvisioningClaims(
  staleCutoff: Date,
): Promise<Array<{ id: string; orderNumber: string }>> {
  await ensureOrderFulfillmentSchema();
  const databasePool = await requireDatabasePool();
  const result = await databasePool.query(
    `WITH stale AS (
       SELECT id
         FROM store_orders
        WHERE status = 'provisioning' AND updated_at < $1
        ORDER BY updated_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
     )
     UPDATE store_orders o
        SET status = 'paid', updated_at = now()
       FROM stale
      WHERE o.id = stale.id
      RETURNING o.id, o.order_number`,
    [staleCutoff, RECONCILE_BATCH_SIZE],
  );
  return result.rows.map((row: { id: string; order_number: string }) => ({
    id: row.id,
    orderNumber: row.order_number,
  }));
}

async function listPaidOrderIds(limit: number): Promise<string[]> {
  const databasePool = await requireDatabasePool();
  // Only a definite Desk rejection is operator-gated. Confirmation delivery
  // is deliberately decoupled so reconciliation cannot strand a paid order.
  const result = await databasePool.query(
    `SELECT o.id
       FROM store_orders o
       LEFT JOIN store_order_fulfillment_state s ON s.order_id = o.id
      WHERE o.status = 'paid'
        AND coalesce(s.desk_ticket_state, 'pending') <> 'failed'
      ORDER BY o.updated_at ASC
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row: { id: string }) => row.id);
}

async function enqueueHubOrder(order: StoreOrder, idempotencyKey: string): Promise<void> {
  await ensureDeSyncSchema();
  await ensureOrderFulfillmentSchema();
  if (!db) throw new Error("Database is unavailable for durable Hub delivery");

  const eventId = deterministicFulfillmentEventId(idempotencyKey);
  await db
    .insert(syncOutbox)
    .values({
      eventId,
      eventType: "store.order_created",
      version: 1,
      source: "website",
      destination: "hub",
      occurredAt: order.paidAt || new Date(),
      correlationId: eventId,
      entityType: "order",
      entityId: order.id,
      canonicalAccountId: null,
      payload: {
        id: order.id,
        orderNumber: order.orderNumber,
        name: order.billingName || "",
        email: order.billingEmail || "",
        company: order.billingCompany || "",
        total: Number(order.total || 0),
        source: "store_purchase",
      },
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({ target: syncOutbox.eventId });

}

const productionPersistence: FulfillmentPersistence = {
  claimPaidOrder: claimPaidOrderDurably,
  loadOrder,
  reserveConfirmationDispatch,
  recordConfirmationOutcome,
  markDeskTicketCreating,
  recordDeskTicket,
  recordDeskTicketFailure,
  completeOrder,
  releaseFailedClaim,
  recoverStaleProvisioningClaims,
  listPaidOrderIds,
};

const productionEffects: FulfillmentEffects = {
  sendConfirmation,
  findDeskTicket: findExistingFulfillmentDeskTicket,
  createDeskTicket: createFulfillmentDeskTicket,
  enqueueHubOrder,
};

export function createOrderFulfillmentOrchestrator(input: {
  persistence: FulfillmentPersistence;
  effects: FulfillmentEffects;
  now?: () => Date;
}): OrderFulfillmentOrchestrator {
  const { persistence, effects } = input;
  const now = input.now || (() => new Date());
  let reconciliationRunning = false;

  async function fulfillOne(orderId: string | number): Promise<boolean> {
    const id = String(orderId);
    let claim: FulfillmentClaim | null = null;

    try {
      claim = await persistence.claimPaidOrder(id);
      if (!claim) {
        const latest = await persistence.loadOrder(id);
        if (!latest) {
          logSecurity("ORDER_FULFILLMENT_SKIPPED", { orderId: id, reason: "not_found" });
          return false;
        }

        const reason = alreadyCompleted(latest)
          ? "already_completed"
          : isFulfillmentTerminalStatus(latest.status)
            ? "terminal_status"
            : isFulfillmentActiveStatus(latest.status)
              ? "already_claimed"
              : "not_paid";

        logSecurity("ORDER_FULFILLMENT_SKIPPED", {
          orderId: latest.id,
          orderNumber: latest.orderNumber,
          reason,
          status: latest.status,
        });
        return false;
      }

      const { order, claimToken, state } = claim;
      logSecurity("ORDER_STATUS_CHANGED", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        oldStatus: "paid",
        newStatus: "provisioning",
        triggeredBy: "order_fulfillment",
      });

      let confirmationState = state.confirmationState;
      if (state.confirmationState === "pending") {
        const reserved = await persistence.reserveConfirmationDispatch(order.id, claimToken);
        if (reserved) {
          confirmationState = "reserved";
          const outcome = await effects.sendConfirmation(order);
          await persistence.recordConfirmationOutcome(order.id, claimToken, outcome);
          confirmationState = outcome;
        } else {
          // A durable reservation exists even though this claim loaded the prior
          // snapshot. Treat its outcome as ambiguous and never send a second copy.
          confirmationState = "reserved";
        }
      }

      if (confirmationState === "reserved" || confirmationState === "failed") {
        logSecurity("ORDER_CONFIRMATION_DELIVERY_UNRESOLVED", {
          orderId: order.id,
          orderNumber: order.orderNumber,
          confirmationState,
          automaticResendSuppressed: true,
          provisioningContinues: true,
        });
      }

      let deskTicketId = state.deskTicketId;
      if (state.deskTicketState === "failed") {
        throw new Error("Desk ticket creation previously failed; operator repair is required");
      }
      if (state.deskTicketState !== "completed" && state.deskTicketState !== "skipped") {
        const deskIdempotencyKey = fulfillmentIdempotencyKey(order.id, "desk-ticket");
        deskTicketId = await effects.findDeskTicket(order, deskIdempotencyKey);

        if (deskTicketId) {
          await persistence.recordDeskTicket(order.id, claimToken, deskTicketId);
        } else if (state.deskTicketState === "creating") {
          // The previous process may have died after Zoho accepted the request.
          // Never create a second ticket while that outcome is ambiguous. The
          // reconciler will keep searching for the deterministic key.
          throw new Error("Desk ticket creation is awaiting provider reconciliation");
        } else {
          await persistence.markDeskTicketCreating(order.id, claimToken);
          try {
            deskTicketId = await effects.createDeskTicket(order, deskIdempotencyKey);
          } catch (error: any) {
            if (error instanceof FulfillmentEffectError && error.outcome === "definite_failure") {
              await persistence.recordDeskTicketFailure(
                order.id,
                claimToken,
                error.message,
              );
            }
            throw error;
          }
          await persistence.recordDeskTicket(order.id, claimToken, deskTicketId);
        }
      }

      await effects.enqueueHubOrder(
        order,
        fulfillmentIdempotencyKey(order.id, "hub-order"),
      );

      if (!(await persistence.completeOrder(order.id, claimToken))) {
        throw new Error("Fulfillment claim was lost before completion");
      }

      logSecurity("ORDER_STATUS_CHANGED", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        oldStatus: "provisioning",
        newStatus: "completed",
        triggeredBy: "order_fulfillment",
        deskTicketId,
      });
      logSecurity("ORDER_FULFILLED", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        deskTicketId,
        confirmationState,
        total: order.total,
      });
      return true;
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error("[ORDER FULFILLMENT ERROR]", { orderId: id, message });
      logSecurity("ORDER_FULFILLMENT_FAILED", { orderId: id, error: message });

      if (claim) {
        try {
          await persistence.releaseFailedClaim(id, claim.claimToken, message);
        } catch (releaseError: any) {
          console.error("[ORDER FULFILLMENT CLAIM RELEASE ERROR]", {
            orderId: id,
            message: releaseError?.message || String(releaseError),
          });
        }
      }
      return false;
    }
  }

  async function reconcile(): Promise<{ recovered: number; attempted: number; fulfilled: number }> {
    if (reconciliationRunning) return { recovered: 0, attempted: 0, fulfilled: 0 };

    reconciliationRunning = true;
    try {
      const staleCutoff = new Date(now().getTime() - STALE_PROVISIONING_MS);
      const recoveredRows = await persistence.recoverStaleProvisioningClaims(staleCutoff);

      for (const recovered of recoveredRows) {
        logSecurity("ORDER_FULFILLMENT_STALE_CLAIM_RECOVERED", {
          orderId: recovered.id,
          orderNumber: recovered.orderNumber,
          newStatus: "paid",
        });
      }

      const pending = await persistence.listPaidOrderIds(RECONCILE_BATCH_SIZE);
      let fulfilled = 0;
      for (const pendingId of pending) {
        if (await fulfillOne(pendingId)) fulfilled += 1;
      }

      if (recoveredRows.length > 0 || pending.length > 0) {
        logSecurity("ORDER_FULFILLMENT_RECONCILED", {
          recovered: recoveredRows.length,
          attempted: pending.length,
          fulfilled,
        });
      }
      return { recovered: recoveredRows.length, attempted: pending.length, fulfilled };
    } catch (error: any) {
      console.error("[ORDER FULFILLMENT RECONCILIATION ERROR]", error?.message || error);
      return { recovered: 0, attempted: 0, fulfilled: 0 };
    } finally {
      reconciliationRunning = false;
    }
  }

  return { fulfillPaidOrder: fulfillOne, reconcilePaidOrders: reconcile };
}

const productionOrchestrator = createOrderFulfillmentOrchestrator({
  persistence: productionPersistence,
  effects: productionEffects,
});

export async function fulfillPaidOrder(orderId: string | number): Promise<boolean> {
  return productionOrchestrator.fulfillPaidOrder(orderId);
}

export async function reconcilePaidOrders(): Promise<{
  recovered: number;
  attempted: number;
  fulfilled: number;
}> {
  return productionOrchestrator.reconcilePaidOrders();
}

/** Start production recovery once after boot, then every five minutes. */
export function startOrderFulfillmentReconciliation(): void {
  if (process.env.NODE_ENV !== "production" || reconciliationTimer) return;

  void reconcilePaidOrders();
  reconciliationTimer = setInterval(() => {
    void reconcilePaidOrders();
  }, RECONCILE_INTERVAL_MS);
  reconciliationTimer.unref?.();
}
