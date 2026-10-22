import { describe, expect, it } from "vitest";
import { DEX_EMOTIONS, DEX_INTERACTIONS, chooseDexPresence, type DexSignals } from "./dexPresence";
import type { DexMode } from "./Mascots";

const base: DexSignals = { audience: "client", phase: "working", topic: "general", urgency: 0 };
const pick = (over: Partial<DexSignals>) => chooseDexPresence({ ...base, ...over });

describe("Dex presence rules", () => {
  it("shows extreme only for urgency 3 on security or outage", () => {
    expect(pick({ urgency: 3, topic: "outage" }).mode).toBe("extreme");
    expect(pick({ urgency: 3, topic: "security" }).mode).toBe("extreme");
    expect(pick({ urgency: 3, topic: "billing" }).mode).not.toBe("extreme");
    expect(pick({ urgency: 2, topic: "outage" }).mode).toBe("alert");
  });

  it("never celebrates security or billing", () => {
    expect(pick({ phase: "resolved", topic: "security" }).mode).toBe("reassuring");
    expect(pick({ phase: "resolved", topic: "billing" }).mode).toBe("reassuring");
    expect(pick({ phase: "resolved", topic: "general" }).mode).toBe("done");
  });

  it("never shows done on a failed step", () => {
    expect(pick({ phase: "failed" }).mode).toBe("concerned");
    expect(pick({ phase: "failed" }).mode).not.toBe("done");
  });

  it("always hands security, billing, failures and urgent items to a person", () => {
    expect(pick({ topic: "security" }).mustHandOff).toBe(true);
    expect(pick({ topic: "billing" }).mustHandOff).toBe(true);
    expect(pick({ phase: "failed" }).mustHandOff).toBe(true);
    expect(pick({ phase: "handoff" }).mustHandOff).toBe(true);
    expect(pick({ urgency: 2 }).mustHandOff).toBe(true);
    expect(pick({ phase: "working", topic: "general", urgency: 0 }).mustHandOff).toBe(false);
  });

  it("rests only when idle outside working hours", () => {
    expect(pick({ phase: "idle", afterHours: true }).mode).toBe("resting");
    expect(pick({ phase: "idle", afterHours: false }).mode).not.toBe("resting");
    expect(pick({ phase: "working", afterHours: true }).mode).not.toBe("resting");
  });

  it("uses the chat forms where their job happens", () => {
    expect(pick({ phase: "working" }).form).toBe("capsule");
    expect(pick({ phase: "working", composing: true }).form).toBe("beads");
    expect(pick({ phase: "waiting" }).form).toBe("bubble");
    expect(pick({ phase: "handoff" }).form).toBe("bubble");
    expect(pick({ urgency: 2 }).form).toBe("ring");
    expect(pick({ phase: "resolved" }).form).toBeNull();
  });

  it("uses the tile form in email and profile surfaces", () => {
    expect(pick({ phase: "greeting", surface: "email" }).form).toBe("tile");
    expect(pick({ phase: "idle", surface: "email" }).form).toBe("tile");
    expect(pick({ phase: "greeting", surface: "chat" }).form).toBe("bubble");
  });

  it("is deterministic", () => {
    expect(pick({ phase: "waiting", urgency: 1 })).toEqual(pick({ phase: "waiting", urgency: 1 }));
  });

  it("every chosen mode is a catalogued emotion with a sample line", () => {
    for (const i of DEX_INTERACTIONS) {
      const p = chooseDexPresence(i.signals);
      expect(DEX_EMOTIONS[p.mode as DexMode].line.length).toBeGreaterThan(0);
      expect(p.reason.length).toBeGreaterThan(0);
    }
  });

  it("names every interaction with a unique id", () => {
    const ids = DEX_INTERACTIONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps sample lines free of prices, timings and promised outcomes", () => {
    const risky = /\$|\bwithin\b|\bhours?\b|\bminutes?\b|\bguarantee|\bfixed\b|\bresolved\b/i;
    for (const e of Object.values(DEX_EMOTIONS)) expect(e.line).not.toMatch(risky);
  });
});
