import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALERT_MONITORING_CLAIM, ALERT_MONITORING_CLAIM_PHRASE } from "./publicSecurityClaims";

const APPROVED =
  "Automated security alert monitoring, with alerts triaged by DE technicians during business hours, on plans that include it.";

describe("public alert-monitoring wording", () => {
  it("keeps the approved sentence in one place", () => {
    expect(ALERT_MONITORING_CLAIM).toBe(APPROVED);
    expect(ALERT_MONITORING_CLAIM_PHRASE).toBe(APPROVED.replace(/\.$/, ""));
  });

  it("is the wording used in search tags", () => {
    const meta = readFileSync(path.resolve(__dirname, "routeMeta.json"), "utf8");
    expect(meta).toContain(ALERT_MONITORING_CLAIM_PHRASE);
    expect(meta).not.toMatch(/security operations partner/i);
    expect(meta).not.toMatch(/around the clock|round-the-clock|We run the security room/i);
    const twentyFourSeven = [...meta.matchAll(/24\s*[/x\u00d7]7[^\n]*/gi)].map((m) => m[0]);
    for (const hit of twentyFourSeven) {
      expect(hit.toLowerCase()).toContain("add-on");
    }
  });
});
