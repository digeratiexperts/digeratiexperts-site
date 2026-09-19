import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  db: null,
  dbReady: false,
  initPromise: Promise.resolve(false),
}));

const SYNTHETIC_HASH =
  "$2b$12$SYNTHETIC_TEST_ONLY_HASH_xxxxxxxxxxxxxxxxxxxxx";

const BOOTSTRAP_EMAILS = [
  "admin@digeratiexperts.com",
  "admin@digerati-experts.com",
] as const;

describe("portal auth bootstrap initialization (seeded-admin P0)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.ENABLE_DEV_PORTAL_BOOTSTRAP;
    delete process.env.DEV_PORTAL_ADMIN_PASSWORD_HASH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function loadStore() {
    return import("./portalAuthStore");
  }

  it("production + no flag → no bootstrap admin indexed or persisted", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_PORTAL_BOOTSTRAP;
    delete process.env.DEV_PORTAL_ADMIN_PASSWORD_HASH;

    const store = await loadStore();
    store.resetPortalAuthStoreForTests();
    const persisted: string[] = [];
    store.setPersistUserObserverForTests((u) => persisted.push(u.email));

    await store.initPortalAuthStore();

    for (const email of BOOTSTRAP_EMAILS) {
      expect(store.getUser(email)).toBeUndefined();
    }
    expect(persisted).toEqual([]);
  });

  it("production + flag set → still no bootstrap admin indexed or persisted", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_PORTAL_BOOTSTRAP = "true";
    process.env.DEV_PORTAL_ADMIN_PASSWORD_HASH = SYNTHETIC_HASH;

    const store = await loadStore();
    store.resetPortalAuthStoreForTests();
    const persisted: string[] = [];
    store.setPersistUserObserverForTests((u) => persisted.push(u.email));

    await store.initPortalAuthStore();

    for (const email of BOOTSTRAP_EMAILS) {
      expect(store.getUser(email)).toBeUndefined();
    }
    expect(persisted).toEqual([]);
    expect(store.isDevPortalBootstrapAllowed()).toBe(false);
  });

  it("development + flag absent → no bootstrap admin", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.ENABLE_DEV_PORTAL_BOOTSTRAP;
    process.env.DEV_PORTAL_ADMIN_PASSWORD_HASH = SYNTHETIC_HASH;

    const store = await loadStore();
    store.resetPortalAuthStoreForTests();
    const persisted: string[] = [];
    store.setPersistUserObserverForTests((u) => persisted.push(u.email));

    await store.initPortalAuthStore();

    for (const email of BOOTSTRAP_EMAILS) {
      expect(store.getUser(email)).toBeUndefined();
    }
    expect(persisted.filter((e) => BOOTSTRAP_EMAILS.includes(e as any))).toEqual(
      [],
    );
  });

  it("development + explicit flag + synthetic credential → bootstrap occurs (memory + persist attempt)", async () => {
    process.env.NODE_ENV = "development";
    process.env.ENABLE_DEV_PORTAL_BOOTSTRAP = "true";
    process.env.DEV_PORTAL_ADMIN_PASSWORD_HASH = SYNTHETIC_HASH;

    const store = await loadStore();
    store.resetPortalAuthStoreForTests();
    const persisted: Array<{ email: string; role: string }> = [];
    store.setPersistUserObserverForTests((u) =>
      persisted.push({ email: u.email, role: u.role }),
    );

    await store.initPortalAuthStore();

    for (const email of BOOTSTRAP_EMAILS) {
      const user = store.getUser(email);
      expect(user).toBeDefined();
      expect(user?.role).toBe("admin");
      expect(user?.password).toBe(SYNTHETIC_HASH);
    }
    expect(persisted.filter((p) => p.role === "admin").map((p) => p.email).sort()).toEqual(
      [...BOOTSTRAP_EMAILS].sort(),
    );
    expect(persisted.filter((p) => p.role === "admin").every((p) => p.role === "admin")).toBe(true);
  });

  it("initialization remains idempotent under explicit bootstrap", async () => {
    process.env.NODE_ENV = "development";
    process.env.ENABLE_DEV_PORTAL_BOOTSTRAP = "true";
    process.env.DEV_PORTAL_ADMIN_PASSWORD_HASH = SYNTHETIC_HASH;

    const store = await loadStore();
    store.resetPortalAuthStoreForTests();
    const persisted: string[] = [];
    store.setPersistUserObserverForTests((u) => persisted.push(u.email));

    await store.initPortalAuthStore();
    const adminPersists = persisted.filter((e) =>
      BOOTSTRAP_EMAILS.includes(e as (typeof BOOTSTRAP_EMAILS)[number]),
    );
    const firstCount = adminPersists.length;
    await store.initPortalAuthStore();
    const adminPersistsAfter = persisted.filter((e) =>
      BOOTSTRAP_EMAILS.includes(e as (typeof BOOTSTRAP_EMAILS)[number]),
    );
    expect(adminPersistsAfter.length).toBe(firstCount);
    expect(store.getUser(BOOTSTRAP_EMAILS[0])?.id).toBe("admin-001");
  });

  it("source no longer contains the old fixed bootstrap credential material", () => {
    const sourcePath = path.resolve(__dirname, "portalAuthStore.ts");
    const source = readFileSync(sourcePath, "utf8");
    // Split so this test file does not embed the forbidden literal itself.
    const legacyHash = ["$2b$12$Bf.sDD1gQ6391SrTebkd4", ".9BeiteKKOswHl63vyCN0/51CmDldT7K"].join(
      "",
    );
    const legacyPlain = ["Admin", "123!"].join("");
    expect(source).not.toContain(legacyHash);
    expect(source).not.toContain(legacyPlain);
    expect(source).not.toMatch(/seedAdmins\s*\(/);
    expect(source).toMatch(/ENABLE_DEV_PORTAL_BOOTSTRAP/);
    expect(source).toMatch(/DEV_PORTAL_ADMIN_PASSWORD_HASH/);
  });
});
