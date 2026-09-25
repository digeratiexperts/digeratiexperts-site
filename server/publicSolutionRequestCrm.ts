import { curatedSolutionFamilies } from "../client/src/data/curatedSolutions";
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

function deliveryLabel(value: string): string {
  if (value === "co_managed") return "Co-managed / shared responsibility";
  if (value === "standalone") return "Standalone / customer-operated";
  if (value === "unsure") return "Needs DE recommendation";
  return value;
}

function installationLabel(value: string): string {
  if (value === "self_install") return "Self-install";
  if (value === "remote_assist") return "Remote DE setup";
  if (value === "onsite") return "On-site technician";
  if (value === "unsure") return "Needs DE recommendation";
  return value;
}

function supportLabel(value: string): string {
  if (value === "none") return "No remote support requested";
  if (value === "as_needed") return "Remote support as needed";
  if (value === "ongoing") return "Ongoing shared support";
  if (value === "unsure") return "Needs DE recommendation";
  return value;
}

export function buildPublicSolutionRequestDescription(record: PublicSolutionRequest): string {
  const needs = record.selectedNeeds.length
    ? record.selectedNeeds
    : record.familyId
      ? [{ familyId: record.familyId, offerId: record.offerId, deliveryModel: record.deliveryModel }]
      : [];
  const needLines = needs.flatMap((need) => {
    const family = curatedSolutionFamilies.find((entry) => entry.id === need.familyId);
    const offer = need.offerId && family ? family.offers.find((item) => item.id === need.offerId) : null;
    return [
      family ? `- ${family.label} (${deliveryLabel(need.deliveryModel)})` : "",
      offer ? `  Offer ID: ${offer.id}` : "",
    ];
  });
  const env = record.environment;
  return [
    `Solution Request ${record.correlationId}`,
    `Intent: ${record.intent}`,
    record.deliveryPreference ? `Offer relationship: ${deliveryLabel(record.deliveryPreference)}` : "",
    needs.length ? "Selected pains / needs:" : "",
    ...needLines,
    env.userCount ? `Users: ${env.userCount}` : "",
    env.workstationCount ? `Computers: ${env.workstationCount}` : "",
    env.mobileDeviceCount ? `Mobile devices: ${env.mobileDeviceCount}` : "",
    env.siteCount ? `Sites: ${env.siteCount}` : "",
    env.deviceOwnership ? `Device ownership: ${env.deviceOwnership}` : "",
    env.internalIt ? `Internal IT: ${env.internalIt}` : "",
    record.fulfillment.installation ? `Installation: ${installationLabel(record.fulfillment.installation)}` : "",
    record.fulfillment.remoteSupport ? `Remote support: ${supportLabel(record.fulfillment.remoteSupport)}` : "",
    env.complianceNeeds ? `Compliance context: ${env.complianceNeeds}` : "",
    env.currentProvider ? `Current provider: ${env.currentProvider}` : "",
    env.urgency ? `Urgency: ${env.urgency}` : "",
    record.organizationName ? `Organization: ${record.organizationName}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3000);
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
