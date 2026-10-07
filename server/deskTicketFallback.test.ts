import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deskFallbackInbox,
  fallbackReference,
  fallbackTicket,
  saveTicketOutsideDesk,
  type DeskFallbackDeps,
  type DeskTicketSpoolEntry,
} from "./deskTicketFallback";
import { listSpoolEntries, updateSpoolEntry, writeSpoolEntry } from "./publicSolutionSpool";

const NOW = new Date("2026-10-07T01:00:00Z");

const ticket = () =>
  fallbackTicket({
    source: "website-widget",
    email: "client@example.com",
    name: "Pat Client",
    subject: "Outlook keeps logging me out",
    description: "Since this morning.",
    priority: "High",
    reason: "auth_failed",
    now: NOW,
  });

function deps(overrides: Partial<DeskFallbackDeps> = {}) {
  const spooled: DeskTicketSpoolEntry[] = [];
  const updated: DeskTicketSpoolEntry[] = [];
  const d: DeskFallbackDeps = {
    spool: vi.fn((entry) => (spooled.push(entry), true)),
    updateSpool: vi.fn((entry) => (updated.push(entry), true)),
    emailDesk: vi.fn(async () => true),
    acknowledgeClient: vi.fn(async () => true),
    alertStaff: vi.fn(async () => true),
    now: () => NOW,
    ...overrides,
  };
  return { d, spooled, updated };
}

describe("DE Desk ticket failover", () => {
  afterEach(() => {
    delete process.env.DESK_FALLBACK_EMAIL;
  });

  it("gives the client a reference they can quote", () => {
    expect(fallbackReference("website-widget", NOW)).toMatch(/^DE-W-[0-9A-Z]+-[0-9A-F]{6}$/);
    expect(fallbackReference("client-portal", NOW)).toMatch(/^DE-P-/);
    const t = ticket();
    expect(t.id).toBe(t.reference);
    expect(t.deskEmailedAt).toBeNull();
  });

  it("spools, emails the Desk inbox, marks the entry so it is never replayed, and acknowledges the client", async () => {
    const { d, spooled, updated } = deps();
    const outcome = await saveTicketOutsideDesk(ticket(), {}, d);
    expect(outcome).toEqual({ accepted: true, spooled: true, deskEmailed: true, clientAcknowledged: true });
    expect(spooled[0].record.deskEmailedAt).toBeNull();
    expect(updated[0].record.deskEmailedAt).toBe(NOW.toISOString());
    expect(d.acknowledgeClient).toHaveBeenCalledTimes(1);
    expect(d.alertStaff).toHaveBeenCalledTimes(1);
  });

  it("is accepted on the spool alone when the email fails, and stays queued for the API replay", async () => {
    const { d, updated } = deps({ emailDesk: vi.fn(async () => false) });
    const outcome = await saveTicketOutsideDesk(ticket(), {}, d);
    expect(outcome).toMatchObject({ accepted: true, spooled: true, deskEmailed: false });
    expect(updated).toHaveLength(0);
  });

  it("is accepted on the Desk email alone when the disk refuses", async () => {
    const { d } = deps({ spool: vi.fn(() => false) });
    expect(await saveTicketOutsideDesk(ticket(), {}, d)).toMatchObject({ accepted: true, spooled: false, deskEmailed: true });
  });

  it("is not accepted when nothing held, and then never tells the client it was received", async () => {
    const { d } = deps({ spool: vi.fn(() => false), emailDesk: vi.fn(async () => false) });
    const outcome = await saveTicketOutsideDesk(ticket(), {}, d);
    expect(outcome.accepted).toBe(false);
    expect(d.acknowledgeClient).not.toHaveBeenCalled();
  });

  it("never throws, whatever a layer does", async () => {
    const { d } = deps({
      spool: vi.fn(() => {
        throw new Error("EACCES");
      }),
      emailDesk: vi.fn(async () => {
        throw new Error("network");
      }),
      alertStaff: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    await expect(saveTicketOutsideDesk(ticket(), {}, d)).resolves.toMatchObject({ accepted: false });
  });

  it("skips the client acknowledgement when the client already sees the ticket (the portal)", async () => {
    const { d } = deps();
    await saveTicketOutsideDesk(ticket(), { acknowledge: false }, d);
    expect(d.acknowledgeClient).not.toHaveBeenCalled();
  });

  it("emails the Desk inbox by default, or the one named in DESK_FALLBACK_EMAIL", () => {
    expect(deskFallbackInbox({})).toBe("support@digerati-experts.com");
    expect(deskFallbackInbox({ DESK_FALLBACK_EMAIL: "help@example.com" })).toBe("help@example.com");
  });

  it("writes a real spool file the replay can read back, private to the service user", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desk-spool-test-"));
    const t = ticket();
    const entry: DeskTicketSpoolEntry = { version: 1, spooledAt: NOW.toISOString(), salesEmailedAt: null, record: t };
    expect(writeSpoolEntry(entry, dir)).toBe(true);
    expect(updateSpoolEntry({ ...entry, record: { ...t, deskEmailedAt: NOW.toISOString() } }, dir)).toBe(true);
    const [read] = listSpoolEntries<typeof t>(dir);
    expect(read.record).toMatchObject({ reference: t.reference, email: "client@example.com", deskEmailedAt: NOW.toISOString() });
    expect(fs.statSync(path.join(dir, `${t.id}.json`)).mode & 0o777).toBe(0o600);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
