/**
 * Website/portal client for the Hub auto-renew subscription API
 * (de.hub.website-subscriptions/v1). Used only when AUTORENEW_CONTRACT_ENABLED
 * is on. Create is signed website_to_hub; list and cancel are signed
 * portal_to_hub. POST calls also send an Idempotency-Key header.
 *
 * Never throws. Every outcome is a result the caller can act on.
 */
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { logger } from "../logger";
import { buildSignedHeaders, newEventId, outboundSecret } from "./deSyncAuth";
import { hubApiBase } from "./techSalesClient";
import {
  HUB_PORTAL_SUBSCRIPTIONS_PATH,
  HUB_WEBSITE_SUBSCRIPTIONS_PATH,
  hubCancelSubscriptionBodySchema,
  hubCancelSubscriptionResponseSchema,
  hubCreateSubscriptionBodySchema,
  hubCreateSubscriptionResponseSchema,
  hubListSubscriptionsResponseSchema,
  hubPortalSubscriptionCancelPath,
  type HubCancelSubscriptionBody,
  type HubCancelSubscriptionResponse,
  type HubCreateSubscriptionBody,
  type HubCreateSubscriptionResponse,
  type HubListSubscriptionsResponse,
} from "./hubSubscriptionsContract";

export type HubSubscriptionFailure = {
  ok: false;
  reason: "not_configured" | "unreachable" | "refused" | "invalid";
  status?: number;
  code?: string;
  error?: string;
};
export type HubSubscriptionResult<T> = { ok: true; status: number; data: T } | HubSubscriptionFailure;

export interface HubSubscriptionsClientDeps {
  fetch: typeof fetch;
  base: () => string | null;
  websiteSecret: () => string;
  portalSecret: () => string;
  timeoutMs: number;
  newIdempotencyKey: () => string;
}

export const defaultHubSubscriptionsClientDeps: HubSubscriptionsClientDeps = {
  fetch: (...args) => fetch(...args),
  base: hubApiBase,
  websiteSecret: () => outboundSecret("website_to_hub", HUB_WEBSITE_SUBSCRIPTIONS_PATH),
  portalSecret: () => outboundSecret("portal_to_hub", HUB_PORTAL_SUBSCRIPTIONS_PATH),
  timeoutMs: Number(process.env.HUB_SUBSCRIPTIONS_TIMEOUT_MS || process.env.HUB_TICKETS_TIMEOUT_MS || 8000),
  newIdempotencyKey: () => randomUUID(),
};

async function call<S extends z.ZodTypeAny>(
  deps: HubSubscriptionsClientDeps,
  input: {
    method: "GET" | "POST";
    pathWithQuery: string;
    body: unknown;
    secret: string;
    schema: S;
    idempotencyKey?: string;
    source: "website" | "portal";
  },
): Promise<HubSubscriptionResult<z.infer<S>>> {
  const base = deps.base();
  const secret = input.secret;
  if (!base || !secret) return { ok: false, reason: "not_configured" };
  const url = `${base.replace(/\/api$/, "")}${input.pathWithQuery}`;
  const parsedUrl = new URL(url);
  const payload = input.method === "GET" ? "{}" : JSON.stringify(input.body);
  const headers: Record<string, string> = {
    ...buildSignedHeaders({
      method: input.method,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      eventId: newEventId(),
      source: input.source,
      body: payload,
      secret,
    }),
    Accept: "application/json",
  };
  if (input.method === "POST") {
    headers["Idempotency-Key"] = input.idempotencyKey || deps.newIdempotencyKey();
  }
  let res: Response;
  try {
    res = await deps.fetch(url, {
      method: input.method,
      headers,
      ...(input.method === "POST" ? { body: payload } : {}),
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
  } catch (err: any) {
    logger.warn("Hub subscriptions: unreachable", {
      method: input.method,
      path: parsedUrl.pathname,
      error: err?.name || "error",
    });
    return { ok: false, reason: "unreachable" };
  }
  const json = await res.json().catch(() => null);
  if (res.status >= 500) {
    return { ok: false, reason: "unreachable", status: res.status, error: (json as any)?.error };
  }
  if (res.status >= 400) {
    return {
      ok: false,
      reason: "refused",
      status: res.status,
      code: typeof (json as any)?.code === "string" ? (json as any).code : undefined,
      error: typeof (json as any)?.error === "string" ? (json as any).error : undefined,
    };
  }
  const parsed = input.schema.safeParse(json);
  if (!parsed.success) {
    logger.warn("Hub subscriptions: invalid response", {
      method: input.method,
      path: parsedUrl.pathname,
      status: res.status,
    });
    return { ok: false, reason: "invalid", status: res.status };
  }
  return { ok: true, status: res.status, data: parsed.data };
}

export interface HubSubscriptionsClient {
  create: (
    body: HubCreateSubscriptionBody,
    idempotencyKey?: string,
  ) => Promise<HubSubscriptionResult<HubCreateSubscriptionResponse>>;
  list: (accountId: string) => Promise<HubSubscriptionResult<HubListSubscriptionsResponse>>;
  cancel: (
    subscriptionId: string,
    body: HubCancelSubscriptionBody,
    idempotencyKey?: string,
  ) => Promise<HubSubscriptionResult<HubCancelSubscriptionResponse>>;
}

export function createHubSubscriptionsClient(
  deps: HubSubscriptionsClientDeps = defaultHubSubscriptionsClientDeps,
): HubSubscriptionsClient {
  return {
    async create(body, idempotencyKey) {
      const parsed = hubCreateSubscriptionBodySchema.safeParse(body);
      if (!parsed.success) {
        return { ok: false, reason: "invalid", status: 400, error: "Invalid subscription create payload" };
      }
      return call(deps, {
        method: "POST",
        pathWithQuery: HUB_WEBSITE_SUBSCRIPTIONS_PATH,
        body: parsed.data,
        secret: deps.websiteSecret(),
        schema: hubCreateSubscriptionResponseSchema,
        idempotencyKey,
        source: "website",
      });
    },
    async list(accountId) {
      const id = String(accountId || "").trim();
      if (!id) return { ok: false, reason: "invalid", status: 400, error: "accountId is required" };
      const path = `${HUB_PORTAL_SUBSCRIPTIONS_PATH}?accountId=${encodeURIComponent(id)}`;
      return call(deps, {
        method: "GET",
        pathWithQuery: path,
        body: null,
        secret: deps.portalSecret(),
        schema: hubListSubscriptionsResponseSchema,
        source: "portal",
      });
    },
    async cancel(subscriptionId, body, idempotencyKey) {
      const id = String(subscriptionId || "").trim();
      if (!id) return { ok: false, reason: "invalid", status: 400, error: "subscriptionId is required" };
      const parsed = hubCancelSubscriptionBodySchema.safeParse(body);
      if (!parsed.success) {
        return { ok: false, reason: "invalid", status: 400, error: "Invalid subscription cancel payload" };
      }
      return call(deps, {
        method: "POST",
        pathWithQuery: hubPortalSubscriptionCancelPath(id),
        body: parsed.data,
        secret: deps.portalSecret(),
        schema: hubCancelSubscriptionResponseSchema,
        idempotencyKey,
        source: "portal",
      });
    },
  };
}

export const hubSubscriptionsClient = createHubSubscriptionsClient();
