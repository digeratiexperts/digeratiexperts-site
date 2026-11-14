import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALERT_MONITORING_CLAIM, ALERT_MONITORING_CLAIM_PHRASE } from "./publicSecurityClaims";

const APPROVED =
  "Automated security alert monitoring, with alerts escalated to DE technicians, on plans that include it.";

describe("public alert-monitoring wording", () => {
  it("keeps the approved sentence in one place", () => {
    expect(ALERT_MONITORING_CLAIM).toBe(APPROVED);
    expect(ALERT_MONITORING_CLAIM_PHRASE).toBe(APPROVED.replace(/\.$/, ""));
  });

  it("is the wording used in search tags", () => {
    const meta = readFileSync(path.resolve(__dirname, "routeMeta.json"), "utf8");
    expect(meta).toContain(ALERT_MONITORING_CLAIM_PHRASE);
    expect(meta).not.toMatch(/security operations partner/i);
    expect(meta).not.toMatch(/24\/7|24x7|24\u00d77|round-the-clock|around the clock|We run the security room/i);
  });
});
