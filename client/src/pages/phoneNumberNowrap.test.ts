import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The phone number inside running text, measured on a production build
 * (2026-10-01): at 390px on the homepage and at 360px on the nonprofits page
 * the browser broke it at a hyphen, leaving "325-" at the end of one line.
 * Vitest runs in node here, so these read the sources.
 */
const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const NOWRAP = '<span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>';

describe("the phone number in running text stays on one line", () => {
  it.each([
    "sections/DigeratiTestimonialsSection.tsx",
    "industries/Nonprofits.tsx",
    "industries/RealEstate.tsx",
  ])("%s", (file) => {
    const src = read(file);
    expect(src).toContain(NOWRAP);
    expect(src.replaceAll(NOWRAP, "")).not.toMatch(/[—·]\s*\{PRIMARY_PHONE\.display\}/);
  });
});
