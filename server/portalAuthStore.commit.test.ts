import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #245: authoritative auth/profile mutations must be durable before the caller
 * may report success. commitUser/commitClient await the database write, throw
 * PortalPersistenceError when it is not confirmed, and restore the cached
 * (in-place mutated) object so a failed change is not visible either.
 */

function fakeDb(state: { fail: boolean; writes: any[] }) {
  return {
    insert: () => ({
      values: (v: any) => ({
        onConflictDoUpdate: async () => {
          if (state.fail) throw new Error("connection terminated");
          state.writes.push(v);
        },
      }),
    }),
  };
}

const queuePortalIdentityLink = vi.fn();

async function loadStore(mock: { dbReady: boolean; db: unknown }) {
  vi.resetModules();
  queuePortalIdentityLink.mockReset();
  vi.doMock("./integrations/linkPortalIdentity", () => ({ queuePortalIdentityLink }));
  vi.doMock("./db", () => ({ db: mock.db, dbReady: mock.dbReady, initPromise: Promise.resolve(mock.dbReady) }));
  const store = await import("./portalAuthStore");
  store.resetPortalAuthStoreForTests();
  return store;
}

const baseUser = () => ({
  id: "user-1",
  email: "pat@example.com",
  username: "pat",
  password: "old-hash",
  fullName: "Pat",
  role: "user",
  emailVerified: false,
  mfaEnabled: true,
  mfaBackupCodes: ["code-a", "code-b"],
});

