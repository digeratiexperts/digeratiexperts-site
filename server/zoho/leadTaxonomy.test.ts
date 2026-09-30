import { describe, expect, it } from "vitest";
import {
  ZOHO_LEAD_STATUS_PENDING_INITIAL_OUTREACH,
  websiteLeadTaxonomy,
} from "./leadTaxonomy";

const connectedCrmLeadSources = new Set([
  "Employee Referral",
  "Trade Show",
  "Seminar Partner",
  "OnlineStore",
  "Partner",
  "External Referral",
  "Web Download",
  "Internal Seminar",
  "Advertisement",
  "Web Research",
  "Cold Call",
  "Sales Email Alias",
  "Public Relations",
  "Chat",
  "WhatsApp - Digerati Experts",
  "Google AdWords",
  "Facebook",
  "Twitter",
]);

describe("website to Zoho Lead taxonomy", () => {
  it("maps every website intake to a Lead Source present in the connected CRM", () => {
    const kinds = [
      "solution_request",
      "store_quote",
      "quote_wizard",
      "advisor_assessment",
      "advisor_callback",
      "advisor_lead",
      "assessment",
      "contact",
      "newsletter",
    ] as const;

    for (const kind of kinds) {
      expect(connectedCrmLeadSources.has(websiteLeadTaxonomy(kind).leadSource)).toBe(true);
    }
  });

  it("uses the connected CRM's canonical initial-outreach status", () => {
    expect(ZOHO_LEAD_STATUS_PENDING_INITIAL_OUTREACH).toBe("Not Contacted");
  });

  it("keeps commerce, web intent, and conversational intake distinguishable", () => {
    expect(websiteLeadTaxonomy("store_quote").leadSource).toBe("OnlineStore");
    expect(websiteLeadTaxonomy("quote_wizard").leadSource).toBe("OnlineStore");
    expect(websiteLeadTaxonomy("store_quote").leadStatus).toBe("Not Contacted");
    expect(websiteLeadTaxonomy("solution_request").leadSource).toBe("Web Download");
    expect(websiteLeadTaxonomy("advisor_lead").leadSource).toBe("Chat");
  });
});
