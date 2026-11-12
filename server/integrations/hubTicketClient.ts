/**
 * The website's client for the Hub's portal ticket API (de.hub.portal-tickets/v1,
 * contract in ./hubTicketsContract.ts). Used only when TICKETS_SOURCE=hub
 * (server/ticketsSource.ts).
 *
 * Signed portal_to_hub with the SCOPED secret only (PORTAL_TO_HUB_SECRET).
 * The Hub refuses the legacy shared secret on these routes, so there is no
 * fallback to it here: with no scoped secret the call is "not_configured"
 * and the caller stays on its Desk path. The signature covers path, query and
 * the exact JSON body sent.
 *
 * Never throws. Every outcome is a result the caller can act on:
 *   ok              the Hub answered inside the contract
 *   not_configured  no Hub URL or no scoped secret
 *   unreachable     network error, timeout, or a 5xx
 *   refused         a 4xx (status + code kept, e.g. 409 client_mapping_required)
 *   invalid         a 2xx that does not match the contract
 */
import { logger } from "../logger";
import { buildSignedHeaders, newEventId } from "./deSyncAuth";
import { hubApiBase } from "./techSalesClient";
import {
  HUB_TICKETS_PATH,
  hubTicketCreateResponseSchema,
  hubTicketGetResponseSchema,
  hubTicketListResponseSchema,
  hubTicketReplyResponseSchema,
  type HubTicketCreateBody,
  type HubTicketReplyBody,
} from "./hubTicketsContract";
import {
  hubSecureFieldCreateResponseSchema,
  hubSecureFieldListResponseSchema,
  hubSecureFieldsPath,
  type HubSecureFieldCreateBody,
} from "./hubSecureFieldsContract";
import type { z } from "zod";

export type HubTicketFailure = {
  ok: false;
  reason: "not_configured" | "unreachable" | "refused" | "invalid";
  status?: number;
  code?: string;
};
export type HubTicketResult<T> = { ok: true; status: number; data: T } | HubTicketFailure;

export interface HubTicketClientDeps {
  fetch: typeof fetch;
  /** The Hub API base ending in /api (techSalesClient.hubApiBase), or null. */
  base: () => string | null;
  secret: () => string;
  timeoutMs: number;
}

export const defaultHubTicketClientDeps: HubTicketClientDeps = {
  fetch: (...args) => fetch(...args),
  base: hubApiBase,
  secret: () => (process.env.PORTAL_TO_HUB_SECRET || "").trim(),
  timeoutMs: Number(process.env.HUB_TICKETS_TIMEOUT_MS || 8000),
};

export interface HubTenant {
  /** The canonical Hub accounts.id (portal_clients.hub_account_id). */
  accountId: string | null;
  portalClientId?: string | null;
}

function query(tenant: HubTenant | null): string {
  const params = new URLSearchParams();
  if (tenant?.accountId) params.set("accountId", tenant.accountId);
  if (tenant?.accountId && tenant.portalClientId) params.set("portalClientId", tenant.portalClientId);
  const q = params.toString();
  return q ? `?${q}` : "";
}

async function call<S extends z.ZodTypeAny>(
  deps: HubTicketClientDeps,
  method: "GET" | "POST",
  pathWithQuery: string,
  body: unknown,
  schema: S,
): Promise<HubTicketResult<z.infer<S>>> {
  const base = deps.base();
  const secret = deps.secret();
  if (!base || !secret) return { ok: false, reason: "not_configured" };
  const url = `${base.replace(/\/api$/, "")}${pathWithQuery}`;
  const parsedUrl = new URL(url);
  const payload = method === "GET" ? "{}" : JSON.stringify(body);
  const headers = buildSignedHeaders({
    method,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    eventId: newEventId(),
    source: "portal",
    body: payload,
    secret,
  });
  let res: Response;
  try {
    res = await deps.fetch(url, {
      method,
      headers: { ...headers, Accept: "application/json" },
      ...(method === "POST" ? { body: payload } : {}),
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
  } catch (err: any) {
    logger.warn("Hub tickets: unreachable", { method, path: parsedUrl.pathname, error: err?.name || "error" });
    return { ok: false, reason: "unreachable" };
  }
  const json = await res.json().catch(() => null);
  if (res.status >= 500) {
    logger.warn("Hub tickets: server error", { method, path: parsedUrl.pathname, status: res.status });
    return { ok: false, reason: "unreachable", status: res.status };
  }
  if (!res.ok) {
    const code = typeof (json as { code?: unknown } | null)?.code === "string" ? (json as { code: string }).code : undefined;
    logger.warn("Hub tickets: refused", { method, path: parsedUrl.pathname, status: res.status, code });
    return { ok: false, reason: "refused", status: res.status, ...(code ? { code } : {}) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.warn("Hub tickets: answer did not match the contract", { method, path: parsedUrl.pathname, status: res.status });
    return { ok: false, reason: "invalid", status: res.status };
  }
  return { ok: true, status: res.status, data: parsed.data };
}

export function createHubTicketClient(deps: HubTicketClientDeps = defaultHubTicketClientDeps) {
  return {
    /** Create (idempotent on body.idempotencyKey). A null accountId is allowed only for the website widget. */
    create(tenant: HubTenant | null, body: HubTicketCreateBody) {
      return call(deps, "POST", `${HUB_TICKETS_PATH}${query(tenant)}`, body, hubTicketCreateResponseSchema);
    },
    list(tenant: HubTenant & { accountId: string }) {
      return call(deps, "GET", `${HUB_TICKETS_PATH}${query(tenant)}`, null, hubTicketListResponseSchema);
    },
    get(tenant: HubTenant & { accountId: string }, ticketId: number) {
      return call(deps, "GET", `${HUB_TICKETS_PATH}/${ticketId}${query(tenant)}`, null, hubTicketGetResponseSchema);
    },
    reply(tenant: HubTenant & { accountId: string }, ticketId: number, body: HubTicketReplyBody) {
      return call(deps, "POST", `${HUB_TICKETS_PATH}/${ticketId}/replies${query(tenant)}`, body, hubTicketReplyResponseSchema);
    },
    /** DE Desk secure fields (#1179): metadata only; the Hub never returns a value here. */
    listSecureFields(tenant: HubTenant & { accountId: string }, ticketId: number) {
      return call(deps, "GET", `${hubSecureFieldsPath(ticketId)}${query(tenant)}`, null, hubSecureFieldListResponseSchema);
    },
    /**
     * Hand a value to the Hub (encrypted there). Only the website widget may
     * send a null tenant, for the unlinked ticket it just created. The body is
     * signed and sent once; it is never logged (call() logs method, path and
     * status only).
     */
    createSecureField(tenant: HubTenant | null, ticketId: number, body: HubSecureFieldCreateBody) {
      return call(deps, "POST", `${hubSecureFieldsPath(ticketId)}${query(tenant)}`, body, hubSecureFieldCreateResponseSchema);
    },
  };
}

export type HubTicketClient = ReturnType<typeof createHubTicketClient>;
