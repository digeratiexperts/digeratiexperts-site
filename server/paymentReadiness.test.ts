import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentReadiness } from "./paymentReadiness";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createPaymentReadiness (#263)", () => {
  it("is not ready when credentials are not configured and never probes", async () => {
    const probe = vi.fn(async () => true);
    const r = createPaymentReadiness({ isConfigured: () => false, probe });
    expect(await r.isReady()).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });

  it("configured but invalid credentials (probe throws) => not ready", async () => {
    const r = createPaymentReadiness({
      isConfigured: () => true,
      probe: async () => {
        throw new Error("Zoho Payments OAuth refresh failed: 400");
      },
    });
    expect(await r.isReady()).toBe(false);
    expect(r.snapshot()).toMatchObject({ ready: false, source: "probe" });
  });

  it("probe returning a non-true value => not ready", async () => {
    const r = createPaymentReadiness({ isConfigured: () => true, probe: async () => "yes" as any });
    expect(await r.isReady()).toBe(false);
  });

  it("unknown before any probe completes", () => {
    const r = createPaymentReadiness({ isConfigured: () => true, probe: async () => true });
    expect(r.snapshot()).toEqual({ ready: false, source: "unknown", checkedAt: null, error: null });
  });

  it("caches a successful probe for the TTL, then re-probes when stale", async () => {
    const c = clock();
    const probe = vi.fn(async () => true);
    const r = createPaymentReadiness({ isConfigured: () => true, probe, okTtlMs: 1000, now: c.now });
    expect(await r.isReady()).toBe(true);
    expect(await r.isReady()).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
    c.advance(1001);
    expect(r.snapshot().ready).toBe(false); // stale is not ready
    probe.mockResolvedValueOnce(false);
    expect(await r.isReady()).toBe(false);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("re-probes a failure after the shorter failure TTL so recovery shows up", async () => {
    const c = clock();
    const probe = vi.fn(async () => false);
    const r = createPaymentReadiness({ isConfigured: () => true, probe, failTtlMs: 100, now: c.now });
    expect(await r.isReady()).toBe(false);
    expect(await r.isReady()).toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
    c.advance(101);
    probe.mockResolvedValueOnce(true);
    expect(await r.isReady()).toBe(true);
  });

  it("shares one in-flight probe across concurrent callers", async () => {
    let resolve!: (v: boolean) => void;
    const probe = vi.fn(() => new Promise<boolean>((res) => (resolve = res)));
    const r = createPaymentReadiness({ isConfigured: () => true, probe });
    const a = r.isReady();
    const b = r.isReady();
    resolve(true);
    expect(await Promise.all([a, b])).toEqual([true, true]);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  describe("timeouts", () => {
    afterEach(() => vi.useRealTimers());
    it("a hung probe fails closed after the timeout", async () => {
      vi.useFakeTimers();
      const r = createPaymentReadiness({
        isConfigured: () => true,
        probe: () => new Promise<boolean>(() => {}),
        timeoutMs: 50,
      });
      const p = r.isReady();
      await vi.advanceTimersByTimeAsync(60);
      expect(await p).toBe(false);
    });
  });

  it("markFailed (real checkout OAuth failure) withdraws a cached ready", async () => {
    const r = createPaymentReadiness({ isConfigured: () => true, probe: async () => true });
    expect(await r.isReady()).toBe(true);
    r.markFailed("oauth_refresh_400");
    expect(await r.isReady()).toBe(false);
  });
});

describe("ZohoPaymentsService readiness (#263)", () => {
  const ENV = {
    ZOHO_PAYMENTS_ACCOUNT_ID: "acct-1",
    ZOHO_PAYMENTS_CLIENT_ID: "client-1",
    ZOHO_PAYMENTS_CLIENT_SECRET: "secret-1",
    ZOHO_PAYMENTS_REFRESH_TOKEN: "refresh-1",
    ZOHO_PAYMENTS_SIGNING_KEY: "sign-1",
  };

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // Token state is shared per refresh token (server/zoho/oauth): a token
    // revoked in one case stays revoked for the next case that reuses it.
    (await import("./zoho/oauth")).resetZohoOAuthForTests();
  });

  async function service() {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const { ZohoPaymentsService } = await import("./zohoPayments");
    return new ZohoPaymentsService();
  }

  it("configured credentials whose OAuth refresh is rejected are not live", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_code" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const svc = await service();
    expect(svc.isConfigured()).toBe(true);
    expect(await svc.readiness.isReady()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("valid OAuth refresh makes checkout ready, without creating a payment session", async () => {
    const fetchMock = vi.fn(async (_url: any) =>
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const svc = await service();
    expect(await svc.readiness.isReady()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/oauth/v2/token");
  });
});
