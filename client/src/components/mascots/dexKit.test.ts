import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildKit } from "./dexKit";
import { renderDexSvg } from "./dexRender";
import { DEX_MODES } from "./dexGeometry";
import { HOLIDAYS, activeHoliday, easterSunday, isoDay, nextHolidayWindow, occurrences } from "./holidays";
import { resolveDexLook } from "./dexPresence";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const find = (id: string, year: number) => isoDay(occurrences(year).find((o) => o.holiday.id === id)!.day);

describe("holiday dates", () => {
  it("matches the 2026 calendar for every rule-based holiday", () => {
    expect(find("mlk-day", 2026)).toBe("2026-01-19");
    expect(find("presidents-day", 2026)).toBe("2026-02-16");
    expect(find("mothers-day", 2026)).toBe("2026-05-10");
    expect(find("memorial-day", 2026)).toBe("2026-05-25");
    expect(find("fathers-day", 2026)).toBe("2026-06-21");
    expect(find("labor-day", 2026)).toBe("2026-09-07");
    expect(find("indigenous-peoples-day", 2026)).toBe("2026-10-12");
    expect(find("thanksgiving", 2026)).toBe("2026-11-26");
  });

  it("computes Easter", () => {
    expect(isoDay(easterSunday(2026))).toBe("2026-04-05");
    expect(isoDay(easterSunday(2025))).toBe("2025-04-20");
  });

  it("covers 18 holidays with unique ids", () => {
    expect(HOLIDAYS).toHaveLength(18);
    expect(new Set(HOLIDAYS.map((h) => h.id)).size).toBe(18);
  });
});

describe("holiday schedule", () => {
  it("shows Christmas from five days before to one day after", () => {
    expect(activeHoliday(day(2026, 12, 20))?.holiday.id).toBe("christmas");
    expect(activeHoliday(day(2026, 12, 26))?.holiday.id).toBe("christmas");
    expect(activeHoliday(day(2026, 12, 19))).toBeNull();
  });

  it("shows nothing on an ordinary day", () => {
    expect(activeHoliday(day(2026, 10, 22))).toBeNull();
  });

  it("names the next window from now", () => {
    const next = nextHolidayWindow(day(2026, 10, 22));
    expect(next?.occ.holiday.id).toBe("halloween");
    expect(isoDay(next!.startsOn)).toBe("2026-10-29");
  });
});

describe("resolveDexLook", () => {
  it("shows the holiday set on a routine day", () => {
    const look = resolveDexLook({ audience: "client", phase: "working", topic: "general", urgency: 1 }, day(2026, 12, 25));
    expect(look.holiday?.id).toBe("christmas");
    expect(look.presence.mode).toBe("focused");
  });

  it("never shows a holiday set when a person must step in", () => {
    const look = resolveDexLook({ audience: "client", phase: "working", topic: "security", urgency: 2 }, day(2026, 12, 25));
    expect(look.holiday).toBeNull();
    const billing = resolveDexLook({ audience: "client", phase: "handoff", topic: "billing", urgency: 1 }, day(2026, 12, 25));
    expect(billing.holiday).toBeNull();
  });

  it("never changes the emotion for a holiday", () => {
    const plain = resolveDexLook({ audience: "client", phase: "waiting", topic: "general", urgency: 1 }, day(2026, 10, 22));
    const festive = resolveDexLook({ audience: "client", phase: "waiting", topic: "general", urgency: 1 }, day(2026, 12, 25));
    expect(festive.presence.mode).toBe(plain.presence.mode);
  });
});

describe("renderDexSvg", () => {
  it("draws the mode's eyes and a holiday glyph in the holiday accent", () => {
    const christmas = HOLIDAYS.find((h) => h.id === "christmas")!;
    const svg = renderDexSvg({ mode: "alert", size: 64, title: "Dex", holiday: christmas });
    expect(svg).toContain(`data-mode="alert"`);
    expect(svg).toContain(`data-holiday="christmas"`);
    expect(svg).toContain(christmas.accent);
    expect(svg).toContain(`aria-label="Dex"`);
  });

  it("is decorative with no title and has no holiday glyph by default", () => {
    const svg = renderDexSvg();
    expect(svg).toContain(`aria-hidden="true"`);
    expect(svg).not.toContain("data-holiday");
    expect(svg).not.toContain("stroke-linecap");
  });

  it("escapes the title", () => {
    expect(renderDexSvg({ title: `"<x>"` })).toContain("&#34;&#60;x&#62;&#34;");
  });

  it("renders every mode", () => {
    for (const mode of Object.keys(DEX_MODES) as (keyof typeof DEX_MODES)[]) {
      expect(renderDexSvg({ mode })).toContain(`data-mode="${mode}"`);
    }
  });
});

describe("dex-kit.json", () => {
  it("matches the code (run scripts/export-dex-kit.ts after changing the kit)", () => {
    const file = JSON.parse(readFileSync(new URL("../../../../dex/kit/dex-kit.json", import.meta.url), "utf8"));
    expect(file).toEqual(JSON.parse(JSON.stringify(buildKit([2026, 2027, 2028]))));
  });
});
