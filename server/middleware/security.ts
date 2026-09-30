import { Request, Response, NextFunction } from "express";
import validator from "validator";
import crypto from "crypto";

/**
 * COMPREHENSIVE SECURITY MIDDLEWARE FOR SPAM & MITM PREVENTION
 */

// ==================== CSRF PROTECTION ====================
const csrfTokens = new Map<string, { token: string; createdAt: number }>();
const CSRF_TOKEN_EXPIRY = 1 * 60 * 60 * 1000; // 1 hour

export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(sessionId, {
    token,
    createdAt: Date.now(),
  });
  return token;
}

export function validateCSRFToken(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const sessionId = req.cookies?.sessionId || req.headers["x-session-id"] as string;
  const token = req.headers["x-csrf-token"] as string || req.body?.csrfToken;

  if (!sessionId || !token) {
    console.warn(`[SECURITY] CSRF: Missing token or session. IP: ${req.ip}`);
    return res.status(403).json({ message: "CSRF validation failed: missing token" });
  }

  const storedToken = csrfTokens.get(sessionId);
  if (!storedToken) {
    console.warn(`[SECURITY] CSRF: Invalid session. IP: ${req.ip}`);
    return res.status(403).json({ message: "CSRF validation failed: invalid session" });
  }

  if (Date.now() - storedToken.createdAt > CSRF_TOKEN_EXPIRY) {
    csrfTokens.delete(sessionId);
    console.warn(`[SECURITY] CSRF: Token expired. IP: ${req.ip}`);
    return res.status(403).json({ message: "CSRF validation failed: token expired" });
  }

  if (token !== storedToken.token) {
    console.warn(`[SECURITY] CSRF: Token mismatch. IP: ${req.ip}`);
    return res.status(403).json({ message: "CSRF validation failed: invalid token" });
  }

  next();
}

// ==================== CLOUDFLARE TURNSTILE BOT PROTECTION ====================
export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  const turnstileToken = req.body.turnstileToken || req.body['cf-turnstile-response'];
  
  if (!process.env.TURNSTILE_SECRET_KEY) {
    // Set TURNSTILE_ENFORCE=1 to fail closed when the secret is missing.
    // Default remains fail-open so a config gap cannot lock out all logins,
    // but in production it is logged as a security event, not a quiet skip.
    if (process.env.TURNSTILE_ENFORCE === '1') {
      console.error('[SECURITY] TURNSTILE_UNCONFIGURED_REJECT - enforcement on, secret missing');
      return res.status(503).json({ error: 'Verification is temporarily unavailable. Please try again later.' });
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] TURNSTILE_UNCONFIGURED - bot protection is OFF in production (set TURNSTILE_SECRET_KEY)');
    } else {
      console.warn('[SECURITY] Turnstile not configured - skipping verification');
    }
    return next();
  }

  if (process.env.NODE_ENV === 'development' && (!turnstileToken || turnstileToken === 'dev-bypass-token')) {
    console.warn('[SECURITY] Turnstile token missing or dev-bypass in dev mode - skipping verification');
    return next();
  }
  
  if (!turnstileToken) {
    try {
      const { recordLoginKnock, clientIpFromReq } = await import('../portalLoginKnocksStore');
      void recordLoginKnock({
        kind: 'turnstile_failed',
        email: typeof req.body?.email === 'string' ? req.body.email : null,
        ip: clientIpFromReq(req),
        userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        path: req.originalUrl || req.url || null,
        meta: { turnstileFailed: true, reason: 'missing_token' },
      });
    } catch { /* non-blocking */ }
    return res.status(400).json({ error: 'Bot verification required' });
  }
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: req.ip || ''
      }).toString()
    });
    
    const data = await response.json();
    if (!data.success) {
      logSecurityEvent('TURNSTILE_FAILED', req, { error: data['error-codes'] });
      try {
        const { recordLoginKnock, clientIpFromReq } = await import('../portalLoginKnocksStore');
        void recordLoginKnock({
          kind: 'turnstile_failed',
          email: typeof req.body?.email === 'string' ? req.body.email : null,
          ip: clientIpFromReq(req),
          userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
          path: req.originalUrl || req.url || null,
          meta: { turnstileFailed: true, errorCodes: data['error-codes'] },
        });
      } catch { /* non-blocking */ }
      return res.status(400).json({ error: 'Bot verification failed' });
    }
    
    next();
  } catch (error) {
    console.error('[SECURITY] Turnstile verification error:', error);
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ message: 'Security verification unavailable. Please try again.' });
    }
    next();
  }
}

// ==================== INPUT SANITIZATION ====================
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    // Remove dangerous HTML/script tags
    return validator.escape(input).trim();
  }
  if (typeof input === "object" && input !== null) {
    return Object.keys(input).reduce((acc, key) => {
      acc[key] = sanitizeInput(input[key]);
      return acc;
    }, {} as any);
  }
  return input;
}

export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  next();
}

