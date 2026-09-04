/**
 * Production Configuration for Digerati Experts MSP Portal
 * 
 * This file contains configuration for deploying to production environments
 * including CyberPanel/OpenLiteSpeed.
 */

export const productionConfig = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3300', 10),
    host: '0.0.0.0',
    trustProxy: true, // Enable for reverse proxy (OpenLiteSpeed)
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    sessionSecret: process.env.SESSION_SECRET,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // External Services
  services: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || process.env.STRIPE_LIVE_API_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    openai: {
      baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    },
    zoho: {
      clientId: process.env.ZOHO_CLIENT_ID,
      clientSecret: process.env.ZOHO_CLIENT_SECRET,
      bookingsUrl: 'https://meet.digerati-experts.com/',
    },
  },

  // Domain Configuration
  domains: {
    main: process.env.MAIN_DOMAIN || 'digeratiexperts.com',
    portal: process.env.PORTAL_DOMAIN || 'portal.digeratiexperts.com',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  },

  // Feature Flags
  features: {
    enableOpenAI: process.env.ENABLE_OPENAI !== 'false',
    enableStripe: process.env.ENABLE_STRIPE !== 'false',
    enableZoho: process.env.ENABLE_ZOHO !== 'false',
  },
};

// Validate critical configuration
const JWT_PLACEHOLDERS = new Set([
  'CHANGE_THIS_IN_PRODUCTION',
  'dev-secret-key-change-in-production',
]);

export function validateProductionConfig(): string[] {
  const errors: string[] = [];

  if (!process.env.DATABASE_URL) {
    // CI's local production smoke boots the built server without a database
    // on purpose (memory-only mode); the opt-out must be explicit so a real
    // deployment can never silently run without durable storage.
    if (process.env.DE_SMOKE_ALLOW_MEMORY_ONLY === '1') {
      console.warn('[config] WARNING: DATABASE_URL not set — memory-only mode explicitly allowed (DE_SMOKE_ALLOW_MEMORY_ONLY=1)');
    } else {
      errors.push('DATABASE_URL is required for production');
    }
  }

  if (!process.env.JWT_SECRET || JWT_PLACEHOLDERS.has(process.env.JWT_SECRET)) {
    errors.push('JWT_SECRET must be set to a secure value in production');
  }

  if (!process.env.MFA_ENCRYPTION_KEY) {
    errors.push('MFA_ENCRYPTION_KEY is required to protect portal MFA secrets in production');
  }

  return errors;
}

export function collectProductionConfigWarnings(): string[] {
  const warnings: string[] = [];

  if (!process.env.SESSION_SECRET) {
    warnings.push('SESSION_SECRET is not set (used as an OAuth state-signing fallback)');
  }
  if (!process.env.TURNSTILE_SECRET_KEY) {
    warnings.push('TURNSTILE_SECRET_KEY is not set — Turnstile verification fails open without it');
  }
  if (
    !process.env.ZOHO_PAYMENTS_ACCOUNT_ID ||
    !process.env.ZOHO_PAYMENTS_SIGNING_KEY
  ) {
    warnings.push('Zoho Payments env is incomplete — online checkout and webhook verification are disabled');
  }

  return warnings;
}

/**
 * Fail-closed production startup gate. Call before the server begins
 * listening; exits the process when required configuration is unsafe/missing.
 */
export function enforceProductionConfig(): void {
  if (getEnvironment() !== 'production') return;

  for (const warning of collectProductionConfigWarnings()) {
    console.warn(`[config] WARNING: ${warning}`);
  }

  const errors = validateProductionConfig();
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[config] FATAL: ${error}`);
    }
    console.error('[config] Refusing to start with unsafe production configuration.');
    process.exit(1);
  }
}

// Environment detection
export function getEnvironment(): 'development' | 'staging' | 'production' {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

export default productionConfig;
