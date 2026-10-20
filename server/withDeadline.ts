/**
 * Bound an await that has no timeout of its own.
 *
 * On 2026-10-20 (#657) production answered /healthz with 503 in under a
 * second while /api/health and /api/zoho/desk/status never answered at all:
 * both read the Zoho token table through a database pool whose sockets had
 * gone dead, and a Postgres query through pg has no deadline unless one is
 * configured. The monitor read "no response body" and could not tell a hung
 * process from an unreachable host. Every await that leaves the process
 * (database, Zoho) now goes through here or carries its own timeout.
 */

export class DeadlineError extends Error {
  readonly deadlineMs: number;

  constructor(label: string, deadlineMs: number) {
    super(`${label} did not finish within ${deadlineMs}ms`);
    this.name = "DeadlineError";
    this.deadlineMs = deadlineMs;
  }
}

export function isDeadlineError(error: unknown): error is DeadlineError {
  return error instanceof DeadlineError || (error instanceof Error && error.name === "DeadlineError");
}

/**
 * Resolve or reject with `promise`, or reject with DeadlineError after `ms`.
 * The timer never keeps the process alive, and the original promise is left
 * to settle on its own (a hung socket is released by the pg query timeout).
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(label, ms)), ms);
    if (typeof timer === "object" && typeof (timer as { unref?: () => void }).unref === "function") {
      (timer as { unref: () => void }).unref();
    }
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
