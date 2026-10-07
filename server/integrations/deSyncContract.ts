import { randomUUID } from "crypto";
import { z } from "zod";

// techconsole: the DE Tech Tool, which sends only to the Hub (techconsole_to_hub). Listed so both copies of the
// contract stay identical; no website direction expects it, so the site never accepts a techconsole event.
export const DE_SYNC_SOURCES = ["website", "portal", "techsales", "techconsole"] as const;
export type DeSyncSource = (typeof DE_SYNC_SOURCES)[number];

export const DE_SYNC_EVENT_TYPES = [
  "lead.created",
  "quote.requested",
  "assessment.submitted",
  "store.order_created",
  "referral.submitted",
  "consultation.booked",
  "account.profile_update_requested",
  "quote.response_submitted",
  "approval.submitted",
  "assessment.response_submitted",
  "onboarding.response_submitted",
  "document.acknowledged",
  "service.change_requested",
  "account.updated",
  "client.created",
  "client.updated",
  "deal.created",
  "deal.stage_changed",
  "quote.created",
  "quote.updated",
  "quote.sent",
  "quote.accepted",
  "quote.rejected",
  "quote.expired",
  "agreement.created",
  "agreement.updated",
  "signature.requested",
  "signature.completed",
  "order.created",
  "order.updated",
  "handoff.created",
  "handoff.updated",
  "onboarding.updated",
  "assessment.updated",
  "roadmap.updated",
  "service_entitlement.created",
  "service_entitlement.updated",
  "service_entitlement.ended",
  "catalog.published",
  "pricing.updated",
  "bundle.updated",
  "device.observed",
  "device.rescue_handoff",
  "device.warranty",
  "email_migration.recorded",
  "service_request.upserted",
] as const;

export type DeSyncEventType = (typeof DE_SYNC_EVENT_TYPES)[number];

export const deSyncEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum(DE_SYNC_EVENT_TYPES),
  version: z.literal(1),
  source: z.enum(DE_SYNC_SOURCES),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(120),
  canonicalAccountId: z.string().max(80).optional().nullable(),
  originEventId: z.string().uuid().optional().nullable(),
  payload: z.record(z.unknown()).default({}),
});

export type DeSyncEnvelope = z.infer<typeof deSyncEnvelopeSchema>;
export type DeSyncPayload = Record<string, unknown>;

export function parseDeSyncEnvelope(input: unknown): DeSyncEnvelope {
  return deSyncEnvelopeSchema.parse(input);
}

export function createDeSyncEnvelope(input: {
  eventType: DeSyncEventType;
  source: DeSyncSource;
  entityType: string;
  entityId?: string;
  canonicalAccountId?: string | null;
  correlationId?: string;
  originEventId?: string | null;
  payload: DeSyncPayload;
}): DeSyncEnvelope {
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    version: 1,
    source: input.source,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId || randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId || randomUUID(),
    canonicalAccountId: input.canonicalAccountId ?? null,
    originEventId: input.originEventId ?? null,
    payload: input.payload ?? {},
  };
}

export function isHubOrigin(envelope: DeSyncEnvelope): boolean {
  return envelope.source === "techsales";
}

/** Hub events update local projections only — never enqueue a command back to Hub. */
export function shouldEchoToHub(envelope: DeSyncEnvelope): boolean {
  if (isHubOrigin(envelope)) return false;
  if (envelope.originEventId) return false;
  return true;
}
