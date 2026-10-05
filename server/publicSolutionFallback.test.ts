import { describe, expect, it, vi } from "vitest";
import { saveOutsideDatabase, type FallbackDeps } from "./publicSolutionFallback";

const record = { id: "req-1", reference: "DE-ABC123", crmStatus: "pending" } as any;

function deps(overrides: Partial<FallbackDeps> = {}): FallbackDeps {
  return {
    spool: vi.fn(() => true),
    updateSpool: vi.fn(() => true),
    syncCrm: vi.fn(async () => "pending" as const),
    emailSales: vi.fn(async () => false),
    now: () => new Date("2026-10-04T12:00:00.000Z"),
    ...overrides,
  };
}

describe("saving a solution request outside the database (#243)", () => {
  it("prefers the spool, and records on it what the CRM and email already did", async () => {
    const d = deps({ syncCrm: vi.fn(async () => "recorded" as const), emailSales: vi.fn(async () => true) });
    const outcome = await saveOutsideDatabase(record, d);
    expect(outcome).toEqual({ durable: "spool", spooled: true, crmRecorded: true, salesEmailed: true });
    expect(d.updateSpool).toHaveBeenCalledWith(
      expect.objectContaining({
        salesEmailedAt: "2026-10-04T12:00:00.000Z",
        record: expect.objectContaining({ crmStatus: "recorded" }),
      }),
    );
  });

  it("falls to the CRM, then the email, and reports nothing held only when all three fail", async () => {
    expect((await saveOutsideDatabase(record, deps({ spool: () => false, syncCrm: async () => "recorded" }))).durable).toBe("crm");
    expect((await saveOutsideDatabase(record, deps({ spool: () => false, emailSales: async () => true }))).durable).toBe("email");
    expect((await saveOutsideDatabase(record, deps({ spool: () => false }))).durable).toBeNull();
  });

  it("treats a throwing layer as a failed layer and still tries the others", async () => {
    const outcome = await saveOutsideDatabase(
      record,
      deps({
        spool: () => {
          throw new Error("disk");
        },
        syncCrm: async () => {
          throw new Error("zoho");
        },
        emailSales: async () => true,
      }),
    );
    expect(outcome).toEqual({ durable: "email", spooled: false, crmRecorded: false, salesEmailed: true });
  });
});
