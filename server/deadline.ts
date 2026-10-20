/**
 * Cap how long a caller waits on a promise.
 *
 * 2026-10-19/20 (#657, #656): Postgres dropped out from under the running
 * process. /healthz answered 503 in 0.3 s, but /api/health and
 * /api/zoho/desk/status sent no bytes for nine hours, because reads behind
 * them waited on the database with nothing to stop them, and one shared
 * in-flight probe pinned every later request to the same wait. The monitor
 * saw "unreachable" with no body; the Desk "Get Support" tab waited with it.
 *
 * withDeadline stops the caller waiting; it does not cancel the work. The
 * work's own result or rejection, when it arrives, goes nowhere (Promise.race
 * keeps a handler on it, so a late rejection is not "unhandled").
 */
export class DeadlineError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${ms} ms`);
    this.name = "DeadlineError";
  }
}

export function withDeadline<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(label, ms)), ms);
    (timer as any)?.unref?.();
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
