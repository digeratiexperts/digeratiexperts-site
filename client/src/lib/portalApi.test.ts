import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPortalLocalSession, PORTAL_SESSION_RESET_EVENT, redirectToPortalLogin } from "./portalApi";
let values: Map<string, string>;
let browser: EventTarget & { location: { pathname: string; search: string; href: string } };
beforeEach(() => {
  values = new Map(["portalUser", "portalUserId", "portalToken", "userEmail", "impersonatingCompany", "unrelated", "de-store-guided-session"].map((key) => [key, "EXAMPLE"]));
  browser = Object.assign(new EventTarget(), { location: { pathname: "/portal/tickets", search: "", href: "" } });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("localStorage", { removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());
describe("owned portal cleanup", () => {
  it("clears owned keys including legacy email and preserves unrelated Store/app data", () => {
    const reset = vi.fn();
    browser.addEventListener(PORTAL_SESSION_RESET_EVENT, reset);
    clearPortalLocalSession();
    expect([...values.keys()]).toEqual(["unrelated", "de-store-guided-session"]);
    expect(reset).toHaveBeenCalledOnce();
  });
  it("attempts every key and notifies even if all storage operations fail", () => {
    const remove = vi.fn(() => { throw new Error("denied"); });
    vi.stubGlobal("localStorage", { removeItem: remove });
    const reset = vi.fn();
    browser.addEventListener(PORTAL_SESSION_RESET_EVENT, reset);
    expect(clearPortalLocalSession).not.toThrow();
    expect(remove).toHaveBeenCalledTimes(5);
    expect(reset).toHaveBeenCalledOnce();
    expect(() => redirectToPortalLogin("/portal/tickets")).not.toThrow();
    expect(browser.location.href).toContain("/portal/login?");
  });
  it("also clears stale keys when already on the login page", () => {
    browser.location.pathname = "/portal/login";
    redirectToPortalLogin();
    expect(values.has("userEmail")).toBe(false);
    expect(browser.location.href).toBe("");
  });
});
