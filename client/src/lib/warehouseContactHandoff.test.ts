import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WAREHOUSE_CONTACT_HANDOFF_KEY,
  WAREHOUSE_CONTACT_HANDOFF_MAX_AGE_MS,
  WAREHOUSE_HANDOFF_MESSAGE_MAX,
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
      message: "",
      reason: "role_required",
      writtenAt: 1_000,
    });
    expect(window.sessionStorage.getItem(WAREHOUSE_CONTACT_HANDOFF_KEY)).not.toContain("http");
  });

  it("keeps Request Quote's message draft across a reload, capped in length (#235)", () => {
    writeContactHandoff(
      { name: "Jordan", email: "j@example.com", message: "  Need 25 seats by Q1.\nCall after 2pm. ", reason: "auth_required" },
      10,
    );
    expect(readContactHandoff(20)).toMatchObject({
      name: "Jordan",
      message: "Need 25 seats by Q1.\nCall after 2pm.",
      reason: "auth_required",
    });
    writeContactHandoff({ name: "Jordan", message: "x".repeat(WAREHOUSE_HANDOFF_MESSAGE_MAX + 50), reason: "user_choice" }, 30);
    expect(readContactHandoff(40)?.message).toHaveLength(WAREHOUSE_HANDOFF_MESSAGE_MAX);
  });

  it("reads a draft written before the message field existed as an empty message", () => {
    window.sessionStorage.setItem(
      WAREHOUSE_CONTACT_HANDOFF_KEY,
      JSON.stringify({ version: 1, name: "J", email: "j@example.com", company: "", phone: "", reason: "user_choice", writtenAt: 1 }),
    );
    expect(readContactHandoff(2)?.message).toBe("");
  });

  it("each save restarts the expiry, so an active draft does not lapse", () => {
    writeContactHandoff({ name: "J", reason: "user_choice" }, 0);
    writeContactHandoff({ name: "J", message: "still typing", reason: "user_choice" }, WAREHOUSE_CONTACT_HANDOFF_MAX_AGE_MS);
    expect(readContactHandoff(WAREHOUSE_CONTACT_HANDOFF_MAX_AGE_MS + 1_000)?.message).toBe("still typing");
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

describe("tax unavailable handoff", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { sessionStorage: memoryStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("carries the buyer to Request Quote when Pay Now cannot calculate sales tax", () => {
    writeContactHandoff({ name: "J", email: "J@Example.com", reason: "tax_unavailable" }, 5);
    expect(readContactHandoff(6)).toMatchObject({ name: "J", email: "j@example.com", reason: "tax_unavailable" });
  });
});
