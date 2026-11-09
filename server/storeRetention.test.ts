import { describe, expect, it, vi } from "vitest";
import {
  classifyForRetention,
  retentionCutoff,
  retentionDeleteEnabled,
  runStoreRetention,
  type RetentionCandidate,
  type RetentionDeps,
  type RetentionLogLine,
  type SaleEvidence,
} from "./storeRetention";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const CUTOFF = retentionCutoff(NOW); // 2024-11-09T12:00:00.000Z
const NO_SALE: SaleEvidence = { clientLinked: false, orderLinked: false, paymentRecorded: false, zohoDealWon: false };
const OLD = new Date("2024-01-01T00:00:00.000Z");

function candidate(overrides: Partial<RetentionCandidate> = {}, evidence: Partial<SaleEvidence> = {}): RetentionCandidate {
  return {
    table: "store_quote_requests",
    id: "q-1",
    status: "pending",
    submittedAt: OLD,
    ...overrides,
    evidence: { ...NO_SALE, ...evidence },
  };
}

describe("retentionCutoff", () => {
  it("is exactly two years before the run time", () => {
    expect(retentionCutoff(NOW).toISOString()).toBe("2024-11-09T12:00:00.000Z");
  });
});

describe("classifyForRetention", () => {
  it("deletes a non-sale quote older than two years", () => {
    expect(classifyForRetention(candidate(), CUTOFF)).toEqual({ eligible: true });
  });

  it("keeps a quote that was converted to an order (sale recorded)", () => {
    expect(classifyForRetention(candidate({}, { orderLinked: true }), CUTOFF)).toEqual({ eligible: false, reason: "sale_recorded" });
    expect(classifyForRetention(candidate({}, { paymentRecorded: true }), CUTOFF)).toEqual({ eligible: false, reason: "sale_recorded" });
    expect(classifyForRetention(candidate({}, { clientLinked: true }), CUTOFF)).toEqual({ eligible: false, reason: "sale_recorded" });
    expect(classifyForRetention(candidate({}, { zohoDealWon: true }), CUTOFF)).toEqual({ eligible: false, reason: "sale_recorded" });
  });

  it("keeps a quote whose status says it became a sale", () => {
    expect(classifyForRetention(candidate({ status: "converted" }), CUTOFF)).toEqual({ eligible: false, reason: "status_not_eligible" });
  });

  it("keeps a record when any sale signal is unknown (fail closed)", () => {
    expect(classifyForRetention(candidate({}, { clientLinked: null }), CUTOFF)).toEqual({ eligible: false, reason: "sale_unknown" });
    expect(classifyForRetention(candidate({}, { zohoDealWon: null }), CUTOFF)).toEqual({ eligible: false, reason: "sale_unknown" });
  });

  it("keeps a submitted solution whose sale evidence is unknown (no order or deal link exists)", () => {
    const solution = candidate(
      { table: "public_solution_requests", id: "s-1", status: "submitted" },
      { clientLinked: null, orderLinked: null, paymentRecorded: null, zohoDealWon: null },
    );
    expect(classifyForRetention(solution, CUTOFF)).toEqual({ eligible: false, reason: "sale_unknown" });
  });

  it("keeps a submitted solution with a Zoho deal won", () => {
    const solution = candidate(
      { table: "public_solution_requests", status: "submitted" },
      { clientLinked: false, orderLinked: false, paymentRecorded: false, zohoDealWon: true },
    );
    expect(classifyForRetention(solution, CUTOFF)).toEqual({ eligible: false, reason: "sale_recorded" });
  });

  it("keeps a young record", () => {
    expect(classifyForRetention(candidate({ submittedAt: new Date("2025-11-09T12:00:00.000Z") }), CUTOFF)).toEqual({
      eligible: false,
      reason: "too_recent",
    });
  });

  it("applies the two-year boundary strictly: exactly two years is kept, one millisecond older is deleted", () => {
    expect(classifyForRetention(candidate({ submittedAt: CUTOFF }), CUTOFF)).toEqual({ eligible: false, reason: "too_recent" });
    expect(classifyForRetention(candidate({ submittedAt: new Date(CUTOFF.getTime() - 1) }), CUTOFF)).toEqual({ eligible: true });
  });

  it("keeps a record whose submission time cannot be read", () => {
    expect(classifyForRetention(candidate({ submittedAt: null }), CUTOFF)).toEqual({ eligible: false, reason: "no_submission_time" });
    expect(classifyForRetention(candidate({ submittedAt: new Date("not a date") }), CUTOFF)).toEqual({
      eligible: false,
      reason: "no_submission_time",
    });
  });
});

describe("retentionDeleteEnabled", () => {
  it("is on only for the exact value 'true'", () => {
    expect(retentionDeleteEnabled({ STORE_PII_RETENTION_DELETE_ENABLED: "true" })).toBe(true);
    for (const value of ["", "1", "TRUE", "yes", " true", "false"]) {
      expect(retentionDeleteEnabled({ STORE_PII_RETENTION_DELETE_ENABLED: value })).toBe(false);
    }
    expect(retentionDeleteEnabled({})).toBe(false);
  });
});

function jobDeps(candidates: RetentionCandidate[], overrides: Partial<RetentionDeps> = {}) {
  const logs: RetentionLogLine[] = [];
  const deleteRecord = vi.fn(async () => true);
  const deps: RetentionDeps = {
    enabled: () => false,
    available: async () => true,
    listCandidates: vi.fn(async (table) => candidates.filter((c) => c.table === table)),
    // A Zoho check that finds no deal won. The production default is null (unknown), tested below.
    zohoDealWon: async () => false,
    deleteRecord,
    log: (line) => logs.push(line),
    now: () => NOW,
    ...overrides,
  };
  return { deps, logs, deleteRecord };
}

