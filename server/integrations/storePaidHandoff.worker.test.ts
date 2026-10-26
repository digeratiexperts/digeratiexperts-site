import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(), retry: vi.fn(), delivered: vi.fn(), gate: vi.fn(), send: vi.fn(),
}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("./deSyncStore", () => ({ claimPendingOutbox: mocks.claim, markOutboxRetry: mocks.retry, markOutboxDelivered: mocks.delivered }));
vi.mock("./deSyncOutboxRecovery", () => ({ recoverStaleOutboxLocks: async () => 0 }));
vi.mock("./ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));
vi.mock("./storePaidHandoff", () => ({ prepareStorePaidHandoff: mocks.gate }));
vi.mock("./techSalesClient", () => ({ deliverEnvelopeToHub: mocks.send, persistHubAccountId: vi.fn() }));
vi.mock("../serviceRequestHubSync", () => ({ recordServiceRequestDelivery: vi.fn() }));
import { processDeSyncOutbox } from "./deSyncWorker";

const record = { eventId: "event-a", eventType: "store.order_created", source: "website", destination: "hub", occurredAt: new Date(), correlationId: "correlation-a", entityType: "store", entityId: "order-a", canonicalAccountId: "hub-a", payload: { id: "order-a", commercial: { status: "paid" }, paidOrderSnapshot: { total: "1250.00" } } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockResolvedValue([record]);
  mocks.retry.mockResolvedValue("retry");
  mocks.gate.mockImplementation(async (_database, envelope) => envelope);
  mocks.send.mockResolvedValue({ canonicalAccountId: null, duplicate: false });
});
describe("paid Store outbox transport boundary", () => {
  it("retains a blocked handoff without sending or acknowledging it", async () => {
    mocks.gate.mockRejectedValue(new Error("Store paid handoff blocked: change_requires_reconciliation"));
    expect(await processDeSyncOutbox()).toEqual({ delivered: 0, retried: 1, dlq: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.delivered).not.toHaveBeenCalled();
    expect(mocks.retry).toHaveBeenCalledWith("event-a", expect.stringContaining("change_requires_reconciliation"));
  });
  it("passes a currently eligible handoff through the existing sender", async () => {
    expect(await processDeSyncOutbox()).toEqual({ delivered: 1, retried: 0, dlq: 0 });
    expect(mocks.gate).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send.mock.calls[0][0].payload).not.toHaveProperty("paidOrderSnapshot");
    expect(record.payload).toHaveProperty("paidOrderSnapshot");
  });
  it("leaves existing unpaid Store intake behavior unchanged", async () => {
    mocks.claim.mockResolvedValue([{ ...record, payload: { id: "order-a", commercial: { status: "awaiting_payment" } } }]);
    expect(await processDeSyncOutbox()).toEqual({ delivered: 1, retried: 0, dlq: 0 });
    expect(mocks.gate).not.toHaveBeenCalled();
  });
});