// ==================== BOT DETECTION ====================
const suspiciousIPs = new Map<string, { count: number; lastSeen: number }>();
const BOT_DETECTION_WINDOW = 10 * 60 * 1000; // 10 minutes
const BOT_THRESHOLD = 100; // Requests in window = potential bot

export function detectBotActivity(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "unknown";
  const userAgent = req.headers["user-agent"] || "";

  // Check known bot user agents
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /scanner/i,
    /curl/i,
    /wget/i,
  ];

  const isSuspiciousBot = botPatterns.some(pattern => pattern.test(userAgent));

  if (isSuspiciousBot) {
    console.warn(
      `[SECURITY] Bot detected. IP: ${ip}, User-Agent: ${userAgent.substring(0, 50)}`
    );
    res.set("X-Bot-Detected", "true");
  }

  // Track request rate per IP
  const record = suspiciousIPs.get(ip);
  const now = Date.now();

  if (record) {
    if (now - record.lastSeen > BOT_DETECTION_WINDOW) {
      // Window expired, reset
      suspiciousIPs.set(ip, { count: 1, lastSeen: now });
    } else {
      record.count++;
      record.lastSeen = now;

      if (record.count > BOT_THRESHOLD) {
        console.warn(
          `[SECURITY] Potential bot/crawler activity. IP: ${ip}, Requests: ${record.count}/${BOT_THRESHOLD}`
        );
        return res.status(429).json({
          message: "Too many requests. Please try again later.",
        });
      }
    }
  } else {
    suspiciousIPs.set(ip, { count: 1, lastSeen: now });
  }

  next();
}

// ==================== HONEYPOT FOR SPAM ====================
export function honeypotValidation(req: Request, res: Response, next: NextFunction) {
  const honeypot = req.body?.website_url || req.body?.phone_number_honeypot;

  if (honeypot && honeypot.length > 0) {
    console.warn(
      `[SECURITY] Honeypot triggered. IP: ${req.ip}, Value: ${honeypot.substring(0, 20)}`
    );
    // Silently fail (don't reveal honeypot)
    return res.status(200).json({ message: "Form submitted successfully" });
  }

  next();
}

// ==================== REQUEST VALIDATION ====================
export function validateEmail(email: string): boolean {
  return validator.isEmail(email);
}

export function validateURL(url: string): boolean {
  return validator.isURL(url, { require_protocol: true });
}

export function validatePhoneNumber(phone: string): boolean {
  return /^[\d\s\-\+\(\)]{10,15}$/.test(phone);
}

export function validateInput(req: Request, res: Response, next: NextFunction) {
  // Validate common fields
  if (req.body.email && !validateEmail(req.body.email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (req.body.phone && !validatePhoneNumber(req.body.phone)) {
    return res.status(400).json({ message: "Invalid phone format" });
  }

  if (req.body.website && !validateURL(req.body.website)) {
    return res.status(400).json({ message: "Invalid URL format" });
  }

  // Check for SQL injection patterns
  const sqlInjectionPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINJECT\b|\bDROP\b|\bDELETE\b|--|;|\bOR\b|\bAND\b)/i,
  ];

  const bodyString = JSON.stringify(req.body);
  if (sqlInjectionPatterns.some(pattern => pattern.test(bodyString))) {
    console.warn(`[SECURITY] SQL injection attempt detected. IP: ${req.ip}`);
    return res.status(400).json({ message: "Invalid input detected" });
  }

  next();
}

// ==================== REQUEST SIZE LIMITS ====================
export function requestSizeValidator(req: Request, res: Response, next: NextFunction) {
  const contentLength = parseInt(req.headers["content-length"] || "0");
  const maxSize = 1024 * 1024; // 1MB

  if (contentLength > maxSize) {
    console.warn(
      `[SECURITY] Request too large. IP: ${req.ip}, Size: ${contentLength}/${maxSize}`
    );
    return res.status(413).json({ message: "Payload too large" });
  }

  next();
}

// ==================== SECURITY LOGGING ====================
interface SecurityEvent {
  type: string;
  ip: string;
  timestamp: string;
  path: string;
  method: string;
  userAgent: string;
  details?: any;
}

const securityLog: SecurityEvent[] = [];
const MAX_LOG_ENTRIES = 10000;

export function logSecurityEvent(
  type: string,
  req: Request,
  details?: any
): SecurityEvent {
  const event: SecurityEvent = {
    type,
    ip: req.ip || "unknown",
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userAgent: (req.headers["user-agent"] || "").substring(0, 100),
    details,
  };

  securityLog.push(event);
  if (securityLog.length > MAX_LOG_ENTRIES) {
    securityLog.shift();
  }

  return event;
}

export function getSecurityLog(type?: string, limit: number = 100): SecurityEvent[] {
  if (type) {
    return securityLog.filter(e => e.type === type).slice(-limit);
  }
  return securityLog.slice(-limit);
}

// ==================== RATE LIMIT PER ENDPOINT ====================
const endpointRateLimits = new Map<
  string,
  { count: number; resetTime: number }
>();