const MIXED: RetentionCandidate[] = [
  candidate({ id: "old-non-sale" }),
  candidate({ id: "old-converted", status: "converted" }),
  candidate({ id: "old-sold" }, { orderLinked: true }),
  candidate({ id: "old-unknown" }, { clientLinked: null }),
  candidate({ id: "young-non-sale", submittedAt: new Date("2026-01-01T00:00:00.000Z") }),
  candidate({ id: "solution-unknown", table: "public_solution_requests", status: "submitted" }, { clientLinked: null, orderLinked: null, paymentRecorded: null }),
];

describe("runStoreRetention (dry run, flag off)", () => {
  it("makes no delete calls and logs only the eligible ids as would-delete", async () => {
    const { deps, logs, deleteRecord } = jobDeps(MIXED);
    const summary = await runStoreRetention(deps);

    expect(deleteRecord).not.toHaveBeenCalled();
    expect(summary.mode).toBe("dry_run");
    expect(summary.deleted).toBe(0);
    expect(summary.eligible).toBe(1);

    const wouldDelete = logs.filter((l) => l.event === "store_retention_would_delete");
    expect(wouldDelete.map((l) => l.id)).toEqual(["old-non-sale"]);
    expect(wouldDelete[0]).toMatchObject({ dry_run: true, table: "store_quote_requests", class: "store_quote_requests:non_sale" });
    expect(logs.some((l) => l.event === "store_retention_deleted")).toBe(false);
  });

  it("skips quietly when the database is unavailable", async () => {
    const { deps, logs, deleteRecord } = jobDeps(MIXED, { available: async () => false });
    const summary = await runStoreRetention(deps);
    expect(summary.skipped).toBe(true);
    expect(deps.listCandidates).not.toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ event: "store_retention_skipped" });
  });
});

describe("runStoreRetention (enabled)", () => {
  it("deletes only eligible ids and writes one audit line per deletion", async () => {
    const { deps, logs, deleteRecord } = jobDeps(MIXED, { enabled: () => true });
    const summary = await runStoreRetention(deps);

    expect(deleteRecord.mock.calls).toEqual([["store_quote_requests", "old-non-sale", CUTOFF]]);
    expect(summary.mode).toBe("delete");
    expect(summary.deleted).toBe(1);

    const deletedLines = logs.filter((l) => l.event === "store_retention_deleted");
    expect(deletedLines).toHaveLength(1);
    expect(deletedLines[0]).toMatchObject({
      id: "old-non-sale",
      table: "store_quote_requests",
      class: "store_quote_requests:non_sale",
      age_days: Math.floor((NOW.getTime() - OLD.getTime()) / 86_400_000),
    });
    expect(typeof deletedLines[0].at).toBe("string");
  });

  it("logs no contact data: a line carries only ids, class, age and times", async () => {
    const withPii = candidate({ id: "old-pii" });
    const { deps, logs } = jobDeps([withPii], { enabled: () => true });
    await runStoreRetention(deps);
    const text = JSON.stringify(logs);
    expect(text).toContain("old-pii");
    expect(text).not.toMatch(/@|\d{3}-\d{4}|contact|email|phone|notes/i);
  });

  it("keeps a row whose delete finds it changed since the scan", async () => {
    const { deps, logs } = jobDeps([candidate({ id: "raced" })], {
      enabled: () => true,
      deleteRecord: vi.fn(async () => false),
    });
    const summary = await runStoreRetention(deps);
    expect(summary.deleted).toBe(0);
    expect(summary.kept.changed_since_scan).toBe(1);
    expect(logs.some((l) => l.event === "store_retention_deleted")).toBe(false);
  });

  it("keeps everything when the Zoho deal stage is unknown (the production default)", async () => {
    const { deps, deleteRecord } = jobDeps(MIXED, {
      enabled: () => true,
      zohoDealWon: async () => null,
    });
    const summary = await runStoreRetention(deps);
    expect(deleteRecord).not.toHaveBeenCalled();
    expect(summary.eligible).toBe(0);
    expect(summary.kept.sale_unknown).toBeGreaterThan(0);
  });

  it("treats a failing Zoho check as unknown and keeps the row", async () => {
    const { deps, deleteRecord } = jobDeps([candidate({ id: "zoho-down" })], {
      enabled: () => true,
      zohoDealWon: async () => {
        throw new Error("zoho unavailable");
      },
    });
    const summary = await runStoreRetention(deps);
    expect(deleteRecord).not.toHaveBeenCalled();
    expect(summary.kept.sale_unknown).toBe(1);
  });

  it("never throws: a failing delete is logged and the next record is still processed", async () => {
    const deleteRecord = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("db down"), { code: "08006" }))
      .mockResolvedValueOnce(true);
    const { deps, logs } = jobDeps(
      [candidate({ id: "first" }), candidate({ id: "second" })],
      { enabled: () => true, deleteRecord },
    );
    const summary = await runStoreRetention(deps);
    expect(summary.errors).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(logs.find((l) => l.event === "store_retention_error")).toMatchObject({ id: "first", code: "08006" });
    expect(logs.find((l) => l.event === "store_retention_deleted")).toMatchObject({ id: "second" });
  });

  it("never throws when listing fails for one table, and still scans the other", async () => {
    const { deps, logs } = jobDeps(MIXED, {
      enabled: () => true,
      listCandidates: vi.fn(async (table) => {
        if (table === "public_solution_requests") throw new Error("relation missing");
        return MIXED.filter((c) => c.table === table);
      }),
    });
    const summary = await runStoreRetention(deps);
    expect(summary.errors).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(logs.find((l) => l.event === "store_retention_error")).toMatchObject({ table: "public_solution_requests", stage: "list" });
  });
});
