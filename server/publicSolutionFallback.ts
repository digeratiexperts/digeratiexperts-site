/**
 * What happens to a submitted solution request the database refused (#243).
 *
 * Three independent saves, each tried regardless of the others:
 *   1. the local disk spool (becomes a database row when Postgres recovers),
 *   2. a Zoho CRM lead,
 *   3. an email with the full request to the lead address and sales.
 * The submit is accepted when any of them held. Only when all three fail does
 * the visitor get a retry, and their browser still holds the draft.
 */
import { buildPublicSolutionRequestDescription, syncPublicSolutionRequestToCrm } from "./publicSolutionRequestCrm";
import type { PublicSolutionRequest } from "./publicSolutionRequestStore";
import { updateSpoolEntry, writeSpoolEntry, type SpoolEntry } from "./publicSolutionSpool";
import { notificationService } from "./services/notificationService";

export type OutsideDatabaseOutcome = {
  durable: "spool" | "crm" | "email" | null;
  spooled: boolean;
  crmRecorded: boolean;
  salesEmailed: boolean;
};

export type FallbackDeps = {
  spool: (entry: SpoolEntry) => boolean;
  updateSpool: (entry: SpoolEntry) => boolean;
  syncCrm: (record: PublicSolutionRequest) => Promise<"pending" | "recorded">;
  emailSales: (record: PublicSolutionRequest) => Promise<boolean>;
  now: () => Date;
};

export const defaultFallbackDeps: FallbackDeps = {
  spool: (entry) => writeSpoolEntry(entry),
  updateSpool: (entry) => updateSpoolEntry(entry),
  syncCrm: syncPublicSolutionRequestToCrm,
  emailSales: (record) =>
    notificationService.sendSolutionRequestFallback({
      reference: record.reference || record.id,
      contactName: record.contactName,
      contactEmail: record.contactEmail,
      contactPhone: record.contactPhone,
      organizationName: record.organizationName,
      description: buildPublicSolutionRequestDescription(record),
    }),
  now: () => new Date(),
};

export async function saveOutsideDatabase(
  record: PublicSolutionRequest,
  deps: FallbackDeps = defaultFallbackDeps,
): Promise<OutsideDatabaseOutcome> {
  // The spool first: it is local, fast, and the only layer that later becomes a row.
  const entry: SpoolEntry = { version: 1, spooledAt: deps.now().toISOString(), salesEmailedAt: null, record };
  let spooled = false;
  try {
    spooled = deps.spool(entry);
  } catch {
    spooled = false;
  }

  let crmRecorded = false;
  try {
    crmRecorded = (await deps.syncCrm(record)) === "recorded";
  } catch (error: any) {
    console.warn("[solution-request] CRM sync failed outside the database:", error?.message || error);
  }

  let salesEmailed = false;
  try {
    salesEmailed = await deps.emailSales(record);
  } catch (error: any) {
    console.warn("[solution-request] fallback email failed:", error?.message || error);
  }

  // Recovery must not create a second CRM lead or send a second email.
  if (spooled && (crmRecorded || salesEmailed)) {
    deps.updateSpool({
      ...entry,
      salesEmailedAt: salesEmailed ? deps.now().toISOString() : null,
      record: { ...record, crmStatus: crmRecorded ? "recorded" : record.crmStatus },
    });
  }

  const durable = spooled ? "spool" : crmRecorded ? "crm" : salesEmailed ? "email" : null;
  return { durable, spooled, crmRecorded, salesEmailed };
}

/** The LEAD_CREATED payload: the admin email and the Hub outbox read these fields. */
export function solutionLeadEvent(record: PublicSolutionRequest) {
  return {
    id: record.id,
    name: record.contactName,
    email: record.contactEmail,
    company: record.organizationName,
    phone: record.contactPhone,
    message: buildPublicSolutionRequestDescription(record),
    source: "solution_request",
    correlationId: record.correlationId,
    familyId: record.familyId,
    offerId: record.offerId,
    deliveryModel: record.deliveryModel,
    deliveryPreference: record.deliveryPreference,
    selectedNeeds: record.selectedNeeds.map((need) => need.familyId),
    installation: record.fulfillment.installation,
    remoteSupport: record.fulfillment.remoteSupport,
    intent: record.intent,
  };
}