export function createEndpointRateLimiter(
  maxRequests: number,
  windowMs: number
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}:${req.method}`;
    const now = Date.now();

    let record = endpointRateLimits.get(key);

    if (!record || now > record.resetTime) {
      endpointRateLimits.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
    } else {
      record.count++;

      if (record.count > maxRequests) {
        logSecurityEvent("RATE_LIMIT_EXCEEDED", req, {
          maxRequests,
          attempts: record.count,
        });
        return res.status(429).json({
          message: `Rate limit exceeded: ${maxRequests} requests per ${windowMs / 1000}s`,
        });
      }
    }

    res.set("X-RateLimit-Limit", maxRequests.toString());
    res.set("X-RateLimit-Remaining", (maxRequests - (record?.count || 0)).toString());
    res.set("X-RateLimit-Reset", (record?.resetTime || 0).toString());

    next();
  };
}

// ==================== SECURE HEADERS ====================
export function setSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === "production";

  // HSTS: Enforce HTTPS (2 years, includeSubDomains, preload-ready)
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  // Content Security Policy — marketing pixels (Meta, LinkedIn, Bing, Clarity, GA) + Zoho
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://challenges.cloudflare.com https://static.cloudflareinsights.com https://salesiq.zoho.com https://*.clarity.ms https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://snap.licdn.com https://bat.bing.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "frame-src https://challenges.cloudflare.com https://meet.digerati-experts.com https://*.zoho.com https://payments.zoho.com https://www.facebook.com https://td.doubleclick.net",
    "connect-src 'self' https://*.zoho.com https://payments.zoho.com https://cloudflareinsights.com https://*.cloudflareinsights.com https://*.clarity.ms https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://www.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://bat.bing.com https://px.ads.linkedin.com https://www.linkedin.com" + (isProduction ? "" : " wss://*.replit.dev ws://localhost:*"),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://payments.zoho.com",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ];
  res.setHeader("Content-Security-Policy", cspDirectives.join("; "));

  // Portal, transactional store, and internal commercial tools must not rank
  const p = req.path || "";
  if (
    p.startsWith("/portal") ||
    p === "/login" ||
    p === "/signup" ||
    p.startsWith("/store/checkout") ||
    p.startsWith("/store/solution") ||
    p.startsWith("/store/cart") ||
    p.startsWith("/store/order-confirmation") ||
    p.startsWith("/store/quote-confirmation") ||
    p.startsWith("/store/quote-request") ||
    p === "/official-network-planner" ||
    p.startsWith("/official-network-planner/") ||
    p === "/de-ecosystem-matrix-offical" ||
    p.startsWith("/de-ecosystem-matrix-offical/")
  ) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy (OWASP recommended)
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );

  // Cross-Origin policies (OWASP recommended)
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  // Prevent cross-domain policy file loading
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // Prevent DNS prefetch abuse
  res.setHeader("X-DNS-Prefetch-Control", "off");

  // Remove server identification
  res.removeHeader("X-Powered-By");

  next();
}

// ==================== SECURE COOKIES ====================
export function getSecureCookieOptions() {
  return {
    httpOnly: true, // Not accessible via JavaScript
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict" as const, // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    signed: true,
  };
}

// ==================== IP WHITELIST/BLACKLIST ====================
const ipBlacklist = new Set<string>();
const ipWhitelist = new Set<string>();

export function addIPToBlacklist(ip: string): void {
  ipBlacklist.add(ip);
  console.log(`[SECURITY] IP blacklisted: ${ip}`);
}

export function addIPToWhitelist(ip: string): void {
  ipWhitelist.add(ip);
}

export function checkIPBlacklist(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "unknown";

  if (ipBlacklist.has(ip)) {
    console.warn(`[SECURITY] Blacklisted IP attempted access: ${ip}`);
    return res.status(403).json({ message: "Access denied" });
  }

  next();
}

// ==================== DUPLICATE REQUEST DETECTION ====================
const requestHashes = new Map<string, { timestamp: number; count: number }>();
const DUPLICATE_REQUEST_WINDOW = 5 * 60 * 1000; // 5 minutes
const DUPLICATE_REQUEST_THRESHOLD = 5;

export function detectDuplicateRequests(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD") {
    return next();
  }

  const bodyHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(req.body) + req.ip)
    .digest("hex");

  const key = `${req.path}:${bodyHash}`;
  const now = Date.now();

  let record = requestHashes.get(key);

  if (!record || now - record.timestamp > DUPLICATE_REQUEST_WINDOW) {
    requestHashes.set(key, {
      timestamp: now,
      count: 1,
    });
  } else {
    record.count++;
    record.timestamp = now;

    if (record.count > DUPLICATE_REQUEST_THRESHOLD) {
      console.warn(
        `[SECURITY] Duplicate request detected. IP: ${req.ip}, Path: ${req.path}, Count: ${record.count}`
      );
      return res.status(429).json({
        message: "Duplicate request detected. Please try again later.",
      });
    }
  }

  next();
}
