import axios, { AxiosInstance } from 'axios';
import { isStagingReview } from '../stagingReviewGuard';
import {
  isZohoAuthUnavailableError,
  type ZohoAccess,
  type ZohoProductAuth,
  type ZohoProductHealth,
} from './oauth';
import {
  createCrmAuth,
  createDeskAuth,
  crmCredentialsPresent,
  deskCredentialsPresent,
  resolveDeskOAuthConfig,
} from './zohoAuth';
import { isZohoOAuthError } from './zohoOAuthErrors';

export { resolveDeskOAuthConfig, type DeskOAuthConfig } from './zohoAuth';

/**
 * Last known Desk OAuth state, synchronous, for /api/health's legacy
 * `zohoDesk` field. "degraded" (throttled or unreachable) is never
 * "auth_failed" (issue #418). The four-state health comes from deskHealth().
 */
export type DeskAuthStatus =
  | 'not_configured'
  | 'credentials_present'
  | 'ok'
  | 'degraded'
  | 'auth_failed';

/**
 * CRM and Desk access for the website. Tokens come from the token manager
 * (server/zoho/oauth): cached and persisted access tokens, one refresh in
 * flight per token, at most 5 refreshes per 10 minutes, classified errors and
 * the issuing client pinned per credential. API hosts come from the account's
 * data center, never a hardcoded zoho.com.
 */
export class ZohoClient {
  private deskAuthStatus: DeskAuthStatus = 'not_configured';
  private deskTokenExpiry = 0;
  readonly crmAuth: ZohoProductAuth;
  readonly deskAuth: ZohoProductAuth;

  constructor() {
    this.crmAuth = createCrmAuth();
    this.deskAuth = createDeskAuth();
    if (!crmCredentialsPresent()) {
      console.warn('⚠️ Zoho API credentials not fully configured');
    }
    const desk = resolveDeskOAuthConfig();
    if (desk.state === 'ready') {
      this.deskAuthStatus = 'credentials_present';
      console.log(
        `✅ Zoho Desk OAuth credentials present (${desk.dedicatedClient ? 'own Desk client' : 'shared CRM client'}; refresh validity not probed at boot)`,
      );
    } else if (desk.state === 'incomplete') {
      console.warn(
        `⚠️ Zoho Desk has its own OAuth client configured but is missing ${desk.missing.join(', ')}; the Desk API stays off until all three are set`,
      );
    }
  }

  /** Last known Desk OAuth state — presence only until a refresh is attempted. */
  getDeskAuthStatus(): DeskAuthStatus {
    if (isStagingReview()) return 'not_configured';
    if (!deskCredentialsPresent()) {
      return 'not_configured';
    }
    return this.deskAuthStatus === 'not_configured' ||
      (this.deskAuthStatus === 'ok' && Date.now() >= this.deskTokenExpiry)
      ? 'credentials_present'
      : this.deskAuthStatus;
  }

  async getAccessToken(): Promise<string> {
    return (await this.crmAuth.getAccess()).token;
  }

  private async deskAccess(opts: { rejectedToken?: string } = {}): Promise<ZohoAccess> {
    try {
      const access = await this.deskAuth.getAccess(opts);
      this.deskAuthStatus = 'ok';
      this.deskTokenExpiry = access.expiresAt;
      return access;
    } catch (error) {
      if (isZohoAuthUnavailableError(error)) {
        this.deskAuthStatus = 'degraded';
      } else if (isZohoOAuthError(error)) {
        this.deskAuthStatus = error.code === 'not_configured' ? 'not_configured' : 'auth_failed';
        // Code only: never the refresh token, a secret or Zoho's own text.
        console.error('❌ Zoho Desk token unavailable:', error.code);
      }
      throw error;
    }
  }

  async getDeskAccessToken(): Promise<string> {
    return (await this.deskAccess()).token;
  }

  /**
   * An axios client for one product. A 401 asks the manager for a new token
   * once (it refuses when the token is brand new: that is a scope problem)
   * and replays the request; a 401 rejects before Zoho acts on the request.
   */
  private authedClient(
    auth: ZohoProductAuth,
    access: ZohoAccess,
    renew: (rejectedToken: string) => Promise<ZohoAccess>,
    config: { baseURL: string; timeout?: number; json: boolean; maxBodyLength?: number; maxContentLength?: number },
  ): AxiosInstance {
    const { json, ...rest } = config;
    const instance = axios.create({
      ...rest,
      headers: {
        Authorization: `Zoho-oauthtoken ${access.token}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    instance?.interceptors?.response.use(
      (response) => {
        auth.noteApiResult(response.status);
        return response;
      },
      async (error) => {
        const original = error?.config;
        if (error?.response?.status === 401 && original && !original.__zohoRetried) {
          const next = await renew(access.token).catch(() => null);
          if (next && next.token !== access.token) {
            original.__zohoRetried = true;
            const authorization = `Zoho-oauthtoken ${next.token}`;
            if (typeof original.headers?.set === 'function') original.headers.set('Authorization', authorization);
            else original.headers = { ...original.headers, Authorization: authorization };
            return instance.request(original);
          }
        }
        if (error?.response?.status) auth.noteApiResult(error.response.status);
        throw error;
      },
    );
    return instance;
  }

  async getClient(): Promise<AxiosInstance> {
    const access = await this.crmAuth.getAccess();
    return this.authedClient(this.crmAuth, access, (rejectedToken) => this.crmAuth.getAccess({ rejectedToken }), {
      baseURL: access.apiDomain,
      json: true,
    });
  }

  async getDeskClient(): Promise<AxiosInstance> {
    const access = await this.deskAccess();
    return this.authedClient(this.deskAuth, access, (rejectedToken) => this.deskAccess({ rejectedToken }), {
      baseURL: `${access.dc.desk}/api/v1`,
      timeout: 15000,
      json: true,
    });
  }

  /** Desk client without JSON Content-Type so multipart uploads can set their own boundary. */
  async getDeskUploadClient(): Promise<AxiosInstance> {
    const access = await this.deskAccess();
    return this.authedClient(this.deskAuth, access, (rejectedToken) => this.deskAccess({ rejectedToken }), {
      baseURL: `${access.dc.desk}/api/v1`,
      timeout: 15000,
      json: false,
      maxBodyLength: 12 * 1024 * 1024,
      maxContentLength: 12 * 1024 * 1024,
    });
  }

  /** CRM health from stored state (no Zoho call): connected / degraded / needs_reconnect / not_configured. */
  async crmHealth(): Promise<ZohoProductHealth> {
    if (isStagingReview()) return { configured: false, state: 'not_configured', source: null };
    return this.crmAuth.status();
  }

  /** Desk health from stored state (no Zoho call). */
  async deskHealth(): Promise<ZohoProductHealth> {
    if (isStagingReview()) return { configured: false, state: 'not_configured', source: null };
    return this.deskAuth.status();
  }

  // Staging review mode reports "not configured" so every existing caller
  // takes its established fail-closed path (skip CRM sync, friendly Desk
  // unavailable message) instead of writing to real Zoho records.
  // See server/stagingReviewGuard.ts.
  isConfigured(): boolean {
    if (isStagingReview()) return false;
    return crmCredentialsPresent();
  }

  isDeskConfigured(): boolean {
    if (isStagingReview()) return false;
    return deskCredentialsPresent();
  }
}

export const zohoClient = new ZohoClient();
