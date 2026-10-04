import { describe, expect, it } from "vitest";
import { describeMatchBasis, getPlanMatch, type TriState } from "./quoteMatch";

/**
 * Pins Joe-approved plan match (2026-10-03): IT for ≤10 seats, Business for
 * mid-size remote, Enterprise above 30 / 100+.
 */
const IT = [
  "Service desk & issue ownership with a documented baseline",
  "DE Security Foundation — endpoint, identity, email, and security monitoring",
  "Security awareness and a clear upgrade path into Office when the environment grows",
];
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
  if (seats <= 10) return { plan: "IT", reasons: IT };
  if (connectivity === "yes" && devices === "yes") return { plan: "Business", reasons: BUSINESS_BOTH };
  if (connectivity === "yes") return { plan: "Business", reasons: BUSINESS_CONNECTIVITY };
  if (devices === "yes") return { plan: "Office", reasons: OFFICE_DEVICES };
  return { plan: "Office", reasons: OFFICE_BASE };
}

describe("getPlanMatch (Joe-approved commercial rule)", () => {
  it("matches the seat-aware table for every answer combination and the seat boundaries", () => {
    for (const seats of [1, 5, 10, 11, 29, 30, 31, 50, 100]) {
      for (const enterpriseToggle of [false, true]) {
        for (const connectivity of TRI) {
          for (const devices of TRI) {
            expect(
              getPlanMatch({ seats, enterpriseToggle, connectivity, devices }),
              `${seats}/${enterpriseToggle}/${connectivity}/${devices}`,
            ).toEqual(expected(seats, enterpriseToggle, connectivity, devices));
          }
        }
      }
    }
  });

  it("keeps 5 seats with remote on IT, not Business", () => {
    expect(
      getPlanMatch({
        seats: 5,
        enterpriseToggle: false,
        connectivity: "yes",
        devices: "yes",
      }).plan,
    ).toBe("IT");
  });

  it("promotes mid-size remote to Business and keeps 30 seats out of Enterprise", () => {
    expect(getPlanMatch({ seats: 18, enterpriseToggle: false, connectivity: "yes", devices: "no" }).plan).toBe(
      "Business",
    );
    expect(getPlanMatch({ seats: 30, enterpriseToggle: false, connectivity: "no", devices: "no" }).plan).toBe("Office");
    expect(getPlanMatch({ seats: 31, enterpriseToggle: false, connectivity: "no", devices: "no" }).plan).toBe(
      "Enterprise",
    );
  });

  it("answers IT, Office, Business, or Enterprise", () => {
    const plans = new Set<string>();
    for (const seats of [1, 15, 31]) {
      for (const c of TRI) {
        for (const d of TRI) {
          plans.add(getPlanMatch({ seats, enterpriseToggle: false, connectivity: c, devices: d }).plan);
        }
      }
    }
    expect([...plans].sort()).toEqual(["Business", "Enterprise", "IT", "Office"]);
  });
});

describe("describeMatchBasis", () => {
  it("names only the answers that shaped the match", () => {
    expect(describeMatchBasis({ seats: 18, enterpriseToggle: false, connectivity: "yes", devices: "yes" })).toBe(
      "Based on 18 people, remote or cloud work, and managed laptops and desktops.",
    );
    expect(describeMatchBasis({ seats: 1, enterpriseToggle: false, connectivity: "not-sure", devices: "not-sure" })).toBe(
      "Based on 1 person.",
    );
    expect(describeMatchBasis({ seats: 100, enterpriseToggle: true, connectivity: "no" })).toBe(
      "Based on more than 100 people and one office with files on site.",
    );
  });
});
