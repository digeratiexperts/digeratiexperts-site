import { describe, expect, it } from "vitest";
import type { StoreOrder } from "@shared/schema";
import {
  createOrderFulfillmentOrchestrator,
  classifyZohoDeskFailure,
  deterministicFulfillmentEventId,
  FulfillmentEffectError,
  fulfillmentIdempotencyKey,
  isFulfillmentActiveStatus,
  isFulfillmentTerminalStatus,
  isStaleProvisioning,
  type FulfillmentClaim,
  type FulfillmentPersistence,
  type FulfillmentState,
} from "./orderFulfillment";

function makeOrder(status = "paid"): StoreOrder {
  return {
    id: "order-1",
    orderNumber: "DE-1001",
    userId: "user-1",
    clientId: "client-1",
    status: status as StoreOrder["status"],
    paymentMethod: "zoho",
    lineItems: [{ name: "Managed endpoint", quantity: 2, unitPrice: 25 }],
    subtotal: "50.00",
    tax: "0.00",
    total: "50.00",
    stripeSessionId: null,
    stripePaymentIntentId: null,
    zohoPaymentId: "payment-1",
    zohoPaymentSessionId: "session-1",
    billingEmail: "owner@example.com",
    billingName: "Example Owner",
    billingCompany: "Example Co",
    billingAddress: null,
    notes: null,
    paidAt: new Date("2026-08-23T12:00:00Z"),
    createdAt: new Date("2026-08-23T11:00:00Z"),
    updatedAt: new Date("2026-08-23T12:00:00Z"),
  };
}

function createMemoryPersistence(initialStatus = "paid") {
  const order = makeOrder(initialStatus);
  const state: FulfillmentState = {
    confirmationState: "pending",
    deskTicketState: "pending",
    deskTicketId: null,
  };
  let currentClaimToken: string | null = null;
  let claimSequence = 0;

  const persistence: FulfillmentPersistence = {
    async claimPaidOrder(id): Promise<FulfillmentClaim | null> {
      const operatorBlocked = state.deskTicketState === "failed";
      if (id !== order.id || order.status !== "paid" || operatorBlocked) return null;
      order.status = "provisioning";
      currentClaimToken = `claim-${++claimSequence}`;
      return {
        order: { ...order },
        claimToken: currentClaimToken,
        state: { ...state },
      };
    },
    async loadOrder(id) {
      return id === order.id ? { ...order } : null;
    },
    async reserveConfirmationDispatch(id, claimToken) {
      if (id !== order.id || claimToken !== currentClaimToken || order.status !== "provisioning") {
        throw new Error("Fulfillment claim was lost");
      }
      if (state.confirmationState !== "pending") return false;
      state.confirmationState = "reserved";
      return true;
    },
    async recordConfirmationOutcome(id, claimToken, outcome) {
      if (id !== order.id || claimToken !== currentClaimToken || order.status !== "provisioning") {
        throw new Error("Fulfillment claim was lost");
      }
      state.confirmationState = outcome;
    },
    async markDeskTicketCreating(id, claimToken) {
      if (id !== order.id || claimToken !== currentClaimToken || order.status !== "provisioning") {
        throw new Error("Fulfillment claim was lost");
      }
      state.deskTicketState = "creating";
    },
    async recordDeskTicket(id, claimToken, ticketId) {
      if (id !== order.id || claimToken !== currentClaimToken || order.status !== "provisioning") {
        throw new Error("Fulfillment claim was lost");
      }
      state.deskTicketId = ticketId;
      state.deskTicketState = ticketId ? "completed" : "skipped";
    },
    async recordDeskTicketFailure(id, claimToken) {
      if (id !== order.id || claimToken !== currentClaimToken || order.status !== "provisioning") {
        throw new Error("Fulfillment claim was lost");
      }
      state.deskTicketState = "failed";
    },
    async completeOrder(id, claimToken) {
      if (id !== order.id || claimToken !== currentClaimToken || order.status !== "provisioning") {
        return false;
      }
      if (state.confirmationState === "pending") return false;
      if (!["completed", "skipped"].includes(state.deskTicketState)) return false;
      order.status = "completed";
      currentClaimToken = null;
      return true;
    },
    async releaseFailedClaim(id, claimToken) {
      if (id === order.id && claimToken === currentClaimToken && order.status === "provisioning") {
        order.status = "paid";
        currentClaimToken = null;
      }
    },
    async recoverStaleProvisioningClaims() {
      if (order.status !== "provisioning") return [];
      order.status = "paid";
      currentClaimToken = null;
      return [{ id: order.id, orderNumber: order.orderNumber }];
    },
    async listPaidOrderIds(limit) {
      const operatorBlocked = state.deskTicketState === "failed";
      return order.status === "paid" && limit > 0 && !operatorBlocked ? [order.id] : [];
    },
  };

  return { order, persistence, state };
}

