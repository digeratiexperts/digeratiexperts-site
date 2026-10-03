import { describe, expect, it, vi } from "vitest";
import { CytracomError, loadCytracomPhoneData, mapCytracomUsers } from "./cytracom";
import { CYTRACOM_DATA_USERS_EXAMPLE } from "./cytracom.fixtures";
import { cytracomTokenFor, phoneScopeFor, PhoneConfigError, readPhoneClientMap } from "./index";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("cytracom /data/users mapping (documented example)", () => {
  it("maps name, extension and assignment, sorted by extension", () => {
    const rows = mapCytracomUsers(CYTRACOM_DATA_USERS_EXAMPLE);
    expect(rows.map((r) => r.extension)).toEqual(["200", "201", "202", "205"]);
    expect(rows.find((r) => r.extension === "205")).toEqual({ name: "Jane Trewin", extension: "205", assigned: false, email: null });
    expect(rows.find((r) => r.extension === "201")?.assigned).toBe(true);
  });

  it("rejects a body without data.users", () => {
    expect(() => mapCytracomUsers({ code: 200 })).toThrow(CytracomError);
    expect(() => mapCytracomUsers(null)).toThrow(CytracomError);
  });
});

describe("loadCytracomPhoneData", () => {
  it("calls the documented endpoint with Basic token auth and keeps emails server-side", async () => {
    const fetchImpl = vi.fn(async () => json(CYTRACOM_DATA_USERS_EXAMPLE));
    const data = await loadCytracomPhoneData("tok-123", "KeriP@CustomerAccount.com", fetchImpl as any, () => new Date("2026-10-03T00:00:00Z"));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cytracom.net/v1.0/data/users?limit=1000");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("token:tok-123").toString("base64")}`);
    expect(data.myExtension).toEqual({ name: "Keri Parker", extension: "201", assigned: true });
    expect(data.extensions).toHaveLength(4);
    expect(JSON.stringify(data)).not.toContain("@");
    expect(data.unavailable).toEqual(["phoneStatus", "recentCalls", "voicemail"]);
    expect(data.fetchedAt).toBe("2026-10-03T00:00:00.000Z");
  });

  it("has no extension of its own when no email matches", async () => {
    const data = await loadCytracomPhoneData("t", "nobody@example.com", (async () => json(CYTRACOM_DATA_USERS_EXAMPLE)) as any);
    expect(data.myExtension).toBeNull();
  });

  it("throws a CytracomError without the vendor body on HTTP failure", async () => {
    const fetchImpl = (async () => new Response("secret vendor detail", { status: 401 })) as any;
    await expect(loadCytracomPhoneData("t", null, fetchImpl)).rejects.toMatchObject({ name: "CytracomError", httpStatus: 401 });
    const err = await loadCytracomPhoneData("t", null, fetchImpl).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain("secret");
  });
});

describe("phone client map", () => {
  it("reads clientId -> token key and ignores blank values", () => {
    expect(readPhoneClientMap({ PORTAL_PHONE_CLIENT_MAP: '{"acme":"ACME","x":""}' })).toEqual({ acme: "ACME" });
    expect(phoneScopeFor("globex", { PORTAL_PHONE_CLIENT_MAP: '{"acme":"ACME"}' })).toBeNull();
    expect(phoneScopeFor("toString", { PORTAL_PHONE_CLIENT_MAP: '{"acme":"ACME"}' })).toBeNull();
  });

  it("treats a malformed map as a config fault", () => {
    expect(() => readPhoneClientMap({ PORTAL_PHONE_CLIENT_MAP: "{nope" })).toThrow(PhoneConfigError);
    expect(() => readPhoneClientMap({ PORTAL_PHONE_CLIENT_MAP: '["acme"]' })).toThrow(PhoneConfigError);
  });

  it("only reads tokens under the fixed prefix", () => {
    const env = { PORTAL_PHONE_CYTRACOM_TOKEN_ACME: "tok", DATABASE_URL: "postgres://x" };
    expect(cytracomTokenFor("acme", env)).toBe("tok");
    expect(() => cytracomTokenFor("../DATABASE_URL", env)).toThrow(PhoneConfigError);
    expect(() => cytracomTokenFor("GLOBEX", env)).toThrow(/PORTAL_PHONE_CYTRACOM_TOKEN_GLOBEX is not set/);
  });
});
