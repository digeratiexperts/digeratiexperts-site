import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SITUATION_SESSION_STORAGE_KEY,
  isAdvisorSessionId,
  readSituationSessionId,
  resolveDeskAdvisorSessionId,
  writeSituationSessionId,
} from "./situationDeskSession";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const VALID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("situation Desk session handoff", () => {
  let store: MemoryStorage;
  beforeEach(() => {
    store = new MemoryStorage();
    (globalThis as unknown as { window: unknown }).window = { sessionStorage: store };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("accepts only server-shaped advisor session ids", () => {
    expect(isAdvisorSessionId(VALID)).toBe(true);
    expect(isAdvisorSessionId(VALID + VALID.slice(0, 32))).toBe(true);
    expect(isAdvisorSessionId("s-1")).toBe(false);
    expect(isAdvisorSessionId("not a session")).toBe(false);
    expect(isAdvisorSessionId("")).toBe(false);
  });

  it("stores and reads a situation session id for this tab", () => {
    writeSituationSessionId("nope");
    expect(store.getItem(SITUATION_SESSION_STORAGE_KEY)).toBeNull();
    writeSituationSessionId(VALID);
    expect(readSituationSessionId()).toBe(VALID);
  });

  it("prefers the explicit openMspAdvisor handoff over a current Desk session", () => {
    writeSituationSessionId(VALID);
    expect(
      resolveDeskAdvisorSessionId({ requestedSessionId: VALID_B, currentSessionId: VALID }),
    ).toBe(VALID_B);
  });

  it("keeps the current Desk session when the open event has no session id", () => {
    expect(
      resolveDeskAdvisorSessionId({ requestedSessionId: undefined, currentSessionId: VALID }),
    ).toBe(VALID);
  });

  it("adopts a stored situation session when Desk does not have one yet", () => {
    writeSituationSessionId(VALID);
    expect(resolveDeskAdvisorSessionId({ currentSessionId: null })).toBe(VALID);
  });

  it("ignores a forged or malformed requested id", () => {
    writeSituationSessionId(VALID);
    expect(
      resolveDeskAdvisorSessionId({ requestedSessionId: "drop-table", currentSessionId: null }),
    ).toBe(VALID);
  });
});
