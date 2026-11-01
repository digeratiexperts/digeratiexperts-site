import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PORTAL_THEME_PREFERENCE, PORTAL_APPEARANCE_TTL_MS, clearPortalAppearanceScope,
  isDarkPortalTheme, portalAppearanceWriter, readPortalContrast, readPortalThemePreference,
  resolvePortalTheme, setVerifiedPortalAppearanceContext, writePortalContrast, writePortalThemePreference,
} from "./portalTheme";

const a = { id: "EXAMPLE-account-a", clientId: "EXAMPLE-tenant-a" };
const b = { id: "EXAMPLE-account-b", clientId: "EXAMPLE-tenant-b" };
let values: Map<string, string>;
function currentRecord() {
  const key = [...values.keys()].find((key) => key.startsWith("de-portal-appearance:v1:"))!;
  return { key, record: JSON.parse(values.get(key)!) };
}
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("window", new EventTarget());
  clearPortalAppearanceScope();
});
afterEach(() => { clearPortalAppearanceScope(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("portal appearance", () => {
  it("defaults to pure black independent of the device", () => {
    expect(DEFAULT_PORTAL_THEME_PREFERENCE).toBe("black");
    expect(resolvePortalTheme(DEFAULT_PORTAL_THEME_PREFERENCE, true)).toBe("black");
    expect(resolvePortalTheme(DEFAULT_PORTAL_THEME_PREFERENCE, false)).toBe("black");
  });
  it("Match device follows light/dark and explicit choices win", () => {
    expect(resolvePortalTheme("system", true)).toBe("light");
    expect(resolvePortalTheme("system", false)).toBe("dark");
    expect(resolvePortalTheme("light", false)).toBe("light");
    expect(resolvePortalTheme("dark", true)).toBe("dark");
    expect(resolvePortalTheme("console", true)).toBe("console");
    expect(isDarkPortalTheme("console")).toBe(true);
    expect(isDarkPortalTheme("black")).toBe(true);
    expect(isDarkPortalTheme("light")).toBe(false);
  });
  it("discards ownerless global preferences and uses memory without verified scope", () => {
    values.set("de-portal-theme", "light");
    values.set("de-portal-contrast", "max");
    values.set("unrelated-app", "keep");
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
    writePortalThemePreference("console");
    writePortalContrast("boost");
    expect(readPortalThemePreference()).toBe("console");
    expect(readPortalContrast()).toBe("boost");
    expect([...values.entries()]).toEqual([["unrelated-app", "keep"]]);
  });
  it("stores only bounded enum preferences under a digest partition and restores the same account", async () => {
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("console");
    writePortalContrast("boost");
    const { key, record } = currentRecord();
    expect(key).toMatch(/^de-portal-appearance:v1:[a-f0-9]{64}$/);
    expect(record).toEqual({ version: 1, theme: "console", contrast: "boost", savedAt: expect.any(Number), expiresAt: expect.any(Number) });
    expect(record.expiresAt - record.savedAt).toBe(PORTAL_APPEARANCE_TTL_MS);
    expect(JSON.stringify([...values])).not.toContain(a.id);
    expect(JSON.stringify([...values])).not.toContain(a.clientId);
    clearPortalAppearanceScope();
    expect(readPortalThemePreference()).toBe("black");
    await setVerifiedPortalAppearanceContext(a);
    expect(readPortalThemePreference()).toBe("console");
    expect(readPortalContrast()).toBe("boost");
  });
  it("isolates accounts and tenant changes, including old queued writers", async () => {
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("light");
    const queued = portalAppearanceWriter();
    await setVerifiedPortalAppearanceContext(b);
    queued.theme("console");
    queued.contrast("max");
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
    writePortalThemePreference("dark");
    await setVerifiedPortalAppearanceContext({ ...a, clientId: b.clientId });
    expect(readPortalThemePreference()).toBe("black");
    await setVerifiedPortalAppearanceContext(a);
    expect(readPortalThemePreference()).toBe("light");
    await setVerifiedPortalAppearanceContext(b);
    expect(readPortalThemePreference()).toBe("dark");
  });
  it("invalidates a queued writer on logout even if the same account returns", async () => {
    await setVerifiedPortalAppearanceContext(a);
    const queued = portalAppearanceWriter();
    clearPortalAppearanceScope();
    queued.theme("light");
    expect(readPortalThemePreference()).toBe("black");
    await setVerifiedPortalAppearanceContext(a);
    queued.contrast("max");
    expect(readPortalContrast()).toBe("none");
  });
  it.each([{}, { id: "" }, { id: " ", clientId: "x" }, { ...a, clientId: "" }, { id: "x".repeat(257) }])("has no persistent scope for invalid context %j", async (context) => {
    await setVerifiedPortalAppearanceContext(context);
    writePortalThemePreference("light");
    expect(readPortalThemePreference()).toBe("light");
    expect(values.size).toBe(0);
  });
  it("does not assign pre-login choices to an authenticated account", async () => {
    writePortalThemePreference("light");
    await setVerifiedPortalAppearanceContext(a);
    expect(readPortalThemePreference()).toBe("black");
    expect(values.size).toBe(0);
  });
  it("defaults at expiry and removes the expired record", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("light");
    const { key } = currentRecord();
    vi.advanceTimersByTime(PORTAL_APPEARANCE_TTL_MS);
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
    expect(values.has(key)).toBe(false);
  });
  it.each(["broken", "null", "[]", '{"version":99}', '{"theme":"light","contrast":"max"}'])("defaults for corrupt or unknown schema %s", async (raw) => {
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("light");
    const { key } = currentRecord();
    values.set(key, raw);
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
    expect(values.has(key)).toBe(false);
  });
  it.each([
    { theme: "unknown" }, { contrast: "unknown" }, { version: 2 }, { savedAt: Infinity },
    { expiresAt: Infinity }, { unexpected: "sensitive" }, { savedAt: Date.now() + 1000000 },
  ])("rejects invalid enum, expiry or extra fields %j", async (invalid) => {
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("light");
    const { key, record } = currentRecord();
    values.set(key, JSON.stringify({ ...record, ...invalid }));
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
  });
  it("validates writes at runtime", async () => {
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("unknown" as never);
    writePortalContrast("secret" as never);
    expect(values.size).toBe(0);
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
  });
  it("survives denied/quota storage and resets memory between accounts", async () => {
    await setVerifiedPortalAppearanceContext(a);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("denied"); } });
    writePortalThemePreference("console");
    writePortalContrast("max");
    expect(readPortalThemePreference()).toBe("console");
    expect(readPortalContrast()).toBe("max");
    await setVerifiedPortalAppearanceContext(b);
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
  });
  it("keeps memory choices after a quota failure even if reads still work", async () => {
    await setVerifiedPortalAppearanceContext(a);
    vi.stubGlobal("localStorage", { getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error("quota"); } });
    writePortalThemePreference("console");
    expect(readPortalThemePreference()).toBe("console");
  });
  it("uses memory safely if Web Crypto is unavailable", async () => {
    vi.stubGlobal("crypto", {});
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("light");
    expect(readPortalThemePreference()).toBe("light");
    expect(values.size).toBe(0);
    await setVerifiedPortalAppearanceContext(b);
    expect(readPortalThemePreference()).toBe("black");
  });
  it("does not persist staff preferences without a verified acting-company scope", async () => {
    await setVerifiedPortalAppearanceContext({ ...a, role: "admin", accountClass: "super_admin" });
    writePortalThemePreference("console");
    expect(readPortalThemePreference()).toBe("console");
    expect(values.size).toBe(0);
    clearPortalAppearanceScope();
    await setVerifiedPortalAppearanceContext({ ...a, accountClass: "de_staff" });
    expect(readPortalThemePreference()).toBe("black");
  });
  it("keeps a new choice in memory if an older valid record cannot be overwritten", async () => {
    await setVerifiedPortalAppearanceContext(a);
    writePortalThemePreference("light");
    const getItem = (key: string) => values.get(key) ?? null;
    vi.stubGlobal("localStorage", { getItem, removeItem: () => {}, setItem: () => { throw new Error("quota"); } });
    writePortalThemePreference("console");
    writePortalContrast("max");
    expect(readPortalThemePreference()).toBe("console");
    expect(readPortalContrast()).toBe("max");
  });
  it("does not let delayed digest completion reactivate an old scope", async () => {
    let finish!: (value: ArrayBuffer) => void;
    vi.stubGlobal("crypto", { subtle: { digest: () => new Promise<ArrayBuffer>((resolve) => { finish = resolve; }) } });
    const pending = setVerifiedPortalAppearanceContext(a);
    clearPortalAppearanceScope();
    finish(new ArrayBuffer(32));
    await pending;
    writePortalThemePreference("light");
    expect(values.size).toBe(0);
  });
});
