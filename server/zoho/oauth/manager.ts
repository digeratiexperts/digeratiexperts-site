/**
 * Zoho OAuth token manager — the one place the website turns refresh tokens
 * into access tokens. CRM, Desk, Books and Payments each go through a
 * ZohoProductAuth instead of calling /oauth/v2/token themselves.
 *
 * Ported from Intelligence Hub lib/zoho-oauth/manager.ts. Rules
 * (docs/ZOHO-OAUTH-INVENTORY.md, Zoho token limits):
 *  - Access tokens live ~1h. They are cached in memory AND in the database,
 *    shared by every product that uses the same refresh token, and reused
 *    until 5 min before expiry — a restart or a health poll does not mint one.
 *  - Zoho allows 10 token requests per refresh token per 10 minutes. We spend
 *    at most REFRESH_BUDGET of them, one in flight at a time per token.
 *  - Failures are classified (token-endpoint.ts). Only `revoked`/`client`
 *    failures ever surface as "needs reconnect"; throttling and network/5xx
 *    errors are `degraded` with a backoff (issue #418).
 *  - A refresh token is always refreshed with the client that minted it: the
 *    Connect grant's stored client_id, or the product's own env client rule
 *    (e.g. resolveDeskOAuthConfig), never "whichever env client resolves first".
 *
 * Local deviations from the Hub: legacy credentials are env refresh tokens
 * supplied by each product's `legacySources()` (with their own client), their
 * state persists by fingerprint (store.readState/writeState), the Connect
 * grant is used only while ZOHO_CONNECT_ENABLED is on, and `notConfigured`
 * learns whether the product is unconfigured or needs a reconnect.
 */
import { createHash } from "node:crypto";
import { zohoDcFromUrl, zohoDefaultDc, type ZohoDcUrls } from "./dc";
import {
  callZohoTokenEndpoint,
  ZohoTokenError,
  type FetchLike,
} from "./token-endpoint";
import type { StoredZohoCredential, ZohoAuthStatus, ZohoStatePatch, ZohoTokenState, ZohoTokenStore } from "./store";
import { scopesCover, ZOHO_PRODUCT_LABELS, ZOHO_PRODUCT_SCOPES, type ZohoProduct } from "./scopes";

// ---- tunables -----------------------------------------------------------------

/** Refresh when the cached access token has less than this left. */
export const ACCESS_SKEW_MS = 5 * 60_000;
/** Max token-endpoint calls per refresh token per window (Zoho allows 10). */
export const REFRESH_BUDGET = 5;
export const REFRESH_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_COOLDOWN_MS = 10 * 60_000;
const TRANSIENT_BASE_MS = 30_000;
const TRANSIENT_MAX_MS = 15 * 60_000;
/** Re-check a client misconfiguration (env may have been fixed + restarted). */
const CLIENT_ERROR_RECHECK_MS = 60 * 60_000;
/** Re-check a revoked token rarely, in case Zoho's answer was a one-off. */
const REVOKED_RECHECK_MS = 6 * 60 * 60_000;
/** A 401 on a token younger than this is a scope/permission problem, not expiry. */
const FRESH_TOKEN_MS = 2 * 60_000;
/** How long a successful product probe is trusted by the health check. */
const PROBE_TTL_MS = 10 * 60_000;
/** How long resolved credential sources are cached between DB reads. */
const SOURCES_TTL_MS = 30_000;

/** The consolidated Zoho Connect grant (one refresh token for every product). */
export const UNIFIED_PROVIDER = "zoho";

// ---- errors -------------------------------------------------------------------

/** Zoho is throttling us or unreachable. The connection itself is fine. */
export class ZohoAuthUnavailableError extends Error {
  constructor(
    message: string,
    readonly retryAt: Date | null,
  ) {
    super(message);
    this.name = "ZohoAuthUnavailableError";
  }
}

export function isZohoAuthUnavailableError(err: unknown): err is ZohoAuthUnavailableError {
  return err instanceof ZohoAuthUnavailableError;
}

// ---- client credentials ---------------------------------------------------------

export interface ZohoClientCreds {
  id: string;
  secret: string;
}

