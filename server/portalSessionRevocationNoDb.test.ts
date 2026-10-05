import { afterEach, describe, expect, it, vi } from "vitest";

/** #393: what "loaded" means when there is no database to load from. */
vi.mock("./db", () => ({ db: null, dbReady: false, initPromise: Promise.resolve(false) }));

const saved = { NODE_ENV: process.env.NODE_ENV, SMOKE: process.env.DE_SMOKE_ALLOW_MEMORY_ONLY };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.env.NODE_ENV = saved.NODE_ENV;
  if (saved.SMOKE === undefined) delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
  else process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = saved.SMOKE;
});

async function loadWith(env: { NODE_ENV: string; smoke?: boolean }) {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  process.env.NODE_ENV = env.NODE_ENV;
  if (env.smoke) process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "1";
  else delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
  const rev = await import("./portalSessionRevocation");
  rev.resetRevocationsForTests({ loadState: "pending" });
  await rev.loadRevokedSessions();
  return rev.revocationLoadState();
}

describe("session revocation readiness without a database (#393)", () => {
  it("fails closed in production: a durable set exists that cannot be read", async () => {
    expect(await loadWith({ NODE_ENV: "production" })).toBe("failed");
  });

  it("is ready in the CI memory-only smoke and in development, where nothing is durable", async () => {
    expect(await loadWith({ NODE_ENV: "production", smoke: true })).toBe("ready");
    expect(await loadWith({ NODE_ENV: "development" })).toBe("ready");
  });
});
