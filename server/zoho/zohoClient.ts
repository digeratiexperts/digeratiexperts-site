import axios, { AxiosInstance } from 'axios';

interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
  scope?: string;
}

class ZohoClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private deskAccessToken: string | null = null;
  private deskTokenExpiry: number = 0;
  private apiDomain: string = 'https://www.zohoapis.com';
  
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID_API || process.env.ZOHO_CLIENT_ID || '';
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET_API || process.env.ZOHO_CLIENT_SECRET || '';
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';
    
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      console.warn('⚠️ Zoho API credentials not fully configured');
    }
    const deskToken = this.getDeskRefreshToken();
    if (deskToken && deskToken !== this.refreshToken) {
      console.log(`✅ Zoho Desk OAuth token configured (prefix: ${deskToken.substring(0, 10)}...)`);
    }
  }

  private getDeskRefreshToken(): string {
    return process.env.ZOHO_DESK_REFRESH_TOKEN || process.env.ZOHO_FORM_OAUTH || this.refreshToken;
  }

  private async refreshAccessToken(): Promise<string> {
    try {
      const response = await axios.post<ZohoTokenResponse>(
        'https://accounts.zoho.com/oauth/v2/token',
        null,
        {
          params: {
            grant_type: 'refresh_token',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
          },
          timeout: 5000,
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      this.apiDomain = response.data.api_domain || this.apiDomain;
      
      console.log('✅ Zoho CRM access token refreshed');
      return this.accessToken;
    } catch (error: any) {
      console.error('❌ Failed to refresh Zoho CRM token:', error.response?.data || error.message);
      throw new Error('Failed to refresh Zoho access token');
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
        null,
        {
          params: {
            grant_type: 'refresh_token',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: token,
          },
          timeout: 5000,
        }
      );

      if (!response.data.access_token) {
        console.error('❌ Zoho Desk token response missing access_token:', JSON.stringify(response.data));
        throw new Error('No access token in Zoho Desk response');
      }
      this.deskAccessToken = response.data.access_token;
      this.deskTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      
      console.log(`✅ Zoho Desk access token refreshed (scopes: ${response.data.scope || 'unknown'})`);
      return this.deskAccessToken;
    } catch (error: any) {
      console.error('❌ Failed to refresh Zoho Desk token:', error.response?.data || error.message);
      throw new Error('Failed to refresh Zoho Desk access token');
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
      timeout: 8000,
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
      timeout: 8000,
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
      timeout: 15000,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
      maxBodyLength: 12 * 1024 * 1024,
      maxContentLength: 12 * 1024 * 1024,
    });
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.refreshToken);
  }

  isDeskConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.getDeskRefreshToken());
  }
}

export const zohoClient = new ZohoClient();
