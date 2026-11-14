import { z } from "zod";

export type RuntimeEnvironment = "development" | "staging" | "test" | "production";

type EnvironmentInput = Record<string, string | undefined>;

export type RuntimeConfig = {
  environment: RuntimeEnvironment;
  server: {
    port: number;
    host: "0.0.0.0";
    trustProxy: boolean;
  };
  database: { url?: string };
  security: {
    jwtSecret?: string;
    sessionSecret?: string;
    turnstileSecretKey?: string;
    mfaEncryptionKey?: string;
    mfaPreviousEncryptionKeys?: string;
  };
  payments: {
    accountId?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    signingKey?: string;
    portalInvoicePaymentsEnabled: boolean;
  };
  domains: {
    appUrl: string;
    allowedOrigins: string[];
  };
};

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const requiredText = (name: string, minimum = 1) =>
  z.preprocess(
    blankToUndefined,
    z
      .string({ required_error: `${name} is required for production` })
      .min(minimum, `${name} must be at least ${minimum} characters`),
  );

const optionalText = z.preprocess(blankToUndefined, z.string().optional());
const mfaEncryptionKey = requiredText("PORTAL_MFA_ENCRYPTION_KEY").refine(
  (value) => /^[A-Za-z0-9_-]{43}$/.test(value),
  "PORTAL_MFA_ENCRYPTION_KEY must be an unpadded base64url-encoded 32-byte key",
);
const previousMfaEncryptionKeys = optionalText.refine(
  (value) =>
    !value ||
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .every((entry) => /^[A-Za-z0-9_-]{43}$/.test(entry)),
  "PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS must contain comma-separated unpadded base64url 32-byte keys",
);

const portSchema = z.coerce
  .number()
  .int("PORT must be an integer")
  .min(1, "PORT must be between 1 and 65535")
  .max(65535, "PORT must be between 1 and 65535");

const productionEnvironmentSchema = z
  .object({
    NODE_ENV: z.literal("production"),
    PORT: portSchema.default(3300),
    DATABASE_URL: requiredText("DATABASE_URL").refine(
      (value) => /^postgres(?:ql)?:\/\//i.test(value),
      "DATABASE_URL must be a PostgreSQL connection URL",
    ),
    JWT_SECRET: requiredText("JWT_SECRET", 32),
    SESSION_SECRET: requiredText("SESSION_SECRET", 32),
    PORTAL_MFA_ENCRYPTION_KEY: mfaEncryptionKey,
    PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS: previousMfaEncryptionKeys,
    TURNSTILE_SECRET_KEY: requiredText("TURNSTILE_SECRET_KEY", 8),
    APP_URL: requiredText("APP_URL").refine((value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "APP_URL must be a valid HTTPS URL"),
    ALLOWED_ORIGINS: requiredText("ALLOWED_ORIGINS").refine((value) => {
      const origins = value.split(",").map((entry) => entry.trim()).filter(Boolean);
      if (origins.length === 0) return false;
      return origins.every((origin) => {
        try {
          const parsed = new URL(origin);
          return parsed.protocol === "https:" && parsed.origin === origin;
        } catch {
          return false;
        }
      });
    }, "ALLOWED_ORIGINS must contain comma-separated HTTPS origins"),
    ZOHO_PAYMENTS_ACCOUNT_ID: requiredText("ZOHO_PAYMENTS_ACCOUNT_ID"),
    ZOHO_PAYMENTS_REFRESH_TOKEN: requiredText("ZOHO_PAYMENTS_REFRESH_TOKEN"),
    ZOHO_PAYMENTS_SIGNING_KEY: requiredText("ZOHO_PAYMENTS_SIGNING_KEY", 16),
    PORTAL_INVOICE_PAYMENTS_ENABLED: z.enum(["true", "false"]).default("false"),
    ZOHO_PAYMENTS_CLIENT_ID: optionalText,
    ZOHO_PAYMENTS_CLIENT_SECRET: optionalText,
    ZOHO_CLIENT_ID: optionalText,
    ZOHO_CLIENT_SECRET: optionalText,
    ZOHO_CLIENT_ID_API: optionalText,
    ZOHO_CLIENT_SECRET_API: optionalText,
    ZOHO_REFRESH_TOKEN: requiredText("ZOHO_REFRESH_TOKEN"),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (!value.ZOHO_CLIENT_ID && !value.ZOHO_CLIENT_ID_API) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ZOHO_CLIENT_ID"],
        message: "ZOHO_CLIENT_ID or ZOHO_CLIENT_ID_API is required for production integrations",
      });
    }
    if (!value.ZOHO_CLIENT_SECRET && !value.ZOHO_CLIENT_SECRET_API) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ZOHO_CLIENT_SECRET"],
        message: "ZOHO_CLIENT_SECRET or ZOHO_CLIENT_SECRET_API is required for production integrations",
      });
    }
    if (!value.ZOHO_PAYMENTS_CLIENT_ID && !value.ZOHO_CLIENT_ID && !value.ZOHO_CLIENT_ID_API) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ZOHO_PAYMENTS_CLIENT_ID"],
        message: "ZOHO_PAYMENTS_CLIENT_ID, ZOHO_CLIENT_ID_API, or ZOHO_CLIENT_ID is required for production",
      });
    }
    if (!value.ZOHO_PAYMENTS_CLIENT_SECRET && !value.ZOHO_CLIENT_SECRET && !value.ZOHO_CLIENT_SECRET_API) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ZOHO_PAYMENTS_CLIENT_SECRET"],
        message: "ZOHO_PAYMENTS_CLIENT_SECRET, ZOHO_CLIENT_SECRET_API, or ZOHO_CLIENT_SECRET is required for production",
      });
    }
  });

function issueMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function paymentCredentialIssues(env: EnvironmentInput): string[] {
  const issues: string[] = [];
  if (!env.ZOHO_CLIENT_ID?.trim() && !env.ZOHO_CLIENT_ID_API?.trim()) {
    issues.push(
      "ZOHO_CLIENT_ID: ZOHO_CLIENT_ID or ZOHO_CLIENT_ID_API is required for production integrations",
    );
  }
  if (!env.ZOHO_CLIENT_SECRET?.trim() && !env.ZOHO_CLIENT_SECRET_API?.trim()) {
    issues.push(
      "ZOHO_CLIENT_SECRET: ZOHO_CLIENT_SECRET or ZOHO_CLIENT_SECRET_API is required for production integrations",
    );
  }
  if (!env.ZOHO_PAYMENTS_CLIENT_ID?.trim() && !env.ZOHO_CLIENT_ID?.trim() && !env.ZOHO_CLIENT_ID_API?.trim()) {
    issues.push(
      "ZOHO_PAYMENTS_CLIENT_ID: ZOHO_PAYMENTS_CLIENT_ID, ZOHO_CLIENT_ID_API, or ZOHO_CLIENT_ID is required for production",
    );
  }
  if (!env.ZOHO_PAYMENTS_CLIENT_SECRET?.trim() && !env.ZOHO_CLIENT_SECRET?.trim() && !env.ZOHO_CLIENT_SECRET_API?.trim()) {
    issues.push(
      "ZOHO_PAYMENTS_CLIENT_SECRET: ZOHO_PAYMENTS_CLIENT_SECRET, ZOHO_CLIENT_SECRET_API, or ZOHO_CLIENT_SECRET is required for production",
    );
  }
  return issues;
}

function uniqueIssues(issues: string[]): string[] {
  return [...new Set(issues)];
}

