import { beforeEach, describe, expect, it, vi } from "vitest";
import { booksCall, resetZohoBooksToken, ZOHO_ACCOUNTS_TOKEN_URL, zohoBooksTaxConfig } from "./zohoBooksTax";

const config = zohoBooksTaxConfig({
  ZOHO_BOOKS_ORGANIZATION_ID: "693714437",
  ZOHO_BOOKS_REFRESH_TOKEN: "1000.fake.refresh",
  ZOHO_BOOKS_CLIENT_ID: "1000.FAKECLIENT",
  ZOHO_BOOKS_CLIENT_SECRET: "fake-secret",
  ZOHO_BOOKS_TAX_CONTACT_ID: "1957016000000600001",
  ZOHO_BOOKS_SERVICE_ITEM_ID: "1957016000000500001",
})!;

describe("Zoho Books client for Pay Now tax", () => {
  beforeEach(() => resetZohoBooksToken());

  it("refreshes the token once and reuses it until it nears expiry", async () => {
    let issued = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === ZOHO_ACCOUNTS_TOKEN_URL) {
        issued++;
        return new Response(JSON.stringify({ access_token: `tok-${issued}`, expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    });
    const f = fetchImpl as unknown as typeof fetch;
    await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: f, nowMs: 0 });
    await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: f, nowMs: 60_000 });
    expect(issued).toBe(1);
    await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: f, nowMs: 3_550_000 });
    expect(issued).toBe(2);
  });

  it("drops a token Books rejects and retries once with a fresh one", async () => {
    let issued = 0;
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === ZOHO_ACCOUNTS_TOKEN_URL) {
        issued++;
        return new Response(JSON.stringify({ access_token: `tok-${issued}`, expires_in: 3600 }), { status: 200 });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      seen.push(auth);
      // Books accepts tok-1 at first, then refuses it (revoked on Zoho's side).
      return auth === "Zoho-oauthtoken tok-1" && seen.length > 1
        ? new Response(JSON.stringify({ code: 57, message: "invalid" }), { status: 401 })
        : new Response(JSON.stringify({ code: 0, item: {} }), { status: 200 });
    });
    const f = fetchImpl as unknown as typeof fetch;
    expect((await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: f, nowMs: 0 })).ok).toBe(true);
    // Five minutes later tok-1 is no longer brand new, so a 401 means "dead token": refresh once.
    const reply = await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: f, nowMs: 5 * 60_000 });
    expect(reply.ok).toBe(true);
    expect(seen).toEqual(["Zoho-oauthtoken tok-1", "Zoho-oauthtoken tok-1", "Zoho-oauthtoken tok-2"]);
  });

  it("does not refresh again when a brand-new token is rejected (a scope problem)", async () => {
    let issued = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === ZOHO_ACCOUNTS_TOKEN_URL) {
        issued++;
        return new Response(JSON.stringify({ access_token: `tok-${issued}`, expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 57, message: "invalid" }), { status: 401 });
    });
    const reply = await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: fetchImpl as unknown as typeof fetch, nowMs: 0 });
    expect(reply).toMatchObject({ ok: false, failure: "auth" });
    expect(issued).toBe(1);
  });

  it("reads throttling and Zoho outages as unreachable, never auth (#418)", async () => {
    const throttled = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Access Denied", error_description: "You have made too many requests continuously." }), { status: 400 }),
    );
    const reply = await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: throttled as unknown as typeof fetch, nowMs: 0 });
    expect(reply).toMatchObject({ ok: false, failure: "unreachable" });
    // Backing off: no second token request inside the cool-down.
    await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: throttled as unknown as typeof fetch, nowMs: 60_000 });
    expect(throttled).toHaveBeenCalledTimes(1);

    resetZohoBooksToken();
    const down = vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: down as unknown as typeof fetch, nowMs: 0 }))
      .toMatchObject({ ok: false, failure: "unreachable" });
  });

  it("never logs the refresh token or the client secret", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_client" }), { status: 400 }));
    const reply = await booksCall(config, { method: "GET", path: "/items/1" }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(reply).toMatchObject({ ok: false, failure: "auth" });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("1000.fake.refresh");
    expect(logged).not.toContain("fake-secret");
    warn.mockRestore();
  });
});
