/**
 * Unified TechSales Hub client: reads, signed command delivery, and identity.
 * Absorbs the former techSalesDocuments.ts surface.
 */
import { retainHubAccountMapping } from "./backfillHubIdentity";
import { logger } from "../logger";
import { getClient, setClient } from "../portalAuthStore";
import { assertMutationAllowed } from "../stagingReviewGuard";
import { buildSignedHeaders, newEventId, resolveScopedSecret } from "./deSyncAuth";
import type { DeSyncEnvelope, DeSyncEventType } from "./deSyncContract";
import { SERVICE_REQUEST_HUB_EVENT, SERVICE_REQUEST_HUB_PATH } from "@shared/serviceRequests";

export type HubCompanyDocumentsResponse = {
  success?: boolean;
  companyName?: string;
  accountId?: number | string | null;
  identitySource?: "canonical_account_id" | "legacy_exact_name" | "unmapped" | string;
  matchedDeals?: Array<{ id: number; accountName: string; accountId: number | null; stage: string }>;
  contracts?: any[];
  library?: any[];
  error?: string;
};

export type HubCompanyOrder = {
  id: string;
  source: "hub_deal" | "hub_quote" | "hub_package" | string;
  orderNumber: string;
  title?: string;
  status: string;
  hubStatus?: string;
  amount?: number | null;
  totalMonthly?: number | null;
  totalOneTime?: number | null;
  companyName?: string;
  dealId?: number | null;
  quoteId?: number | null;
  packageId?: number | null;
  tier?: string | null;
  stage?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  detailPath?: string;
};

export type HubCompanyOrdersResponse = {
  success?: boolean;
  companyName?: string;
  accountId?: number | string | null;
  identitySource?: "canonical_account_id" | "legacy_exact_name" | "unmapped" | string;
  matchedDeals?: Array<{ id: number; accountName: string; accountId: number | null; stage: string }>;
  orders?: HubCompanyOrder[];
  counts?: { deals?: number; quotes?: number; packages?: number; total?: number };
  error?: string;
};

const WEBSITE_PATHS: Partial<Record<DeSyncEventType, string>> = {
  "lead.created": "/api/integrations/v1/website/leads",
  "quote.requested": "/api/integrations/v1/website/quote-requests",
  "assessment.submitted": "/api/integrations/v1/website/assessments",
  "store.order_created": "/api/integrations/v1/website/store-orders",
  "referral.submitted": "/api/integrations/v1/website/referrals",
  "consultation.booked": "/api/integrations/v1/website/consultations",
};

export function hubApiBase(): string | null {
  const explicit = (process.env.TECHSALES_HUB_URL || process.env.TECHSALES_BASE_URL || "").trim();
  if (explicit) {
    return explicit.replace(/\/$/, "") + (explicit.includes("/api") ? "" : "/api");
  }
  const syncUrl = (process.env.TECHSALES_SYNC_URL || "").trim();
  if (!syncUrl) return null;
  try {
    const u = new URL(syncUrl);
    const idx = u.pathname.indexOf("/api");
    if (idx >= 0) return `${u.origin}${u.pathname.slice(0, idx + 4)}`;
    return `${u.origin}/api`;
  } catch {
    return null;
  }
}

