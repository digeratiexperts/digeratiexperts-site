import { generateKeyPairSync, createVerify } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The Microsoft Graph and Google licensing clients against a fake fetch: right hosts, right bodies, no throws. */

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let answer: (url: string, init: RequestInit) => { status: number; body: unknown };

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const a = answer(String(url), init);
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } });
  });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MS_GRAPH_CLIENT_ID;
  delete process.env.MS_GRAPH_CLIENT_SECRET;
  delete process.env.MS_GRAPH_GOV_CLIENT_ID;
  delete process.env.MS_GRAPH_GOV_CLIENT_SECRET;
  delete process.env.GOOGLE_LICENSING_SERVICE_ACCOUNT;
});

describe("Microsoft Graph licence client", () => {
  it("is off without the app credentials, and GCC High needs its own pair", async () => {
    const ms = await import("./msGraph");
    expect(ms.msGraphConfigured("commercial")).toBe(false);
    process.env.MS_GRAPH_CLIENT_ID = "app";
    process.env.MS_GRAPH_CLIENT_SECRET = "secret";
    expect(ms.msGraphConfigured("gcc")).toBe(true);
    expect(ms.msGraphConfigured("gcc_high")).toBe(false);
    expect(await ms.msAssignLicense("t.onmicrosoft.com", "gcc_high", "a@t.test", "s")).toMatchObject({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it("takes a token for the client tenant, reads subscriptions and assigns by UPN", async () => {
    process.env.MS_GRAPH_GOV_CLIENT_ID = "gov-app";
    process.env.MS_GRAPH_GOV_CLIENT_SECRET = "gov-secret";
    answer = (url) =>
      url.includes("/oauth2/")
        ? { status: 200, body: { access_token: "tok", expires_in: 3600 } }
        : url.endsWith("/subscribedSkus")
          ? { status: 200, body: { value: [{ skuId: "id-1", skuPartNumber: "SPE_E5_USGOV_GCCHIGH", prepaidUnits: { enabled: 5 }, consumedUnits: 1 }] } }
          : { status: 200, body: {} };
    const ms = await import("./msGraph");
    const subs = await ms.msSubscribedSkus("acme.onmicrosoft.us", "gcc_high");
    expect(subs).toEqual({ ok: true, skus: [{ skuId: "id-1", skuPartNumber: "SPE_E5_USGOV_GCCHIGH", enabled: 5, consumed: 1 }] });
    expect(await ms.msAssignLicense("acme.onmicrosoft.us", "gcc_high", "dana@acme.us", "id-1")).toEqual({ ok: true });
    expect(calls[0].url).toBe("https://login.microsoftonline.us/acme.onmicrosoft.us/oauth2/v2.0/token");
    expect(String(calls[0].init.body)).toContain("scope=https%3A%2F%2Fgraph.microsoft.us%2F.default");
    expect(calls[1].url).toBe("https://graph.microsoft.us/v1.0/subscribedSkus");
    expect(calls[2].url).toBe("https://graph.microsoft.us/v1.0/users/dana%40acme.us/assignLicense");
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ addLicenses: [{ skuId: "id-1", disabledPlans: [] }], removeLicenses: [] });
    expect(calls.filter((c) => c.url.includes("/oauth2/"))).toHaveLength(1); // the token is reused
  });

  it("explains a missing usage location instead of throwing", async () => {
    process.env.MS_GRAPH_CLIENT_ID = "app";
    process.env.MS_GRAPH_CLIENT_SECRET = "secret";
    answer = (url) =>
      url.includes("/oauth2/")
        ? { status: 200, body: { access_token: "tok", expires_in: 3600 } }
        : { status: 400, body: { error: { message: "License assignment failed because service plans require usage location." } } };
    const ms = await import("./msGraph");
    const r = await ms.msAssignLicense("acme.onmicrosoft.com", "commercial", "dana@acme.test", "id");
    expect(r).toEqual({ ok: false, error: "The user has no usage location set in Entra; set it, then send again" });
  });
});

describe("Google licensing client", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = {
    client_email: "patchbay@de-project.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };

  it("signs a delegated JWT as the client's admin and assigns the licence (409 counts as done)", async () => {
    process.env.GOOGLE_LICENSING_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(sa)).toString("base64");
    let n = 0;
    answer = (url) => (url.includes("oauth2") ? { status: 200, body: { access_token: "gtok", expires_in: 3600 } } : { status: n++ ? 409 : 200, body: {} });
    const g = await import("./googleLicensing");
    expect(g.googleLicensingConfigured()).toBe(true);
    expect(await g.googleAssignLicense("admin@acme.test", "Google-Apps", "1010020027", "lee@acme.test")).toEqual({ ok: true });
    expect(await g.googleAssignLicense("admin@acme.test", "Google-Apps", "1010020027", "lee@acme.test")).toEqual({ ok: true });

    const assertion = new URLSearchParams(String(calls[0].init.body)).get("assertion")!;
    const [h, p, sig] = assertion.split(".");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(claims).toMatchObject({ iss: sa.client_email, sub: "admin@acme.test", scope: "https://www.googleapis.com/auth/apps.licensing" });
    expect(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
    expect(calls[1].url).toBe("https://licensing.googleapis.com/apps/licensing/v1/product/Google-Apps/sku/1010020027/user");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ userId: "lee@acme.test" });
  });

  it("names a missing domain-wide delegation", async () => {
    process.env.GOOGLE_LICENSING_SERVICE_ACCOUNT = JSON.stringify(sa);
    answer = () => ({ status: 401, body: { error: "unauthorized_client" } });
    const g = await import("./googleLicensing");
    const r = await g.googleAssignLicense("admin@other.test", "Google-Apps", "1010020027", "x@other.test");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Domain-wide delegation/);
  });
});