/** Every env client pair the website knows about, in no particular priority. */
const KNOWN_CLIENT_ENV: ReadonlyArray<readonly [string, string]> = [
  ["ZOHO_CONNECT_CLIENT_ID", "ZOHO_CONNECT_CLIENT_SECRET"],
  ["ZOHO_CLIENT_ID_API", "ZOHO_CLIENT_SECRET_API"],
  ["ZOHO_DESK_CLIENT_ID", "ZOHO_DESK_CLIENT_SECRET"],
  ["ZOHO_BOOKS_CLIENT_ID", "ZOHO_BOOKS_CLIENT_SECRET"],
  ["ZOHO_PAYMENTS_CLIENT_ID", "ZOHO_PAYMENTS_CLIENT_SECRET"],
  ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET"],
];

function envPair(pair: readonly [string, string]): ZohoClientCreds | null {
  const id = process.env[pair[0]]?.trim();
  const secret = process.env[pair[1]]?.trim();
  return id && secret ? { id, secret } : null;
}

/** The secret for a specific client id, from any known env pair. */
export function clientById(clientId: string): ZohoClientCreds | null {
  for (const pair of KNOWN_CLIENT_ENV) {
    const c = envPair(pair);
    if (c && c.id === clientId) return c;
  }
  return null;
}

/** Client used by the server-based Zoho Connect flow. */
export function connectClient(): ZohoClientCreds | null {
  return envPair(["ZOHO_CONNECT_CLIENT_ID", "ZOHO_CONNECT_CLIENT_SECRET"]);
}

/** Feature flag for Zoho Connect: its routes, and products using its grant. */
export function isZohoConnectEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|yes|on)$/i.test(env.ZOHO_CONNECT_ENABLED?.trim() ?? "");
}

// ---- per-refresh-token runtime state (shared across products) -------------------

interface CredentialRuntime {
  accessToken: string | null;
  accessExpiresAt: number;
  accessMintedAt: number;
  refreshTimes: number[];
  inflight: Promise<string> | null;
  status: ZohoAuthStatus | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  nextAttemptAt: number;
  failureCount: number;
}

const runtimes = new Map<string, CredentialRuntime>();

/** Non-reversible id for a refresh token: runtime and env-state key, safe to log. */
export function fingerprint(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex").slice(0, 24);
}

function runtimeFor(refreshToken: string, row: ZohoTokenState | null): CredentialRuntime {
  const key = fingerprint(refreshToken);
  let rt = runtimes.get(key);
  if (!rt) {
    rt = {
      accessToken: row?.accessToken ?? null,
      accessExpiresAt: row?.accessExpiresAt?.getTime() ?? 0,
      accessMintedAt: 0,
      refreshTimes: [],
      inflight: null,
      status: row?.authStatus ?? null,
      lastError: row?.lastError ?? null,
      lastSuccessAt: row?.lastSuccessAt?.getTime() ?? null,
      nextAttemptAt: row?.nextAttemptAt?.getTime() ?? 0,
      failureCount: row?.failureCount ?? 0,
    };
    runtimes.set(key, rt);
  }
  return rt;
}

/** Test hook: forget all in-memory token state. */
export function resetZohoRuntimeForTests(): void {
  runtimes.clear();
  sourcesGeneration++;
}

/** Install a just-minted access token for a refresh token (shared by all products). */
export function primeZohoAccessToken(
  refreshToken: string,
  accessToken: string,
  expiresInSec: number,
  now = Date.now(),
): void {
  const rt = runtimeFor(refreshToken, null);
  rt.accessToken = accessToken;
  rt.accessMintedAt = now;
  rt.accessExpiresAt = now + expiresInSec * 1000;
  rt.status = "ok";
  rt.lastError = null;
  rt.lastSuccessAt = now;
  rt.nextAttemptAt = 0;
  rt.failureCount = 0;
}

let sourcesGeneration = 0;
/** Drop cached source resolution in every product (after a new grant is saved). */
export function invalidateZohoSources(): void {
  sourcesGeneration++;
}

// ---- product auth ---------------------------------------------------------------

/** A legacy env refresh token and the client its product refreshes it with. */
export interface LegacyEnvSource {
  /** The env var the refresh token came from: a name, never a value. */
  label: string;
  refreshToken: string;
  client: ZohoClientCreds | null;
}

