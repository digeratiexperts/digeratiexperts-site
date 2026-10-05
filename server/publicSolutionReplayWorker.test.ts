import { describe, expect, it, vi } from "vitest";
import { replaySpooledSolutionRequests, type ReplayDeps } from "./publicSolutionReplayWorker";
import type { SpoolEntry } from "./publicSolutionSpool";

vi.mock("./publicSolutionRequestCrm", () => ({ buildPublicSolutionRequestDescription: () => "desc", syncPublicSolutionRequestToCrm: vi.fn() }));

const NOW = Date.parse("2026-10-04T12:00:00.000Z");
const record = (id: string, crmStatus = "pending") =>
  ({
    id,
    reference: "DE-ABC123",
    contactName: "Riley",
    contactEmail: "r@example.com",
    contactPhone: "480",
    organizationName: "Riley Co",
    crmStatus,
    durable: null,
    selectedNeeds: [],
    fulfillment: { installation: null, remoteSupport: null },
  }) as any;
const spooled = (id: string, extra: Partial<SpoolEntry> = {}): SpoolEntry => ({
  version: 1,
  spooledAt: "2026-10-04T11:59:00.000Z",
  salesEmailedAt: null,
  record: record(id),
  ...extra,
});

function deps(entries: SpoolEntry[], overrides: Partial<ReplayDeps> = {}) {
  const updates: any[] = [];
  const d: ReplayDeps = {
    dbAvailable: vi.fn(async () => true),
    persist: vi.fn(async () => true),
    syncCrm: vi.fn(async () => "recorded" as const),
    emitLead: vi.fn(),
    queueHub: vi.fn(async () => undefined),
    list: () => entries,
    update: vi.fn((e) => {
      updates.push(e);
      return true;
    }),
    remove: vi.fn(),
    now: () => NOW,
    ...overrides,
  };
  return { d, updates };
}

describe("recovering spooled solution requests into the database (#243)", () => {
  it("waits, touching nothing, while the database is still down", async () => {
    const { d } = deps([spooled("req-1")], { dbAvailable: async () => false });
    expect(await replaySpooledSolutionRequests(d)).toEqual({ recovered: 0, waiting: 1 });
    expect(d.persist).not.toHaveBeenCalled();
    expect(d.remove).not.toHaveBeenCalled();
  });

  it("writes the row, creates the missing CRM lead, sends the full lead event, then deletes the file", async () => {
    const { d } = deps([spooled("req-1")]);
    expect(await replaySpooledSolutionRequests(d)).toEqual({ recovered: 1, waiting: 0 });
    expect(d.persist).toHaveBeenCalledWith(expect.objectContaining({ id: "req-1", durable: "spool" }));
    expect(d.persist).toHaveBeenLastCalledWith(expect.objectContaining({ crmStatus: "recorded" }));
    expect(d.emitLead).toHaveBeenCalledWith(expect.objectContaining({ id: "req-1", source: "solution_request" }));
    expect(d.queueHub).not.toHaveBeenCalled();
    expect(d.remove).toHaveBeenCalledWith("req-1");
  });

  it("does not create a second CRM lead or a second email when the submit already did", async () => {
    const { d } = deps([spooled("req-2", { salesEmailedAt: "2026-10-04T11:59:01.000Z", record: record("req-2", "recorded") })]);
    await replaySpooledSolutionRequests(d);
    expect(d.syncCrm).not.toHaveBeenCalled();
    expect(d.emitLead).not.toHaveBeenCalled();
    expect(d.queueHub).toHaveBeenCalledWith(expect.objectContaining({ id: "req-2" }));
  });

  it("keeps the file and stops when the database refuses the write mid-run", async () => {
    const { d } = deps([spooled("req-3"), spooled("req-4")], { persist: vi.fn(async () => false) });
    expect(await replaySpooledSolutionRequests(d)).toEqual({ recovered: 0, waiting: 2 });
    expect(d.remove).not.toHaveBeenCalled();
    expect(d.emitLead).not.toHaveBeenCalled();
  });

  it("does not send the lead event twice after a crash between sending and deleting", async () => {
    const { d } = deps([{ ...spooled("req-5"), leadSentAt: "2026-10-04T11:59:30.000Z" } as SpoolEntry]);
    await replaySpooledSolutionRequests(d);
    expect(d.emitLead).not.toHaveBeenCalled();
    expect(d.queueHub).not.toHaveBeenCalled();
    expect(d.remove).toHaveBeenCalledWith("req-5");
  });
});
