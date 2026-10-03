import { describe, expect, it } from "vitest";
import {
  categorizeThreat,
  HOMEPAGE_MAX_AGE_DAYS,
  isNicheProduct,
  isSmbRelevant,
  kickerFor,
  normalizeThreatAttribution,
  scoreThreat,
  selectHomepageThreats,
  THREAT_ATTRIBUTION,
  type ThreatItem,
} from "./threatFeed";

const now = new Date("2026-08-14T12:00:00Z");

function item(partial: Partial<ThreatItem> & Pick<ThreatItem, "id" | "title" | "score" | "publishedAt">): ThreatItem {
  return {
    excerpt: "",
    category: "Active Exploitation",
    severity: "critical",
    kicker: "CRITICAL · ACTIVE EXPLOITATION",
    sourceName: "CISA KEV",
    sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    kev: true,
    ransomware: false,
    scoreReasons: [],
    ...partial,
  };
}

describe("threat relevance scoring", () => {
  it("promotes a fresh Microsoft KEV item to homepage threshold", () => {
    const { score, reasons } = scoreThreat({
      publishedAt: "2026-08-11T12:00:00Z",
      title: "Microsoft Windows Ancillary Function Driver Use-After-Free",
      vendor: "Microsoft",
      product: "Windows",
      excerpt: "Use-after-free allowing remote code execution.",
      kev: true,
      ransomware: false,
      now,
    });
    expect(score).toBeGreaterThanOrEqual(40);
    expect(reasons.some((r) => r.includes("CISA KEV"))).toBe(true);
    expect(reasons.some((r) => r.includes("SMB"))).toBe(true);
  });

  it("does not promote a stale niche KEV onto the homepage", () => {
    const { score } = scoreThreat({
      publishedAt: "2026-01-07T12:00:00Z",
      title: "HPE OneView Remote Code Execution",
      vendor: "HPE",
      product: "OneView",
      excerpt: "Code injection in HPE OneView.",
      kev: true,
      ransomware: false,
      now,
    });
    expect(isNicheProduct({ title: "HPE OneView", vendor: "HPE", product: "OneView" })).toBe(true);
    expect(score).toBeLessThan(40);
  });

  it("treats high EPSS as a prioritization signal, not a homepage guarantee", () => {
    const { score, reasons } = scoreThreat({
      publishedAt: "2026-08-10T12:00:00Z",
      title: "Obscure industrial controller overflow",
      vendor: "Siemens",
      product: "Parasolid",
      kev: false,
      ransomware: false,
      epss: 0.91,
      cvss: 9.8,
      now,
    });
    expect(reasons.some((r) => r.includes("EPSS"))).toBe(true);
    expect(isSmbRelevant({ title: "Obscure industrial controller overflow", vendor: "Siemens", product: "Parasolid" })).toBe(
      false,
    );
    expect(score).toBeLessThan(40);
  });

  it("categorizes ransomware and KEV distinctly", () => {
    expect(
      categorizeThreat({
        publishedAt: "2026-08-10T12:00:00Z",
        title: "#StopRansomware: Gunra Ransomware",
        kev: false,
        ransomware: true,
        cisaUrgentAdvisory: true,
      }),
    ).toBe("Ransomware");
    expect(
      categorizeThreat({
        publishedAt: "2026-08-11T12:00:00Z",
        title: "Microsoft Windows vulnerability",
        vendor: "Microsoft",
        kev: true,
        ransomware: false,
      }),
    ).toBe("Active Exploitation");
  });

  it("uses category kickers instead of calling everything an alert", () => {
    expect(kickerFor({ kev: true, ransomware: false, category: "Active Exploitation" })).toBe(
      "CRITICAL · ACTIVE EXPLOITATION",
    );
    expect(kickerFor({ kev: false, ransomware: false, epss: 0.91, category: "Critical Vulnerability" })).toBe(
      "HIGH · 91% EPSS",
    );
    expect(kickerFor({ kev: false, ransomware: false, category: "Threat Advisory" })).toBe("THREAT ADVISORY");
  });

  it("returns an empty homepage set when nothing is fresh enough (no fake backfill)", () => {
    const stale: ThreatItem[] = [
      item({
        id: "old",
        title: "Old KEV",
        publishedAt: "2026-01-01T12:00:00Z",
        score: 80,
      }),
    ];
    expect(selectHomepageThreats(stale, now)).toEqual([]);
    expect(HOMEPAGE_MAX_AGE_DAYS).toBe(45);
  });

  it("keeps a canonical attribution line with Digerati Experts and real sources", () => {
    expect(THREAT_ATTRIBUTION).toContain("Digerati Experts");
    for (const source of ["CISA", "NIST NVD", "FIRST", "Microsoft MSRC"]) {
      expect(THREAT_ATTRIBUTION).toContain(source);
    }
    expect(normalizeThreatAttribution("")).toBe(THREAT_ATTRIBUTION);
    expect(normalizeThreatAttribution(null)).toBe(THREAT_ATTRIBUTION);
    expect(normalizeThreatAttribution("Sources: somewhere. Digerati ranks threats.")).toBe(
      THREAT_ATTRIBUTION,
    );
    expect(normalizeThreatAttribution(THREAT_ATTRIBUTION)).toBe(THREAT_ATTRIBUTION);
  });
});