/** Why a product cannot get a token: nothing set up, or Zoho refused it. */
export type ZohoAuthProblem = "not_configured" | "revoked" | "client";

export interface ZohoProductAuthConfig {
  product: ZohoProduct;
  /** Legacy env credentials in priority order; read on every source resolve. */
  legacySources: () => LegacyEnvSource[];
  /** Why there are no legacy sources (names missing settings, never values). */
  notConfiguredReason?: () => string | null;
  /** Product-specific error so existing callers keep their failure paths. */
  notConfigured: (message: string, problem: ZohoAuthProblem) => Error;
}

export type ZohoSourceKind = "unified" | "env";

interface CredentialSource {
  kind: ZohoSourceKind;
  label: string;
  refreshToken: string;
  client: ZohoClientCreds | null;
  clientProblem: string | null;
  /** Persisted state (grant row or env state row). */
  row: ZohoTokenState | null;
  orgId: string | null;
  apiDomain: string | null;
  accountsServer: string | null;
}

export interface ZohoAccess {
  token: string;
  apiDomain: string;
  dc: ZohoDcUrls;
  orgId: string | null;
  source: ZohoSourceKind;
  /** When the access token expires (ms since epoch). */
  expiresAt: number;
}

export type ZohoConnectionState =
  | "connected"
  | "degraded"
  | "needs_reconnect"
  | "not_configured"
  | "unknown";

export interface ZohoProductHealth {
  /** connected or degraded — the integration is set up and expected to work. */
  configured: boolean;
  /**
   * connected · degraded (throttled or unreachable; never a reconnect) ·
   * needs_reconnect (Zoho refused the token or client) · not_configured ·
   * unknown (credentials present, not tried yet; only from status()).
   */
  state: ZohoConnectionState;
  source: ZohoSourceKind | null;
  reason?: string;
  lastSuccessAt?: string;
  retryAt?: string;
}

export interface ZohoProductAuthDeps {
  store: ZohoTokenStore;
  fetchImpl?: FetchLike;
  now?: () => number;
  log?: (level: "info" | "warn", msg: string, meta?: Record<string, unknown>) => void;
  /** Override the flag (tests); defaults to isZohoConnectEnabled(). */
  connectEnabled?: () => boolean;
}

export class ZohoProductAuth {
  private lastGoodToken: string | null = null;
  private sourcesCache: { at: number; gen: number; sources: CredentialSource[] } | null = null;
  private lastProbeOkAt = 0;
  private apiAuthFailure: { at: number; message: string } | null = null;
  private probeInflight: Promise<ZohoProductHealth> | null = null;

  constructor(
    readonly config: ZohoProductAuthConfig,
    private readonly deps: ZohoProductAuthDeps,
  ) {}

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private get fetchImpl(): FetchLike {
    return this.deps.fetchImpl ?? fetch;
  }

  private log(level: "info" | "warn", msg: string, meta?: Record<string, unknown>): void {
    this.deps.log?.(level, `[zoho-oauth:${this.config.product}] ${msg}`, meta);
  }

  private connectEnabled(): boolean {
    return (this.deps.connectEnabled ?? isZohoConnectEnabled)();
  }

  label(): string {
    return ZOHO_PRODUCT_LABELS[this.config.product];
  }

  // ---- sources ----

  private sourceFromGrant(row: StoredZohoCredential): CredentialSource {
    let client: ZohoClientCreds | null = null;
    let clientProblem: string | null = null;
    if (row.clientId) {
      client = clientById(row.clientId);
      if (!client) {
        clientProblem =
          "The Zoho OAuth client that issued the Zoho Connect grant is no longer configured on the server (client id not found in env). Reconnect Zoho, or restore that client's id/secret.";
      }
    } else {
      client = connectClient();
      if (!client) clientProblem = "Zoho Connect client id/secret are not configured on the server.";
    }
    return {
      kind: "unified",
      label: "Zoho Connect",
      refreshToken: row.refreshToken,
      client,
      clientProblem,
      row,
      orgId: row.orgId,
      apiDomain: row.apiDomain,
      accountsServer: row.accountsServer,
    };
  }

