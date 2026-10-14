/**
 * Persistence for Zoho OAuth credentials + token-manager state.
 *
 * The manager only depends on the ZohoTokenStore interface so it can be unit
 * tested with the in-memory store (docs/ZOHO-OAUTH-STANDARD.md in Intelligence
 * Hub). Secrets (refresh + access tokens) are encrypted at rest by the DB
 * store (db-store.ts).
 *
 * Local deviation from the Hub: the website has no per-product grant rows;
 * its legacy credentials are env refresh tokens. Their access token and health
 * are persisted as "state" rows keyed by a fingerprint of the refresh token
 * (readState/writeState), so a restart does not mint a new token, and the
 * refresh token itself is never copied into the database.
 */

export type ZohoAuthStatus = "ok" | "degraded" | "revoked" | "client_error";

/** Cached access token + health for one refresh token. No refresh token here. */
export interface ZohoTokenState {
  clientId: string | null;
  apiDomain: string | null;
  accessToken: string | null;
  accessExpiresAt: Date | null;
  authStatus: ZohoAuthStatus | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  lastSuccessAt: Date | null;
  nextAttemptAt: Date | null;
  failureCount: number;
}

/** A stored grant (the Zoho Connect grant): the refresh token plus its state. */
export interface StoredZohoCredential extends ZohoTokenState {
  provider: string;
  refreshToken: string;
  orgId: string | null;
  accountsServer: string | null;
  scope: string | null;
}

export interface ZohoGrantInput {
  provider: string;
  refreshToken: string;
  clientId: string;
  orgId?: string | null;
  apiDomain?: string | null;
  accountsServer?: string | null;
  scope?: string | null;
  accessToken?: string | null;
  accessExpiresAt?: Date | null;
}

export interface ZohoStatePatch {
  clientId?: string | null;
  apiDomain?: string | null;
  orgId?: string | null;
  accessToken?: string | null;
  accessExpiresAt?: Date | null;
  authStatus?: ZohoAuthStatus | null;
  lastError?: string | null;
  lastErrorAt?: Date | null;
  lastSuccessAt?: Date | null;
  nextAttemptAt?: Date | null;
  failureCount?: number;
}

export interface ZohoTokenStore {
  read(provider: string): Promise<StoredZohoCredential | null>;
  /** Insert/replace a grant. Resets all cached access + health state. */
  saveGrant(input: ZohoGrantInput): Promise<void>;
  /**
   * Patch state for `provider` only while its refresh token is still
   * `refreshToken` — a concurrent reconnect must never be clobbered by the
   * outcome of a refresh that used the old token.
   */
  patch(provider: string, refreshToken: string, patch: ZohoStatePatch): Promise<void>;
  remove(provider: string): Promise<void>;
  /** State for an env refresh token, by fingerprint (see fingerprint() in manager.ts). */
  readState(fingerprint: string): Promise<ZohoTokenState | null>;
  /** Upsert state for an env refresh token. */
  writeState(fingerprint: string, patch: ZohoStatePatch): Promise<void>;
}

function emptyState(): ZohoTokenState {
  return {
    clientId: null,
    apiDomain: null,
    accessToken: null,
    accessExpiresAt: null,
    authStatus: null,
    lastError: null,
    lastErrorAt: null,
    lastSuccessAt: null,
    nextAttemptAt: null,
    failureCount: 0,
  };
}

function applyPatch<T extends object>(row: T, patch: ZohoStatePatch): T {
  const next = { ...row };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (next as Record<string, unknown>)[k] = v;
  }
  return next;
}

/** In-memory store (tests, and the server when no database is reachable). */
export class MemoryZohoTokenStore implements ZohoTokenStore {
  readonly rows = new Map<string, StoredZohoCredential>();
  readonly states = new Map<string, ZohoTokenState>();

  async read(provider: string): Promise<StoredZohoCredential | null> {
    const row = this.rows.get(provider);
    return row ? { ...row } : null;
  }

  async saveGrant(input: ZohoGrantInput): Promise<void> {
    this.rows.set(input.provider, {
      ...emptyState(),
      provider: input.provider,
      refreshToken: input.refreshToken,
      clientId: input.clientId,
      orgId: input.orgId ?? null,
      apiDomain: input.apiDomain ?? null,
      accountsServer: input.accountsServer ?? null,
      scope: input.scope ?? null,
      accessToken: input.accessToken ?? null,
      accessExpiresAt: input.accessExpiresAt ?? null,
      authStatus: "ok",
      lastSuccessAt: input.accessToken ? new Date() : null,
    });
  }

  async patch(provider: string, refreshToken: string, patch: ZohoStatePatch): Promise<void> {
    const row = this.rows.get(provider);
    if (!row || row.refreshToken !== refreshToken) return;
    this.rows.set(provider, applyPatch(row, patch));
  }

  async remove(provider: string): Promise<void> {
    this.rows.delete(provider);
  }

  async readState(fingerprint: string): Promise<ZohoTokenState | null> {
    const row = this.states.get(fingerprint);
    return row ? { ...row } : null;
  }

  async writeState(fingerprint: string, patch: ZohoStatePatch): Promise<void> {
    const { orgId: _orgId, ...rest } = patch;
    this.states.set(fingerprint, applyPatch(this.states.get(fingerprint) ?? emptyState(), rest));
  }

  clear(): void {
    this.rows.clear();
    this.states.clear();
  }
}