export function hubOrigin(): string | null {
  const base = hubApiBase();
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

function syncToken(): string {
  return resolveScopedSecret("portal_to_hub").secret;
}

function websiteToken(): string {
  return resolveScopedSecret("website_to_hub").secret;
}

async function signedGet<T>(pathWithQuery: string, direction: "website_to_hub" | "portal_to_hub"): Promise<T | null> {
  const base = hubApiBase();
  const secret = resolveScopedSecret(direction).secret;
  if (!base || !secret) return null;
  const url = `${base.replace(/\/api$/, "")}${pathWithQuery.startsWith("/api") ? pathWithQuery : `/api${pathWithQuery}`}`;
  const parsed = new URL(url);
  const headers = buildSignedHeaders({
    method: "GET",
    path: `${parsed.pathname}${parsed.search}`,
    eventId: "00000000-0000-4000-8000-000000000000",
    source: direction === "portal_to_hub" ? "portal" : "website",
    body: "{}",
    secret,
  });
  const res = await fetch(url, { method: "GET", headers: { ...headers, Accept: "application/json" } });
  if (!res.ok) {
    logger.error("TechSales GET failed", { path: pathWithQuery, status: res.status });
    return null;
  }
  return (await res.json()) as T;
}

export function resolvePortalCompanyName(opts: {
  clientId?: string | null;
  impersonatingCompanyId?: string | null;
  getClient: (id: string) => { companyName?: string; hubAccountId?: string | null } | undefined;
}): string | null {
  const id = opts.impersonatingCompanyId || opts.clientId;
  if (!id) return null;
  const client = opts.getClient(id);
  return client?.companyName?.trim() || null;
}

export function resolvePortalHubAccountId(opts: {
  clientId?: string | null;
  impersonatingCompanyId?: string | null;
  getClient: (id: string) => { hubAccountId?: string | null } | undefined;
}): string | null {
  const id = opts.impersonatingCompanyId || opts.clientId;
  if (!id) return null;
  return opts.getClient(id)?.hubAccountId?.trim() || null;
}

export function mayPersistHubAccount(identitySource: string | null | undefined): boolean {
  return identitySource === "canonical_account_id";
}

export async function persistHubAccountId(clientId: string, accountId: string | number): Promise<void> {
  const id = String(accountId).trim();
  if (!clientId || !id) return;
  const client = getClient(clientId);
  if (!client) return;
  const write = retainHubAccountMapping(client.hubAccountId, id);
  if (write.action === "conflict") {
    logger.warn("Refused to replace Hub account mapping", {
      clientId,
      existing: write.existing,
      incoming: write.incoming,
    });
    return;
  }
  if (write.action === "ignore") return;
  if (write.action === "set") {
    setClient({ ...client, hubAccountId: write.hubAccountId });
    logger.info("Persisted Hub account mapping", { clientId, hubAccountId: write.hubAccountId });
  }
  try {
    const { db } = await import("../db");
    const { externalIntegrationMappings } = await import("@shared/schema");
    const { and, eq } = await import("drizzle-orm");
    if (!db || !process.env.DATABASE_URL) return;
    const existing = await db
      .select()
      .from(externalIntegrationMappings)
      .where(
        and(
          eq(externalIntegrationMappings.clientId, clientId),
          eq(externalIntegrationMappings.integrationType, "techsales_hub"),
        ),
      )
      .limit(1);
    const storedId = write.hubAccountId;
    if (existing[0]) {
      const rowWrite = retainHubAccountMapping(existing[0].externalId, storedId);
      if (rowWrite.action === "conflict") {
        logger.warn("Refused to replace stored Hub account mapping", {
          clientId,
          existing: rowWrite.existing,
          incoming: rowWrite.incoming,
        });
        return;
      }
      await db
        .update(externalIntegrationMappings)
        .set({ externalId: storedId, lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(externalIntegrationMappings.id, existing[0].id));
    } else {
      await db.insert(externalIntegrationMappings).values({
        clientId,
        integrationType: "techsales_hub",
        externalId: storedId,
        externalType: "account",
        mappedPortalId: clientId,
        mappedType: "client",
        syncStatus: "active",
        lastSyncedAt: new Date(),
      });
    }
  } catch {
    /* mapping table is optional in memory mode */
  }
}

/**
 * Signed headers for a portal-bridge GET. The signature covers the path AND
 * the query string, because the Hub reads the tenant (accountId / companyName)
 * from the query: a captured request cannot be replayed for another company,
 * and the raw sync token never leaves this server. Requires the Hub release
 * that accepts query-covering signatures (Intelligence-Hub de-sync-auth).
 */
export function portalBridgeHeaders(url: string, secret: string): Record<string, string> {
  const parsed = new URL(url);
  return buildSignedHeaders({
    method: "GET",
    path: `${parsed.pathname}${parsed.search}`,
    eventId: newEventId(),
    source: "portal",
    body: "{}",
    secret,
  });
}

function documentsQuery(
  companyName: string | null,
  accountId: string | null,
  portalClientId?: string | null,
): string {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", accountId);
  else if (companyName) params.set("companyName", companyName);
  if (portalClientId) params.set("portalClientId", portalClientId);
  return params.toString();
}

export async function fetchHubCompanyDocuments(
  companyName: string,
  accountId?: string | null,
  portalClientId?: string | null,
): Promise<HubCompanyDocumentsResponse | null> {
  const base = hubApiBase();
  const token = syncToken();
  if (!base || !token) {
    logger.warn("TechSales document bridge skipped — TECHSALES_HUB_URL/SYNC_URL or TOKEN not set");
    return null;
  }
  const qs = documentsQuery(companyName, accountId || null, portalClientId);
  if (!qs) return null;
  const url = `${base}/webhooks/portal/company-documents?${qs}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { ...portalBridgeHeaders(url, token), Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as HubCompanyDocumentsResponse;
    if (!res.ok) {
      logger.error("TechSales company-documents failed", { status: res.status, error: data.error, companyName, accountId });
      return null;
    }
    return data;
  } catch (err: any) {
    logger.error("TechSales company-documents error", { message: err?.message, companyName });
    return null;
  }
}

export async function fetchHubCompanyOrders(
  companyName: string,
  accountId?: string | null,
  portalClientId?: string | null,
): Promise<HubCompanyOrdersResponse | null> {
  const base = hubApiBase();
  const token = syncToken();
  if (!base || !token) {
    logger.warn("TechSales orders bridge skipped — TECHSALES_HUB_URL/SYNC_URL or TOKEN not set");
    return null;
  }
  const qs = documentsQuery(companyName, accountId || null, portalClientId);
  if (!qs) return null;
  const url = `${base}/webhooks/portal/company-orders?${qs}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { ...portalBridgeHeaders(url, token), Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as HubCompanyOrdersResponse;
    if (!res.ok) {
      logger.error("TechSales company-orders failed", { status: res.status, error: data.error, companyName, accountId });
      return null;
    }
    return data;
  } catch (err: any) {
    logger.error("TechSales company-orders error", { message: err?.message, companyName });
    return null;
  }
}

export async function fetchHubContractDownload(
  signatureId: number,
  companyName: string,
  kind: string = "signed_pdf",
  accountId?: string | null,
  portalClientId?: string | null,
): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null> {
  const base = hubApiBase();
  const token = syncToken();
  if (!base || !token) return null;
  const qs = new URLSearchParams();
  if (accountId) qs.set("accountId", accountId);
  else qs.set("companyName", companyName);
  if (portalClientId) qs.set("portalClientId", portalClientId);
  qs.set("kind", kind);
  const url = `${base}/webhooks/portal/company-documents/${signatureId}/download?${qs.toString()}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: portalBridgeHeaders(url, token),
    });
    if (!res.ok) {
      logger.error("TechSales document download failed", { status: res.status, signatureId });
      return null;
    }
    const ab = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/pdf";
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    return {
      buffer: Buffer.from(ab),
      contentType,
      fileName: match?.[1] || `contract-${signatureId}.pdf`,
    };
  } catch (err: any) {
    logger.error("TechSales document download error", { message: err?.message, signatureId });
    return null;
  }
}

const PORTAL_COMMANDS_PATH = "/api/integrations/v1/portal/commands";

/** Portal-sourced events with their own Hub intake route (signed portal_to_hub, same headers). */
const PORTAL_PATHS: Partial<Record<DeSyncEventType, string>> = {
  [SERVICE_REQUEST_HUB_EVENT]: SERVICE_REQUEST_HUB_PATH,
};

export function websitePathForEvent(eventType: DeSyncEventType): string {
  return WEBSITE_PATHS[eventType] || PORTAL_COMMANDS_PATH;
}

/**
 * Hub path for an outbound envelope, chosen by (source, eventType).
 *
 * The Hub's website intake routes only accept `X-DE-Source: website` signed
 * with the website secret, and its portal route has no handler for website
 * intake events (it would acknowledge them as a no-op). So a portal-sourced
 * envelope whose type is website-only is refused here, loudly, instead of
 * being posted somewhere that rejects or silently drops it.
 */
export function hubPathForEnvelope(source: DeSyncEnvelope["source"], eventType: DeSyncEventType): string {
  if (source === "portal") {
    if (WEBSITE_PATHS[eventType]) {
      throw new Error(`Portal-sourced ${eventType} has no Hub portal route`);
    }
    return PORTAL_PATHS[eventType] || PORTAL_COMMANDS_PATH;
  }
  return websitePathForEvent(eventType);
}

export function readHubDeliveryResult(body: unknown): {
  canonicalAccountId: string | null;
  duplicate: boolean;
} {
  if (!body || typeof body !== "object") {
    return { canonicalAccountId: null, duplicate: false };
  }
  const record = body as Record<string, unknown>;
  const raw = record.canonicalAccountId;
  const canonicalAccountId =
    typeof raw === "string" && raw.trim()
      ? raw.trim()
      : typeof raw === "number" && Number.isInteger(raw) && raw > 0
        ? String(raw)
        : null;
  return { canonicalAccountId, duplicate: record.duplicate === true };
}

export async function deliverEnvelopeToHub(
  envelope: DeSyncEnvelope,
  destination: "hub" | "website" | "portal",
): Promise<{ canonicalAccountId: string | null; duplicate: boolean }> {
  // Review instances never emit Hub events. Throwing keeps the envelope in the
  // outbox (retryable) rather than marking it delivered.
  assertMutationAllowed(`Hub event delivery: ${envelope.eventType}`);
  if (destination !== "hub") {
    throw new Error(`Site worker does not deliver destination=${destination}`);
  }
  const origin = hubOrigin();
  const secret =
    envelope.source === "portal" ? resolveScopedSecret("portal_to_hub").secret : websiteToken();
  if (!origin || !secret) {
    throw new Error("Hub destination not configured");
  }

  const path = hubPathForEnvelope(envelope.source, envelope.eventType);
  const body = JSON.stringify(envelope);
  const headers = buildSignedHeaders({
    method: "POST",
    path,
    eventId: envelope.eventId,
    source: envelope.source,
    body,
    secret,
  });

  const response = await fetch(`${origin}${path}`, { method: "POST", headers, body });
  if (response.ok) {
    const data = typeof response.json === "function" ? await response.json().catch(() => null) : null;
    return readHubDeliveryResult(data);
  }

  // Compatibility: lead-like website commands can still hit the live webhook.
  const legacyUrl = (process.env.TECHSALES_SYNC_URL || "").trim();
  const isLeadLike = envelope.eventType === "lead.created" || envelope.eventType === "assessment.submitted" || envelope.eventType === "consultation.booked" || envelope.eventType === "referral.submitted";
  if (legacyUrl && isLeadLike && (response.status === 404 || response.status === 405)) {
    const payload = envelope.payload || {};
    const legacyBody = JSON.stringify({
      id: envelope.entityId,
      name: payload.name || "",
      email: payload.email || "",
      company: payload.company || "",
      phone: payload.phone || "",
      message: payload.message || "",
      source: payload.source || envelope.eventType,
    });
    const legacy = await fetch(legacyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "x-de-sync-token": secret,
      },
      body: legacyBody,
    });
    if (legacy.ok) return { canonicalAccountId: null, duplicate: false };
    const text = await legacy.text().catch(() => "");
    throw new Error(`Hub legacy lead webhook ${legacy.status}: ${text.slice(0, 200)}`);
  }

  const text = await response.text().catch(() => "");
  throw new Error(`Hub ${path} ${response.status}: ${text.slice(0, 200)}`);
}

export async function fetchPublicCatalog(): Promise<Record<string, unknown> | null> {
  const origin = hubOrigin();
  const secret = websiteToken();
  if (!origin || !secret) return null;
  const path = "/api/integrations/v1/public-catalog";
  const headers = buildSignedHeaders({
    method: "GET",
    path,
    eventId: "00000000-0000-4000-8000-000000000000",
    source: "website",
    body: "{}",
    secret,
  });
  try {
    const res = await fetch(`${origin}${path}`, { method: "GET", headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (error) {
    logger.warn("public catalog fetch failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** Staff-safe Hub catalog (tiers + SKUs with internal cost). Never for Door 2. */
export async function fetchStaffCatalog(): Promise<Record<string, unknown> | null> {
  const origin = hubOrigin();
  const secret = websiteToken();
  if (!origin || !secret) return null;
  const path = "/api/integrations/v1/staff-catalog";
  const headers = buildSignedHeaders({
    method: "GET",
    path,
    eventId: "00000000-0000-4000-8000-000000000001",
    source: "website",
    body: "{}",
    secret,
  });
  try {
    const res = await fetch(`${origin}${path}`, { method: "GET", headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (error) {
    logger.warn("staff catalog fetch failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export type HubConnectorHealth = {
  connector: string;
  status: "CONNECTED" | "AUTH_REQUIRED" | "FAILED" | "UNKNOWN" | "STALE";
  message?: string;
  checkedAt?: string;
};

/** Pax8 connector health from Hub. AUTH_REQUIRED until DE supplies credentials. */
export async function fetchPax8ConnectorHealth(): Promise<HubConnectorHealth | null> {
  const origin = hubOrigin();
  const secret = websiteToken();
  if (!origin || !secret) return null;
  const path = "/api/integrations/v1/connectors/pax8/health";
  const headers = buildSignedHeaders({
    method: "GET",
    path,
    eventId: "00000000-0000-4000-8000-000000000002",
    source: "website",
    body: "{}",
    secret,
  });
  try {
    const res = await fetch(`${origin}${path}`, { method: "GET", headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as HubConnectorHealth;
  } catch (error) {
    logger.warn("pax8 health fetch failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function pingHub(): Promise<{ ok: boolean; latencyMs: number; status?: number }> {
  const origin = hubOrigin();
  if (!origin) return { ok: false, latencyMs: 0 };
  const started = Date.now();
  try {
    const res = await fetch(`${origin}/api/healthz`, { method: "GET" });
    return { ok: res.ok, latencyMs: Date.now() - started, status: res.status };
  } catch {
    try {
      const res = await fetch(`${origin}/healthz`, { method: "GET" });
      return { ok: res.ok, latencyMs: Date.now() - started, status: res.status };
    } catch {
      return { ok: false, latencyMs: Date.now() - started };
    }
  }
}

export { signedGet };
