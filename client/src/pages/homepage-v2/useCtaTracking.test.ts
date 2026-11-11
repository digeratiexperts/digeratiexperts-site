import { describe, expect, it } from "vitest";
import { ctaClickFrom, type CtaElementLike } from "./useCtaTracking";

function fakeTarget(attrs: Record<string, string> | null, text = ""): CtaElementLike {
  return {
    closest: () =>
      attrs
        ? { getAttribute: (name: string) => attrs[name] ?? null, textContent: text }
        : null,
  };
}

describe("ctaClickFrom", () => {
  it("reads the tagged CTA's id, label and destination", () => {
    expect(ctaClickFrom(fakeTarget({ "data-cta": "hero_fit_call", href: "/book" }, "  Book a Fit Call "))).toEqual({
      cta: "hero_fit_call",
      label: "Book a Fit Call",
      href: "/book",
    });
  });

  it("ignores clicks outside a tagged CTA", () => {
    expect(ctaClickFrom(fakeTarget(null))).toBeNull();
    expect(ctaClickFrom(null)).toBeNull();
    expect(ctaClickFrom(fakeTarget({ "data-cta": "  " }))).toBeNull();
  });
});
