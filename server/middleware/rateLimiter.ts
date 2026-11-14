import { createHash } from "node:crypto";
import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ============ SECURITY-HARDENED RATE LIMITERS ============

// Login attempts: STRICT - 5 attempts per 15 minutes
const tooManyAuthenticationAttempts = {
  message: "Too many authentication attempts. Please try again later.",
};

function requestIpKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip || "unknown")}`;
}

export function portalAccountRateLimitKey(req: Request): string {
  const candidate = [req.body?.email, req.body?.username]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  if (!candidate) return requestIpKey(req);
  const normalized = candidate.trim().toLowerCase();
  return `account:${createHash("sha256").update(normalized).digest("hex")}`;
}

// First boundary: source IP. Successful logins do not consume the failure budget.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: tooManyAuthenticationAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => req.method !== "POST",
});

// Second boundary: normalized account, so distributed attempts against one user
// do not evade the IP limiter. The key contains only a one-way digest.
export const loginAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: portalAccountRateLimitKey,
  message: tooManyAuthenticationAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const accountRecoveryIpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: "Too many account recovery requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const accountRecoveryAccountRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: portalAccountRateLimitKey,
  message: { message: "Too many account recovery requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const mfaVerificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: tooManyAuthenticationAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const sensitiveAccountRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: "Too many security-setting changes. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
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

// Payment: STRICT - 10 per hour (prevent payment spam/fraud)
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many payment attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
