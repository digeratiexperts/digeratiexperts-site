export const ZOHO_LEAD_STATUS_PENDING_INITIAL_OUTREACH =
  "Pending Initial Outreach: Lead is waiting for the first contact attempt." as const;

export type WebsiteLeadKind =
  | "solution_request"
  | "store_quote"
  | "quote_wizard"
  | "advisor_assessment"
  | "advisor_callback"
  | "advisor_lead"
  | "assessment"
  | "contact"
  | "newsletter";

const LEAD_SOURCE_BY_KIND: Record<WebsiteLeadKind, "Web Download" | "Online Store" | "Chat"> = {
  solution_request: "Web Download",
  store_quote: "Online Store",
  quote_wizard: "Online Store",
  advisor_assessment: "Chat",
  advisor_callback: "Chat",
  advisor_lead: "Chat",
  assessment: "Web Download",
  contact: "Web Download",
  newsletter: "Web Download",
};

/**
 * Maps granular website intake kinds to values that exist in the connected
 * Zoho Leads picklists. Granular source detail remains in each event and
 * description; this adapter owns only the constrained CRM vocabulary.
 */
export function websiteLeadTaxonomy(kind: WebsiteLeadKind) {
  return {
    leadSource: LEAD_SOURCE_BY_KIND[kind],
    leadStatus: ZOHO_LEAD_STATUS_PENDING_INITIAL_OUTREACH,
  } as const;
}
