/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s), the profile every authenticator app reads:
 * Microsoft Authenticator, JumpCloud Protect, Google Authenticator, Authy, 1Password,
 * Apple Passwords (iOS 18+) and Google Password Manager.
 *
 * Written on node:crypto instead of otplib. otplib 13 removed the `authenticator`
 * object the portal called (`keyuri`), which made every authenticator-app setup
 * answer 500 "MFA setup failed".
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_ISSUER = "Digerati Experts";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 character in TOTP secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, the RFC 4226 recommended length. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function generateTotp(secret: string, nowMs = Date.now()): string {
  return hotp(base32Decode(secret), Math.floor(nowMs / 1000 / STEP_SECONDS));
}

/** Accepts the current step and one step either side, for phone clock drift. */
export function verifyTotp(code: string, secret: string, nowMs = Date.now(), window = 1): boolean {
  const token = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(nowMs / 1000 / STEP_SECONDS);
  let matched = false;
  for (let delta = -window; delta <= window; delta++) {
    const candidate = Buffer.from(hotp(key, counter + delta));
    // Check every step so timing does not reveal which one matched.
    if (timingSafeEqual(candidate, Buffer.from(token))) matched = true;
  }
  return matched;
}

/** otpauth:// URI in the Key URI Format that Microsoft Authenticator and JumpCloud Protect both scan. */
export function totpKeyUri(accountName: string, secret: string, issuer = TOTP_ISSUER): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
