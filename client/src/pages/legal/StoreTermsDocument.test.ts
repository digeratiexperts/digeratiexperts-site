import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "store-terms-of-sale.full.md"),
  "utf8",
);

describe("store terms of sale source", () => {
  it("keeps the Legal full text and named placeholders", () => {
    expect(source).toContain("# DE Store Terms of Sale");
    expect(source).toContain("{{EXCLUDED_STATES}}");
    expect(source).toContain("Responsibility Matrix");
    expect(source).toMatch(/Schedule A\. ProActive Ecosystem/);
  });
});
