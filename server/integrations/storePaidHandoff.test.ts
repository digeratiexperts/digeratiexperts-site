import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@shared/schema";
import { prepareStorePaidHandoff, recordPaidStoreHandoff, type StoreHandoffDatabase } from "./storePaidHandoff";
import type { DeSyncEnvelope } from "./deSyncContract";

const testUrl = process.env.STORE_HANDOFF_TEST_DATABASE_URL;
const items = [{ productId: "synthetic-service", sku: "TEST", name: "Synthetic service", quantity: 1, unitPrice: 1250, pricingType: "one_time", total: 1250 }];
const payment = { amount: "1250.00", currency: "USD", paymentId: "synthetic-payment" };
const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;

// Opt-in, real PostgreSQL transactions. Never use DATABASE_URL or app bootstrap.
describe.skipIf(!testUrl)("Store paid handoff — isolated synthetic PostgreSQL", () => {
  let pool: Pool;
  let admin: Pool;
  let db: StoreHandoffDatabase;
  const namespace = `handoff688_${randomUUID().replaceAll("-", "")}`;

  beforeAll(async () => {
    const target = new URL(testUrl!);
    if (target.hostname !== "127.0.0.1" || target.port !== "55488" || target.username !== "handoff_test") {
      throw new Error("Use only the issue-688 isolated loopback PostgreSQL test cluster");
    }
    admin = new Pool({ connectionString: testUrl, connectionTimeoutMillis: 5000 });
    await admin.query(`CREATE SCHEMA ${ident(namespace)}`);
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 10 });
    db = drizzle(pool, { schema });
    for (const type of [schema.storeOrderStatusEnum, schema.storePaymentMethodEnum]) {
      await pool.query(`CREATE TYPE ${ident(type.enumName)} AS ENUM (${type.enumValues.map(v => `'${v}'`).join(",")})`);
    }
    // Use the actual Drizzle column types/defaults, but no production migration
    // or unrelated tables. FK/receiver concurrency is a separate follow-on.
    const dialect = new PgDialect();
    for (const table of [schema.portalClients, schema.storeOrders, schema.storeOrderHolds, schema.storeOrderChangeRequests, schema.syncOutbox]) {
      const config = getTableConfig(table);
      const columns = config.columns.map(column => {
        let definition = `${ident(column.name)} ${column.getSQLType()}`;
        if (column.primary) definition += " PRIMARY KEY";
        else if (column.notNull) definition += " NOT NULL";
        if (column.isUnique) definition += " UNIQUE";
        if (column.default !== undefined) {
          const value = column.default;
          definition += " DEFAULT " + (typeof value === "object" && value !== null && "getSQL" in value
            ? dialect.sqlToQuery((value as { getSQL(): ReturnType<typeof sql> }).getSQL()).sql
            : typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : String(value));
        }
        return definition;
      });
      await pool.query(`CREATE TABLE ${ident(config.name)} (${columns.join(",")})`);
    }
  }, 30000);

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${ident(namespace)} CASCADE`);
      await admin.end();
    }
  });

  beforeEach(async () => {
    await pool.query("ALTER TABLE sync_outbox DROP CONSTRAINT IF EXISTS reject_paid_handoff");
    await pool.query("TRUNCATE sync_outbox, store_order_change_requests, store_order_holds, store_orders, portal_clients");
    await db.insert(schema.portalClients).values({ id: "client-a", companyName: "Synthetic A", contactEmail: "buyer@example.test", hubAccountId: "hub-a" });
    await db.insert(schema.storeOrders).values({
      id: "order-a", orderNumber: "TEST-688-A", clientId: "client-a", status: "awaiting_payment", paymentMethod: "zoho",
      lineItems: items, subtotal: "1250.00", total: "1250.00", billingEmail: "buyer@example.test", billingName: "Synthetic Buyer", billingCompany: "Synthetic A",
    });
  });

  async function queuedHandoff(): Promise<DeSyncEnvelope> {
    await recordPaidStoreHandoff(db, "order-a", payment);
    const [row] = await db.select().from(schema.syncOutbox);
    return { ...row, version: 1, source: "website", eventType: "store.order_created", occurredAt: row.occurredAt.toISOString(), correlationId: row.correlationId!, payload: row.payload as Record<string, unknown> };
  }

  it("rolls back payment and payment identifiers when the durable outbox insert fails", async () => {
    await pool.query("ALTER TABLE sync_outbox ADD CONSTRAINT reject_paid_handoff CHECK (event_type <> 'store.order_created')");
    await expect(recordPaidStoreHandoff(db, "order-a", payment)).rejects.toThrow();
    const [order] = await db.select().from(schema.storeOrders);
    expect(order.status).toBe("awaiting_payment");
    expect(order.zohoPaymentId).toBeNull();
    expect(order.paidAt).toBeNull();
    expect(await db.select().from(schema.syncOutbox)).toHaveLength(0);
    await pool.query("ALTER TABLE sync_outbox DROP CONSTRAINT reject_paid_handoff");
    await recordPaidStoreHandoff(db, "order-a", payment);
    expect(await db.select().from(schema.syncOutbox)).toHaveLength(1);
  });

  it("commits one paid handoff across concurrent and replayed notifications", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, () => recordPaidStoreHandoff(db, "order-a", payment)));
    expect(results.filter(result => result.action === "mark_paid")).toHaveLength(1);
    await recordPaidStoreHandoff(db, "order-a", payment);
    const [order] = await db.select().from(schema.storeOrders);
    const rows = await db.select().from(schema.syncOutbox);
    expect(order.status).toBe("paid");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ eventType: "store.order_created", entityId: "order-a", canonicalAccountId: "hub-a", status: "pending" });
    expect(rows[0].payload).toMatchObject({ id: "order-a", portalClientId: "client-a", commercial: { status: "paid", reference: "TEST-688-A" } });
  });

  it("rejects a mismatched amount using the current stored order", async () => {
    await db.update(schema.storeOrders).set({ total: "1500.00" }).where(eq(schema.storeOrders.id, "order-a"));
    expect(await recordPaidStoreHandoff(db, "order-a", payment)).toMatchObject({ action: "reject", reason: "amount_mismatch" });
    expect(await db.select().from(schema.syncOutbox)).toHaveLength(0);
  });

  it.each(["cancelled", "refunded"] as const)("never revives a %s order or delivers its previously queued purchase", async status => {
    const envelope = await queuedHandoff();
    await db.update(schema.storeOrders).set({ status }).where(eq(schema.storeOrders.id, "order-a"));
    expect(await recordPaidStoreHandoff(db, "order-a", payment)).toMatchObject({ action: "reject", reason: "order_closed" });
    expect((await db.select().from(schema.storeOrders))[0].status).toBe(status);
    expect(await db.select().from(schema.syncOutbox)).toHaveLength(1);
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("order_not_paid");
  });

  it("records a held payment durably but blocks delivery until the existing hold ends", async () => {
    const envelope = await queuedHandoff();
    await db.insert(schema.storeOrderHolds).values({ orderId: "order-a", clientId: "client-a", heldUntil: "2026-11-01", reason: "Synthetic hold", heldByName: "Synthetic admin", heldByRole: "de_admin" });
    await expect(prepareStorePaidHandoff(db, envelope, new Date("2026-10-30T00:00:00Z"))).rejects.toThrow("on_hold");
    await expect(prepareStorePaidHandoff(db, envelope, new Date("2026-11-01T00:00:00Z"))).resolves.toMatchObject({ canonicalAccountId: "hub-a" });
  });

  it.each(["cancel", "amend"])("neither closing nor adding a reconciliation note to %s unblocks the original purchase", async kind => {
    const envelope = await queuedHandoff();
    await db.insert(schema.storeOrderChangeRequests).values({ id: "request-a", orderId: "order-a", orderNumber: "TEST-688-A", clientId: "client-a", kind, details: "Replace or stop the original purchase", requestedByName: "Synthetic buyer", requestedByRole: "orderer" });
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("change_requires_reconciliation");
    await db.update(schema.storeOrderChangeRequests).set({ status: "done", resolvedAt: new Date(), resolutionNote: "Details reconciled" }).where(eq(schema.storeOrderChangeRequests.id, "request-a"));
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("change_requires_reconciliation");
    expect((await db.select().from(schema.storeOrders))[0].status).toBe("paid");
  });

  it("allows an unchanged purchase when its request was declined", async () => {
    const envelope = await queuedHandoff();
    await db.insert(schema.storeOrderChangeRequests).values({ orderId: "order-a", orderNumber: "TEST-688-A", kind: "cancel", details: "Synthetic request", status: "declined", requestedByName: "Synthetic buyer", requestedByRole: "orderer" });
    await expect(prepareStorePaidHandoff(db, envelope)).resolves.toMatchObject({ canonicalAccountId: "hub-a" });
  });

  it("blocks cross-tenant payloads and mapping changes using stored client identity", async () => {
    const envelope = await queuedHandoff();
    await expect(prepareStorePaidHandoff(db, { ...envelope, canonicalAccountId: "hub-b" })).rejects.toThrow("tenant_mapping_changed");
    await expect(prepareStorePaidHandoff(db, { ...envelope, payload: { ...envelope.payload, portalClientId: "client-b" } })).rejects.toThrow("tenant_mismatch");
    await db.update(schema.portalClients).set({ hubAccountId: "hub-b" }).where(eq(schema.portalClients.id, "client-a"));
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("tenant_mapping_changed");
  });

  it("durably binds a newly learned trusted mapping and retains it on replay", async () => {
    await db.update(schema.portalClients).set({ hubAccountId: null }).where(eq(schema.portalClients.id, "client-a"));
    const envelope = await queuedHandoff();
    expect(envelope.canonicalAccountId).toBeNull();
    await db.update(schema.portalClients).set({ hubAccountId: "hub-a" }).where(eq(schema.portalClients.id, "client-a"));
    const prepared = await prepareStorePaidHandoff(db, envelope);
    expect(prepared).toEqual({ ...envelope, canonicalAccountId: "hub-a" });
    const [queued] = await db.select().from(schema.syncOutbox);
    expect(queued.canonicalAccountId).toBe("hub-a");
    expect(queued.eventId).toBe(envelope.eventId);
    expect(queued.payload).toEqual(envelope.payload);
    expect(await prepareStorePaidHandoff(db, prepared)).toEqual(prepared);
    await db.update(schema.portalClients).set({ hubAccountId: "hub-b" }).where(eq(schema.portalClients.id, "client-a"));
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("tenant_mapping_changed");
  });

  it.each(["subtotal", "tax", "total"] as const)("blocks %s-only changes after the payment snapshot was committed", async field => {
    const envelope = await queuedHandoff();
    await db.update(schema.storeOrders).set({ [field]: "1251.00" }).where(eq(schema.storeOrders.id, "order-a"));
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("paid_amounts_changed");
  });

  it("retains legacy paid commands without a verified amount snapshot for reconciliation", async () => {
    const envelope = await queuedHandoff();
    delete envelope.payload.paidOrderSnapshot;
    await db.update(schema.syncOutbox).set({ payload: envelope.payload }).where(eq(schema.syncOutbox.eventId, envelope.eventId));
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("paid_amounts_changed");
  });

  it("does not deliver an old paid snapshot after purchased details change", async () => {
    const envelope = await queuedHandoff();
    await expect(prepareStorePaidHandoff(db, envelope)).resolves.toMatchObject({ canonicalAccountId: "hub-a" });
    await db.update(schema.storeOrders).set({ lineItems: [{ ...items[0], quantity: 2, total: 2500 }] }).where(eq(schema.storeOrders.id, "order-a"));
    await expect(prepareStorePaidHandoff(db, envelope)).rejects.toThrow("purchase_changed");
  });

  it("keeps two legitimate purchases distinct even for the same tenant and items", async () => {
    const [first] = await db.select().from(schema.storeOrders);
    await db.insert(schema.storeOrders).values({ ...first, id: "order-b", orderNumber: "TEST-688-B" });
    await Promise.all([recordPaidStoreHandoff(db, "order-a", payment), recordPaidStoreHandoff(db, "order-b", { ...payment, paymentId: "synthetic-payment-b" })]);
    const outbox = await db.select().from(schema.syncOutbox);
    expect(outbox).toHaveLength(2);
    expect(new Set(outbox.map(row => row.entityId))).toEqual(new Set(["order-a", "order-b"]));
  });

  it("preserves missing payment-ID enrichment on replay without another handoff", async () => {
    await queuedHandoff();
    await db.update(schema.storeOrders).set({ zohoPaymentId: null, paidAt: null }).where(eq(schema.storeOrders.id, "order-a"));
    expect(await recordPaidStoreHandoff(db, "order-a", payment)).toMatchObject({ action: "already_paid", order: { zohoPaymentId: payment.paymentId } });
    expect(await db.select().from(schema.syncOutbox)).toHaveLength(1);
  });

  it("rolls back rather than silently paying an order with no handoff items", async () => {
    await db.update(schema.storeOrders).set({ lineItems: [] }).where(eq(schema.storeOrders.id, "order-a"));
    await expect(recordPaidStoreHandoff(db, "order-a", payment)).rejects.toThrow("no handoff payload");
    expect((await db.select().from(schema.storeOrders))[0].status).toBe("awaiting_payment");
    expect(await db.select().from(schema.syncOutbox)).toHaveLength(0);
  });
});
