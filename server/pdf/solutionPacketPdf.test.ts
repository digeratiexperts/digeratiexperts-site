import { describe, expect, it } from "vitest";
import { buildSolutionPacketHtml, parseSolutionPacketBody } from "./solutionPacketPdf";

describe("solution packet PDF HTML", () => {
  it("renders a branded cover and package sections without inventing prices", () => {
    const html = buildSolutionPacketHtml({
      title: "Your Solution",
      statusLabel: "Draft",
      profile: "4 users · 4 computers",
      relationship: "Standalone",
      support: "As needed",
      packages: [
        {
          familyLabel: "IT Operations & Support",
          offerName: "IT Operations — Standalone",
          pricingLabel: "Standard pricing",
          assessmentLabel: "Assessment recommended",
          setupLabel: "Remote DE setup",
          lineItems: [
            { label: "Helpdesk intake and triage", quantity: "4 covered users" },
            { label: "Endpoint monitoring", quantity: "4 primary computers" },
          ],
        },
      ],
      dateLabel: "September 30, 2026",
    });

    expect(html).toContain("Your Solution");
    expect(html).toContain("Digerati Experts");
    expect(html).toContain("#D3126A");
    expect(html).toContain("#050312");
    expect(html).toContain("IT Operations &amp; Support");
    expect(html).toContain("Helpdesk intake and triage");
    expect(html).toContain("4 covered users");
    expect(html).not.toContain("$");
  });

  it("rejects oversized package lists", () => {
    const packages = Array.from({ length: 25 }, (_, i) => ({
      familyLabel: `Family ${i}`,
      offerName: `Offer ${i}`,
      pricingLabel: "Standard",
      assessmentLabel: "None",
      setupLabel: "Remote",
      lineItems: [],
    }));
    const parsed = parseSolutionPacketBody({
      profile: "1 user",
      relationship: "Standalone",
      support: "None",
      packages,
    });
    expect(parsed).toEqual({ error: "Too many packages" });
  });

  it("accepts a minimal valid payload", () => {
    const parsed = parseSolutionPacketBody({
      profile: "2 users",
      relationship: "Co-Managed",
      support: "Ongoing",
      packages: [],
    });
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.profile).toBe("2 users");
    expect(parsed.packages).toEqual([]);
  });
});
