import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WAREHOUSE_CONTACT_HANDOFF_KEY,
  WAREHOUSE_CONTACT_HANDOFF_MAX_AGE_MS,
  clearContactHandoff,
  readContactHandoff,
  writeContactHandoff,
} from "./warehouseContactHandoff";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as Storage;
}

describe("warehouse contact handoff (issues #235 / #258)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { sessionStorage: memoryStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("carries the checkout contact fields into Request Quote without touching the URL", () => {
    const written = writeContactHandoff(
      { name: "  Jordan Buyer ", email: "Jordan@Example.com", company: "Example Co", phone: "602-555-1212", reason: "role_required" },
      1_000,
    );
    expect(written?.writtenAt).toBe(1_000);
    const read = readContactHandoff(2_000);
    expect(read).toEqual({
      version: 1,
      name: "Jordan Buyer",
      email: "jordan@example.com",
      company: "Example Co",
      phone: "602-555-1212",
      reason: "role_required",
      writtenAt: 1_000,
    });
    expect(window.sessionStorage.getItem(WAREHOUSE_CONTACT_HANDOFF_KEY)).not.toContain("http");
  });

  it("expires on its own and is removed once stale", () => {
    writeContactHandoff({ name: "J", email: "j@example.com", reason: "user_choice" }, 0);
    expect(readContactHandoff(WAREHOUSE_CONTACT_HANDOFF_MAX_AGE_MS + 1)).toBeNull();
    expect(window.sessionStorage.getItem(WAREHOUSE_CONTACT_HANDOFF_KEY)).toBeNull();
  });

  it("ignores unknown versions and malformed payloads", () => {
    window.sessionStorage.setItem(WAREHOUSE_CONTACT_HANDOFF_KEY, JSON.stringify({ version: 2, name: "x", writtenAt: 1 }));
    expect(readContactHandoff(2)).toBeNull();
    window.sessionStorage.setItem(WAREHOUSE_CONTACT_HANDOFF_KEY, "{not json");
    expect(readContactHandoff(2)).toBeNull();
  });

  it("clears after a successful quote submission", () => {
    writeContactHandoff({ name: "J", email: "j@example.com", reason: "durable_db" }, 5);
    clearContactHandoff();
    expect(readContactHandoff(6)).toBeNull();
  });

  it("is a no-op without browser storage", () => {
    vi.stubGlobal("window", undefined);
    expect(writeContactHandoff({ name: "J", reason: "user_choice" })).toBeNull();
    expect(readContactHandoff()).toBeNull();
    expect(() => clearContactHandoff()).not.toThrow();
  });
});