describe("paid-order fulfillment recovery helpers", () => {
  it("treats active claims separately from terminal fulfillment states", () => {
    expect(isFulfillmentActiveStatus("provisioning")).toBe(true);
    expect(isFulfillmentActiveStatus("processing")).toBe(true);
    expect(isFulfillmentActiveStatus("paid")).toBe(false);
    expect(isFulfillmentActiveStatus("completed")).toBe(false);

    expect(isFulfillmentTerminalStatus("completed")).toBe(true);
    expect(isFulfillmentTerminalStatus("cancelled")).toBe(true);
    expect(isFulfillmentTerminalStatus("refunded")).toBe(true);
    expect(isFulfillmentTerminalStatus("provisioning")).toBe(false);
    expect(isFulfillmentTerminalStatus("paid")).toBe(false);
  });

  it("only considers provisioning claims stale after the recovery timeout", () => {
    const now = new Date("2026-08-10T18:00:00-07:00").getTime();

    expect(
      isStaleProvisioning(
        "provisioning",
        new Date(now - 31 * 60 * 1000),
        now,
      ),
    ).toBe(true);

    expect(
      isStaleProvisioning(
        "provisioning",
        new Date(now - 29 * 60 * 1000),
        now,
      ),
    ).toBe(false);

    expect(
      isStaleProvisioning(
        "paid",
        new Date(now - 60 * 60 * 1000),
        now,
      ),
    ).toBe(false);
  });

  it("does not classify missing or malformed timestamps as stale", () => {
    expect(isStaleProvisioning("provisioning", null)).toBe(false);
    expect(isStaleProvisioning("provisioning", "not-a-date")).toBe(false);
  });

  it("derives a stable UUID idempotency key for the durable Hub event", () => {
    const key = fulfillmentIdempotencyKey("order-1", "hub-order");
    const first = deterministicFulfillmentEventId(key);
    const second = deterministicFulfillmentEventId(key);

    expect(key).toBe("store-order:order-1:hub-order:v1");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deterministicFulfillmentEventId(fulfillmentIdempotencyKey("order-2", "hub-order"))).not.toBe(first);
  });

  it("distinguishes definite Desk rejections from ambiguous provider failures", () => {
    expect(classifyZohoDeskFailure({ response: { status: 400 } })).toBe("definite_failure");
    expect(classifyZohoDeskFailure({ response: { status: 422 } })).toBe("definite_failure");
    expect(classifyZohoDeskFailure({ response: { status: 429 } })).toBe("ambiguous");
    expect(classifyZohoDeskFailure({ response: { status: 503 } })).toBe("ambiguous");
    expect(classifyZohoDeskFailure(new Error("timeout"))).toBe("ambiguous");
  });
});

