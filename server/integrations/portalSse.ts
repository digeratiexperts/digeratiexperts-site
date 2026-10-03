import type { Response } from "express";

type PortalSsePayload = {
  eventType: string;
  entityId: string;
  canonicalAccountId?: string | null;
};

export type PortalSseViewer = {
  role: string;
  clientId: string | null;
  hubAccountId: string | null;
};

type PortalSseClient = {
  res: Response;
  viewer: PortalSseViewer;
};

const SHARED_PORTAL_EVENTS = new Set(["catalog.published", "pricing.updated", "bundle.updated"]);

const clients = new Set<PortalSseClient>();

/** Catalog events are shared. Account events stay on the matching tenant or an admin. */
export function portalEventVisibleTo(viewer: PortalSseViewer, event: PortalSsePayload): boolean {
  if (viewer.role === "admin") return true;
  if (SHARED_PORTAL_EVENTS.has(event.eventType)) return true;
  // The canonical Hub account is the tenant of record. When the event names
  // one, it alone decides: a mismatch (or a viewer with no Hub account) fails
  // closed even if the entity id happens to equal the viewer's client id (#238).
  const canonical = typeof event.canonicalAccountId === "string" ? event.canonicalAccountId.trim() : "";
  if (canonical) {
    return Boolean(viewer.hubAccountId) && canonical === viewer.hubAccountId;
  }
  // Legacy events without a canonical account fall back to the portal client id.
  if (viewer.clientId && event.entityId === viewer.clientId) return true;
  return false;
}

export function addPortalSseClient(res: Response, viewer: PortalSseViewer): void {
  const client = { res, viewer };
  clients.add(client);
  res.on("close", () => {
    clients.delete(client);
  });
}

export function publishPortalProjection(payload: PortalSsePayload): void {
  const line = `data: ${JSON.stringify({ eventType: payload.eventType, entityId: payload.entityId })}\n\n`;
  for (const client of Array.from(clients)) {
    if (!portalEventVisibleTo(client.viewer, payload)) continue;
    try {
      client.res.write(line);
    } catch {
      clients.delete(client);
    }
  }
}

export function portalSseClientCount(): number {
  return clients.size;
}
