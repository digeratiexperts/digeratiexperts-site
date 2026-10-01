import { describe, expect, it } from "vitest";
import {
  ZohoOAuthError,
  classifyZohoTokenFailure,
  isZohoOAuthError,
} from "./zoho/zohoOAuthErrors";
import {
  mapWidgetTicketCreateFailure,
  widgetTicketNotConfigured,
} from "./widgetTicketFailure";

describe("classifyZohoTokenFailure", () => {
  it("maps Zoho invalid_code to invalid_refresh_token (production Desk failure mode)", () => {
    expect(classifyZohoTokenFailure({ error: "invalid_code" })).toBe(
      "invalid_refresh_token",
    );
  });

  it("maps invalid_grant the same way", () => {
    expect(classifyZohoTokenFailure({ error: "invalid_grant" })).toBe(
      "invalid_refresh_token",
    );
  });

  it("maps invalid_client", () => {
    expect(classifyZohoTokenFailure({ error: "invalid_client" })).toBe(
      "invalid_client",
    );
  });
});

describe("mapWidgetTicketCreateFailure — production Desk OAuth failure", () => {
  it("never returns success when Zoho rejects the Desk refresh token with invalid_code", () => {
    const err = new ZohoOAuthError({
      message: "Failed to refresh Zoho Desk access token",
      code: "invalid_refresh_token",
      product: "desk",
      zohoError: "invalid_code",
    });

    const failure = mapWidgetTicketCreateFailure(err);

    expect(failure.status).toBe(503);
    expect(failure.body.success).toBe(false);
    expect(failure.body.code).toBe("desk_auth_unavailable");
    expect(failure.body.error.toLowerCase()).toContain("not submitted");
    expect(failure.body).not.toHaveProperty("zohoTicketId");
    expect(failure.body).not.toHaveProperty("ticketNumber");
  });

  it("classifies legacy refresh-failed Error messages as auth unavailable", () => {
    const failure = mapWidgetTicketCreateFailure(
      new Error("Failed to refresh Zoho Desk access token"),
    );
    expect(failure.status).toBe(503);
    expect(failure.body.success).toBe(false);
    expect(failure.body.code).toBe("desk_auth_unavailable");
  });

  it("keeps non-auth Desk API failures as 502 create_failed", () => {
    const failure = mapWidgetTicketCreateFailure(
      new Error("No Zoho Desk department found"),
    );
    expect(failure.status).toBe(502);
    expect(failure.body.success).toBe(false);
    expect(failure.body.code).toBe("desk_create_failed");
  });

  it("exposes a not-configured body without success", () => {
    const failure = widgetTicketNotConfigured();
    expect(failure.status).toBe(503);
    expect(failure.body.success).toBe(false);
    expect(failure.body.code).toBe("desk_not_configured");
  });

  it("recognizes ZohoOAuthError instances", () => {
    const err = new ZohoOAuthError({
      message: "x",
      code: "invalid_refresh_token",
      product: "desk",
    });
    expect(isZohoOAuthError(err)).toBe(true);
    expect(isZohoOAuthError(new Error("x"))).toBe(false);
  });
});