describe("commitUser / commitClient durability (#245)", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.VITEST = "true";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("indexes and returns only after the database write succeeds", async () => {
    const state = { fail: false, writes: [] as any[] };
    const store = await loadStore({ dbReady: true, db: fakeDb(state) });
    const user = baseUser();
    await store.commitUser(user);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].email).toBe("pat@example.com");
    expect(store.getUser("pat@example.com")).toBe(user);
  });

  it("a failed password write throws and the cached user keeps its old password", async () => {
    const state = { fail: false, writes: [] as any[] };
    const store = await loadStore({ dbReady: true, db: fakeDb(state) });
    const user = baseUser();
    await store.commitUser(user);

    const live = store.getUser("pat@example.com")!;
    live.password = "new-hash"; // handlers mutate the cached object in place
    state.fail = true;
    await expect(store.commitUser(live)).rejects.toBeInstanceOf(store.PortalPersistenceError);
    expect(store.getUser("pat@example.com")!.password).toBe("old-hash");
  });

  it("a failed verification or MFA write is rolled back, including consumed backup codes", async () => {
    const state = { fail: false, writes: [] as any[] };
    const store = await loadStore({ dbReady: true, db: fakeDb(state) });
    await store.commitUser(baseUser());
    const live = store.getUser("pat")!;
    live.emailVerified = true;
    live.mfaBackupCodes!.splice(0, 1);
    state.fail = true;
    await expect(store.commitUser(live)).rejects.toMatchObject({ code: "PERSISTENCE_UNAVAILABLE" });
    expect(live.emailVerified).toBe(false);
    expect(live.mfaBackupCodes).toEqual(["code-a", "code-b"]);
  });

  it("a user whose first write failed is never indexed", async () => {
    const state = { fail: true, writes: [] as any[] };
    const store = await loadStore({ dbReady: true, db: fakeDb(state) });
    await expect(store.commitUser(baseUser())).rejects.toBeInstanceOf(store.PortalPersistenceError);
    expect(store.getUser("pat@example.com")).toBeUndefined();
  });

  it("production with no database refuses to commit and leaves the cache alone", async () => {
    process.env.NODE_ENV = "production";
    const store = await loadStore({ dbReady: false, db: null });
    await expect(store.commitUser(baseUser())).rejects.toBeInstanceOf(store.PortalPersistenceError);
    expect(store.getUser("pat@example.com")).toBeUndefined();
    await expect(
      store.commitClient({ id: "c1", companyName: "Acme", contactEmail: "a@acme.test" }),
    ).rejects.toBeInstanceOf(store.PortalPersistenceError);
    expect(store.getClient("c1")).toBeUndefined();
  });

  it("dev/test with no database keeps working in memory", async () => {
    process.env.NODE_ENV = "test";
    const store = await loadStore({ dbReady: false, db: null });
    await store.commitUser(baseUser());
    expect(store.getUser("pat")?.id).toBe("user-1");
    await store.commitClient({ id: "c1", companyName: "Acme", contactEmail: "a@acme.test" });
    expect(store.getClient("c1")?.companyName).toBe("Acme");
  });

  it("a failed client write throws and restores the cached company", async () => {
    const state = { fail: false, writes: [] as any[] };
    const store = await loadStore({ dbReady: true, db: fakeDb(state) });
    await store.commitClient({ id: "c1", companyName: "Acme", contactEmail: "a@acme.test" });
    const live = store.getClient("c1")!;
    live.companyName = "Renamed";
    state.fail = true;
    await expect(store.commitClient(live)).rejects.toBeInstanceOf(store.PortalPersistenceError);
    expect(store.getClient("c1")!.companyName).toBe("Acme");
  });

  it("rolls back the company when the second registration write fails", async () => {
    const durable: unknown[] = [];
    const attempts: any[] = [];
    const mock = {
      transaction: async (operation: (tx: unknown) => Promise<void>) => {
        const pending: unknown[] = [];
        await operation({ insert: () => ({ values: (value: any) => ({
          onConflictDoUpdate: async () => {
            attempts.push(value);
            if (attempts.length === 2) throw new Error("user unique constraint");
            pending.push(value);
          },
        }) }) });
        durable.push(...pending);
      },
    };
    const store = await loadStore({ dbReady: true, db: mock });
    const user = { ...baseUser(), clientId: null, storeRole: "prospect" as const };
    await expect(store.createProspectClientForUser(user, "EXAMPLE Company")).rejects.toBeInstanceOf(store.PortalPersistenceError);
    expect(attempts).toHaveLength(2);
    expect(durable).toEqual([]);
    expect(store.listClients()).toEqual([]);
    expect(store.getUser(user.email)).toBeUndefined();
    expect(user.clientId).toBeNull();
    expect(queuePortalIdentityLink).not.toHaveBeenCalled();
  });

  it("publishes both records and queues identity linking only after the transaction commits", async () => {
    const durable: any[] = [];
    let release!: () => void;
    let wrotePair!: () => void;
    const pendingCommit = new Promise<void>(resolve => { release = resolve; });
    const pairWritten = new Promise<void>(resolve => { wrotePair = resolve; });
    const mock = {
      transaction: async (operation: (tx: unknown) => Promise<void>) => {
        const pending: any[] = [];
        await operation({ insert: () => ({ values: (value: any) => ({
          onConflictDoUpdate: async () => { pending.push(value); },
        }) }) });
        wrotePair();
        await pendingCommit;
        durable.push(...pending);
      },
    };
    const store = await loadStore({ dbReady: true, db: mock });
    const user = { ...baseUser(), clientId: null };
    const registration = store.createProspectClientForUser(user, "EXAMPLE Company");
    await pairWritten;
    expect(store.listClients()).toEqual([]);
    expect(store.getUser(user.email)).toBeUndefined();
    expect(queuePortalIdentityLink).not.toHaveBeenCalled();
    release();
    const company = await registration;
    expect(durable).toHaveLength(2);
    expect(durable[1].clientId).toBe(durable[0].id);
    expect(store.getClient(company.id)).toBe(company);
    expect(store.getUser(user.email)).toBe(user);
    expect(user.clientId).toBe(company.id);
    await vi.waitFor(() => expect(queuePortalIdentityLink).toHaveBeenCalledOnce());
  });

  it("prospect signup fails closed in production without a database and indexes nothing", async () => {
    process.env.NODE_ENV = "production";
    const store = await loadStore({ dbReady: false, db: null });
    const user = baseUser();
    await expect(store.createProspectClientForUser(user as any)).rejects.toBeInstanceOf(store.PortalPersistenceError);
    expect(store.getUser("pat@example.com")).toBeUndefined();
    expect(store.listClients()).toHaveLength(0);
  });
});

describe("route wiring (#245)", () => {
  it("no portal route acknowledges a user/company mutation through the fire-and-forget facade", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/portalUsers\.set\(/);
    expect(src).not.toMatch(/portalClients\.set\(/);
  });
});