  private async resolveSources(force = false): Promise<CredentialSource[]> {
    const c = this.sourcesCache;
    if (!force && c && c.gen === sourcesGeneration && this.now() - c.at < SOURCES_TTL_MS) {
      return c.sources;
    }
    const out: CredentialSource[] = [];
    const seen = new Set<string>();
    const push = (s: CredentialSource) => {
      if (seen.has(s.refreshToken)) return;
      seen.add(s.refreshToken);
      out.push(s);
    };

    if (this.connectEnabled()) {
      const unified = await this.deps.store.read(UNIFIED_PROVIDER).catch(() => null);
      if (unified && scopesCover(unified.scope, ZOHO_PRODUCT_SCOPES[this.config.product])) {
        push(this.sourceFromGrant(unified));
      }
    }
    for (const legacy of this.config.legacySources()) {
      const token = legacy.refreshToken.trim();
      if (!token || seen.has(token)) continue;
      const row = await this.deps.store.readState(fingerprint(token)).catch(() => null);
      // Every legacy env token lives in the server's configured DC.
      const dc = zohoDefaultDc();
      push({
        kind: "env",
        label: legacy.label,
        refreshToken: token,
        client: legacy.client,
        clientProblem: legacy.client ? null : "Zoho OAuth client id/secret are not configured on the server.",
        row,
        orgId: null,
        apiDomain: row?.apiDomain ?? null,
        accountsServer: dc.accounts,
      });
    }

    // The source that last worked goes first (after unified, which always wins
    // when it covers this product).
    if (this.lastGoodToken) {
      const i = out.findIndex((s) => s.refreshToken === this.lastGoodToken);
      const firstNonUnified = out.findIndex((s) => s.kind !== "unified");
      if (i > 0 && firstNonUnified >= 0 && i > firstNonUnified) {
        const [s] = out.splice(i, 1);
        out.splice(firstNonUnified, 0, s);
      }
    }
    this.sourcesCache = { at: this.now(), gen: sourcesGeneration, sources: out };
    return out;
  }

  // ---- access tokens ----

  private accessFrom(src: CredentialSource, token: string): ZohoAccess {
    const dc = zohoDcFromUrl(src.accountsServer, src.apiDomain);
    const rt = runtimeFor(src.refreshToken, src.row);
    return {
      token,
      apiDomain: (src.apiDomain || dc.api).replace(/\/$/, ""),
      dc,
      orgId: src.orgId,
      source: src.kind,
      expiresAt: rt.accessToken === token ? rt.accessExpiresAt : 0,
    };
  }

