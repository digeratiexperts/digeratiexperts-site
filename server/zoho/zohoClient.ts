import axios, { AxiosInstance } from 'axios';
import { isStagingReview } from '../stagingReviewGuard';
import {
  ZohoOAuthError,
  classifyZohoTokenFailure,
} from './zohoOAuthErrors';

interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
  scope?: string;
}

export type DeskAuthStatus =
  | 'not_configured'
  | 'credentials_present'
  | 'ok'
  | 'auth_failed';

class ZohoClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private deskAccessToken: string | null = null;
  private deskTokenExpiry: number = 0;
  private apiDomain: string = 'https://www.zohoapis.com';
  private deskAuthStatus: DeskAuthStatus = 'not_configured';
  
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID_API || '';
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET_API || '';
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';
    
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      console.warn('⚠️ Zoho API credentials not fully configured');
    }
    if (this.clientId && this.clientSecret && this.getDeskRefreshToken()) {
      this.deskAuthStatus = 'credentials_present';
      console.log('✅ Zoho Desk OAuth credentials present (refresh validity not probed at boot)');
    }
  }

  private getDeskRefreshToken(): string {
    return process.env.ZOHO_DESK_REFRESH_TOKEN || process.env.ZOHO_FORM_OAUTH || this.refreshToken;
  }

  /** Last known Desk OAuth state — presence only until a refresh is attempted. */
  getDeskAuthStatus(): DeskAuthStatus {
    if (isStagingReview()) return 'not_configured';
    if (!(this.clientId && this.clientSecret && this.getDeskRefreshToken())) {
      return 'not_configured';
    }
    return this.deskAuthStatus === 'not_configured'
      ? 'credentials_present'
      : this.deskAuthStatus;
  }

  private crmRefreshPromise: Promise<string> | null = null;

  // Dedup concurrent refreshes (Zoho rate-limits refresh-token grants) and
  // send credentials in the POST body so they never land in URL/proxy logs.
  private async refreshAccessToken(): Promise<string> {
    if (this.crmRefreshPromise) {
      return this.crmRefreshPromise;
    }
    this.crmRefreshPromise = this._doRefreshCrmToken();
    try {
      return await this.crmRefreshPromise;
    } finally {
      this.crmRefreshPromise = null;
    }
  }

  private async _doRefreshCrmToken(): Promise<string> {
    try {
      const response = await axios.post<ZohoTokenResponse>(
        'https://accounts.zoho.com/oauth/v2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!response.data.access_token) {
        const code = classifyZohoTokenFailure(response.data);
        throw new ZohoOAuthError({
          message: 'No access token in Zoho CRM response',
          code,
          product: 'crm',
          zohoError:
            response.data && typeof response.data === 'object' && 'error' in response.data
              ? String((response.data as { error?: unknown }).error || '')
              : undefined,
        });
      }

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      this.apiDomain = response.data.api_domain || this.apiDomain;
      
      console.log('✅ Zoho CRM access token refreshed');
      return this.accessToken;
    } catch (error: any) {
      if (error instanceof ZohoOAuthError) throw error;
      const payload = error.response?.data;
      console.error('❌ Failed to refresh Zoho CRM token:', payload || error.message);
      throw new ZohoOAuthError({
        message: 'Failed to refresh Zoho access token',
        code: classifyZohoTokenFailure(payload),
        product: 'crm',
        zohoError:
          payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error || '')
            : undefined,
      });
    }
  }

  private deskRefreshPromise: Promise<string> | null = null;

  private async refreshDeskAccessToken(): Promise<string> {
    if (this.deskRefreshPromise) {
      return this.deskRefreshPromise;
    }
    
    this.deskRefreshPromise = this._doRefreshDeskToken();
    try {
      return await this.deskRefreshPromise;
    } finally {
      this.deskRefreshPromise = null;
    }
  }

  private async _doRefreshDeskToken(): Promise<string> {
    const token = this.getDeskRefreshToken();
    try {
      const response = await axios.post<ZohoTokenResponse>(
        'https://accounts.zoho.com/oauth/v2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: token,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!response.data.access_token) {
        const code = classifyZohoTokenFailure(response.data);
        this.deskAuthStatus = 'auth_failed';
        // Log error name only — never the refresh token or full client secret.
        console.error(
          '❌ Zoho Desk token response missing access_token:',
          response.data && typeof response.data === 'object' && 'error' in response.data
            ? String((response.data as { error?: unknown }).error)
            : 'incomplete_response',
        );
        throw new ZohoOAuthError({
          message: 'No access token in Zoho Desk response',
          code,
          product: 'desk',
          zohoError:
            response.data && typeof response.data === 'object' && 'error' in response.data
              ? String((response.data as { error?: unknown }).error || '')
              : undefined,
        });
      }
      this.deskAccessToken = response.data.access_token;
      this.deskTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      this.deskAuthStatus = 'ok';
      
      console.log(`✅ Zoho Desk access token refreshed (scopes: ${response.data.scope || 'unknown'})`);
      return this.deskAccessToken;
    } catch (error: any) {
      if (error instanceof ZohoOAuthError) {
        this.deskAuthStatus = 'auth_failed';
        throw error;
      }
      const payload = error.response?.data;
      this.deskAuthStatus = 'auth_failed';
      console.error(
        '❌ Failed to refresh Zoho Desk token:',
        payload && typeof payload === 'object' && 'error' in payload
          ? String(payload.error)
          : error.message,
      );
      throw new ZohoOAuthError({
        message: 'Failed to refresh Zoho Desk access token',
        code: classifyZohoTokenFailure(payload),
        product: 'desk',
        zohoError:
          payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error || '')
            : undefined,
      });
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      return this.refreshAccessToken();
    }
    return this.accessToken;
  }

  async getDeskAccessToken(): Promise<string> {
    if (!this.deskAccessToken || Date.now() >= this.deskTokenExpiry) {
      return this.refreshDeskAccessToken();
    }
    return this.deskAccessToken;
  }

  async getClient(): Promise<AxiosInstance> {
    const token = await this.getAccessToken();
    
    return axios.create({
      baseURL: this.apiDomain,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getDeskClient(): Promise<AxiosInstance> {
    const token = await this.getDeskAccessToken();
    
    return axios.create({
      baseURL: 'https://desk.zoho.com/api/v1',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /** Desk client without JSON Content-Type so multipart uploads can set their own boundary. */
  async getDeskUploadClient(): Promise<AxiosInstance> {
    const token = await this.getDeskAccessToken();

    return axios.create({
      baseURL: "https://desk.zoho.com/api/v1",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
      maxBodyLength: 12 * 1024 * 1024,
      maxContentLength: 12 * 1024 * 1024,
    });
  }

  // Staging review mode reports "not configured" so every existing caller
  // takes its established fail-closed path (skip CRM sync, friendly Desk
  // unavailable message) instead of writing to real Zoho records.
  // See server/stagingReviewGuard.ts.
  isConfigured(): boolean {
    if (isStagingReview()) return false;
    return !!(this.clientId && this.clientSecret && this.refreshToken);
  }

  isDeskConfigured(): boolean {
    if (isStagingReview()) return false;
    return !!(this.clientId && this.clientSecret && this.getDeskRefreshToken());
  }
}

export const zohoClient = new ZohoClient();
