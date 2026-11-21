/**
 * Website client for the Hub store tax and event APIs.
 * Signs website_to_hub with the existing scoped secret. Never throws.
 */
import { randomUUID } from "node:crypto";
import {
  DE_STORE_CONTRACT_VERSION,
  type StateNotServedResponse,
  type TaxQuoteRequest,
  type TaxQuoteResponse,
} from "@shared/deStoreContract";
import { logger } from "../logger";
import { buildSignedHeaders, newEventId, outboundSecret } from "./deSyncAuth";
import { hubApiBase } from "./techSalesClient";

export const HUB_STORE_TAX_QUOTE_PATH = "/api/store/tax/quote";
export const HUB_STORE_TAX_COMMIT_PATH = "/api/store/tax/commit";
export const HUB_STORE_TAX_VOID_PATH = "/api/store/tax/void";
export const HUB_STORE_EVENTS_PATH = "/api/store/events";

export type HubStoreFailure = {
  ok: false;
  reason: "not_configured" | "unreachable" | "refused" | "invalid" | "state_not_served" | "tax_unavailable";
  status?: number;
  code?: string;
  error?: string;
  stateNotServed?: StateNotServedResponse;
};

export type HubStoreResult<T> = { ok: true; status: number; data: T; duplicate?: boolean } | HubStoreFailure;

export interface HubTaxCommitResponse {
  calculationId: string;
  committedAt: string;
  currency: "USD";
  taxCents: number;
  feeCents: number;
  totalCents: number;
}

export interface HubTaxVoidResponse {
  calculationId: string;
  voidedAt: string;
}

export interface HubStoreClient {
  quoteTax: (request: TaxQuoteRequest, idempotencyKey?: string) => Promise<HubStoreResult<TaxQuoteResponse>>;
  commitTax: (
    request: { contractVersion: "1"; calculationId: string; paymentRef: string; siteOrderId: string },
    idempotencyKey?: string,
  ) => Promise<HubStoreResult<HubTaxCommitResponse>>;
  voidTax: (
    request: {
      contractVersion: "1";
      calculationId: string;
      reason: "payment_failed" | "payment_reversed" | "order_cancelled" | "expired_quote";
    },
    idempotencyKey?: string,
  ) => Promise<HubStoreResult<HubTaxVoidResponse>>;
  submitEvent: (envelope: unknown, idempotencyKey?: string) => Promise<HubStoreResult<{ eventId?: string }>>;
}

export interface HubStoreClientDeps {
  fetch: typeof fetch;
  base: () => string | null;
  websiteSecret: () => string;
  timeoutMs: number;
  newIdempotencyKey: () => string;
}

export const defaultHubStoreClientDeps: HubStoreClientDeps = {
  fetch: (...args) => fetch(...args),
  base: hubApiBase,
  websiteSecret: () => outboundSecret("website_to_hub", HUB_STORE_TAX_QUOTE_PATH),
  timeoutMs: Number(process.env.HUB_STORE_TIMEOUT_MS || process.env.HUB_TICKETS_TIMEOUT_MS || 8000),
  newIdempotencyKey: () => randomUUID(),
};

function asErrorCode(json: unknown): { code?: string; error?: string } {
  if (!json || typeof json !== "object") return {};
  const record = json as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
  };
}

function isStateNotServed(status: number, json: unknown): StateNotServedResponse | null {
  if (status !== 409 || !json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  if (record.code !== "state_not_served" || typeof record.error !== "string") return null;
  return record as unknown as StateNotServedResponse;
}

async function call<T>(
  deps: HubStoreClientDeps,
  input: { method: "GET" | "POST"; path: string; body: unknown; idempotencyKey?: string },
): Promise<HubStoreResult<T>> {
  const base = deps.base();
  const secret = deps.websiteSecret();
  if (!base || !secret) return { ok: false, reason: "not_configured" };

  const url = `${base.replace(/\/api$/, "")}${input.path}`;
  const parsedUrl = new URL(url);
  const payload = input.method === "GET" ? "{}" : JSON.stringify(input.body ?? {});
  const headers: Record<string, string> = {
    ...buildSignedHeaders({
      method: input.method,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      eventId: newEventId(),
      source: "website",
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
    logger.warn("Hub store: unreachable", {
      method: input.method,
      path: parsedUrl.pathname,
      error: err?.name || "error",
    });
    return { ok: false, reason: "unreachable" };
  }

  const json = await res.json().catch(() => null);
  const { code, error } = asErrorCode(json);
  if (res.status === 409) {
    const stateNotServed = isStateNotServed(res.status, json);
    if (stateNotServed) {
      return { ok: false, reason: "state_not_served", status: 409, code: "state_not_served", error: stateNotServed.error, stateNotServed };
    }
  }
  if (res.status >= 500) {
    const taxUnavailable =
      code === "tax_engine_disabled" || code === "tax_engine_unselected" || code === "tax_unavailable";
    return {
      ok: false,
      reason: taxUnavailable ? "tax_unavailable" : "unreachable",
      status: res.status,
      code,
      error,
    };
  }
  if (res.status >= 400) {
    const taxUnavailable =
      code === "tax_engine_disabled" || code === "tax_engine_unselected" || code === "tax_unavailable";
    return {
      ok: false,
      reason: taxUnavailable ? "tax_unavailable" : "refused",
      status: res.status,
      code,
      error,
    };
  }
  if (!json || typeof json !== "object") {
    return { ok: false, reason: "invalid", status: res.status };
  }
  return {
    ok: true,
    status: res.status,
    data: json as T,
    duplicate: (json as { duplicate?: boolean }).duplicate === true,
  };
}

export function createHubStoreClient(deps: HubStoreClientDeps = defaultHubStoreClientDeps): HubStoreClient {
  return {
    quoteTax: (request, idempotencyKey) =>
      call<TaxQuoteResponse>(deps, {
        method: "POST",
        path: HUB_STORE_TAX_QUOTE_PATH,
        body: { ...request, contractVersion: DE_STORE_CONTRACT_VERSION },
        idempotencyKey,
      }),
    commitTax: (request, idempotencyKey) =>
      call<HubTaxCommitResponse>(deps, {
        method: "POST",
        path: HUB_STORE_TAX_COMMIT_PATH,
        body: request,
        idempotencyKey,
      }),
    voidTax: (request, idempotencyKey) =>
      call<HubTaxVoidResponse>(deps, {
        method: "POST",
        path: HUB_STORE_TAX_VOID_PATH,
        body: request,
        idempotencyKey,
      }),
    submitEvent: (envelope, idempotencyKey) =>
      call(deps, {
        method: "POST",
        path: HUB_STORE_EVENTS_PATH,
        body: envelope,
        idempotencyKey,
      }),
  };
}

export const hubStoreClient = createHubStoreClient();
