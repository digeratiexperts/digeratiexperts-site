import crypto from "crypto";
import { describe, expect, it } from "vitest";

process.env.ZOHO_PAYMENTS_SIGNING_KEY =
  process.env.ZOHO_PAYMENTS_SIGNING_KEY || "test-signing-key-webhook";

import { ZohoPaymentsService } from "./zohoPayments";

const SIGNING_KEY = process.env.ZOHO_PAYMENTS_SIGNING_KEY!;

function sign(payload: string, timestamp: number): string {
  const v = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v=${v}`;
}

describe("Zoho Payments webhook signature verification", () => {
  const service = new ZohoPaymentsService();
  const payload = JSON.stringify({ event_type: "payment.succeeded" });

  it("accepts a correctly signed payload with a fresh timestamp (seconds or ms)", () => {
    const nowMs = Date.now();
    const seconds = Math.floor(nowMs / 1000);
    expect(service.verifyWebhookSignature(payload, sign(payload, seconds), nowMs)).toBe(true);
    expect(service.verifyWebhookSignature(payload, sign(payload, nowMs), nowMs)).toBe(true);
  });

  it("rejects a validly signed but stale event (replay outside the 5-minute window)", () => {
    const nowMs = Date.now();
    const staleSeconds = Math.floor(nowMs / 1000) - 10 * 60;
    expect(service.verifyWebhookSignature(payload, sign(payload, staleSeconds), nowMs)).toBe(false);
  });

  it("rejects tampered payloads and malformed headers", () => {
    const nowMs = Date.now();
    const seconds = Math.floor(nowMs / 1000);
    const header = sign(payload, seconds);
    expect(service.verifyWebhookSignature(payload + "x", header, nowMs)).toBe(false);
    expect(service.verifyWebhookSignature(payload, "t=abc,v=def", nowMs)).toBe(false);
    expect(service.verifyWebhookSignature(payload, "", nowMs)).toBe(false);
  });
});
