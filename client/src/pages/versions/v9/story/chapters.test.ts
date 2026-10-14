import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORY, entrySide, railX, stepNumber } from "./chapters";

const sections = path.resolve(import.meta.dirname, "../sections");
const source = readdirSync(sections)
  .filter((f) => f.endsWith(".tsx"))
  .sort()
  .map((f) => readFileSync(path.join(sections, f), "utf8"))
  .join("\n");

describe("Signal Thread chapters", () => {
  it("mounts every chapter exactly once, in page order", () => {
    const used = [...source.matchAll(/<StoryBackdrop chapter="(\w+)"/g)].map((m) => m[1]);
    expect(used).toEqual(STORY.map((c) => c.key));
  });

  it("enters each chapter on the side the previous one left", () => {
    STORY.forEach((_, i) => expect(entrySide(i)).toBe(i === 0 ? "l" : STORY[i - 1].side));
  });

  it("numbers the visible steps without gaps", () => {
    const shown = STORY.map((c, i) => (c.passthrough ? null : stepNumber(i))).filter((n) => n !== null);
    expect(shown).toEqual(shown.map((_, i) => i + 1));
  });

  it("keeps the rail outside the 1400px canvas and inside the phone gutter", () => {
    expect(railX(390, "l")).toBeLessThan(16);
    expect(railX(1440, "l")).toBeLessThan(44);
    expect(railX(1920, "l")).toBeLessThan((1920 - 1400) / 2 + 24);
    expect(railX(1440, "r")).toBe(1440 - railX(1440, "l"));
  });
});
