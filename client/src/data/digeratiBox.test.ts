/**
 * The box's contract: every compartment resolves to something the site can
 * actually hand over, and the page never asserts anything about a recipient
 * it was not told.
 */
import { describe, it, expect } from "vitest";
import { resources } from "./resourceRegistry";
import { EXECUTIVE_BRIEFS } from "./executiveBriefs";
import {
  BOX_COMPARTMENTS,
  BOX_RESOURCE_SLUGS,
  boxBriefs,
  boxItemCount,
  compartmentResources,
  recipientName,
} from "./digeratiBox";

describe("box manifest", () => {
  it("promises nothing the registry cannot deliver", () => {
    const known = new Set(resources.map((r) => r.slug));
    const missing = BOX_RESOURCE_SLUGS.filter((slug) => !known.has(slug));
    expect(missing).toEqual([]);
  });

  it("gives every compartment a resolved payload", () => {
    for (const compartment of BOX_COMPARTMENTS) {
      const count =
        compartment.id === "briefing"
          ? boxBriefs().length
          : compartmentResources(compartment).length;
      expect(count, `compartment ${compartment.id} is empty`).toBeGreaterThan(0);
    }
  });

  it("packs each resource once — a box with duplicates reads as padding", () => {
    expect(new Set(BOX_RESOURCE_SLUGS).size).toBe(BOX_RESOURCE_SLUGS.length);
  });

  it("counts what it actually holds", () => {
    expect(boxItemCount()).toBe(BOX_RESOURCE_SLUGS.length + EXECUTIVE_BRIEFS.length);
  });

  it("routes every packed resource to a real page", () => {
    for (const compartment of BOX_COMPARTMENTS) {
      for (const item of compartmentResources(compartment)) {
        expect(item.route.startsWith("/resources/")).toBe(true);
        expect(item.file.startsWith("/assets/resources/")).toBe(true);
      }
    }
  });
});

describe("recipientName", () => {
  it("has no name unless the link carried one", () => {
    expect(recipientName(null)).toBeNull();
    expect(recipientName(undefined)).toBeNull();
    expect(recipientName("")).toBeNull();
    expect(recipientName("   ")).toBeNull();
  });

  it("keeps the punctuation real company names use", () => {
    expect(recipientName("Vance, Refrigeration & Co. (Scranton)")).toBe(
      "Vance, Refrigeration & Co. (Scranton)",
    );
    expect(recipientName("O'Brien-Nakamura")).toBe("O'Brien-Nakamura");
  });

  it("strips anything that could become markup or a script", () => {
    // Parentheses, apostrophes and ampersands survive because real company
    // names use them, and React escapes them on render — the page never uses
    // dangerouslySetInnerHTML. What must not survive is anything that could
    // open a tag, close an attribute, or walk a path.
    for (const hostile of [
      "<script>alert(1)</script>",
      "Acme<img src=x onerror=y>",
      "Acme\" onmouseover=\"x",
      "Acme&lt;b&gt;",
      "Acme/../../etc/passwd",
    ]) {
      const out = recipientName(hostile) ?? "";
      expect(out).not.toMatch(/[<>"`;=/\\]/);
    }
  });

  it("collapses whitespace so a name cannot be padded into a banner", () => {
    expect(recipientName("  Acme     Corp  ")).toBe("Acme Corp");
  });

  it("refuses a name too long to be one", () => {
    expect(recipientName("x".repeat(61))).toBeNull();
    expect(recipientName("x".repeat(60))).toBe("x".repeat(60));
  });

  it("refuses a single character", () => {
    expect(recipientName("A")).toBeNull();
  });
});
