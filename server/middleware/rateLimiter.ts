import rateLimit from "express-rate-limit";

// ============ SECURITY-HARDENED RATE LIMITERS ============

// Login attempts: STRICT - 5 attempts per 15 minutes
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== "POST",
});

// Chat messages: 50 messages per 15 minutes (per user)
export const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many chat messages, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Desktop agent download: 100 requests per 15 minutes
export const agentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Agent rate limit exceeded",
  standardHeaders: true,
  legacyHeaders: false,
});

// Form submissions: STRICT - 10 per hour (prevents spam)
export const formSubmissionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many form submissions, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// API general: 300 requests per 15 minutes
export const apiGeneralRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health",
});

// Import operations: VERY STRICT - 5 per hour (expensive operations)
export const importRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many import requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment / checkout / order mutations: STRICT - 10 per hour (prevent spam/fraud).
// Factory kept testable so regression tests can use a tiny threshold.
export function createPaymentRateLimiter(overrides?: {
  windowMs?: number;
  max?: number;
  message?: string;
}) {
  return rateLimit({
    windowMs: overrides?.windowMs ?? 60 * 60 * 1000,
    max: overrides?.max ?? 10,
    message: overrides?.message ?? "Too many payment attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export const paymentRateLimiter = createPaymentRateLimiter();
