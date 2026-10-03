/**
 * Cached, fail-closed readiness for card checkout (#263).
 *
 * "Configured" only means the credential env vars are present. "Ready" means a
 * recent server-side probe proved the OAuth client + refresh token still mint
 * an access token. The public availability flag follows readiness, never mere
 * configuration:
 *
 * - unknown (never probed), failed, timed out or stale  => not ready;
 * - a successful probe is trusted for `okTtlMs`, a failed one for `failTtlMs`
 *   (shorter, so recovery shows up quickly);
 * - concurrent callers share one in-flight probe, so page views never fan out
 *   into one Zoho call each.
 */

export interface PaymentReadinessSnapshot {
  ready: boolean;
  /** "probe" when a probe produced the answer, "unknown" when none has completed. */
  source: "probe" | "unknown";
  checkedAt: number | null;
  error: string | null;
}

export interface PaymentReadinessOptions {
  /** Cheap check: env vars present. When false the probe is never run. */
  isConfigured: () => boolean;
  /** Proves the credentials work without creating a charge. Throw/false => not ready. */
  probe: () => Promise<boolean>;
  okTtlMs?: number;
  failTtlMs?: number;
  timeoutMs?: number;
  now?: () => number;
}

export const DEFAULT_OK_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_FAIL_TTL_MS = 60 * 1000;
export const DEFAULT_PROBE_TIMEOUT_MS = 5000;

export function createPaymentReadiness(options: PaymentReadinessOptions) {
  const okTtlMs = options.okTtlMs ?? DEFAULT_OK_TTL_MS;
  const failTtlMs = options.failTtlMs ?? DEFAULT_FAIL_TTL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const now = options.now ?? Date.now;

  let last: { ready: boolean; checkedAt: number; error: string | null } | null = null;
  let inFlight: Promise<boolean> | null = null;

  function fresh(): boolean {
    if (!last) return false;
    const ttl = last.ready ? okTtlMs : failTtlMs;
    return now() - last.checkedAt < ttl;
  }

  function record(ready: boolean, error: string | null) {
    last = { ready, checkedAt: now(), error };
  }

  async function runProbe(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("readiness probe timed out")), timeoutMs);
        (timer as any)?.unref?.();
      });
      const ok = (await Promise.race([options.probe(), timeout])) === true;
      record(ok, ok ? null : "probe returned not ready");
      return ok;
    } catch (error: any) {
      record(false, String(error?.message || error || "probe failed").slice(0, 200));
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    /** Fail-closed boolean for the public flag. */
    async isReady(): Promise<boolean> {
      if (!options.isConfigured()) return false;
      if (fresh()) return last!.ready;
      if (!inFlight) {
        inFlight = runProbe().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    /** Record a real-world failure (e.g. OAuth refresh failed during checkout). */
    markFailed(error: string) {
      record(false, error.slice(0, 200));
    },
    /** Internal-only metadata (freshness/source). Never expose `error` publicly. */
    snapshot(): PaymentReadinessSnapshot {
      if (!last) return { ready: false, source: "unknown", checkedAt: null, error: null };
      return { ready: last.ready && fresh(), source: "probe", checkedAt: last.checkedAt, error: last.error };
    },
  };
}

export type PaymentReadiness = ReturnType<typeof createPaymentReadiness>;
