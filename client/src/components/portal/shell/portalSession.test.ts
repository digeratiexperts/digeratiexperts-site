import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = (user: unknown) => new Response(JSON.stringify({ user }), { status: 200 });
const userA = { id: "EXAMPLE-a", clientId: "EXAMPLE-tenant-a", email: "a@example.test" };
const userB = { id: "EXAMPLE-b", clientId: "EXAMPLE-tenant-b", email: "b@example.test" };
let values: Map<string, string>;
let browser: EventTarget & { location: { pathname: string; search: string; href: string } };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  values = new Map();
  browser = Object.assign(new EventTarget(), { location: { pathname: "/portal/dashboard", search: "", href: "" } });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

describe("portal session epochs", () => {
  it("isolates a throwing subscriber from verified state and later subscribers", async () => {
    const session = await import("./portalSession");
    const healthy = vi.fn();
    session.subscribePortalSession(() => { throw new Error("EXAMPLE subscriber failure"); });
    session.subscribePortalSession(healthy);
    fetcher.mockResolvedValueOnce(response(userA));
    await expect(session.ensurePortalSession()).resolves.toEqual(userA);
    expect(healthy).toHaveBeenLastCalledWith({ ready: true, user: userA });
  });

  it("continues reset cleanup and notification after a subscriber throws", async () => {
    const session = await import("./portalSession");
    const healthy = vi.fn();
    session.subscribePortalSession(() => { throw new Error("EXAMPLE subscriber failure"); });
    session.subscribePortalSession(healthy);
    values.set("userEmail", "EXAMPLE legacy email");
    expect(() => session.resetPortalSession()).not.toThrow();
    expect(values.has("userEmail")).toBe(false);
    expect(healthy).toHaveBeenLastCalledWith({ ready: false, user: null });
  });

  it("still sends server logout and navigates when a subscriber throws", async () => {
    const session = await import("./portalSession");
    session.subscribePortalSession(() => { throw new Error("EXAMPLE subscriber failure"); });
    values.set("portalToken", "EXAMPLE legacy token");
    values.set("impersonatingCompany", "EXAMPLE selected company");
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(session.signOutOfPortal()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/portal/logout", { method: "POST", credentials: "include" });
    expect(values.has("portalToken")).toBe(false);
    expect(values.has("impersonatingCompany")).toBe(false);
    expect(browser.location.href).toBe("/portal/login");
  });

  it("deduplicates the document's verified check and preserves legacy page readers", async () => {
    const session = await import("./portalSession");
    const { readPortalUser } = await import("@/lib/portalRoles");
    const pending = deferred<Response>();
    fetcher.mockReturnValue(pending.promise);
    const first = session.ensurePortalSession();
    expect(session.ensurePortalSession()).toBe(first);
    pending.resolve(response(userA));
    await expect(first).resolves.toEqual(userA);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readPortalUser()).toEqual(userA);
    expect(values.has("userEmail")).toBe(false);
  });

  it("notifies on reset and ignores a delayed A response after B is verified", async () => {
    const session = await import("./portalSession");
    const notify = vi.fn();
    const unsubscribe = session.subscribePortalSession(notify);
    const old = deferred<Response>();
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(userB));
    const a = session.ensurePortalSession();
    session.resetPortalSession();
    expect(notify).toHaveBeenLastCalledWith({ ready: false, user: null });
    await expect(session.ensurePortalSession()).resolves.toEqual(userB);
    old.resolve(response(userA));
    await expect(a).resolves.toBeNull();
    expect(notify).toHaveBeenLastCalledWith({ ready: true, user: userB });
    expect(JSON.parse(values.get("portalUser")!)).toEqual(userB);
    unsubscribe();
  });

  it("does not let an old unauthorized response redirect the new account", async () => {
    const session = await import("./portalSession");
    const expired = vi.fn();
    browser.addEventListener("de-portal-session-expired", expired);
    const old = deferred<Response>();
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(userB));
    const a = session.ensurePortalSession();
    session.resetPortalSession();
    await session.ensurePortalSession();
    old.resolve(new Response("Unauthorized", { status: 401 }));
    await a;
    expect(browser.location.href).toBe("");
    expect(JSON.parse(values.get("portalUser")!)).toEqual(userB);
    expect(expired).not.toHaveBeenCalled();
  });

  it.each([401, 403])("still redirects a current %i rejection and clears the outgoing state", async (status) => {
    const session = await import("./portalSession");
    const expired = vi.fn();
    browser.addEventListener("de-portal-session-expired", expired);
    values.set("userEmail", "EXAMPLE outgoing email");
    fetcher.mockResolvedValueOnce(new Response("Unauthorized", { status }));
    await expect(session.ensurePortalSession()).resolves.toBeNull();
    expect(browser.location.href).toContain("/portal/login?");
    expect(values.has("userEmail")).toBe(false);
    expect(expired).not.toHaveBeenCalled();
  });

  it("invalidates on tenant/auth change events and ignores unrelated storage", async () => {
    const session = await import("./portalSession");
    fetcher.mockResolvedValue(response(userA));
    await session.ensurePortalSession();
    const notify = vi.fn();
    session.subscribePortalSession(notify);
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated-app" }));
    expect(notify).not.toHaveBeenCalled();
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: "impersonatingCompany" }));
    expect(notify).toHaveBeenLastCalledWith({ ready: false, user: null });
    fetcher.mockResolvedValue(response({ ...userA, clientId: "EXAMPLE-next-tenant" }));
    await session.ensurePortalSession();
    browser.dispatchEvent(new Event("de-portal-auth-changed"));
    expect(notify).toHaveBeenLastCalledWith({ ready: false, user: null });
  });

  it("preserves the verified user and drafts on same-account reauthentication in another tab", async () => {
    const session = await import("./portalSession");
    fetcher.mockResolvedValue(response(userA));
    await session.ensurePortalSession();
    const notify = vi.fn();
    session.subscribePortalSession(notify);
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: "portalToken", newValue: "EXAMPLE-new-cookie-hint" }));
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: "portalUser", newValue: JSON.stringify({ ...userA, fullName: "EXAMPLE refreshed profile" }) }));
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: "portalUserId", newValue: userA.id }));
    expect(notify).not.toHaveBeenCalled();
    await expect(session.ensurePortalSession()).resolves.toEqual(userA);
    expect(fetcher).toHaveBeenCalledTimes(1);
    values.set("portalUser", JSON.stringify(userB));
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: "portalUser", newValue: JSON.stringify(userB) }));
    expect(notify).toHaveBeenLastCalledWith({ ready: false, user: null });
    expect(JSON.parse(values.get("portalUser")!)).toEqual(userB);
  });

  it("purges outgoing snapshots on reset but preserves tenant-switch markers and other app data", async () => {
    const session = await import("./portalSession");
    for (const key of ["portalUser", "portalUserId", "userEmail", "portalToken", "impersonatingCompany", "unrelated"]) values.set(key, "EXAMPLE");
    session.resetPortalSession();
    expect([...values.keys()]).toEqual(["portalToken", "impersonatingCompany", "unrelated"]);
  });

  it("does not recover an unverified user from disk on network failure or an empty response", async () => {
    const session = await import("./portalSession");
    values.set("portalUser", JSON.stringify(userA));
    fetcher.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(session.ensurePortalSession()).resolves.toBeNull();
    session.resetPortalSession();
    fetcher.mockResolvedValueOnce(response(null));
    await expect(session.ensurePortalSession()).resolves.toBeNull();
  });

  it("keeps a verified response usable when writes are denied", async () => {
    const session = await import("./portalSession");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("denied"); } });
    fetcher.mockResolvedValueOnce(response(userA));
    await expect(session.ensurePortalSession()).resolves.toEqual(userA);
  });

  it("clears and notifies before a pending logout, suppresses late checks and survives network failure", async () => {
    const session = await import("./portalSession");
    const old = deferred<Response>();
    const logout = deferred<Response>();
    fetcher.mockReturnValueOnce(old.promise).mockReturnValueOnce(logout.promise);
    const a = session.ensurePortalSession();
    for (const key of ["portalUser", "portalUserId", "portalToken", "userEmail", "impersonatingCompany"]) values.set(key, "EXAMPLE");
    values.set("de-store-guided-session", "EXAMPLE store choices");
    const notify = vi.fn();
    session.subscribePortalSession(notify);
    const signingOut = session.signOutOfPortal();
    expect(notify).toHaveBeenLastCalledWith({ ready: false, user: null });
    expect([...values.keys()]).toEqual(["de-store-guided-session"]);
    old.resolve(response(userA));
    await expect(a).resolves.toBeNull();
    await expect(session.ensurePortalSession()).resolves.toBeNull();
    expect(values.has("portalUser")).toBe(false);
    logout.reject(new Error("offline"));
    await signingOut;
    expect(browser.location.href).toBe("/portal/login");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
