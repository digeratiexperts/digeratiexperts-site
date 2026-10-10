/**
 * Mirrors Intelligence Hub lib/zoho-oauth/manager.test.ts: budget, backoff,
 * error kinds, client pinning, persistence, DC hosts, Connect + revoke.
 * Adapted to the website's sources: legacy env tokens with their own client
 * (instead of the Hub's per-product DB rows), and the ZOHO_CONNECT_ENABLED flag.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isZohoAccountsServer, zohoDcFromUrl, zohoDefaultDc } from "./dc";
import {
  REFRESH_BUDGET,
  fingerprint,
  resetZohoRuntimeForTests,
  UNIFIED_PROVIDER,
  ZohoAuthUnavailableError,
  ZohoProductAuth,
  type LegacyEnvSource,
  type ZohoAuthProblem,
  type ZohoProductAuthConfig,
} from "./manager";
import { buildZohoConnectUrl, completeZohoConnect, disconnectZoho, ZOHO_CONNECT_CALLBACK_PATH } from "./connect";
import { productsCoveredBy, scopesCover, scopesForProducts, ZOHO_PRODUCT_SCOPES } from "./scopes";
import { MemoryZohoTokenStore } from "./store";
import { classifyTokenError } from "./token-endpoint";

class NotConnected extends Error {
  constructor(message: string, readonly problem: ZohoAuthProblem) {
    super(message);
  }
}

type Reply = { status?: number; body: unknown };

function mockFetch(replies: Array<Reply | ((url: string, init?: RequestInit) => Reply)>) {
  const calls: Array<{ url: string; params: URLSearchParams | null; headers: Headers }> = [];
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    const params = init?.body instanceof URLSearchParams ? new URLSearchParams(init.body) : null;
    calls.push({ url, params, headers: new Headers(init?.headers) });
    const next = replies.length > 1 ? replies.shift()! : replies[0];
    if (!next) throw new Error(`unexpected fetch ${url}`);
    const r = typeof next === "function" ? next(url, init) : next;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fn, calls };
}

const tokenOk = (token = "at-1", extra: Record<string, unknown> = {}): Reply => ({
  body: { access_token: token, expires_in: 3600, api_domain: "https://www.zohoapis.com", ...extra },
});

const ENV_KEYS = [
  "ZOHO_CONNECT_CLIENT_ID",
  "ZOHO_CONNECT_CLIENT_SECRET",
  "ZOHO_CONNECT_ENABLED",
  "ZOHO_CLIENT_ID_API",
  "ZOHO_CLIENT_SECRET_API",
  "ZOHO_DESK_CLIENT_ID",
  "ZOHO_DESK_CLIENT_SECRET",
  "ZOHO_ACCOUNTS_SERVER",
];
const savedEnv: Record<string, string | undefined> = {};

let legacy: LegacyEnvSource[] = [];

const CRM: ZohoProductAuthConfig = {
  product: "crm",
  legacySources: () => legacy,
  notConfigured: (m, problem) => new NotConnected(m, problem),
};

const legacyCrm = (client = { id: "crm-client", secret: "crm-secret" }): LegacyEnvSource => ({
  label: "ZOHO_REFRESH_TOKEN",
  refreshToken: "rt-legacy",
  client,
});

function setup(replies: Parameters<typeof mockFetch>[0], opts: { connectEnabled?: boolean } = {}) {
  let clock = 1_700_000_000_000;
  const store = new MemoryZohoTokenStore();
  const http = mockFetch(replies);
  const auth = new ZohoProductAuth(CRM, {
    store,
    fetchImpl: http.fn,
    now: () => clock,
    connectEnabled: () => opts.connectEnabled ?? false,
  });
  return {
    store,
    http,
    auth,
    advance: (ms: number) => {
      clock += ms;
    },
    now: () => clock,
  };
}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  process.env.ZOHO_CLIENT_ID_API = "crm-client";
  process.env.ZOHO_CLIENT_SECRET_API = "crm-secret";
  legacy = [legacyCrm()];
  resetZohoRuntimeForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("classifyTokenError", () => {
  it("separates revoked, client, throttled and transient failures", () => {
    expect(classifyTokenError(200, { error: "invalid_code" }).kind).toBe("revoked");
    expect(classifyTokenError(400, { error: "invalid_client" }).kind).toBe("client");
    expect(
      classifyTokenError(400, {
        error: "Access Denied",
        error_description: "You have made too many requests continuously. Please try again after some time.",
      }).kind,
    ).toBe("rate_limited");
    expect(classifyTokenError(429, {}).kind).toBe("rate_limited");
    expect(classifyTokenError(502, {}).kind).toBe("transient");
    expect(classifyTokenError(400, { error: "general_error" }).kind).toBe("transient");
  });
});

describe("ZohoProductAuth access tokens", () => {
  it("reuses a cached access token instead of refreshing on every call", async () => {
    const t = setup([tokenOk()]);
    const a = await t.auth.getAccess();
    const b = await t.auth.getAccess();
    expect(a.token).toBe("at-1");
    expect(b.token).toBe("at-1");
    expect(t.http.calls).toHaveLength(1);
    expect(t.http.calls[0].url).toBe("https://accounts.zoho.com/oauth/v2/token");
    expect(t.http.calls[0].params?.get("client_id")).toBe("crm-client");
  });

  it("refreshes once for concurrent callers (single flight)", async () => {
    const t = setup([tokenOk()]);
    const all = await Promise.all(Array.from({ length: 6 }, () => t.auth.getAccess()));
    expect(new Set(all.map((a) => a.token))).toEqual(new Set(["at-1"]));
    expect(t.http.calls).toHaveLength(1);
  });

  it("persists the access token (encrypted at rest by the DB store) so a restart does not burn a refresh", async () => {
    const t = setup([tokenOk()]);
    await t.auth.getAccess();
    const state = t.store.states.get(fingerprint("rt-legacy"));
    expect(state).toMatchObject({ accessToken: "at-1", authStatus: "ok", clientId: "crm-client" });
    // The env refresh token itself is never copied into the store.
    expect(JSON.stringify([...t.store.states.values()])).not.toContain("rt-legacy");

    resetZohoRuntimeForTests();
    const fresh = new ZohoProductAuth(CRM, { store: t.store, fetchImpl: t.http.fn, now: t.now, connectEnabled: () => false });
    expect((await fresh.getAccess()).token).toBe("at-1");
    expect(t.http.calls).toHaveLength(1);
  });

  it("refreshes each legacy token with the client its product names (client pinning)", async () => {
    legacy = [legacyCrm({ id: "desk-client", secret: "desk-secret" })];
    const t = setup([tokenOk()]);
    await t.auth.getAccess();
    expect(t.http.calls[0].params?.get("client_id")).toBe("desk-client");
    expect(t.http.calls[0].params?.get("client_secret")).toBe("desk-secret");
  });

  it("refreshes a Connect grant with the client that minted it, and does not call Zoho when it is gone", async () => {
    process.env.ZOHO_DESK_CLIENT_ID = "desk-client";
    process.env.ZOHO_DESK_CLIENT_SECRET = "desk-secret";
    legacy = [];
    const t = setup([tokenOk()], { connectEnabled: true });
    await t.store.saveGrant({ provider: UNIFIED_PROVIDER, refreshToken: "rt-unified", clientId: "desk-client", scope: null });
    t.store.rows.get(UNIFIED_PROVIDER)!.authStatus = null;
    await t.auth.getAccess();
    expect(t.http.calls[0].params?.get("client_id")).toBe("desk-client");

    resetZohoRuntimeForTests();
    delete process.env.ZOHO_DESK_CLIENT_ID;
    const gone = setup([tokenOk()], { connectEnabled: true });
    await gone.store.saveGrant({ provider: UNIFIED_PROVIDER, refreshToken: "rt-unified-2", clientId: "desk-client", scope: null });
    await expect(gone.auth.getAccess()).rejects.toBeInstanceOf(NotConnected);
    expect(gone.http.calls).toHaveLength(0);
    expect((await gone.auth.status()).state).toBe("needs_reconnect");
  });

  it("does not call Zoho when a legacy token has no client", async () => {
    legacy = [{ label: "ZOHO_REFRESH_TOKEN", refreshToken: "rt-legacy", client: null }];
    const t = setup([tokenOk()]);
    await expect(t.auth.getAccess()).rejects.toMatchObject({ problem: "client" });
    expect(t.http.calls).toHaveLength(0);
  });
});

describe("ZohoProductAuth failure handling", () => {
  it("treats throttling as degraded, waits, and never asks for a reconnect", async () => {
    const t = setup([
      {
        status: 400,
        body: { error: "Access Denied", error_description: "You have made too many requests continuously." },
      },
      tokenOk("at-2"),
    ]);
    await expect(t.auth.getAccess()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    const st = await t.auth.status();
    expect(st.state).toBe("degraded");
    expect(st.configured).toBe(true);

    // Inside the cooldown: no further token calls.
    t.advance(5 * 60_000);
    await expect(t.auth.getAccess()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    expect(t.http.calls).toHaveLength(1);

    t.advance(6 * 60_000);
    expect((await t.auth.getAccess()).token).toBe("at-2");
    expect((await t.auth.status()).state).toBe("connected");
  });

  it("backs off exponentially on network/5xx errors", async () => {
    const t = setup([{ status: 503, body: {} }]);
    await expect(t.auth.getAccess()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    t.advance(10_000);
    await expect(t.auth.getAccess()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    expect(t.http.calls).toHaveLength(1);
    t.advance(25_000);
    await expect(t.auth.getAccess()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    expect(t.http.calls).toHaveLength(2);
    const state = t.store.states.get(fingerprint("rt-legacy"));
    expect(state?.authStatus).toBe("degraded");
    expect(state?.failureCount).toBe(2);
  });

  it("treats a network failure as degraded", async () => {
    const t = setup([]);
    const auth = new ZohoProductAuth(CRM, {
      store: t.store,
      fetchImpl: async () => {
        throw new Error("ECONNRESET");
      },
      now: t.now,
      connectEnabled: () => false,
    });
    await expect(auth.getAccess()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    expect((await auth.status()).state).toBe("degraded");
  });

  it("reports needs_reconnect only when Zoho says the token is invalid", async () => {
    const t = setup([{ body: { error: "invalid_code" } }]);
    await expect(t.auth.getAccess()).rejects.toMatchObject({ problem: "revoked" });
    const st = await t.auth.status();
    expect(st.state).toBe("needs_reconnect");
    expect(st.configured).toBe(false);
    // No hammering a revoked token.
    await expect(t.auth.getAccess()).rejects.toBeInstanceOf(NotConnected);
    expect(t.http.calls).toHaveLength(1);
  });

  it("reports a client error (wrong client for this token) as needs_reconnect", async () => {
    const t = setup([{ status: 400, body: { error: "invalid_client" } }]);
    await expect(t.auth.getAccess()).rejects.toMatchObject({ problem: "client" });
    expect((await t.auth.status()).state).toBe("needs_reconnect");
  });

  it("caps token requests under Zoho's 10-per-10-minutes limit", async () => {
    const times: number[] = [];
    let n = 0;
    // eslint-disable-next-line prefer-const
    let t: ReturnType<typeof setup>;
    t = setup([
      () => {
        times.push(t.now());
        return tokenOk(`at-${++n}`);
      },
    ]);
    let token = (await t.auth.getAccess()).token;
    for (let i = 0; i < 40; i++) {
      t.advance(3 * 60_000); // past the "fresh token" window: every 401 asks for a refresh
      try {
        token = (await t.auth.getAccess({ rejectedToken: token })).token;
      } catch (err) {
        expect(err).toBeInstanceOf(ZohoAuthUnavailableError);
      }
    }
    for (const start of times) {
      const inWindow = times.filter((x) => x >= start && x < start + 10 * 60_000);
      expect(inWindow.length).toBeLessThanOrEqual(REFRESH_BUDGET);
    }
    expect(times.length).toBeGreaterThan(REFRESH_BUDGET);
  });

  it("does not refresh again when a brand-new token is rejected (scope problem)", async () => {
    const t = setup([tokenOk("at-1"), tokenOk("at-2")]);
    const first = await t.auth.getAccess();
    const again = await t.auth.getAccess({ rejectedToken: first.token });
    expect(again.token).toBe("at-1");
    expect(t.http.calls).toHaveLength(1);
  });
});

describe("ZohoProductAuth sources", () => {
  const unifiedGrant = async (store: MemoryZohoTokenStore, scope: string) => {
    await store.saveGrant({
      provider: UNIFIED_PROVIDER,
      refreshToken: "rt-unified",
      clientId: "connect-client",
      accountsServer: "https://accounts.zoho.eu",
      apiDomain: "https://www.zohoapis.eu",
      scope,
    });
    store.rows.get(UNIFIED_PROVIDER)!.authStatus = null;
  };

  beforeEach(() => {
    process.env.ZOHO_CONNECT_CLIENT_ID = "connect-client";
    process.env.ZOHO_CONNECT_CLIENT_SECRET = "connect-secret";
  });

  it("prefers the Zoho Connect grant when it covers the product, in its own DC", async () => {
    const t = setup([tokenOk("unified-at")], { connectEnabled: true });
    await unifiedGrant(t.store, ZOHO_PRODUCT_SCOPES.crm.join(" "));
    const a = await t.auth.getAccess();
    expect(a.token).toBe("unified-at");
    expect(a.source).toBe("unified");
    expect(a.dc.desk).toBe("https://desk.zoho.eu");
    expect(t.http.calls[0].url).toBe("https://accounts.zoho.eu/oauth/v2/token");
    expect(t.http.calls[0].params?.get("client_id")).toBe("connect-client");
  });

  it("ignores the Connect grant while ZOHO_CONNECT_ENABLED is off", async () => {
    const t = setup([tokenOk("legacy-at")], { connectEnabled: false });
    await unifiedGrant(t.store, ZOHO_PRODUCT_SCOPES.crm.join(" "));
    const a = await t.auth.getAccess();
    expect(a.source).toBe("env");
  });

  it("ignores a Zoho Connect grant that lacks this product's scopes", async () => {
    const t = setup([tokenOk("legacy-at")], { connectEnabled: true });
    await unifiedGrant(t.store, "Desk.tickets.ALL");
    const a = await t.auth.getAccess();
    expect(a.source).toBe("env");
  });

  it("is not_configured with no credential at all", async () => {
    legacy = [];
    const t = setup([tokenOk()]);
    expect((await t.auth.status()).state).toBe("not_configured");
    await expect(t.auth.getAccess()).rejects.toMatchObject({ problem: "not_configured" });
    expect(t.http.calls).toHaveLength(0);
  });
});

describe("ZohoProductAuth.check", () => {
  it("probes once, then answers from state", async () => {
    const t = setup([tokenOk()]);
    let probes = 0;
    const probe = async () => {
      probes++;
      return new Response("{}", { status: 200 });
    };
    expect((await t.auth.check(probe)).state).toBe("connected");
    expect((await t.auth.check(probe)).state).toBe("connected");
    expect(probes).toBe(1);
  });

  it("maps a product 5xx/429 to degraded and a 403 to needs_reconnect", async () => {
    const t = setup([tokenOk()]);
    const down = await t.auth.check(async () => new Response("", { status: 503 }));
    expect(down.state).toBe("degraded");
    expect(down.configured).toBe(true);
    const busy = await t.auth.check(async () => new Response("", { status: 429 }));
    expect(busy.state).toBe("degraded");
    const denied = await t.auth.check(async () => new Response("", { status: 403 }));
    expect(denied.state).toBe("needs_reconnect");
  });

  it("does not probe while Zoho is throttling", async () => {
    const t = setup([{ status: 400, body: { error: "Access Denied", error_description: "too many requests" } }]);
    await t.auth.getAccess().catch(() => undefined);
    let probes = 0;
    const st = await t.auth.check(async () => {
      probes++;
      return new Response("{}");
    });
    expect(st.state).toBe("degraded");
    expect(probes).toBe(0);
  });
});

describe("scopes + data centers", () => {
  it("treats .ALL and fullaccess.all as covering narrower scopes", () => {
    expect(scopesCover("ZohoCRM.modules.ALL,ZohoCRM.users.READ", ["ZohoCRM.modules.leads.READ"])).toBe(true);
    expect(scopesCover("ZohoCRM.modules.READ", ["ZohoCRM.modules.ALL"])).toBe(false);
    expect(scopesCover("ZohoBooks.fullaccess.all", ZOHO_PRODUCT_SCOPES.books)).toBe(true);
    expect(productsCoveredBy("ZohoPay.payments.CREATE ZohoPay.payments.READ")).toEqual(["payments"]);
  });

  it("asks for every product's scopes (and Billing with CRM) in one consent", () => {
    const all = scopesForProducts(["crm", "desk", "books", "payments"]);
    for (const s of [...ZOHO_PRODUCT_SCOPES.crm, ...ZOHO_PRODUCT_SCOPES.desk, ...ZOHO_PRODUCT_SCOPES.books, ...ZOHO_PRODUCT_SCOPES.payments]) {
      expect(all).toContain(s);
    }
    expect(all).toContain("ZohoSubscriptions.subscriptions.READ");
  });

  it("derives product hosts from the account's DC", () => {
    expect(zohoDcFromUrl("https://www.zohoapis.com").desk).toBe("https://desk.zoho.com");
    expect(zohoDcFromUrl("https://www.zohoapis.eu").accounts).toBe("https://accounts.zoho.eu");
    expect(zohoDcFromUrl("https://accounts.zoho.com.au").payments).toBe("https://payments.zoho.com.au");
    expect(zohoDcFromUrl("https://accounts.zohocloud.ca").api).toBe("https://www.zohoapis.ca");
    expect(zohoDcFromUrl("https://evil.example.com").accounts).toBe("https://accounts.zoho.com");
    expect(isZohoAccountsServer("https://accounts.zoho.in")).toBe(true);
    expect(isZohoAccountsServer("https://accounts.zoho.in.evil.com")).toBe(false);
    expect(isZohoAccountsServer("http://accounts.zoho.com")).toBe(false);
  });

  it("takes the default DC from ZOHO_ACCOUNTS_SERVER, US otherwise", () => {
    expect(zohoDefaultDc({}).accounts).toBe("https://accounts.zoho.com");
    expect(zohoDefaultDc({ ZOHO_ACCOUNTS_SERVER: "https://accounts.zoho.eu" }).desk).toBe("https://desk.zoho.eu");
    expect(zohoDefaultDc({ ZOHO_ACCOUNTS_SERVER: "https://accounts.zoho.eu.attacker.net" }).accounts).toBe("https://accounts.zoho.com");
  });

  it("refreshes legacy env tokens in the configured DC", async () => {
    process.env.ZOHO_ACCOUNTS_SERVER = "https://accounts.zoho.eu";
    const t = setup([tokenOk("eu-at", { api_domain: "https://www.zohoapis.eu" })]);
    const a = await t.auth.getAccess();
    expect(t.http.calls[0].url).toBe("https://accounts.zoho.eu/oauth/v2/token");
    expect(a.apiDomain).toBe("https://www.zohoapis.eu");
    expect(a.dc.desk).toBe("https://desk.zoho.eu");
  });
});

describe("Zoho Connect", () => {
  beforeEach(() => {
    process.env.ZOHO_CONNECT_CLIENT_ID = "connect-client";
    process.env.ZOHO_CONNECT_CLIENT_SECRET = "connect-secret";
  });

  it("builds an offline, consent-prompting URL with every product's scopes", () => {
    const { url, state } = buildZohoConnectUrl({
      products: ["crm", "desk", "books", "payments"],
      redirectUri: `https://digeratiexperts.com${ZOHO_CONNECT_CALLBACK_PATH}`,
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.zoho.com/oauth/v2/auth");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("client_id")).toBe("connect-client");
    expect(u.searchParams.get("redirect_uri")).toBe("https://digeratiexperts.com/api/zoho/connect/callback");
    expect(u.searchParams.get("state")).toBe(state);
    expect(state.length).toBeGreaterThanOrEqual(32);
    for (const s of ["ZohoCRM.modules.READ", "Desk.tickets.CREATE", "ZohoBooks.estimates.CREATE", "ZohoPay.payments.CREATE"]) {
      expect(u.searchParams.get("scope")).toContain(s);
    }
  });

  it("refuses to build a URL without the dedicated Connect client", () => {
    delete process.env.ZOHO_CONNECT_CLIENT_ID;
    expect(() => buildZohoConnectUrl({ products: ["crm"], redirectUri: "https://x/cb" })).toThrow(/ZOHO_CONNECT_CLIENT_ID/);
  });

  it("stores one grant for all products, discovers the Desk org, revokes the old grant", async () => {
    const store = new MemoryZohoTokenStore();
    await store.saveGrant({ provider: UNIFIED_PROVIDER, refreshToken: "rt-old", clientId: "connect-client" });
    const http = mockFetch([
      tokenOk("at-new", {
        refresh_token: "rt-new",
        api_domain: "https://www.zohoapis.eu",
        scope: scopesForProducts(["crm", "desk"]).join(" "),
      }),
      { body: { data: [{ id: "111", isDefault: false }, { id: "222", isDefault: true }] } },
      { body: {} },
    ]);
    const result = await completeZohoConnect({
      code: "code-1",
      accountsServer: "https://accounts.zoho.eu",
      redirectUri: "https://digeratiexperts.com/api/zoho/connect/callback",
      requestedProducts: ["crm", "desk"],
      store,
      fetchImpl: http.fn,
    });
    expect(result.products).toEqual(["crm", "desk"]);
    expect(result.deskOrgId).toBe("222");
    expect(http.calls[0].url).toBe("https://accounts.zoho.eu/oauth/v2/token");
    expect(http.calls[0].params?.get("grant_type")).toBe("authorization_code");
    expect(http.calls[0].params?.get("redirect_uri")).toBe("https://digeratiexperts.com/api/zoho/connect/callback");
    expect(http.calls[1].url).toBe("https://desk.zoho.eu/api/v1/organizations");
    expect(http.calls[2].url).toBe("https://accounts.zoho.com/oauth/v2/token/revoke");
    expect(http.calls[2].params?.get("token")).toBe("rt-old");
    const row = store.rows.get(UNIFIED_PROVIDER)!;
    expect(row.refreshToken).toBe("rt-new");
    expect(row.clientId).toBe("connect-client");
    expect(row.accountsServer).toBe("https://accounts.zoho.eu");
    expect(row.orgId).toBe("222");
  });

  it("does not revoke anything when the code exchange fails", async () => {
    const store = new MemoryZohoTokenStore();
    await store.saveGrant({ provider: UNIFIED_PROVIDER, refreshToken: "rt-old", clientId: "connect-client" });
    const http = mockFetch([{ body: { error: "invalid_code" } }]);
    await expect(
      completeZohoConnect({
        code: "stale",
        redirectUri: "https://digeratiexperts.com/api/zoho/connect/callback",
        requestedProducts: ["crm"],
        store,
        fetchImpl: http.fn,
      }),
    ).rejects.toThrow(/expired or already used/);
    expect(http.calls).toHaveLength(1);
    expect(store.rows.get(UNIFIED_PROVIDER)?.refreshToken).toBe("rt-old");
  });

  it("refuses to send the code to a non-Zoho accounts server", async () => {
    const http = mockFetch([tokenOk()]);
    await expect(
      completeZohoConnect({
        code: "c",
        accountsServer: "https://accounts.zoho.com.evil.net",
        redirectUri: "https://digeratiexperts.com/cb",
        requestedProducts: ["crm"],
        store: new MemoryZohoTokenStore(),
        fetchImpl: http.fn,
      }),
    ).rejects.toThrow(/unrecognised accounts server/);
    expect(http.calls).toHaveLength(0);
  });

  it("disconnect revokes and removes the grant", async () => {
    const store = new MemoryZohoTokenStore();
    await store.saveGrant({ provider: UNIFIED_PROVIDER, refreshToken: "rt-x", clientId: "connect-client" });
    const http = mockFetch([{ body: {} }]);
    expect(await disconnectZoho(store, http.fn)).toBe(true);
    expect(store.rows.has(UNIFIED_PROVIDER)).toBe(false);
    expect(http.calls[0].url).toBe("https://accounts.zoho.com/oauth/v2/token/revoke");
    expect(http.calls[0].params?.get("token")).toBe("rt-x");
  });
});
