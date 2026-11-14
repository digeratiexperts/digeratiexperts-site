import { describe, expect, it } from "vitest";

import {
  RuntimeConfigurationError,
  loadRuntimeConfig,
  validateProductionConfig,
} from "./production.config";

const productionEnv = {
  NODE_ENV: "production",
  PORT: "3300",
  DATABASE_URL: "postgresql://app:secret@db.example.com:5432/digerati",
  JWT_SECRET: "j".repeat(48),
  SESSION_SECRET: "s".repeat(48),
  PORTAL_MFA_ENCRYPTION_KEY: "m".repeat(43),
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  APP_URL: "https://digeratiexperts.com",
  ALLOWED_ORIGINS: "https://digeratiexperts.com,https://portal.digeratiexperts.com",
  ZOHO_CLIENT_ID: "zoho-client",
  ZOHO_CLIENT_SECRET: "zoho-secret",
  ZOHO_REFRESH_TOKEN: "zoho-refresh",
  ZOHO_PAYMENTS_ACCOUNT_ID: "payments-account",
  ZOHO_PAYMENTS_REFRESH_TOKEN: "payments-refresh",
  ZOHO_PAYMENTS_SIGNING_KEY: "payments-signing-key",
} satisfies Record<string, string>;

describe("production runtime configuration", () => {
  it("accepts the Zoho Payments production contract without Stripe", () => {
    const config = loadRuntimeConfig(productionEnv);

    expect(config.environment).toBe("production");
    expect(config.server.port).toBe(3300);
    expect(config.payments.clientId).toBe("zoho-client");
    expect(config.payments.clientSecret).toBe("zoho-secret");
    expect(config.security.mfaEncryptionKey).toBe("m".repeat(43));
    expect(config.domains.allowedOrigins).toEqual([
      "https://digeratiexperts.com",
      "https://portal.digeratiexperts.com",
    ]);
    expect(validateProductionConfig(productionEnv)).toEqual([]);
  });

  it("accepts dedicated Zoho Payments OAuth credentials", () => {
    const config = loadRuntimeConfig({
      ...productionEnv,
      ZOHO_PAYMENTS_CLIENT_ID: "payments-client",
      ZOHO_PAYMENTS_CLIENT_SECRET: "payments-secret",
    });

    expect(config.payments.clientId).toBe("payments-client");
    expect(config.payments.clientSecret).toBe("payments-secret");
  });

  it("fails before production startup when security and payment bindings are incomplete", () => {
    const invalid = {
      ...productionEnv,
      JWT_SECRET: "short",
      TURNSTILE_SECRET_KEY: "",
      ZOHO_PAYMENTS_SIGNING_KEY: "",
      ZOHO_CLIENT_ID: "",
      ZOHO_CLIENT_SECRET: "",
    };

    expect(() => loadRuntimeConfig(invalid)).toThrow(RuntimeConfigurationError);
    const errors = validateProductionConfig(invalid).join("\n");
    expect(errors).toContain("JWT_SECRET");
    expect(errors).toContain("TURNSTILE_SECRET_KEY");
    expect(errors).toContain("ZOHO_PAYMENTS_SIGNING_KEY");
    expect(errors).toContain("ZOHO_PAYMENTS_CLIENT_ID");
    expect(errors).toContain("ZOHO_CLIENT_ID");
    expect(errors).not.toContain("STRIPE");
  });

  it("requires HTTPS for the public production URL", () => {
    expect(validateProductionConfig({ ...productionEnv, APP_URL: "http://localhost:3300" }).join("\n"))
      .toContain("APP_URL");
  });

  it("requires a dedicated 256-bit MFA encryption key", () => {
    const errors = validateProductionConfig({
      ...productionEnv,
      PORTAL_MFA_ENCRYPTION_KEY: "too-short",
    }).join("\n");
    expect(errors).toContain("PORTAL_MFA_ENCRYPTION_KEY");
  });

  it("keeps local development usable without production credentials", () => {
    const config = loadRuntimeConfig({ NODE_ENV: "development", PORT: "8080" });
    expect(config.environment).toBe("development");
    expect(config.server.port).toBe(8080);
  });
});
