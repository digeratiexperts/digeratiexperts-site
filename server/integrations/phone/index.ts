import { loadCytracomPhoneData } from "./cytracom";
import type { PhoneLoadResult } from "./types";

/**
 * Phone adapters behind GET /api/portal/phone. Today the only provider is
 * "cytracom" (PORTAL_PHONE_PROVIDER=cytracom); see README.md.
 *
 * Per-company scope: Cytracom API tokens are created by an admin of ONE
 * customer account and only read that account, so each portal company maps to
 * the name of its own token:
 *
 *   PORTAL_PHONE_CLIENT_MAP='{"<portal clientId>":"ACME"}'
 *   PORTAL_PHONE_CYTRACOM_TOKEN_ACME=<token from that company's Cytracom admin>
 *
 * The map holds a token key, never a token. The key is restricted to
 * [A-Z0-9_] and always read under the fixed prefix, so a map entry cannot point
 * at an unrelated environment variable.
 */

export const PHONE_CLIENT_MAP_ENV = "PORTAL_PHONE_CLIENT_MAP";
export const CYTRACOM_TOKEN_ENV_PREFIX = "PORTAL_PHONE_CYTRACOM_TOKEN_";

type Env = Record<string, string | undefined>;

/** Thrown for configuration faults; the route logs the message and answers 502. */
export class PhoneConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoneConfigError";
  }
}

/** Parses PORTAL_PHONE_CLIENT_MAP. Invalid JSON is a config fault, not "unmapped". */
export function readPhoneClientMap(env: Env): Record<string, string> {
  const raw = (env[PHONE_CLIENT_MAP_ENV] || "").trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PhoneConfigError(`${PHONE_CLIENT_MAP_ENV} is not valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PhoneConfigError(`${PHONE_CLIENT_MAP_ENV} must be a JSON object of clientId -> token key`);
  }
  const out: Record<string, string> = {};
  for (const [clientId, scope] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof scope === "string" && scope.trim()) out[clientId] = scope.trim();
  }
  return out;
}

/** The company's mapped token key, or null when the company is not mapped. */
export function phoneScopeFor(clientId: string, env: Env): string | null {
  const map = readPhoneClientMap(env);
  return Object.prototype.hasOwnProperty.call(map, clientId) ? map[clientId] : null;
}

/** Resolves a token key to its token. Missing or malformed is a config fault. */
export function cytracomTokenFor(tokenKey: string, env: Env): string {
  const key = tokenKey.toUpperCase();
  if (!/^[A-Z0-9_]{1,64}$/.test(key)) {
    throw new PhoneConfigError(`token key for this company must match [A-Z0-9_]{1,64}`);
  }
  const token = (env[`${CYTRACOM_TOKEN_ENV_PREFIX}${key}`] || "").trim();
  if (!token) throw new PhoneConfigError(`${CYTRACOM_TOKEN_ENV_PREFIX}${key} is not set`);
  return token;
}

export async function loadPhoneData(opts: {
  provider: string;
  clientId: string;
  userEmail: string | null;
  env: Env;
  fetchImpl?: typeof fetch;
}): Promise<PhoneLoadResult> {
  const scope = phoneScopeFor(opts.clientId, opts.env);
  if (!scope) return { notMapped: true };
  if (opts.provider === "cytracom") {
    const token = cytracomTokenFor(scope, opts.env);
    return { data: await loadCytracomPhoneData(token, opts.userEmail, opts.fetchImpl) };
  }
  throw new PhoneConfigError(`no phone adapter for provider "${opts.provider}"`);
}
