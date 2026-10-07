import { logger } from "./logger";
import { enqueueOutbox } from "./integrations/deSyncStore";
import { setServiceRequestHubSync, type StoredAttachment, type StoredServiceRequest } from "./serviceRequestStore";
import {
  BASKET_STATUS,
  SERVICE_REQUEST_HUB_ENTITY,
  SERVICE_REQUEST_HUB_EVENT,
  type ServiceRequestHubPayload,
  type ServiceRequestPerson,
} from "@shared/serviceRequests";

/**
 * Portal → Hub copy of a service request. The Portal row is the source of
 * truth; each submit or status change queues one `service_request.upserted`
 * envelope in the durable DE-Sync outbox, which the worker signs
 * (X-DE-Signature, PORTAL_TO_HUB_SECRET) and POSTs to the Hub's
 * /api/ingest/service-requests with backoff (30s, 2m, 5m, 15m, 1h, 4h, then
 * dead letter). Nothing here throws: a Hub that is down or unconfigured never
 * blocks the requester; it shows up as hub_sync_status retrying / failed.
 */

export function buildServiceRequestHubPayload(input: {
  request: StoredServiceRequest;
  accountName: string;
  requestedFor: ServiceRequestPerson;
  submittedBy: ServiceRequestPerson;
  attachments: StoredAttachment[];
}): ServiceRequestHubPayload {
  const r = input.request;
  if (r.status === BASKET_STATUS) throw new Error("A basket request is not sent to the Hub");
  return {
    contractVersion: 1,
    requestId: r.id,
    number: r.number,
    type: r.type,
    status: r.status,
    revision: r.revision,
    portalClientId: r.accountId,
    accountName: input.accountName,
    requestedFor: input.requestedFor,
    submittedBy: input.submittedBy,
    fields: r.payload,
    site: r.site,
    customAddress: r.customAddress,
    attachments: input.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    })),
    statusHistory: r.statusHistory,
    deskTicketId: r.deskTicketId,
    submittedAt: r.submittedAt || r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function queueServiceRequestForHub(input: {
  request: StoredServiceRequest;
  hubAccountId: string | null;
  accountName: string;
  requestedFor: ServiceRequestPerson;
  submittedBy: ServiceRequestPerson;
  attachments: StoredAttachment[];
}): Promise<void> {
  try {
    const payload = buildServiceRequestHubPayload(input);
    const envelope = await enqueueOutbox({
      eventType: SERVICE_REQUEST_HUB_EVENT,
      source: "portal",
      destination: "hub",
      entityType: SERVICE_REQUEST_HUB_ENTITY,
      entityId: input.request.id,
      canonicalAccountId: input.hubAccountId,
      correlationId: input.request.id,
      payload: payload as unknown as Record<string, unknown>,
    });
    await setServiceRequestHubSync(input.request.id, "queued", envelope.eventId);
  } catch (error) {
    logger.warn("service request Hub sync could not be queued", {
      requestId: input.request.id,
      message: error instanceof Error ? error.message : String(error),
    });
    await setServiceRequestHubSync(input.request.id, "failed").catch(() => undefined);
  }
}

/** Called by the DE-Sync worker after each delivery attempt. */
export async function recordServiceRequestDelivery(
  record: { entityType: string; entityId: string; eventId: string },
  status: "synced" | "retrying" | "failed",
): Promise<void> {
  if (record.entityType !== SERVICE_REQUEST_HUB_ENTITY) return;
  try {
    await setServiceRequestHubSync(record.entityId, status, record.eventId);
  } catch (error) {
    logger.warn("service request Hub sync status not recorded", {
      requestId: record.entityId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
