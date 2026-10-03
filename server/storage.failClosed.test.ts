import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #248: production must not use MemStorage as a write (or read) backend.
 * Dev/test keep the in-memory fallback. A recovered database is picked up.
 */

async function load(opts: { nodeEnv: string; connected: boolean; reconnect?: () => Promise<boolean> }) {
  vi.resetModules();
  process.env.NODE_ENV = opts.nodeEnv;
  vi.doMock("./db", () => ({
    db: null,
    dbReady: opts.connected,
    initPromise: Promise.resolve(opts.connected),
    getDatabaseStatus: () => ({ connected: opts.connected, type: opts.connected ? "postgresql" : "memory" }),
    reconnectDatabase: opts.reconnect ?? (async () => false),
  }));
  return import("./storage");
}

function fakeRes() {
  const out: { status?: number; body?: any } = {};
  const res: any = {
    status(c: number) {
      out.status = c;
      return res;
    },
    json(b: any) {
      out.body = b;
      return res;
    },
  };
  return { res, out };
}

describe("storage fails closed in production (#248)", () => {
  const env = { ...process.env };
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("production without a database: every storage call rejects with STORAGE_UNAVAILABLE, nothing is stored", async () => {
    const mod = await load({ nodeEnv: "production", connected: false });
    await expect(
      mod.storage.createPortalTicket({ clientId: "c", createdBy: "u", subject: "s", description: "d" } as any),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    await expect(mod.storage.getPortalTickets()).rejects.toBeInstanceOf(mod.StorageUnavailableError);
    expect(mod.getStorageMode()).toBe("unavailable");
  });

  it("the gate answers 503 and never calls the handler", async () => {
    const mod = await load({ nodeEnv: "production", connected: false });
    const { res, out } = fakeRes();
    const next = vi.fn();
    await mod.requireDurableStorage({}, res, next);
    expect(out.status).toBe(503);
    expect(out.body.code).toBe("STORAGE_UNAVAILABLE");
    expect(next).not.toHaveBeenCalled();
  });

  it("production with a database passes the gate and uses the database backend", async () => {
    const mod = await load({ nodeEnv: "production", connected: true });
    const next = vi.fn();
    await mod.requireDurableStorage({}, fakeRes().res, next);
    expect(next).toHaveBeenCalledWith();
    expect(mod.getStorageMode()).toBe("database");
  });

  it("recovers without a restart once the database reconnects", async () => {
    let up = false;
    const mod = await load({ nodeEnv: "production", connected: false, reconnect: async () => up });
    const first = fakeRes();
    await mod.requireDurableStorage({}, first.res, vi.fn());
    expect(first.out.status).toBe(503);
    up = true;
    const next = vi.fn();
    await mod.requireDurableStorage({}, fakeRes().res, next);
    expect(next).toHaveBeenCalledWith();
    expect(mod.getStorageMode()).toBe("database");
  });

  it("development/test without a database keep working on MemStorage", async () => {
    const mod = await load({ nodeEnv: "test", connected: false });
    const ticket = await mod.storage.createPortalTicket({
      clientId: "c",
      createdBy: "u",
      ticketNumber: "T-1",
      subject: "s",
      description: "d",
      status: "open",
      priority: "low",
    } as any);
    expect(ticket.id).toBeTruthy();
    const next = vi.fn();
    await mod.requireDurableStorage({}, fakeRes().res, next);
    expect(next).toHaveBeenCalledWith();
    expect(mod.getStorageMode()).toBe("memory");
  });
});

describe("durable mutation gate routing (#248)", () => {
  it("covers ticket, tenant-file and generic workspace writes, not reads or public pages", async () => {
    const { isDurableMutation } = await import("./durableMutationGate");
    expect(isDurableMutation("POST", "/api/portal/tickets")).toBe(true);
    expect(isDurableMutation("POST", "/api/portal/tickets/abc/comments")).toBe(true);
    expect(isDurableMutation("PATCH", "/api/tasks/1")).toBe(true);
    expect(isDurableMutation("DELETE", "/api/portal/admin/companies/c1/files/f1")).toBe(true);
    expect(isDurableMutation("POST", "/api/chat")).toBe(true);
    expect(isDurableMutation("GET", "/api/portal/tickets")).toBe(false);
    expect(isDurableMutation("GET", "/healthz")).toBe(false);
    expect(isDurableMutation("POST", "/api/public/contact")).toBe(false);
  });
});
