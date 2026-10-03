import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "Checkout.tsx"), "utf8");

describe("Pay Now when sales tax is unavailable", () => {
  it("switches to Request Quote with an explanation instead of a Checkout Failed error", () => {
    const block = src.match(/if \(errorData\.code === "TAX_RATE_UNAVAILABLE"\) \{[\s\S]*?return;\s*\}/)?.[0] ?? "";
    expect(block).toContain('reason: "tax_unavailable"');
    expect(block).toContain('setPaymentMethod("quote_request")');
    expect(block).toMatch(/title: "Pay Now is paused while sales tax is set up"/);
  });
});
