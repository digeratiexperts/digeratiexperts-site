import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalHrefsFor,
  registerPageCanonical,
} from "@/components/DefaultCanonical";

const here = dirname(fileURLToPath(import.meta.url));

describe("useSEO page canonical vs DefaultCanonical", () => {
  afterEach(() => {
    registerPageCanonical(undefined);
  });

  it('a page using useSEO({canonical:"/go"}) ends with exactly one canonical = https://digeratiexperts.com/go', () => {
    registerPageCanonical("/go");
    const hrefs = canonicalHrefsFor("/pricing");
    expect(hrefs).toEqual(["https://digeratiexperts.com/go"]);
    expect(hrefs).toHaveLength(1);
  });

  it("does not mutate link[rel=canonical] in the DOM from useSEO", () => {
    const source = readFileSync(resolve(here, "useSEO.ts"), "utf8");
    expect(source).toMatch(/registerPageCanonical\(canonical\)/);
    expect(source).not.toMatch(/querySelector\(['"]link\[rel=["']canonical["']\]['"]\)/);
  });
});