export class RuntimeConfigurationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Runtime configuration is invalid:\n- ${issues.join("\n- ")}`);
    this.name = "RuntimeConfigurationError";
    this.issues = issues;
  }
}

export function getEnvironment(
  env: EnvironmentInput = process.env,
): RuntimeEnvironment {
  const value = env.NODE_ENV?.trim().toLowerCase();
  if (value === "production" || value === "staging" || value === "test") return value;
  return "development";
}

function splitAllowedOrigins(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateProductionConfig(
  env: EnvironmentInput = process.env,
): string[] {
  const result = productionEnvironmentSchema.safeParse({ ...env, NODE_ENV: "production" });
  return result.success
    ? []
    : uniqueIssues([...issueMessages(result.error), ...paymentCredentialIssues(env)]);
}

export function loadRuntimeConfig(
  env: EnvironmentInput = process.env,
): RuntimeConfig {
  const environment = getEnvironment(env);
  if (environment === "production") {
    const result = productionEnvironmentSchema.safeParse(env);
    if (!result.success) {
      throw new RuntimeConfigurationError(
        uniqueIssues([...issueMessages(result.error), ...paymentCredentialIssues(env)]),
      );
    }

    const value = result.data;
    return {
      environment,
      server: { port: value.PORT, host: "0.0.0.0", trustProxy: true },
      database: { url: value.DATABASE_URL },
      security: {
        jwtSecret: value.JWT_SECRET,
        sessionSecret: value.SESSION_SECRET,
        turnstileSecretKey: value.TURNSTILE_SECRET_KEY,
        mfaEncryptionKey: value.PORTAL_MFA_ENCRYPTION_KEY,
        mfaPreviousEncryptionKeys: value.PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS,
      },
      payments: {
        accountId: value.ZOHO_PAYMENTS_ACCOUNT_ID,
        clientId: value.ZOHO_PAYMENTS_CLIENT_ID || value.ZOHO_CLIENT_ID_API || value.ZOHO_CLIENT_ID,
        clientSecret: value.ZOHO_PAYMENTS_CLIENT_SECRET || value.ZOHO_CLIENT_SECRET_API || value.ZOHO_CLIENT_SECRET,
        refreshToken: value.ZOHO_PAYMENTS_REFRESH_TOKEN,
        signingKey: value.ZOHO_PAYMENTS_SIGNING_KEY,
        portalInvoicePaymentsEnabled: value.PORTAL_INVOICE_PAYMENTS_ENABLED === "true",
      },
      domains: {
        appUrl: value.APP_URL,
        allowedOrigins: splitAllowedOrigins(value.ALLOWED_ORIGINS),
      },
    };
  }

  const portResult = portSchema.safeParse(env.PORT || "8080");
  const port = portResult.success ? portResult.data : 8080;
  return {
    environment,
    server: { port, host: "0.0.0.0", trustProxy: false },
    database: { url: env.DATABASE_URL || undefined },
    security: {
      jwtSecret: env.JWT_SECRET || undefined,
      sessionSecret: env.SESSION_SECRET || undefined,
      turnstileSecretKey: env.TURNSTILE_SECRET_KEY || undefined,
      mfaEncryptionKey: env.PORTAL_MFA_ENCRYPTION_KEY || undefined,
      mfaPreviousEncryptionKeys: env.PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS || undefined,
    },
    payments: {
      accountId: env.ZOHO_PAYMENTS_ACCOUNT_ID || undefined,
      clientId: env.ZOHO_PAYMENTS_CLIENT_ID || env.ZOHO_CLIENT_ID_API || env.ZOHO_CLIENT_ID || undefined,
      clientSecret: env.ZOHO_PAYMENTS_CLIENT_SECRET || env.ZOHO_CLIENT_SECRET_API || env.ZOHO_CLIENT_SECRET || undefined,
      refreshToken: env.ZOHO_PAYMENTS_REFRESH_TOKEN || undefined,
      signingKey: env.ZOHO_PAYMENTS_SIGNING_KEY || undefined,
      portalInvoicePaymentsEnabled: env.PORTAL_INVOICE_PAYMENTS_ENABLED === "true",
    },
    domains: {
      appUrl: env.APP_URL || `http://localhost:${port}`,
      allowedOrigins: splitAllowedOrigins(env.ALLOWED_ORIGINS),
    },
  };
}

export default loadRuntimeConfig;

export function isPortalInvoicePaymentsEnabled(
  env: EnvironmentInput = process.env,
): boolean {
  return env.PORTAL_INVOICE_PAYMENTS_ENABLED?.trim().toLowerCase() === "true";
}
