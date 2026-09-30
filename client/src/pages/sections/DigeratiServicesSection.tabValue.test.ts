import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tabValue } from "./DigeratiServicesSection";

// Radix Tabs builds `id`, `aria-controls` and `aria-labelledby` from the tab
// value. "SOC / MDR Monitoring" used to be passed straight through, producing
// ids with spaces and slashes — an invalid id token that axe reports as a
// critical aria-valid-attr-value violation on the homepage.
const ID_TOKEN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("capability tab values", () => {
  it("slugs titles into valid, non-empty id tokens", () => {
    for (const title of ["SOC / MDR Monitoring", "Backup & Disaster Recovery", "Email Security", "  Odd  Spacing  "]) {
      expect(tabValue(title)).toMatch(ID_TOKEN);
    }
  });

  it("keeps distinct titles distinct", () => {
    const titles = ["SOC / MDR Monitoring", "SOC MDR Monitoring", "Endpoint Management"];
    expect(new Set(titles.map(tabValue)).size).toBe(2);
  });

  it("is what the section actually passes to Radix", () => {
    const src = readFileSync(new URL("./DigeratiServicesSection.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/value=\{item\.title\}/);
    expect(src).toMatch(/defaultValue=\{tabValue\(/);
    expect((src.match(/value=\{tabValue\(item\.title\)\}/g) ?? []).length).toBe(2);
  });
});
