import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    update: vi.fn(),
    select: vi.fn(),
  },
  sendOrderConfirmation: vi.fn(),
  isDeskConfigured: vi.fn(),
  eventEmit: vi.fn(),
  createTicket: vi.fn(),
  getContactByEmail: vi.fn(),
}));

vi.mock("../db", () => ({ db: mocks.db }));
vi.mock("./notificationService", () => ({
  notificationService: {
    sendOrderConfirmation: mocks.sendOrderConfirmation,
  },
}));
vi.mock("../zoho/zohoClient", () => ({
  zohoClient: {
    isDeskConfigured: mocks.isDeskConfigured,
  },
}));
vi.mock("../zoho/zohoDesk", () => ({
  zohoDeskService: {
    createTicket: mocks.createTicket,
    getContactByEmail: mocks.getContactByEmail,
  },
}));
vi.mock("../eventBus", () => ({
  eventBus: { emit: mocks.eventEmit },
  EventTypes: { LEAD_CREATED: "lead.created" },
}));

import { fulfillPaidOrder, reconcilePaidOrders } from "./orderFulfillment";

const paidOrder = {
  id: "order-1",
  orderNumber: "ORD-TEST-1",
  userId: "user-1",
  clientId: "client-1",
  status: "paid",
  paymentMethod: "zoho",
  lineItems: [],
  subtotal: "100.00",
  tax: "0.00",
  total: "100.00",
  billingEmail: "buyer@example.com",
  billingName: "Test Buyer",
  billingCompany: "Example Co",
  billingAddress: null,
  stripePaymentIntentId: null,
  stripeSessionId: null,
  zohoPaymentId: "pay-1",
  zohoPaymentSessionId: "session-1",
  notes: null,
  paidAt: new Date("2026-08-24T16:00:00Z"),
  createdAt: new Date("2026-08-24T15:55:00Z"),
  updatedAt: new Date("2026-08-24T16:00:00Z"),
};

type ScriptedResult = unknown[] | Error;
let updateResults: ScriptedResult[];
let selectResults: unknown[][];
let updateSets: Array<Record<string, unknown>>;

function nextUpdateResult() {
  const result = updateResults.shift();
  if (result instanceof Error) return Promise.reject(result);
  if (result === undefined) throw new Error("Unexpected db.update().returning() call");
  return Promise.resolve(result);
}

function nextSelectResult() {
  const result = selectResults.shift();
  if (result === undefined) throw new Error("Unexpected db.select() call");
  return Promise.resolve(result);
}

beforeEach(() => {
  updateResults = [];
  selectResults = [];
  updateSets = [];

  mocks.sendOrderConfirmation.mockReset().mockResolvedValue(true);
  mocks.isDeskConfigured.mockReset().mockReturnValue(false);
  mocks.eventEmit.mockReset().mockResolvedValue(undefined);
  mocks.createTicket.mockReset();
  mocks.getContactByEmail.mockReset();

  mocks.db.update.mockReset().mockImplementation(() => ({
    set: (values: Record<string, unknown>) => {
      updateSets.push(values);
      return {
        where: () => ({
          returning: () => nextUpdateResult(),
        }),
      };
    },
  }));

  mocks.db.select.mockReset().mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: () => nextSelectResult(),
      }),
    }),
  }));
});

describe("paid-order fulfillment behavior", () => {
  it("allows only one concurrent caller to own the paid -> provisioning claim", async () => {
    let releaseConfirmation!: () => void;
    const confirmationGate = new Promise<boolean>((resolve) => {
      releaseConfirmation = () => resolve(true);
    });
    mocks.sendOrderConfirmation.mockImplementationOnce(() => confirmationGate);

    updateResults.push(
      [{ ...paidOrder }],
      [],
      [{ id: paidOrder.id }],
    );
    selectResults.push([{ ...paidOrder, status: "provisioning" }]);

    const first = fulfillPaidOrder(paidOrder.id);
    await vi.waitFor(() => expect(mocks.sendOrderConfirmation).toHaveBeenCalledTimes(1));

    const second = await fulfillPaidOrder(paidOrder.id);
    expect(second).toBe(false);

    releaseConfirmation();
    await expect(first).resolves.toBe(true);

    expect(mocks.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(mocks.eventEmit).not.toHaveBeenCalled();
    expect(updateSets.map((set) => set.status)).toEqual([
      "provisioning",
      "provisioning",
      "completed",
    ]);
  });

  it("returns a claimed order to paid when completion fails fatally", async () => {
    updateResults.push(
      [{ ...paidOrder }],
      new Error("completion write failed"),
      [{ id: paidOrder.id, orderNumber: paidOrder.orderNumber }],
    );

    await expect(fulfillPaidOrder(paidOrder.id)).resolves.toBe(false);

    expect(updateSets.map((set) => set.status)).toEqual([
      "provisioning",
      "completed",
      "paid",
    ]);
  });

  it("keeps completed fulfillment idempotent on repeated delivery", async () => {
    updateResults.push([]);
    selectResults.push([
      {
        ...paidOrder,
        status: "completed",
        notes: "[FULFILLED] at 2026-08-24T16:05:00.000Z",
      },
    ]);

    await expect(fulfillPaidOrder(paidOrder.id)).resolves.toBe(false);

    expect(mocks.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(mocks.eventEmit).not.toHaveBeenCalled();
    expect(updateSets.map((set) => set.status)).toEqual(["provisioning"]);
  });

  it("recovers stale provisioning work and fulfills it during reconciliation", async () => {
    updateResults.push(
      [{ id: paidOrder.id, orderNumber: paidOrder.orderNumber }],
      [{ ...paidOrder }],
      [{ id: paidOrder.id }],
    );
    selectResults.push([{ id: paidOrder.id }]);

    await expect(reconcilePaidOrders()).resolves.toEqual({
      recovered: 1,
      attempted: 1,
      fulfilled: 1,
    });

    expect(updateSets.map((set) => set.status)).toEqual([
      "paid",
      "provisioning",
      "completed",
    ]);
    expect(mocks.sendOrderConfirmation).toHaveBeenCalledTimes(1);
  });
});
