/**
 * Bounded retry for transient model-provider failures. One brief backoff,
 * then the caller falls back to the deterministic heuristic reply.
 * Disabled-provider results (null from withOpenAIGuard) are not retried.
 */

export const TRANSIENT_MODEL_MAX_ATTEMPTS = 2;
export const TRANSIENT_MODEL_BACKOFF_MS = 200;

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);
const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function statusOf(error: unknown): number | undefined {
  const err = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  return typeof status === "number" ? status : undefined;
}

export function isTransientModelError(error: unknown): boolean {
  if (!error) return false;
  const status = statusOf(error);
  if (status != null) return TRANSIENT_STATUS.has(status);
  const code = String((error as { code?: unknown }).code || "");
  if (TRANSIENT_CODES.has(code)) return true;
  const message = String((error as { message?: unknown }).message || error);
  return /\b(timeout|timed out|socket hang up|fetch failed|429|rate limit|overloaded|temporarily unavailable|ECONNRESET|ETIMEDOUT)\b/i.test(
    message,
  );
}

export async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTransientModelRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    backoffMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? TRANSIENT_MODEL_MAX_ATTEMPTS);
  const backoffMs = Math.max(0, options?.backoffMs ?? TRANSIENT_MODEL_BACKOFF_MS);
  const sleep = options?.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientModelError(error)) {
        throw error;
      }
      await sleep(backoffMs * attempt);
    }
  }
  throw lastError;
}
