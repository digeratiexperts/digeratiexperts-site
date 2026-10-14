/**
 * Zoho accounts token endpoint (`/oauth/v2/token`) with a strict error taxonomy.
 * Ported from Intelligence Hub lib/zoho-oauth/token-endpoint.ts.
 *
 * Zoho often answers errors with HTTP 200 and an `error` field, and answers
 * throttling with `{"error":"Access Denied","error_description":"You have made
 * too many requests continuously..."}`. Treating every non-success as "token
 * dead" is what made the Hub ask for new grant codes on network blips, so every
 * failure is classified:
 *
 *   revoked      — the refresh token / code is invalid (invalid_code, ...).
 *                  Only a new grant fixes it.
 *   client       — the OAuth client is wrong (invalid_client, ...). Only an env
 *                  fix (client id/secret) fixes it.
 *   rate_limited — Zoho throttled us. Wait; the token is fine.
 *   transient    — network error, timeout, 5xx, unparseable body, or an
 *                  unrecognised error code. Retry with backoff; the token is
 *                  presumed fine.
 */

export type ZohoTokenErrorKind = "revoked" | "client" | "rate_limited" | "transient";

export class ZohoTokenError extends Error {
  constructor(
    readonly kind: ZohoTokenErrorKind,
    readonly code: string,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "ZohoTokenError";
  }
}

export interface ZohoTokenResponse {
  accessToken: string;
  expiresInSec: number;
  refreshToken?: string;
  apiDomain?: string;
  scope?: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const REVOKED_CODES = new Set(["invalid_code", "invalid_grant", "invalid_token"]);
const CLIENT_CODES = new Set([
  "invalid_client",
  "invalid_client_secret",
  "unauthorized_client",
  "invalid_redirect_uri",
  "redirect_uri_mismatch",
]);

export function classifyTokenError(
  httpStatus: number,
  body: Record<string, unknown>,
): { kind: ZohoTokenErrorKind; code: string; description: string } {
  const code = typeof body.error === "string" ? body.error : `HTTP ${httpStatus}`;
  const description =
    typeof body.error_description === "string" ? body.error_description : "";
  const lc = code.toLowerCase();
  if (REVOKED_CODES.has(lc)) return { kind: "revoked", code, description };
  if (CLIENT_CODES.has(lc)) return { kind: "client", code, description };
  if (
    httpStatus === 429 ||
    lc === "access denied" ||
    /too many requests/i.test(description) ||
    /too many requests/i.test(code)
  ) {
    return { kind: "rate_limited", code, description };
  }
  return { kind: "transient", code, description };
}

const TOKEN_TIMEOUT_MS = 15_000;

/**
 * POST to `${accountsServer}/oauth/v2/token`. Resolves with the token on
 * success; throws ZohoTokenError (never a bare Error) on any failure.
 * The params (refresh token, client secret, code) are never logged or echoed.
 */
export async function callZohoTokenEndpoint(
  accountsServer: string,
  params: Record<string, string>,
  fetchImpl: FetchLike = fetch,
): Promise<ZohoTokenResponse> {
  let resp: Response;
  try {
    resp = await fetchImpl(`${accountsServer.replace(/\/$/, "")}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ZohoTokenError("transient", "network", `Zoho token endpoint unreachable: ${msg}`);
  }
  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) {
    throw new ZohoTokenError(
      "transient",
      `HTTP ${resp.status}`,
      `Zoho token endpoint returned a non-JSON response (HTTP ${resp.status}).`,
      resp.status,
    );
  }
  // A blank token is no token (local addition to the Hub port).
  const accessToken = typeof json.access_token === "string" ? json.access_token.trim() : "";
  if (resp.ok && accessToken && !json.error) {
    return {
      accessToken,
      expiresInSec: typeof json.expires_in === "number" ? json.expires_in : 3600,
      refreshToken:
        typeof json.refresh_token === "string" && json.refresh_token.trim()
          ? json.refresh_token.trim()
          : undefined,
      apiDomain: typeof json.api_domain === "string" ? json.api_domain : undefined,
      scope: typeof json.scope === "string" ? json.scope : undefined,
    };
  }
  const c = classifyTokenError(resp.status, json);
  throw new ZohoTokenError(
    c.kind,
    c.code,
    `Zoho token endpoint: ${c.code}${c.description ? ` — ${c.description}` : ""}`,
    resp.status,
  );
}

/**
 * Revoke a refresh token (frees one of Zoho's 20 refresh-token slots per
 * client+user). Best effort: failures are swallowed — the old token simply
 * ages out of the slot window.
 */
export async function revokeZohoRefreshToken(
  accountsServer: string,
  refreshToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  try {
    const resp = await fetchImpl(
      `${accountsServer.replace(/\/$/, "")}/oauth/v2/token/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      },
    );
    return resp.ok;
  } catch {
    return false;
  }
}
