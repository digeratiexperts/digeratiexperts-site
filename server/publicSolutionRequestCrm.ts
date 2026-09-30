import { curatedSolutionFamilies } from "../client/src/data/curatedSolutions";
import {
  ASSESSMENT_LABELS,
  INSTALL_MODE_LABELS,
  PRICING_LABELS,
  RELATIONSHIP_LABELS,
  SUPPORT_LABELS,
  buildSolutionPackage,
  installModeDetail,
  preferredInstallMode,
} from "../client/src/lib/solutionPackage";
import { zohoClient } from "./zoho/zohoClient";
import { zohoCRMService } from "./zoho/zohoCRM";
import { websiteLeadTaxonomy } from "./zoho/leadTaxonomy";
import type { PublicSolutionRequest } from "./publicSolutionRequestStore";

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "Unknown" };
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const OWNERSHIP_WORDS: Record<string, string> = {
  company: "company-owned",
  byod: "people bring their own",
  hybrid: "a mix",
};

const INTERNAL_IT_WORDS: Record<string, string> = {
  yes: "yes",
  no: "no",
  unsure: "not sure",
};

const INTENT_WORDS: Record<string, string> = {
  quote: "Quote the solution",
  consultation: "DE recommends the relationship, then quotes",
  assessment: "Assessment before final scope, then quote",
  request: "Request",
};

/**
 * What DE reads. Public words only, from the same label maps the buyer saw,
 * with every package sized exactly as it was shown. No enum values, no offer
 * ids, no vendor names, no internal state.
 */
export function buildPublicSolutionRequestDescription(record: PublicSolutionRequest): string {
  const needs = record.selectedNeeds.length
    ? record.selectedNeeds
    : record.familyId
      ? [{ familyId: record.familyId, offerId: record.offerId, deliveryModel: record.deliveryModel }]
      : [];
  const env = record.environment;
  const relationship = record.deliveryPreference;
  const concrete = relationship === "standalone" || relationship === "co_managed";

  const packageBlocks = needs.flatMap((need) => {
    const family = curatedSolutionFamilies.find((entry) => entry.id === need.familyId);
    if (!family) return [];
    const view = buildSolutionPackage(family, concrete ? relationship : "standalone", env);
    const installation = (need as { installation?: string }).installation;
    const mode =
      installation === "remote_assist" || installation === "self_install" || installation === "onsite"
        ? installation
        : (preferredInstallMode(view.installModes) ?? "remote_assist");
    const setupLabel = installModeDetail(mode, view.shipmentMode).label;
    const setupTag = mode === preferredInstallMode(view.installModes) ? "(DE's first choice)" : "(chosen)";
    const source = (need as { source?: string }).source;
    return [
      `- ${family.label}${concrete ? ` — ${view.offerName}` : " — DE confirms Standalone or Co-Managed"}`,
      `  Pricing position: ${concrete ? view.pricingLabel : PRICING_LABELS.unsure}`,
      `  Assessment: ${ASSESSMENT_LABELS[view.assessmentPolicy]}`,
      ...view.lineItems.map((line) => `  · ${line.label}: ${line.quantity}`),
      `  Delivery & Setup: ${setupLabel} ${setupTag}`,
      `  Shipping: ${view.shipmentMode === "none" ? "nothing ships" : view.shipmentMode === "physical" ? "equipment ships" : "equipment ships if included"}`,
      source ? `  Started from situation: ${source}` : "",
    ];
  });

  const support = record.fulfillment.remoteSupport;
  const suggestion = record.suggestion;

  return [
    `Solution ${record.reference ?? "(draft)"} · correlation ${record.correlationId}`,
    `Intent: ${INTENT_WORDS[record.intent] ?? record.intent}`,
    `Relationship: ${relationship === "unsure" ? "DE to recommend" : (RELATIONSHIP_LABELS[relationship] ?? RELATIONSHIP_LABELS[""])}`,
    suggestion?.value
      ? `Suggestion shown: ${RELATIONSHIP_LABELS[suggestion.value]} (${suggestion.accepted ? "used" : "declined"})`
      : "",
    "",
    "Profile:",
    env.userCount ? `  Users: ${env.userCount}` : "",
    env.workstationCount ? `  Computers: ${env.workstationCount}` : "",
    env.mobileDeviceCount ? `  Mobile devices: ${env.mobileDeviceCount}` : "",
    env.siteCount ? `  Sites: ${env.siteCount}` : "",
    env.deviceOwnership ? `  Device ownership: ${OWNERSHIP_WORDS[env.deviceOwnership] ?? env.deviceOwnership}` : "",
    env.internalIt ? `  Internal IT: ${INTERNAL_IT_WORDS[env.internalIt] ?? env.internalIt}` : "",
    "",
    packageBlocks.length ? "Packages (sized as shown to the buyer):" : "",
    ...packageBlocks,
    "",
    support ? `Remote support after setup: ${SUPPORT_LABELS[support]?.label ?? support}` : "",
    record.fulfillment.installation === "onsite"
      ? `Buyer asked for: ${INSTALL_MODE_LABELS.onsite.label} (Truck-Roll, Trip Charge and Tech Labor; DE confirms whether it is needed)`
      : "",
    env.complianceNeeds ? `Compliance context: ${env.complianceNeeds}` : "",
    env.currentProvider ? `Current provider: ${env.currentProvider}` : "",
    env.urgency ? `Urgency: ${env.urgency}` : "",
    record.organizationName ? `Organization: ${record.organizationName}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n")
    .slice(0, 6000);
}

/**
 * Best-effort CRM handoff. Public fields only. Never throws to the HTTP path.
 * Does not claim connector health. Returns recorded only when a remote id exists.
 */
export async function syncPublicSolutionRequestToCrm(
  record: PublicSolutionRequest,
): Promise<"pending" | "recorded"> {
  if (!zohoClient.isConfigured()) {
    console.info("[solution-request] CRM sync skipped — Zoho is not configured");
    return "pending";
  }

  try {
    const { first, last } = splitName(record.contactName);
    const description = buildPublicSolutionRequestDescription(record);
    const taxonomy = websiteLeadTaxonomy("solution_request");
    const created = await zohoCRMService.createLead({
      First_Name: first || undefined,
      Last_Name: last,
      Email: record.contactEmail,
      Phone: record.contactPhone || undefined,
      Company: record.organizationName || "Solution request prospect",
      Lead_Source: taxonomy.leadSource,
      Description: description,
      Lead_Status: taxonomy.leadStatus,
    });
    if (created?.id) return "recorded";
    return "pending";
  } catch (error: any) {
    console.warn("[solution-request] CRM sync pending:", error?.message || error);
    return "pending";
  }
}
