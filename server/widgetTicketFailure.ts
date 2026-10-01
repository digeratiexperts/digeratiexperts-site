import { isZohoOAuthError } from "./zoho/zohoOAuthErrors";

export type WidgetTicketFailureBody = {
  success: false;
  error: string;
  code: "desk_not_configured" | "desk_auth_unavailable" | "desk_create_failed";
};

/**
 * Map Desk create failures to a clear, non-success JSON body.
 * Auth/config failures are 503 (retry after ops fix); other Desk errors stay 502.
 */
export function mapWidgetTicketCreateFailure(err: unknown): {
  status: number;
  body: WidgetTicketFailureBody;
} {
  if (isZohoOAuthError(err) && err.product === "desk") {
    return {
      status: 503,
      body: {
        success: false,
        code: "desk_auth_unavailable",
        error:
          "Support desk authentication is unavailable right now. Your message was not submitted — please try again shortly, or email support@digeratiexperts.com.",
      },
    };
  }

  const message = err instanceof Error ? err.message : String(err || "");
  if (/refresh Zoho Desk access token|No access token in Zoho Desk/i.test(message)) {
    return {
      status: 503,
      body: {
        success: false,
        code: "desk_auth_unavailable",
        error:
          "Support desk authentication is unavailable right now. Your message was not submitted — please try again shortly, or email support@digeratiexperts.com.",
      },
    };
  }

  return {
    status: 502,
    body: {
      success: false,
      code: "desk_create_failed",
      error: "We couldn't open the ticket right now. Please try again.",
    },
  };
}

export function widgetTicketNotConfigured(): {
  status: number;
  body: WidgetTicketFailureBody;
} {
  return {
    status: 503,
    body: {
      success: false,
      code: "desk_not_configured",
      error: "Support desk is temporarily unavailable. Please try again.",
    },
  };
}
