import { describe, expect, it } from "vitest";
import { normalizeSolutionReference, REFERENCE_PATTERN } from "./solutionReference";

describe("the Store reference", () => {
  it("accepts what a buyer types or reads back, and nothing else", () => {
    expect(normalizeSolutionReference("DE-4K7Q2M")).toBe("DE-4K7Q2M");
    expect(normalizeSolutionReference(" de4k7q2m ")).toBe("DE-4K7Q2M");
    expect(normalizeSolutionReference("DE-4K7QZM")).toBe("DE-4K7QZM");
    expect(normalizeSolutionReference("DE-IL0O00")).toBe("DE-110000");
    for (const bad of ["", "DE-", "DE-4K7Q2", "DE-4K7Q2MX", "XX-4K7Q2M", "DE-4K7Q2U", null, 42, "<script>"]) {
      expect(normalizeSolutionReference(bad), String(bad)).toBeNull();
    }
    expect(REFERENCE_PATTERN.test("DE-OOOOOO")).toBe(false);
  });
});
