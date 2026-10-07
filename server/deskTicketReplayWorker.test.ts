import { describe, expect, it, vi } from "vitest";
import { fallbackTicket, type DeskTicketSpoolEntry, type FallbackTicket } from "./deskTicketFallback";
import { replaySpooledDeskTickets, type DeskReplayDeps } from "./deskTicketReplayWorker";

const T0 = Date.parse("2026-10-07T01:00:00Z");

function entry(subject: string, emailed: boolean, spooledAt = T0): DeskTicketSpoolEntry {
  const record = fallbackTicket({
    source: "website-widget",
    email: "client@example.com",
    subject,
    description: "details",
    priority: "Medium",
    reason: "auth_failed",
    now: new Date(spooledAt),
  });
  return {
    version: 1,
    spooledAt: new Date(spooledAt).toISOString(),
    salesEmailedAt: null,
    record: { ...record, deskEmailedAt: emailed ? new Date(spooledAt).toISOString() : null },
  };
}

function deps(entries: DeskTicketSpoolEntry[], createInDesk: DeskReplayDeps["createInDesk"], now = T0 + 60_000) {
  const removed: string[] = [];
  const d: DeskReplayDeps = { list: () => entries, remove: (id) => removed.push(id), createInDesk, now: () => now };
  return { d, removed };
}

describe("DE Desk ticket replay", () => {
  it("creates queued tickets in Desk by API once it works, then deletes their spool files", async () => {
    const a = entry("First", false);
    const b = entry("Second", false, T0 + 1000);
    const created: FallbackTicket[] = [];
    const { d, removed } = deps([a, b], async (t) => (created.push(t), "130"));
    expect(await replaySpooledDeskTickets(d)).toEqual({ replayed: 2, expired: 0, waiting: 0 });
    expect(created.map((t) => t.subject)).toEqual(["First", "Second"]);
    expect(removed).toEqual([a.record.id, b.record.id]);
  });

  it("stops at the first refusal and keeps everything for the next tick", async () => {
    const createInDesk = vi.fn(async () => {
      throw new Error("Failed to refresh Zoho Desk access token");
    });
    const { d, removed } = deps([entry("First", false), entry("Second", false, T0 + 1000)], createInDesk);
    expect(await replaySpooledDeskTickets(d)).toEqual({ replayed: 0, expired: 0, waiting: 2 });
    expect(createInDesk).toHaveBeenCalledTimes(1);
    expect(removed).toEqual([]);
  });

  it("never creates a ticket that already reached the Desk inbox by email", async () => {
    const createInDesk = vi.fn(async () => "131");
    const { d, removed } = deps([entry("Emailed", true)], createInDesk);
    expect(await replaySpooledDeskTickets(d)).toEqual({ replayed: 0, expired: 0, waiting: 0 });
    expect(createInDesk).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it("deletes an emailed entry's record after a week", async () => {
    const old = entry("Emailed long ago", true);
    const { d, removed } = deps([old], vi.fn(async () => "x"), T0 + 8 * 24 * 60 * 60_000);
    expect(await replaySpooledDeskTickets(d)).toMatchObject({ expired: 1 });
    expect(removed).toEqual([old.record.id]);
  });
});
