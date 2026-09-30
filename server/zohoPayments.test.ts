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
    expect(JSON.stringify(payload.meta_data)).not.toContain("must-be-dropped");

    expect(session.payment_session_id).toBe("ps_123");
    expect(session.url).toBe("https://payments.zoho.com/hostedcheckout/ak_456");
  });

  it("verifies Zoho timestamped webhook signatures against timestamp.rawBody", () => {
    const service = new ZohoPaymentsService();
    const payload = JSON.stringify({ event_type: "payment.succeeded", event_object: { payment: { payment_id: "pay_1" } } });
    const timestamp = "1786400000";
    const signature = crypto
      .createHmac("sha256", process.env.ZOHO_PAYMENTS_SIGNING_KEY!)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    const nowMs = Number(timestamp) * 1000;
    expect(service.verifyWebhookSignature(payload, `t=${timestamp},v=${signature}`, nowMs)).toBe(true);
    expect(service.verifyWebhookSignature(payload, `t=${timestamp},v=${"0".repeat(64)}`, nowMs)).toBe(false);
    expect(service.verifyWebhookSignature(payload, signature, nowMs)).toBe(false);
  });

  it("parses the official payment webhook object and preserves order metadata", () => {
    const service = new ZohoPaymentsService();
    const parsed = service.parseWebhookEvent({
      event_type: "payment.succeeded",
      event_object: {
        payment: {
          payment_id: "pay_123",
          reference_number: "ORD-ABC",
          invoice_number: "ORD-ABC",
          amount: 78,
          status: "succeeded",
          meta_data: [
            { key: "orderId", value: "order-uuid" },
            { key: "orderNumber", value: "ORD-ABC" },
          ],
        },
      },
    });

    expect(parsed).toMatchObject({
      eventType: "payment.succeeded",
      paymentId: "pay_123",
      referenceNumber: "ORD-ABC",
      invoiceNumber: "ORD-ABC",
      amount: "78",
      status: "succeeded",
    });
    expect(parsed.metadata).toContainEqual({ key: "orderId", value: "order-uuid" });
  });
});
