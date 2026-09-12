import { describe, expect, it } from "vitest";
import legacyRuntimeLogo from "@assets/DE-Logo-new_1762461524794.webp";
import canonicalReverseLogo from "@brand/digerati-logo-reverse.svg";

describe("Digerati Experts runtime logo authority", () => {
  it("resolves the legacy live import to the canonical reverse SVG master", () => {
    expect(legacyRuntimeLogo).toBe(canonicalReverseLogo);
  });
});
