/**
 * Typed Zoho OAuth failures so ticket/create paths can fail closed with a
 * distinct status instead of a generic "couldn't open the ticket" 502.
 *
 * Since the token manager (server/zoho/oauth) a ZohoOAuthError always means
 * Zoho refused the credential or there is none: it maps to needs_reconnect /
 * not_configured. Throttling and outages are ZohoAuthUnavailableError
 * (degraded), never this class (issue #418).
 */

export type ZohoOAuthErrorCode =
  | "invalid_refresh_token"
  | "invalid_client"
  | "token_response_incomplete"
  | "refresh_failed"
  /** No credential at all for this product (server/zoho/oauth). */
  | "not_configured";

export class ZohoOAuthError extends Error {
  readonly code: ZohoOAuthErrorCode;
  readonly product: "desk" | "crm";
  readonly zohoError?: string;

  constructor(opts: {
    message: string;
    code: ZohoOAuthErrorCode;
    product: "desk" | "crm";
    zohoError?: string;
  }) {
    super(opts.message);
    this.name = "ZohoOAuthError";
    this.code = opts.code;
    this.product = opts.product;
    this.zohoError = opts.zohoError;
  }
}

export function isZohoOAuthError(err: unknown): err is ZohoOAuthError {
  return err instanceof ZohoOAuthError;
}

/** Classify Zoho accounts.oauth token JSON without logging secrets. */
export function classifyZohoTokenFailure(payload: unknown): ZohoOAuthErrorCode {
  const error =
    payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error?: unknown }).error || "")
      : "";

  if (error === "invalid_code" || error === "invalid_grant") {
    return "invalid_refresh_token";
  }
  if (error === "invalid_client") {
    return "invalid_client";
  }
  if (!error && payload && typeof payload === "object" && !("access_token" in payload)) {
    return "token_response_incomplete";
  }
  return "refresh_failed";
}
