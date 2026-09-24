import type { DeSyncEventType } from "./deSyncContract";
import { enqueueOutbox } from "./deSyncStore";
import { ensureDeSyncSchema } from "./ensureDeSyncSchema";

export type WebsiteLeadLike = {
  id?: string;
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  message?: string;
  source?: string;
  canonicalAccountId?: string | null;
  portalClientId?: string | null;
  zohoAccountId?: string | null;
};

function eventTypeForSource(source?: string): DeSyncEventType {
  const raw = (source || "").toLowerCase();
  if (raw.includes("assessment")) return "assessment.submitted";
  if (raw.includes("quote")) return "quote.requested";
  if (raw.includes("referral")) return "referral.submitted";
  if (raw.includes("consult") || raw.includes("book")) return "consultation.booked";
  if (raw.includes("order") || raw.includes("store")) return "store.order_created";
  return "lead.created";
}

export async function enqueueWebsiteCommand(payload: WebsiteLeadLike, eventType?: DeSyncEventType) {
  // Website forms can be the first integration activity after a fresh deploy,
  // before any health route or worker tick. Guarantee the durable outbox exists
  // before accepting the customer event into it.
  await ensureDeSyncSchema();

  const type = eventType || eventTypeForSource(payload.source);
  return enqueueOutbox({
    eventType: type,
    source: "website",
    destination: "hub",
    entityType: type.split(".")[0],
    entityId: payload.id,
    canonicalAccountId: payload.canonicalAccountId ?? null,
    payload: {
      id: payload.id || "",
      name: payload.name || "",
      email: payload.email || "",
      company: payload.company || "",
      phone: payload.phone || "",
      message: payload.message || "",
      source: payload.source || "website",
      ...(payload.portalClientId ? { portalClientId: payload.portalClientId } : {}),
      ...(payload.zohoAccountId ? { zohoAccountId: payload.zohoAccountId } : {}),
    },
  });
}