describe("paid-order fulfillment orchestration", () => {
  it("lets concurrent workers provision one paid order only once", async () => {
    const { order, persistence } = createMemoryPersistence();
    let confirmationCount = 0;
    let deskCreateCount = 0;
    const hubKeys = new Set<string>();

    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          confirmationCount += 1;
          return "sent";
        },
        async findDeskTicket() {
          return null;
        },
        async createDeskTicket() {
          deskCreateCount += 1;
          return "desk-1";
        },
        async enqueueHubOrder(_order, idempotencyKey) {
          hubKeys.add(idempotencyKey);
        },
      },
    });

    const results = await Promise.all([
      orchestrator.fulfillPaidOrder(order.id),
      orchestrator.fulfillPaidOrder(order.id),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(order.status).toBe("completed");
    expect(confirmationCount).toBe(1);
    expect(deskCreateCount).toBe(1);
    expect(hubKeys.size).toBe(1);
  });

  it("reconciles an ambiguous provider success without creating a second ticket or email", async () => {
    const { order, persistence, state } = createMemoryPersistence();
    let providerTicketId: string | null = null;
    let confirmationCount = 0;
    let deskCreateCount = 0;

    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          confirmationCount += 1;
          return "sent";
        },
        async findDeskTicket() {
          return providerTicketId;
        },
        async createDeskTicket() {
          deskCreateCount += 1;
          providerTicketId = "desk-after-timeout";
          throw new Error("connection dropped after Zoho accepted the ticket");
        },
        async enqueueHubOrder() {},
      },
    });

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(order.status).toBe("paid");
    expect(state.confirmationState).toBe("sent");
    expect(state.deskTicketState).toBe("creating");

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(true);
    expect(order.status).toBe("completed");
    expect(state.deskTicketId).toBe("desk-after-timeout");
    expect(confirmationCount).toBe(1);
    expect(deskCreateCount).toBe(1);
  });

  it("continues provisioning exactly once when confirmation delivery fails", async () => {
    const { order, persistence, state } = createMemoryPersistence();
    let confirmationCount = 0;
    let deskCreateCount = 0;
    let hubEnqueueCount = 0;
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          confirmationCount += 1;
          return "failed";
        },
        async findDeskTicket() { return null; },
        async createDeskTicket() {
          deskCreateCount += 1;
          return "desk-email-failed";
        },
        async enqueueHubOrder() {
          hubEnqueueCount += 1;
        },
      },
    });

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(true);
    expect(order.status).toBe("completed");
    expect(state.confirmationState).toBe("failed");
    expect(state.deskTicketId).toBe("desk-email-failed");
    expect(confirmationCount).toBe(1);
    expect(deskCreateCount).toBe(1);
    expect(hubEnqueueCount).toBe(1);

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(await orchestrator.reconcilePaidOrders()).toMatchObject({ attempted: 0, fulfilled: 0 });
    expect(confirmationCount).toBe(1);
    expect(deskCreateCount).toBe(1);
    expect(hubEnqueueCount).toBe(1);
  });

  it("recovers a paid order after a crash following confirmation reservation without resending", async () => {
    const { order, persistence, state } = createMemoryPersistence();
    const crashedClaim = await persistence.claimPaidOrder(order.id);
    expect(crashedClaim).not.toBeNull();
    expect(await persistence.reserveConfirmationDispatch(order.id, crashedClaim!.claimToken)).toBe(true);
    await persistence.releaseFailedClaim(order.id, crashedClaim!.claimToken, "simulated process crash");

    let confirmationCount = 0;
    let deskCreateCount = 0;
    let hubEnqueueCount = 0;
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          confirmationCount += 1;
          return "sent";
        },
        async findDeskTicket() { return null; },
        async createDeskTicket() {
          deskCreateCount += 1;
          return "desk-after-email-reservation";
        },
        async enqueueHubOrder() {
          hubEnqueueCount += 1;
        },
      },
    });

    expect(state.confirmationState).toBe("reserved");
    expect(order.status).toBe("paid");
    await expect(orchestrator.reconcilePaidOrders()).resolves.toEqual({
      recovered: 0,
      attempted: 1,
      fulfilled: 1,
    });
    expect(order.status).toBe("completed");
    expect(state.confirmationState).toBe("reserved");
    expect(confirmationCount).toBe(0);
    expect(deskCreateCount).toBe(1);
    expect(hubEnqueueCount).toBe(1);

    await expect(orchestrator.reconcilePaidOrders()).resolves.toEqual({
      recovered: 0,
      attempted: 0,
      fulfilled: 0,
    });
    expect(confirmationCount).toBe(0);
    expect(deskCreateCount).toBe(1);
    expect(hubEnqueueCount).toBe(1);
  });

  it("reconciles a paid order with a durable failed confirmation without resending", async () => {
    const { order, persistence, state } = createMemoryPersistence();
    const failedClaim = await persistence.claimPaidOrder(order.id);
    expect(failedClaim).not.toBeNull();
    expect(await persistence.reserveConfirmationDispatch(order.id, failedClaim!.claimToken)).toBe(true);
    await persistence.recordConfirmationOutcome(order.id, failedClaim!.claimToken, "failed");
    await persistence.releaseFailedClaim(order.id, failedClaim!.claimToken, "confirmation failed");

    let confirmationCount = 0;
    let deskCreateCount = 0;
    let hubEnqueueCount = 0;
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          confirmationCount += 1;
          return "sent";
        },
        async findDeskTicket() { return null; },
        async createDeskTicket() {
          deskCreateCount += 1;
          return "desk-after-email-failure";
        },
        async enqueueHubOrder() {
          hubEnqueueCount += 1;
        },
      },
    });

    expect(state.confirmationState).toBe("failed");
    await expect(orchestrator.reconcilePaidOrders()).resolves.toEqual({
      recovered: 0,
      attempted: 1,
      fulfilled: 1,
    });
    expect(order.status).toBe("completed");
    expect(state.confirmationState).toBe("failed");
    expect(confirmationCount).toBe(0);
    expect(deskCreateCount).toBe(1);
    expect(hubEnqueueCount).toBe(1);
  });

  it("records a definite Desk rejection for operator repair without retrying it", async () => {
    const { order, persistence, state } = createMemoryPersistence();
    let deskCreateCount = 0;
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() { return "sent"; },
        async findDeskTicket() { return null; },
        async createDeskTicket() {
          deskCreateCount += 1;
          throw new FulfillmentEffectError("definite_failure", "Desk rejected the request");
        },
        async enqueueHubOrder() {},
      },
    });

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(order.status).toBe("paid");
    expect(state.deskTicketState).toBe("failed");
    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(deskCreateCount).toBe(1);
  });

  it("recovers a stale provisioning claim and resumes from durable effect state", async () => {
    const { order, persistence, state } = createMemoryPersistence("provisioning");
    state.confirmationState = "sent";
    state.deskTicketState = "creating";
    let confirmationCount = 0;
    let deskCreateCount = 0;

    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          confirmationCount += 1;
          return "sent";
        },
        async findDeskTicket() {
          return "desk-recovered";
        },
        async createDeskTicket() {
          deskCreateCount += 1;
          return "desk-duplicate";
        },
        async enqueueHubOrder() {},
      },
    });

    const result = await orchestrator.reconcilePaidOrders();

    expect(result).toEqual({ recovered: 1, attempted: 1, fulfilled: 1 });
    expect(order.status).toBe("completed");
    expect(state.deskTicketId).toBe("desk-recovered");
    expect(confirmationCount).toBe(0);
    expect(deskCreateCount).toBe(0);
  });

  it("keeps completed fulfillment terminal across repeated delivery attempts", async () => {
    const { order, persistence } = createMemoryPersistence("completed");
    let sideEffectCount = 0;
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          sideEffectCount += 1;
          return "sent";
        },
        async findDeskTicket() {
          sideEffectCount += 1;
          return null;
        },
        async createDeskTicket() {
          sideEffectCount += 1;
          return null;
        },
        async enqueueHubOrder() {
          sideEffectCount += 1;
        },
      },
    });

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(order.status).toBe("completed");
    expect(sideEffectCount).toBe(0);
  });

  it("never fulfills an order that is still awaiting payment", async () => {
    const { order, persistence } = createMemoryPersistence("awaiting_payment");
    let sideEffectCount = 0;
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() {
          sideEffectCount += 1;
          return "sent";
        },
        async findDeskTicket() {
          sideEffectCount += 1;
          return null;
        },
        async createDeskTicket() {
          sideEffectCount += 1;
          return null;
        },
        async enqueueHubOrder() {
          sideEffectCount += 1;
        },
      },
    });

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(order.status).toBe("awaiting_payment");
    expect(sideEffectCount).toBe(0);
  });

  it("prevents a recovered stale worker from completing or releasing the new claim", async () => {
    const { order, persistence, state } = createMemoryPersistence();
    const staleClaim = await persistence.claimPaidOrder(order.id);
    expect(staleClaim).not.toBeNull();

    await persistence.recoverStaleProvisioningClaims(new Date());
    const currentClaim = await persistence.claimPaidOrder(order.id);
    expect(currentClaim).not.toBeNull();

    state.confirmationState = "sent";
    state.deskTicketState = "completed";

    expect(await persistence.completeOrder(order.id, staleClaim!.claimToken)).toBe(false);
    await persistence.releaseFailedClaim(order.id, staleClaim!.claimToken, "late worker");
    expect(order.status).toBe("provisioning");

    expect(await persistence.completeOrder(order.id, currentClaim!.claimToken)).toBe(true);
    expect(order.status).toBe("completed");
  });

  it("does not duplicate an ambiguous Desk create while provider reconciliation is empty", async () => {
    const { order, persistence, state } = createMemoryPersistence();
    state.confirmationState = "sent";
    state.deskTicketState = "creating";
    let createCount = 0;
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() { return "sent"; },
        async findDeskTicket() {
          return null;
        },
        async createDeskTicket() {
          createCount += 1;
          return "desk-duplicate";
        },
        async enqueueHubOrder() {},
      },
    });

    expect(await orchestrator.fulfillPaidOrder(order.id)).toBe(false);
    expect(order.status).toBe("paid");
    expect(createCount).toBe(0);
  });

  it("guards overlapping reconciliation passes within one process", async () => {
    const { persistence } = createMemoryPersistence("completed");
    let releaseRecovery!: () => void;
    persistence.recoverStaleProvisioningClaims = () =>
      new Promise((resolve) => {
        releaseRecovery = () => resolve([]);
      });
    const orchestrator = createOrderFulfillmentOrchestrator({
      persistence,
      effects: {
        async sendConfirmation() { return "sent"; },
        async findDeskTicket() {
          return null;
        },
        async createDeskTicket() {
          return null;
        },
        async enqueueHubOrder() {},
      },
    });

    const first = orchestrator.reconcilePaidOrders();
    await Promise.resolve();
    expect(await orchestrator.reconcilePaidOrders()).toEqual({
      recovered: 0,
      attempted: 0,
      fulfilled: 0,
    });
    releaseRecovery();
    await expect(first).resolves.toEqual({ recovered: 0, attempted: 0, fulfilled: 0 });
  });
});
