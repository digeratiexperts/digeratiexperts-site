import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The exit-intent popup asks for an assessment follow-up. It must not put
 * anyone on the newsletter: that takes its own signup form.
 */
describe("exit-intent popup", () => {
  const source = readFileSync(resolve(__dirname, "ExitIntentPopup.tsx"), "utf8");

  it("submits an assessment request, not a newsletter signup", () => {
    expect(source).toContain('"/api/assessment"');
    expect(source).not.toContain("/api/newsletter");
  });
});
