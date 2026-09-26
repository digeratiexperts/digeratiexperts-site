import type { Request, Response } from "express";
import { eventBus } from "../eventBus";
import { logger } from "../logger";
import { parseDeSyncEnvelope, shouldEchoToHub, type DeSyncEnvelope } from "./deSyncContract";
import { requireDeSyncAuth } from "./deSyncAuth";
import {
  clearMemoryProjections,
  getHubProjectionRecord,
  isNewerProjection,
  recordConflict,
  saveCatalogSnapshot,
  saveHubProjection,
} from "./deSyncStore";
import { beginInbox, markInboxApplied } from "./deSyncInboxLifecycle";
import { persistHubAccountId } from "./techSalesClient";
import { publishPortalProjection } from "./portalSse";
import { toClientProjection, toPublicCatalog } from "./clientProjection";

export async function getHubProjection(
  entityType: string,
  entityId: string,
): Promise<Record<string, unknown> | undefined> {
  const row = await getHubProjectionRecord(entityType, entityId);
  return row ? toClientProjection(row.payload) : undefined;
}

export function resetHubProjections(): void {
  clearMemoryProjections();
}

async function applyHubEvent(envelope: DeSyncEnvelope): Promise<void> {
  if (shouldEchoToHub(envelope)) return;

  const existing = await getHubProjectionRecord(envelope.entityType, envelope.entityId);
  const occurredAt = new Date(envelope.occurredAt);
  const apply = isNewerProjection(existing?.updatedAt ?? null, envelope.occurredAt);

  if (apply) {
    const previous = existing?.payload;
    if (
      previous &&
      envelope.eventType.startsWith("account.") &&
      previous.name &&
      envelope.payload.name &&
      previous.name !== envelope.payload.name
    ) {
      await recordConflict({
        canonicalAccountId: envelope.canonicalAccountId ?? existing?.canonicalAccountId,
        entityType: envelope.entityType,
        entityId: envelope.entityId,
        field: "name",
        hubValue: envelope.payload.name,
        peerValue: previous.name,
      });
    }

    await saveHubProjection({
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      canonicalAccountId: envelope.canonicalAccountId ?? existing?.canonicalAccountId ?? null,
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      payload: toClientProjection({
        ...(previous || {}),
        ...envelope.payload,
        eventType: envelope.eventType,
        updatedAt: envelope.occurredAt,
      }),
      updatedAt: Number.isFinite(occurredAt.getTime()) ? occurredAt : new Date(),
    });

    if (
      envelope.eventType === "catalog.published" ||
      envelope.eventType === "pricing.updated" ||
      envelope.eventType === "bundle.updated"
    ) {
      const snapshot =
        envelope.payload.catalog && typeof envelope.payload.catalog === "object"
          ? (envelope.payload.catalog as Record<string, unknown>)
          : envelope.payload;
      await saveCatalogSnapshot(toPublicCatalog(snapshot), envelope.eventId);
    }

    await eventBus.emit(
      `hub:${envelope.eventType}`,
      {
        eventId: envelope.eventId,
        entityType: envelope.entityType,
        entityId: envelope.entityId,
        canonicalAccountId: envelope.canonicalAccountId,
      },
      "techsales",
    );

    publishPortalProjection({ eventType: envelope.eventType, entityId: envelope.entityId });
  }

  const portalClientId =
    typeof envelope.payload.portalClientId === "string" ? envelope.payload.portalClientId : null;
  if (envelope.canonicalAccountId && portalClientId) {
    await persistHubAccountId(portalClientId, envelope.canonicalAccountId);
  }
}

export async function handleHubEvents(req: Request, res: Response): Promise<void> {
  let envelope: DeSyncEnvelope;
  try {
    envelope = parseDeSyncEnvelope(req.body);
  } catch {
    res.status(400).json({ error: "Invalid integration envelope" });
    return;
  }

  if (shouldEchoToHub(envelope)) {
    res.status(400).json({ error: "Hub events must originate from techsales" });
    return;
  }

  try {
    const inbox = await beginInbox(envelope);
    if (inbox.alreadyApplied) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    await applyHubEvent(envelope);
    await markInboxApplied(envelope.eventId);
    res.status(200).json({ ok: true, duplicate: false });
  } catch (error) {
    // The inbox row intentionally remains with appliedAt = null. A Hub retry
    // with the same eventId will re-run application instead of being discarded.
    logger.error("Failed to apply Hub event", error);
    res.status(500).json({ error: "Failed to apply event" });
  }
}

export const hubEventsAuth = requireDeSyncAuth("hub_to_website");
