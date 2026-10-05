import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotp, generateTotpSecret, hotp, totpKeyUri, verifyTotp } from "./portalTotp";

// RFC 6238 appendix B: SHA-1 seed "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("portal TOTP (RFC 6238)", () => {
  it("matches the RFC 4226 HOTP test vectors", () => {
    const key = Buffer.from("12345678901234567890", "ascii");
    expect([0, 1, 2, 9].map((c) => hotp(key, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });

  it("matches the RFC 6238 SHA-1 vectors (last 6 digits)", () => {
    expect(generateTotp(RFC_SECRET, 59_000)).toBe("287082");
    expect(generateTotp(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(generateTotp(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
    expect(generateTotp(RFC_SECRET, 20_000_000_000_000)).toBe("353130");
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("generates a 160-bit base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret).length).toBe(20);
  });

  it("accepts the current step and one step of clock drift, nothing further", () => {
    const secret = generateTotpSecret();
    const now = 1_790_000_000_000;
    expect(verifyTotp(generateTotp(secret, now), secret, now)).toBe(true);
    expect(verifyTotp(generateTotp(secret, now - 30_000), secret, now)).toBe(true);
    expect(verifyTotp(generateTotp(secret, now + 30_000), secret, now)).toBe(true);
    expect(verifyTotp(generateTotp(secret, now - 90_000), secret, now)).toBe(false);
  });

  it("rejects malformed codes without throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp("", secret)).toBe(false);
    expect(verifyTotp("12345", secret)).toBe(false);
    expect(verifyTotp("abcdef", secret)).toBe(false);
    expect(verifyTotp(" 1234567 ", secret)).toBe(false);
  });

  it("builds a Key URI that Microsoft Authenticator and JumpCloud Protect scan", () => {
    const uri = totpKeyUri("joe@example.com", "JBSWY3DPEHPK3PXP");
    expect(uri.startsWith("otpauth://totp/Digerati%20Experts:joe%40example.com?")).toBe(true);
    const params = new URL(uri).searchParams;
    expect(params.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(params.get("issuer")).toBe("Digerati Experts");
    expect(params.get("digits")).toBe("6");
    expect(params.get("period")).toBe("30");
    expect(params.get("algorithm")).toBe("SHA1");
  });
});
