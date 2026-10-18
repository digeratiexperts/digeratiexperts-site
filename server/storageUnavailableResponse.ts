import type { Response } from "express";

/**
 * #378 / #395 residual: in production, `storage` throws StorageUnavailableError
 * (server/storage.ts) when the database is down. Routes gated by
 * requireDurableStorage already answer 503; a route that reaches `storage` in
 * its own try/catch would otherwise answer 500. Call this first in the catch.
 *
 * Matched by name + code rather than `instanceof` so it does not import the
 * storage module (and its database probe) and survives module re-instantiation.
 */
export const STORAGE_UNAVAILABLE_MESSAGE =
  "This service is temporarily unavailable. Please try again in a moment.";

export function isStorageUnavailableError(error: unknown): boolean {
  const e = error as { name?: unknown; code?: unknown } | null;
  return !!e && typeof e === "object" && e.name === "StorageUnavailableError" && e.code === "STORAGE_UNAVAILABLE";
}

/** Answers 503 and returns true for a storage-unavailable failure; false for any other error. */
export function sendStorageUnavailable(res: Response, error: unknown): boolean {
  if (!isStorageUnavailableError(error)) return false;
  if (!res.headersSent) {
    res.status(503).json({
      code: "STORAGE_UNAVAILABLE",
      message: STORAGE_UNAVAILABLE_MESSAGE,
      error: STORAGE_UNAVAILABLE_MESSAGE,
    });
  }
  return true;
}