  private async persist(src: CredentialSource, patch: ZohoStatePatch) {
    try {
      if (src.kind === "unified") {
        await this.deps.store.patch(UNIFIED_PROVIDER, src.refreshToken, patch);
      } else {
        await this.deps.store.writeState(fingerprint(src.refreshToken), patch);
      }
    } catch (err) {
      this.log("warn", "could not persist token state", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async refresh(src: CredentialSource, rt: CredentialRuntime): Promise<string> {
    if (rt.inflight) return rt.inflight;
    const run = async (): Promise<string> => {
      const client = src.client!;
      const accounts = zohoDcFromUrl(src.accountsServer, src.apiDomain).accounts;
      rt.refreshTimes.push(this.now());
      try {
        const got = await callZohoTokenEndpoint(
          accounts,
          {
            grant_type: "refresh_token",
            client_id: client.id,
            client_secret: client.secret,
            refresh_token: src.refreshToken,
          },
          this.fetchImpl,
        );
        const now = this.now();
        rt.accessToken = got.accessToken;
        rt.accessMintedAt = now;
        rt.accessExpiresAt = now + got.expiresInSec * 1000;
        rt.status = "ok";
        rt.lastError = null;
        rt.lastSuccessAt = now;
        rt.nextAttemptAt = 0;
        rt.failureCount = 0;
        if (got.apiDomain) src.apiDomain = got.apiDomain;
        await this.persist(src, {
          accessToken: got.accessToken,
          accessExpiresAt: new Date(rt.accessExpiresAt),
          authStatus: "ok",
          lastError: null,
          lastSuccessAt: new Date(now),
          nextAttemptAt: null,
          failureCount: 0,
          clientId: client.id,
          ...(got.apiDomain ? { apiDomain: got.apiDomain } : {}),
        });
        this.log("info", "access token refreshed", { source: src.label });
        return got.accessToken;
      } catch (err) {
        const e =
          err instanceof ZohoTokenError
            ? err
            : new ZohoTokenError("transient", "unknown", err instanceof Error ? err.message : String(err));
        await this.recordFailure(src, rt, e);
        throw e;
      }
    };
    rt.inflight = run().finally(() => {
      rt.inflight = null;
    });
    return rt.inflight;
  }

  private async recordFailure(
    src: CredentialSource,
    rt: CredentialRuntime,
    error: ZohoTokenError,
  ): Promise<void> {
    const { kind, message } = error;
    const now = this.now();
    rt.failureCount += 1;
    rt.lastError = message;
    let wait: number;
    switch (kind) {
      case "revoked":
        rt.status = "revoked";
        wait = REVOKED_RECHECK_MS;
        break;
      case "client":
        rt.status = "client_error";
        wait = CLIENT_ERROR_RECHECK_MS;
        break;
      case "rate_limited":
        rt.status = "degraded";
        wait = RATE_LIMIT_COOLDOWN_MS;
        break;
      default:
        rt.status = "degraded";
        wait = Math.min(TRANSIENT_BASE_MS * 2 ** Math.min(rt.failureCount - 1, 10), TRANSIENT_MAX_MS);
    }
    rt.nextAttemptAt = now + wait;
    if (kind === "revoked" || kind === "client") {
      rt.accessToken = null;
      rt.accessExpiresAt = 0;
    }
    // Kind and Zoho's error code only: never a token, a secret or upstream text.
    this.log("warn", `refresh failed (${kind})`, { source: src.label, code: error.code, retryInMs: wait });
    await this.persist(src, {
      authStatus: rt.status,
      lastError: message.slice(0, 500),
      lastErrorAt: new Date(now),
      nextAttemptAt: new Date(rt.nextAttemptAt),
      failureCount: rt.failureCount,
      ...(kind === "revoked" || kind === "client" ? { accessToken: null, accessExpiresAt: null } : {}),
    });
  }

  private budgetRetryAt(rt: CredentialRuntime): number | null {
    const now = this.now();
    rt.refreshTimes = rt.refreshTimes.filter((t) => now - t < REFRESH_WINDOW_MS);
    if (rt.refreshTimes.length < REFRESH_BUDGET) return null;
    return rt.refreshTimes[0] + REFRESH_WINDOW_MS;
  }

  private notConfiguredMessage(): string {
    const why = this.config.notConfiguredReason?.() ?? null;
    return `${this.label()} is not connected${why ? `: ${why}` : ""}. Use Zoho Connect (docs/ZOHO-OAUTH-INVENTORY.md), or set its legacy refresh token.`;
  }

  /** Any credential at all (Connect grant covering this product, or env). */
  async hasCredentials(): Promise<boolean> {
    return (await this.resolveSources()).length > 0;
  }

  /**
   * A usable access token. `rejectedToken` = the token an API just answered
   * 401 for; it is dropped (unless it is brand new, which means a scope
   * problem that a refresh cannot fix).
   */
  async getAccess(opts: { rejectedToken?: string } = {}): Promise<ZohoAccess> {
    const sources = await this.resolveSources();
    if (!sources.length) {
      throw this.config.notConfigured(this.notConfiguredMessage(), "not_configured");
    }
    const now = this.now();
    const problems: string[] = [];
    let problem: ZohoAuthProblem = "client";
    const noteProblem = (message: string, kind: "revoked" | "client") => {
      problems.push(message);
      if (kind === "revoked") problem = "revoked";
    };
    let temporary: { message: string; retryAt: number } | null = null;
    const noteTemporary = (message: string, retryAt: number) => {
      if (!temporary || retryAt < temporary.retryAt) temporary = { message, retryAt };
    };

    for (const src of sources) {
      const rt = runtimeFor(src.refreshToken, src.row);

      if (opts.rejectedToken && rt.accessToken === opts.rejectedToken) {
        if (now - rt.accessMintedAt < FRESH_TOKEN_MS) {
          // Fresh token still rejected: refreshing again cannot help.
          return this.accessFrom(src, rt.accessToken);
        }
        rt.accessToken = null;
        rt.accessExpiresAt = 0;
      }

      if (rt.accessToken && rt.accessExpiresAt - now > ACCESS_SKEW_MS) {
        this.lastGoodToken = src.refreshToken;
        return this.accessFrom(src, rt.accessToken);
      }

      if (src.clientProblem || !src.client) {
        noteProblem(src.clientProblem ?? "Zoho OAuth client not configured.", "client");
        continue;
      }

      if (rt.nextAttemptAt > now) {
        if (rt.status === "revoked" || rt.status === "client_error") {
          noteProblem(rt.lastError ?? "Zoho rejected this connection.", rt.status === "revoked" ? "revoked" : "client");
        } else {
          // Still-valid (but near expiry) token beats waiting.
          if (rt.accessToken && rt.accessExpiresAt > now) return this.accessFrom(src, rt.accessToken);
          noteTemporary(rt.lastError ?? "Zoho token refresh is backing off.", rt.nextAttemptAt);
        }
        continue;
      }

      const budgetAt = this.budgetRetryAt(rt);
      if (budgetAt !== null && !rt.inflight) {
        if (rt.accessToken && rt.accessExpiresAt > now) return this.accessFrom(src, rt.accessToken);
        noteTemporary("Zoho token refresh budget reached; waiting to stay under Zoho's limit.", budgetAt);
        continue;
      }

      try {
        const token = await this.refresh(src, rt);
        this.lastGoodToken = src.refreshToken;
        return this.accessFrom(src, token);
      } catch (err) {
        const e = err as ZohoTokenError;
        if (e.kind === "revoked" || e.kind === "client") {
          noteProblem(e.message, e.kind);
        } else {
          noteTemporary(e.message, rt.nextAttemptAt);
        }
      }
    }

    if (temporary) {
      const t = temporary as { message: string; retryAt: number };
      throw new ZohoAuthUnavailableError(
        `${this.label()} is temporarily unavailable: ${t.message} Retrying automatically — no reconnect needed.`,
        new Date(t.retryAt),
      );
    }
    throw this.config.notConfigured(
      `${this.label()} needs to be reconnected: ${problems.join(" | ") || "Zoho rejected the stored token."}`,
      problem,
    );
  }

  /**
   * Run an authenticated request, retrying once with a new access token on a
   * 401. Records the API outcome for the health check.
   */
  async fetchWithAuth(doFetch: (access: ZohoAccess) => Promise<Response>): Promise<Response> {
    let access = await this.getAccess();
    let resp = await doFetch(access);
    if (resp.status === 401) {
      const retry = await this.getAccess({ rejectedToken: access.token });
      if (retry.token !== access.token) {
        access = retry;
        resp = await doFetch(access);
      }
    }
    this.noteApiResult(resp.status);
    return resp;
  }

  /**
   * Record a product API answer for the health check (for callers that use
   * axios instead of fetchWithAuth). A 401 on a fresh token means missing scopes.
   */
  noteApiResult(status: number): void {
    if (status >= 200 && status < 300) {
      this.apiAuthFailure = null;
    } else if (status === 401) {
      this.apiAuthFailure = {
        at: this.now(),
        message: `Zoho rejected a fresh access token for ${this.label()} (HTTP 401). The grant is probably missing this product's scopes: ${ZOHO_PRODUCT_SCOPES[this.config.product].join(", ")}.`,
      };
    }
  }

  /** Install a just-minted grant's access token so the first call needs no refresh. */
  primeAccessToken(refreshToken: string, accessToken: string, expiresInSec: number): void {
    primeZohoAccessToken(refreshToken, accessToken, expiresInSec, this.now());
    this.lastGoodToken = refreshToken;
  }

  /** Forget cached sources + probe results (after a new grant). */
  resetCaches(): void {
    this.sourcesCache = null;
    this.lastProbeOkAt = 0;
    this.apiAuthFailure = null;
    this.lastGoodToken = null;
  }

  // ---- health ----

  /** Health from stored/in-memory state only — never calls Zoho. */
  async status(): Promise<ZohoProductHealth> {
    let sources: CredentialSource[];
    try {
      sources = await this.resolveSources();
    } catch (err) {
      return {
        configured: false,
        state: "unknown",
        source: null,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
    if (!sources.length) {
      return {
        configured: false,
        state: "not_configured",
        source: null,
        reason: this.notConfiguredMessage(),
      };
    }
    const now = this.now();
    const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : undefined);

    if (this.apiAuthFailure && now - this.apiAuthFailure.at < PROBE_TTL_MS) {
      return {
        configured: false,
        state: "needs_reconnect",
        source: sources[0].kind,
        reason: this.apiAuthFailure.message,
      };
    }

    let degraded: ZohoProductHealth | null = null;
    let unknown: ZohoProductHealth | null = null;
    const problems: string[] = [];
    for (const src of sources) {
      const rt = runtimeFor(src.refreshToken, src.row);
      if (src.clientProblem) {
        problems.push(src.clientProblem);
        continue;
      }
      const hasAccess = !!rt.accessToken && rt.accessExpiresAt > now;
      if (hasAccess || rt.status === "ok") {
        return {
          configured: true,
          state: "connected",
          source: src.kind,
          lastSuccessAt: iso(rt.lastSuccessAt),
        };
      }
      if (rt.status === "degraded") {
        degraded ??= {
          configured: true,
          state: "degraded",
          source: src.kind,
          reason: rt.lastError ?? "Zoho is temporarily unavailable.",
          lastSuccessAt: iso(rt.lastSuccessAt),
          retryAt: iso(rt.nextAttemptAt || null),
        };
        continue;
      }
      if (rt.status === "revoked" || rt.status === "client_error") {
        problems.push(rt.lastError ?? "Zoho rejected this connection.");
        continue;
      }
      unknown ??= { configured: false, state: "unknown", source: src.kind };
    }
    if (degraded) return degraded;
    if (unknown) return unknown;
    return {
      configured: false,
      state: "needs_reconnect",
      source: sources[0].kind,
      reason: problems.join(" | ") || "Zoho rejected the stored token.",
    };
  }

  /**
   * Health for status endpoints: state-only when we already know the answer,
   * otherwise one cheap probe request (deduplicated, cached for 10 min).
   * Never turns a throttle or outage into "needs reconnect".
   */
  async check(probe: (access: ZohoAccess) => Promise<Response>): Promise<ZohoProductHealth> {
    const st = await this.status();
    if (st.state === "not_configured" || st.state === "needs_reconnect" || st.state === "degraded") {
      return st;
    }
    if (st.state === "connected" && this.now() - this.lastProbeOkAt < PROBE_TTL_MS) return st;
    if (this.probeInflight) return this.probeInflight;
    this.probeInflight = this.runProbe(probe).finally(() => {
      this.probeInflight = null;
    });
    return this.probeInflight;
  }

  private async runProbe(probe: (access: ZohoAccess) => Promise<Response>): Promise<ZohoProductHealth> {
    let resp: Response;
    try {
      resp = await this.fetchWithAuth(probe);
    } catch (err) {
      if (err instanceof ZohoAuthUnavailableError) {
        return {
          configured: true,
          state: "degraded",
          source: null,
          reason: err.message,
          retryAt: err.retryAt?.toISOString(),
        };
      }
      const st = await this.status();
      if (st.state === "needs_reconnect" || st.state === "not_configured") return st;
      // Network failure talking to the product API: not a credential problem.
      return {
        configured: true,
        state: "degraded",
        source: st.source,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
    const st = await this.status();
    if (resp.ok) {
      this.lastProbeOkAt = this.now();
      return { ...st, configured: true, state: "connected", reason: undefined };
    }
    if (resp.status === 429 || resp.status >= 500) {
      return {
        configured: true,
        state: "degraded",
        source: st.source,
        reason: `${this.label()} API answered HTTP ${resp.status}; retrying automatically.`,
      };
    }
    const text = await resp.text().catch(() => "");
    return {
      configured: false,
      state: "needs_reconnect",
      source: st.source,
      reason:
        resp.status === 401 || resp.status === 403
          ? `${this.label()} rejected the token (HTTP ${resp.status}) — the grant is missing scopes: ${ZOHO_PRODUCT_SCOPES[this.config.product].join(", ")}.`
          : `${this.label()} API answered HTTP ${resp.status}${text ? ` — ${text.slice(0, 200)}` : ""}.`,
    };
  }
}
