/**
 * Zoho Agents readiness — existing CRM/Desk/webhook surface only.
 * Does not invent Zoho Agent Studio / Zia Agent APIs or a new Zoho product.
 *
 * A Zoho Deluge/Flow agent can use these tenant ids + scopes to act on the
 * same org the Client Portal and Intelligence-Hub already know.
 */

import { compactTenantIds, normalizeTenantId, type TenantIds } from "./tenantIdentity";

export const ZOHO_AGENT_EVENT_NAMES = [
  "agent.response",
  "desk.ticket",
  "deal.stage_changed",
  "contact.onboarded",
  "order.paid",
] as const;

export type ZohoAgentEventName = (typeof ZOHO_AGENT_EVENT_NAMES)[number];

/**
 * Scopes already implied by existing DE OAuth clients. Do not rotate tokens.
 * Website CRM uses ZOHO_CLIENT_ID_API + ZOHO_REFRESH_TOKEN; website Desk uses
 * ZOHO_DESK_CLIENT_ID/_SECRET + ZOHO_DESK_REFRESH_TOKEN, or the CRM client when
 * no Desk client is set (server/zoho/zohoClient.ts resolveDeskOAuthConfig).
 * Hub CRM/Desk use integration_tokens / ZOHO_CRM_* / ZOHO_DESK_*.
 */
export const ZOHO_EXISTING_SCOPES = {
  desk: [
    "Desk.tickets.READ",
    "Desk.tickets.CREATE",
    "Desk.tickets.UPDATE",
    "Desk.contacts.READ",
    "Desk.contacts.WRITE",
    "Desk.settings.READ",
  ],
  crm: [
    "ZohoCRM.modules.READ",
    "ZohoCRM.modules.CREATE",
    "ZohoCRM.modules.UPDATE",
    "ZohoCRM.users.READ",
  ],
  books: ["ZohoSubscriptions.fullaccess.all", "ZohoBooks.fullaccess.all"],
  payments: ["ZohoPay.fullaccess.READ", "ZohoPay.fullaccess.CREATE"],
  workdrive: ["WorkDrive.files.READ", "WorkDrive.files.CREATE"],
  sign: ["ZohoSign.documents.READ", "ZohoSign.documents.CREATE"],
  oidcPortal: ["openid", "email", "profile"],
} as const;

export const ZOHO_AGENT_WEBHOOKS = {
  hubEvents: "POST https://techsales.digerati-experts.com/api/webhooks/zoho/events",
  hubDealStage: "POST https://techsales.digerati-experts.com/api/webhooks/zoho/deal-stage",
  secretEnv: "ZOHO_HUB_WEBHOOK_SECRET",
} as const;

export type ZohoAgentPayload = {
  event?: unknown;
  correlationId?: unknown;
  sourceAgent?: unknown;
  message?: unknown;
  portalClientId?: unknown;
  hubAccountId?: unknown;
  canonicalAccountId?: unknown;
  zohoAccountId?: unknown;
  zohoContactId?: unknown;
  zohoDealId?: unknown;
  zohoTicketId?: unknown;
  zohoBooksCustomerId?: unknown;
};

export type AgentPayloadGate =
  | { ok: true; event: string; tenant: TenantIds; correlationId: string | null }
  | { ok: false; status: 400; error: string; code: string };

export function tenantIdsFromAgentPayload(payload: ZohoAgentPayload): TenantIds {
  return compactTenantIds({
    portalClientId: normalizeTenantId(payload.portalClientId),
    hubAccountId: normalizeTenantId(payload.hubAccountId) || normalizeTenantId(payload.canonicalAccountId),
    zohoAccountId: normalizeTenantId(payload.zohoAccountId),
    zohoContactId: normalizeTenantId(payload.zohoContactId),
    zohoBooksCustomerId: normalizeTenantId(payload.zohoBooksCustomerId),
  });
}

export function validateZohoAgentPayload(payload: ZohoAgentPayload): AgentPayloadGate {
  const event = typeof payload.event === "string" ? payload.event.trim() : "";
  if (!event) {
    return { ok: false, status: 400, code: "missing_event", error: "event is required" };
  }

  const tenant = tenantIdsFromAgentPayload(payload);
  const dealId = normalizeTenantId(payload.zohoDealId);
  const ticketId = normalizeTenantId(payload.zohoTicketId);
  const hasTenant =
    Boolean(tenant.portalClientId) ||
    Boolean(tenant.hubAccountId) ||
    Boolean(tenant.zohoAccountId) ||
    Boolean(tenant.zohoContactId) ||
    Boolean(tenant.zohoBooksCustomerId) ||
    Boolean(dealId) ||
    Boolean(ticketId);

  if (!hasTenant) {
    return {
      ok: false,
      status: 400,
      code: "missing_tenant",
      error:
        "Zoho agent events must include at least one tenant id (portalClientId, hubAccountId/canonicalAccountId, zohoAccountId, zohoContactId, zohoDealId, zohoTicketId, or zohoBooksCustomerId)",
    };
  }

  return {
    ok: true,
    event,
    tenant,
    correlationId: typeof payload.correlationId === "string" ? payload.correlationId : null,
  };
}
