import crypto from "crypto";
import { getJwtSecretOrNull } from "./config/authSecrets";

/**
 * Proof-of-possession token for the post-checkout confirmation page.
 *
 * The Zoho success_url (and the client-side navigate after checkout) carry
 * `ct=<token>` so only the purchaser returning from checkout can read the
 * redacted confirmation payload. An order id alone (leaked via history,
 * Referer, or logs) is no longer enough to read customer billing details.
 */

const TOKEN_SCOPE = "store-order-confirmation";

export function orderConfirmationToken(orderId: string): string | null {
  const secret = getJwtSecretOrNull();
  if (!secret || !orderId) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(`${TOKEN_SCOPE}:${orderId}`)
    .digest("hex");
}

export function isValidOrderConfirmationToken(orderId: string, supplied: unknown): boolean {
  if (typeof supplied !== "string" || !supplied) return false;
  const expected = orderConfirmationToken(orderId);
  if (!expected) return false;
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (suppliedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}
