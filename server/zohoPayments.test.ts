// Regression contract for the production Zoho Payments hosted-checkout integration.
import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZohoPaymentsService } from "./zohoPayments";

const ENV_KEYS = [
  "ZOHO_PAYMENTS_ACCOUNT_ID",
  "ZOHO_PAYMENTS_CLIENT_ID",
  "ZOHO_PAYMENTS_CLIENT_SECRET",
  "ZOHO_PAYMENTS_REFRESH_TOKEN",
  "ZOHO_PAYMENTS_SIGNING_KEY",
  "ZOHO_CLIENT_ID_API",
  "ZOHO_CLIENT_SECRET_API",
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
] as const;

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function configurePaymentsEnv() {
  process.env.ZOHO_PAYMENTS_ACCOUNT_ID = "acct_123456";
  process.env.ZOHO_PAYMENTS_CLIENT_ID = "client_123456";
  process.env.ZOHO_PAYMENTS_CLIENT_SECRET = "secret_123456";
  process.env.ZOHO_PAYMENTS_REFRESH_TOKEN = "refresh_123456";
  process.env.ZOHO_PAYMENTS_SIGNING_KEY = "signing_123456";
}

describe("ZohoPaymentsService", () => {
  beforeEach(() => {
    configurePaymentsEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      const original = savedEnv[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  it("uses OAuth, account_id, decimal dollars, hosted checkout access_key, and non-PII metadata", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access_abc",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payments_session: {
          payments_session_id: "ps_123",
          access_key: "ak_456",
          status: "created",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const service = new ZohoPaymentsService();
    const session = await service.createPaymentSession({
      orderNumber: "ORD-123",
      customerEmail: "buyer@example.com",
      customerName: "Buyer Example",
      lineItems: [{ name: "Co-Managed Endpoint Management", amount: 39, quantity: 3 }],
      totalAmount: 117,
      successUrl: "https://digeratiexperts.com/store/order-confirmation?orderId=123",
      cancelUrl: "https://digeratiexperts.com/store/checkout",
      metadata: {
        orderId: "123",
        billingName: "Buyer Example",
        billingEmail: "buyer@example.com",
        billingCompany: "Example Company",
        "identifier-key-that-is-longer-than-20": "truncated-key-value",
        thirdId: "3",
        fourthId: "4",
        fifthId: "5",
        sixthId: "must-be-dropped",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(String(tokenUrl)).toBe("https://accounts.zoho.com/oauth/v2/token");
    expect(tokenInit?.method).toBe("POST");
    expect(String(tokenInit?.body)).toContain("grant_type=refresh_token");

    const [sessionUrl, sessionInit] = fetchMock.mock.calls[1];
    expect(String(sessionUrl)).toContain("/api/v1/paymentsessions?account_id=acct_123456");
    expect((sessionInit?.headers as Record<string, string>).Authorization).toBe("Zoho-oauthtoken access_abc");

    const payload = JSON.parse(String(sessionInit?.body));
    expect(payload.amount).toBe(117);
    expect(payload.amount).not.toBe(11700);
    expect(payload.reference_number).toBe("ORD-123");
    expect(payload.invoice_number).toBe("ORD-123");
    expect(payload.configurations.hosted_checkout_parameters.success_url).toContain("order-confirmation");
    expect(payload.configurations.hosted_checkout_parameters.failure_url).toContain("/store/checkout");
    expect(payload.configurations.hosted_checkout_parameters.name).toBe("Buyer Example");
    expect(payload.configurations.hosted_checkout_parameters.email).toBe("buyer@example.com");

    expect(payload.meta_data).toHaveLength(5);
    expect(payload.meta_data).toContainEqual({ key: "orderNumber", value: "ORD-123" });
    expect(payload.meta_data).toContainEqual({ key: "orderId", value: "123" });
    expect(payload.meta_data.every((item: { key: string }) => item.key.length <= 20)).toBe(true);
    expect(JSON.stringify(payload.meta_data)).not.toContain("buyer@example.com");
    expect(JSON.stringify(payload.meta_data)).not.toContain("Buyer Example");
    expect(JSON.stringify(payload.meta_data)).not.toContain("Example Company");
    expect(JSON.stringify(payload.meta_data)).not.toContain("must-be-dropped");

    expect(session.payment_session_id).toBe("ps_123");
    expect(session.url).toBe("https://payments.zoho.com/hostedcheckout/ak_456");
  });

  it("verifies Zoho timestamped webhook signatures against timestamp.rawBody", () => {
    const service = new ZohoPaymentsService();
    const payload = JSON.stringify({ event_type: "payment.succeeded", event_object: { payment: { payment_id: "pay_1" } } });
    const nowMs = Date.UTC(2026, 7, 23, 12, 0, 0);
    const timestamp = String(nowMs);
    const signature = crypto
      .createHmac("sha256", process.env.ZOHO_PAYMENTS_SIGNING_KEY!)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    expect(service.verifyWebhookSignature(payload, `t=${timestamp},v=${signature}`, { nowMs })).toBe(true);
    expect(service.verifyWebhookSignature(payload, `t=${timestamp},v=${"0".repeat(64)}`, { nowMs })).toBe(false);
    expect(service.verifyWebhookSignature(payload, signature, { nowMs })).toBe(false);

    const staleTimestamp = String(nowMs - 5 * 60_000 - 1);
    const staleSignature = crypto
      .createHmac("sha256", process.env.ZOHO_PAYMENTS_SIGNING_KEY!)
      .update(`${staleTimestamp}.${payload}`)
      .digest("hex");
    expect(service.verifyWebhookSignature(payload, `t=${staleTimestamp},v=${staleSignature}`, { nowMs })).toBe(false);

    const futureTimestamp = String(nowMs + 60_000 + 1);
    const futureSignature = crypto
      .createHmac("sha256", process.env.ZOHO_PAYMENTS_SIGNING_KEY!)
      .update(`${futureTimestamp}.${payload}`)
      .digest("hex");
    expect(service.verifyWebhookSignature(payload, `t=${futureTimestamp},v=${futureSignature}`, { nowMs })).toBe(false);

    const secondsTimestamp = String(Math.floor(nowMs / 1000));
    const secondsSignature = crypto
      .createHmac("sha256", process.env.ZOHO_PAYMENTS_SIGNING_KEY!)
      .update(`${secondsTimestamp}.${payload}`)
      .digest("hex");
    expect(service.verifyWebhookSignature(payload, `t=${secondsTimestamp},v=${secondsSignature}`, { nowMs })).toBe(true);
  });

  it("parses the official payment webhook object and preserves order metadata", () => {
    const service = new ZohoPaymentsService();
    const parsed = service.parseWebhookEvent({
      event_id: "evt_123",
      event_time: 1787486400000,
      live_mode: true,
      event_type: "payment.succeeded",
      event_object: {
        payment: {
          payment_id: "pay_123",
          payments_session_id: "ps_123",
          reference_number: "ORD-ABC",
          invoice_number: "ORD-ABC",
          amount: 78,
          currency: "USD",
          status: "succeeded",
          meta_data: [
            { key: "orderId", value: "order-uuid" },
            { key: "orderNumber", value: "ORD-ABC" },
          ],
        },
      },
    });

    expect(parsed).toMatchObject({
      eventId: "evt_123",
      eventTimeMs: 1787486400000,
      liveMode: true,
      eventType: "payment.succeeded",
      paymentId: "pay_123",
      paymentSessionId: "ps_123",
      referenceNumber: "ORD-ABC",
      invoiceNumber: "ORD-ABC",
      amount: "78",
      currency: "USD",
      status: "succeeded",
    });
    expect(parsed.metadata).toContainEqual({ key: "orderId", value: "order-uuid" });
  });

  it("preserves adjacent numeric webhook event IDs above JavaScript's safe integer range", () => {
    const service = new ZohoPaymentsService();
    const payload = (eventId: string) => JSON.stringify({
      event_id: `__EVENT_${eventId}__`,
      event_time: 1787486400000,
      live_mode: true,
      event_type: "payment.succeeded",
      event_object: { payment: { payment_id: `pay-${eventId}`, status: "succeeded" } },
    }).replace(`"__EVENT_${eventId}__"`, eventId);

    const first = service.parseWebhookEvent(service.parseWebhookPayload(payload("9007199254740992")));
    const second = service.parseWebhookEvent(service.parseWebhookPayload(payload("9007199254740993")));

    expect(first.eventId).toBe("9007199254740992");
    expect(second.eventId).toBe("9007199254740993");
    expect(first.eventId).not.toBe(second.eventId);
  });

  it("rejects a provider reference over 50 characters instead of silently truncating it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const service = new ZohoPaymentsService();

    await expect(service.createPaymentSession({
      orderNumber: "X".repeat(51),
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      lineItems: [{ name: "Invoice", amount: 1, quantity: 1 }],
      totalAmount: 1,
      successUrl: "https://digeratiexperts.com/success",
      cancelUrl: "https://digeratiexperts.com/cancel",
    })).rejects.toThrow(/50 characters or fewer/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("puts a bounded abort signal on every Zoho request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access_abc",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payments_session: {
          payments_session_id: "ps_timeout",
          access_key: "ak_timeout",
          status: "created",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const service = new ZohoPaymentsService();
    await service.createPaymentSession({
      orderNumber: "ORD-TIMEOUT",
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      lineItems: [{ name: "Invoice", amount: 1, quantity: 1 }],
      totalAmount: 1,
      successUrl: "https://digeratiexperts.com/success",
      cancelUrl: "https://digeratiexperts.com/cancel",
    });

    expect(fetchMock.mock.calls).toHaveLength(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("normalizes a retrieved payment session for authoritative reconciliation", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access_abc",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payments_session: {
          payments_session_id: "ps_123",
          amount: "78.00",
          currency: "USD",
          status: "succeeded",
          reference_number: "ORD-ABC",
          invoice_number: "ORD-ABC",
          payments: [{ payment_id: "pay_123", status: "succeeded" }],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const service = new ZohoPaymentsService();
    await expect(service.getPaymentSessionSnapshot("ps_123")).resolves.toEqual({
      paymentSessionId: "ps_123",
      amount: "78.00",
      currency: "USD",
      status: "succeeded",
      referenceNumber: "ORD-ABC",
      invoiceNumber: "ORD-ABC",
      payments: [{ paymentId: "pay_123", status: "succeeded" }],
    });
  });

  it("preserves the ISO currency exponent instead of hard-rounding every checkout to cents", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access_abc",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payments_session: {
          payments_session_id: "ps_kwd",
          access_key: "ak_kwd",
          status: "created",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const service = new ZohoPaymentsService();
    await service.createPaymentSession({
      orderNumber: "INV-KWD-1",
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      lineItems: [{ name: "Invoice", amount: 1.234, quantity: 1 }],
      totalAmount: 1.234,
      currency: "kwd",
      successUrl: "https://digeratiexperts.com/success",
      cancelUrl: "https://digeratiexperts.com/cancel",
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(payload).toMatchObject({ amount: 1.234, currency: "KWD" });
  });
});
