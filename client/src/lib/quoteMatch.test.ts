import { describe, expect, it } from "vitest";
import { describeMatchBasis, getPlanMatch, type TriState } from "./quoteMatch";

/**
 * Pins the plan match the wizard used before the quiz rebuild (issue 419).
 * If one of these changes, a business rule changed: that needs Joe, not a UI PR.
 */
const ENTERPRISE = [
  "Full compliance modules (HIPAA, GDPR, FTC Safeguards)",
  "Penetration testing, DR runbooks, and privileged access controls",
  "AI & Cloud Automation + vCIO strategic guidance",
];
const BUSINESS_BOTH = [
  "Deeper security operations + 24/7 managed threat response",
  "BCDR + compliance/risk reporting + Security Awareness Training",
  "Technology + security business reviews + Cyber Insurance Readiness",
];
const BUSINESS_CONNECTIVITY = [
  "24/7 managed threat response with deeper security operations",
  "Advanced identity controls + BCDR / risk reporting depth",
  "Cyber insurance readiness and recurring security reviews",
];
const OFFICE_DEVICES = [
  "Email + Calendar + Team Chat with MFA + SSO",
  "Endpoint Security + Email Protection + 24/7 MDR",
  "Managed Network + Service Desk + Endpoint Backup",
];
const OFFICE_BASE = [
  "Security-first IT with MFA, SSO, and Password Manager",
  "Endpoint Security + Email Protection + 24/7 MDR",
  "Service Desk + Managed Network + Endpoint Backup",
];

const TRI: TriState[] = ["yes", "no", "not-sure"];

function expected(seats: number, enterpriseToggle: boolean, connectivity: TriState, devices: TriState) {
  if (enterpriseToggle || seats > 30) return { plan: "Enterprise", reasons: ENTERPRISE };
  if (connectivity === "yes" && devices === "yes") return { plan: "Business", reasons: BUSINESS_BOTH };
  if (connectivity === "yes") return { plan: "Business", reasons: BUSINESS_CONNECTIVITY };
  if (devices === "yes") return { plan: "Office", reasons: OFFICE_DEVICES };
  return { plan: "Office", reasons: OFFICE_BASE };
}

describe("getPlanMatch (pinned business rule)", () => {
  it("matches the pre-rebuild table for every answer combination and the seat boundaries", () => {
    for (const seats of [1, 5, 10, 29, 30, 31, 50, 100]) {
      for (const enterpriseToggle of [false, true]) {
        for (const connectivity of TRI) {
          for (const devices of TRI) {
            expect(getPlanMatch({ seats, enterpriseToggle, connectivity, devices }), `${seats}/${enterpriseToggle}/${connectivity}/${devices}`).toEqual(
              expected(seats, enterpriseToggle, connectivity, devices),
            );
          }
        }
      }
    }
  });

  it("keeps 30 seats out of Enterprise and puts 31 in it", () => {
    expect(getPlanMatch({ seats: 30, enterpriseToggle: false, connectivity: "no", devices: "no" }).plan).toBe("Office");
    expect(getPlanMatch({ seats: 31, enterpriseToggle: false, connectivity: "no", devices: "no" }).plan).toBe("Enterprise");
  });

  it("only ever answers Office, Business or Enterprise", () => {
    const plans = new Set<string>();
    for (const seats of [1, 31]) for (const c of TRI) for (const d of TRI) plans.add(getPlanMatch({ seats, enterpriseToggle: false, connectivity: c, devices: d }).plan);
    expect([...plans].sort()).toEqual(["Business", "Enterprise", "Office"]);
  });
});

describe("describeMatchBasis", () => {
  it("names only the answers that shaped the match", () => {
    expect(describeMatchBasis({ seats: 18, enterpriseToggle: false, connectivity: "yes", devices: "yes" })).toBe(
      "Based on 18 people, remote or cloud work, and managed laptops and desktops.",
    );
    expect(describeMatchBasis({ seats: 1, enterpriseToggle: false, connectivity: "not-sure", devices: "not-sure" })).toBe("Based on 1 person.");
    expect(describeMatchBasis({ seats: 100, enterpriseToggle: true, connectivity: "no" })).toBe(
      "Based on more than 100 people and one office with files on site.",
    );
  });
});
