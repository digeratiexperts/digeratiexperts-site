/**
 * The website's CRM and Desk token managers (server/zoho/oauth): which
 * credentials each product may use, in order, and with which OAuth client.
 *
 * Order per product: the Zoho Connect grant (when ZOHO_CONNECT_ENABLED is on
 * and its scopes cover the product) → the legacy env refresh token. Each
 * legacy token is always refreshed with the client its rule names, so adding
 * a variable for one product can never change another product's client.
 * Inventory: docs/ZOHO-OAUTH-INVENTORY.md.
 */
import { createZohoProductAuth, zohoConnectCovers, type LegacyEnvSource, type ZohoAuthProblem } from "./oauth";
import { ZohoOAuthError, type ZohoOAuthErrorCode } from "./zohoOAuthErrors";

/**
 * The OAuth client and refresh token the Desk refreshes with (PR #555).
 *
 * - ZOHO_DESK_CLIENT_ID / ZOHO_DESK_CLIENT_SECRET set: the Desk has its own
 *   Zoho client (a Self Client of its own). Then all three Desk values must be
 *   set, ZOHO_DESK_REFRESH_TOKEN included, and none is borrowed from CRM: a
 *   refresh token only works with the client that issued it.
 * - Neither set: the legacy shared client (ZOHO_CLIENT_ID_API /
 *   ZOHO_CLIENT_SECRET_API) with ZOHO_DESK_REFRESH_TOKEN, then
 *   ZOHO_FORM_OAUTH, then ZOHO_REFRESH_TOKEN.
 *
 * "incomplete" names the missing variables only, never a value.
 */
export type DeskOAuthConfig =
  | {
      state: 'ready';
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      dedicatedClient: boolean;
      /** The env var the refresh token came from: a name, never a value. */
      refreshTokenVar: string;
    }
  | { state: 'incomplete'; missing: string[] }
  | { state: 'missing' };

export function resolveDeskOAuthConfig(env: NodeJS.ProcessEnv = process.env): DeskOAuthConfig {
  const deskClientId = env.ZOHO_DESK_CLIENT_ID?.trim() || '';
  const deskClientSecret = env.ZOHO_DESK_CLIENT_SECRET?.trim() || '';
  if (deskClientId || deskClientSecret) {
    const deskRefreshToken = env.ZOHO_DESK_REFRESH_TOKEN?.trim() || '';
    const missing = [
      ['ZOHO_DESK_CLIENT_ID', deskClientId],
      ['ZOHO_DESK_CLIENT_SECRET', deskClientSecret],
      ['ZOHO_DESK_REFRESH_TOKEN', deskRefreshToken],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) return { state: 'incomplete', missing };
    return {
      state: 'ready',
      clientId: deskClientId,
      clientSecret: deskClientSecret,
      refreshToken: deskRefreshToken,
      dedicatedClient: true,
      refreshTokenVar: 'ZOHO_DESK_REFRESH_TOKEN',
    };
  }
  const clientId = env.ZOHO_CLIENT_ID_API || '';
  const clientSecret = env.ZOHO_CLIENT_SECRET_API || '';
  const refreshTokenVar = ['ZOHO_DESK_REFRESH_TOKEN', 'ZOHO_FORM_OAUTH', 'ZOHO_REFRESH_TOKEN'].find((name) => env[name]);
  const refreshToken = refreshTokenVar ? env[refreshTokenVar] || '' : '';
  if (!(clientId && clientSecret && refreshToken)) return { state: 'missing' };
  return { state: 'ready', clientId, clientSecret, refreshToken, dedicatedClient: false, refreshTokenVar: refreshTokenVar! };
}

/** CRM: ZOHO_REFRESH_TOKEN with ZOHO_CLIENT_ID_API / ZOHO_CLIENT_SECRET_API, unchanged. */
export function resolveCrmOAuthConfig(env: NodeJS.ProcessEnv = process.env): LegacyEnvSource | null {
  const id = env.ZOHO_CLIENT_ID_API || '';
  const secret = env.ZOHO_CLIENT_SECRET_API || '';
  const refreshToken = env.ZOHO_REFRESH_TOKEN || '';
  if (!(id && secret && refreshToken)) return null;
  return { label: 'ZOHO_REFRESH_TOKEN', refreshToken, client: { id, secret } };
}

const PROBLEM_CODES: Record<ZohoAuthProblem, ZohoOAuthErrorCode> = {
  not_configured: 'not_configured',
  revoked: 'invalid_refresh_token',
  client: 'invalid_client',
};

// One pair per ZohoClient (server/zoho/zohoClient.ts); production has one client.
export const createCrmAuth = () => createZohoProductAuth({
  product: 'crm',
  legacySources: () => {
    const crm = resolveCrmOAuthConfig();
    return crm ? [crm] : [];
  },
  notConfiguredReason: () => 'set ZOHO_CLIENT_ID_API, ZOHO_CLIENT_SECRET_API and ZOHO_REFRESH_TOKEN',
  notConfigured: (message, problem) =>
    new ZohoOAuthError({ message, code: PROBLEM_CODES[problem], product: 'crm' }),
});

export const createDeskAuth = () => createZohoProductAuth({
  product: 'desk',
  legacySources: () => {
    const desk = resolveDeskOAuthConfig();
    return desk.state === 'ready'
      ? [{ label: desk.refreshTokenVar, refreshToken: desk.refreshToken, client: { id: desk.clientId, secret: desk.clientSecret } }]
      : [];
  },
  notConfiguredReason: () => {
    const desk = resolveDeskOAuthConfig();
    return desk.state === 'incomplete' ? `missing ${desk.missing.join(', ')}` : null;
  },
  notConfigured: (message, problem) =>
    new ZohoOAuthError({ message, code: PROBLEM_CODES[problem], product: 'desk' }),
});

/** Synchronous presence checks (no Zoho call): a legacy credential or the Connect grant. */
export function crmCredentialsPresent(): boolean {
  return resolveCrmOAuthConfig() !== null || zohoConnectCovers('crm');
}

export function deskCredentialsPresent(): boolean {
  return resolveDeskOAuthConfig().state === 'ready' || zohoConnectCovers('desk');
}
