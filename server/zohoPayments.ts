import crypto from "crypto";
import { isStagingReview } from "./stagingReviewGuard";

const ZOHO_PAYMENTS_BASE_URL = "https://payments.zoho.com/api/v1";
const ZOHO_ACCOUNTS_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_HOSTED_CHECKOUT_URL = "https://payments.zoho.com/hostedcheckout";
const ZOHO_METADATA_MAX_ITEMS = 5;
const ZOHO_METADATA_KEY_MAX_LENGTH = 20;
const ZOHO_METADATA_VALUE_MAX_LENGTH = 500;

interface ZohoPaymentSession {
  payment_session_id: string;
  url: string;
  status: string;
  access_key?: string;
}

interface ZohoLineItem {
  name: string;
  description?: string;
  amount: number;
  quantity: number;
}

interface ZohoTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

export interface ZohoPaymentWebhookEvent {
  eventType: string;
  paymentId: string | null;
  referenceNumber: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  currency: string | null;
  status: string | null;
  metadata: Array<{ key: string; value: string }>;
}

function safeText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

export class ZohoPaymentsService {
  private readonly accountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly signingKey: string;
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.accountId = process.env.ZOHO_PAYMENTS_ACCOUNT_ID || "";
    this.clientId =
      process.env.ZOHO_PAYMENTS_CLIENT_ID ||
      process.env.ZOHO_CLIENT_ID_API ||
      process.env.ZOHO_CLIENT_ID ||
      "";
    this.clientSecret =
      process.env.ZOHO_PAYMENTS_CLIENT_SECRET ||
      process.env.ZOHO_CLIENT_SECRET_API ||
      process.env.ZOHO_CLIENT_SECRET ||
      "";
    this.refreshToken = process.env.ZOHO_PAYMENTS_REFRESH_TOKEN || "";
    this.signingKey = process.env.ZOHO_PAYMENTS_SIGNING_KEY || "";
  }

  private looksConfigured(value: string): boolean {
    const v = (value || "").trim();
    if (!v) return false;
    const lower = v.toLowerCase();
    if (v.includes("<") || v.includes(">")) return false;
    if (lower.includes("your ") || lower.includes("placeholder") || lower.includes("changeme")) return false;
    return true;
  }

  isConfigured(): boolean {
    // Review instances never move money, regardless of credentials.
    if (isStagingReview()) return false;
    return [
      this.accountId,
      this.clientId,
      this.clientSecret,
      this.refreshToken,
      this.signingKey,
    ].every((value) => this.looksConfigured(value));
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        "Zoho Payments is not configured. Set account ID, OAuth client credentials, a Zoho Payments refresh token, and the webhook signing key.",
      );
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });

    const response = await fetch(ZOHO_ACCOUNTS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = (await response.json().catch(() => ({}))) as ZohoTokenResponse;
    if (!response.ok || !data.access_token) {
      console.error("[ZOHO PAYMENTS] OAuth refresh failed", {
        status: response.status,
        error: data.error || "missing_access_token",
      });
      throw new Error(`Zoho Payments OAuth refresh failed: ${response.status}`);
    }

    this.accessToken = data.access_token;
    const expiresInSeconds = Number(data.expires_in || 3600);
    this.accessTokenExpiresAt = Date.now() + Math.max(60, expiresInSeconds - 60) * 1000;
    return this.accessToken;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async paymentsFetch(path: string, init: RequestInit = {}, retryAuth = true): Promise<Response> {
    const token = await this.getAccessToken();
    const separator = path.includes("?") ? "&" : "?";
    const url = `${ZOHO_PAYMENTS_BASE_URL}${path}${separator}account_id=${encodeURIComponent(this.accountId)}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-oauthtoken ${token}`,
        ...(init.headers || {}),
      },
    });

    if (response.status === 401 && retryAuth) {
      this.accessToken = null;
      this.accessTokenExpiresAt = 0;
      return this.paymentsFetch(path, init, false);
    }

    return response;
  }

  async createPaymentSession(params: {
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    lineItems: ZohoLineItem[];
    totalAmount: number;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    /** Non-sensitive identifiers only. Do not include names, email addresses, phone numbers, or other PII. */
    metadata?: Record<string, string>;
  }): Promise<ZohoPaymentSession> {
    if (!Number.isFinite(params.totalAmount) || params.totalAmount <= 0) {
      throw new Error("Zoho Payments requires a positive payment amount.");
    }

    const orderNumber = safeText(params.orderNumber, 50);
    const lineSummary = params.lineItems
      .slice(0, 5)
      .map((item) => `${safeText(item.name, 80)} x${Math.max(1, Number(item.quantity) || 1)}`)
      .filter(Boolean)
      .join(", ");
    const description = safeText(
      lineSummary ? `Digerati Experts ${orderNumber}: ${lineSummary}` : `Digerati Experts ${orderNumber}`,
      500,
    );

    const metaData = Object.entries({ orderNumber, ...(params.metadata || {}) })
      .filter(([key, value]) => key && value !== undefined && value !== null)
      .slice(0, ZOHO_METADATA_MAX_ITEMS)
      .map(([key, value]) => ({
        key: safeText(key, ZOHO_METADATA_KEY_MAX_LENGTH),
        value: safeText(value, ZOHO_METADATA_VALUE_MAX_LENGTH),
      }));

    const payload = {
      amount: Number(params.totalAmount.toFixed(2)),
      currency: params.currency || "USD",
      expires_in: 900,
      description,
      invoice_number: orderNumber,
      reference_number: orderNumber,
      meta_data: metaData,
      max_retry_count: 3,
      configurations: {
        allowed_payment_methods: ["card", "ach_debit"],
        hosted_checkout_parameters: {
          name: safeText(params.customerName, 100),
          email: safeText(params.customerEmail, 254),
          description,
          success_url: params.successUrl,
          failure_url: params.cancelUrl,
          udf1: orderNumber,
        },
      },
    };

    const response = await this.paymentsFetch("/paymentsessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[ZOHO PAYMENTS] Create session failed", {
        status: response.status,
        code: data?.code,
        message: safeText(data?.message || data?.error, 300),
      });
      throw new Error(`Zoho Payments API error: ${response.status}`);
    }

    const session = data?.payments_session || data?.payment_session || data;
    const sessionId = session?.payments_session_id || session?.payment_session_id || session?.id;
    const accessKey = session?.access_key;
    if (!sessionId || !accessKey) {
      throw new Error("Zoho Payments returned an incomplete hosted-checkout session.");
    }

    return {
      payment_session_id: String(sessionId),
      access_key: String(accessKey),
      url: `${ZOHO_HOSTED_CHECKOUT_URL}/${encodeURIComponent(String(accessKey))}`,
      status: String(session?.status || "created"),
    };
  }

  async getPaymentSession(sessionId: string): Promise<any> {
    const safeSessionId = encodeURIComponent(String(sessionId || "").trim());
    if (!safeSessionId) {
      throw new Error("Payment session ID is required.");
    }

    const response = await this.paymentsFetch(`/paymentsessions/${safeSessionId}`, {
      method: "GET",
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[ZOHO PAYMENTS] Retrieve session failed", {
        status: response.status,
        code: data?.code,
        message: safeText(data?.message || data?.error, 300),
      });
      throw new Error(`Zoho Payments API error: ${response.status}`);
    }

    return data?.payments_session || data?.payment_session || data;
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signatureHeader: string,
    nowMs: number = Date.now(),
  ): boolean {
    if (!this.looksConfigured(this.signingKey) || !signatureHeader) {
      return false;
    }

    const fields = new Map<string, string>();
    for (const part of signatureHeader.split(",")) {
      const [key, ...rest] = part.trim().split("=");
      if (key && rest.length) fields.set(key.trim(), rest.join("=").trim());
    }
    const timestamp = fields.get("t") || "";
    const suppliedSignature = fields.get("v") || "";
    if (!timestamp || !suppliedSignature) {
      return false;
    }

    // Replay window: a signed event older (or newer) than the tolerance is
    // rejected. The timestamp may arrive in seconds or milliseconds.
    const timestampNum = Number(timestamp);
    if (!Number.isFinite(timestampNum)) {
      return false;
    }
    const timestampMs = timestampNum > 1e12 ? timestampNum : timestampNum * 1000;
    const REPLAY_TOLERANCE_MS = 5 * 60 * 1000;
    if (Math.abs(nowMs - timestampMs) > REPLAY_TOLERANCE_MS) {
      return false;
    }

    const payloadStr = typeof payload === "string" ? payload : payload.toString("utf-8");
    const expectedSignature = crypto
      .createHmac("sha256", this.signingKey)
      .update(`${timestamp}.${payloadStr}`)
      .digest("hex");

    const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (suppliedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
  }

  parseWebhookEvent(event: any): ZohoPaymentWebhookEvent {
    const payment = event?.event_object?.payment || event?.data?.payment || event?.data || {};
    const metadata = Array.isArray(payment?.meta_data)
      ? payment.meta_data
          .filter((item: any) => item && item.key !== undefined)
          .map((item: any) => ({ key: String(item.key), value: String(item.value ?? "") }))
      : [];

    return {
      eventType: String(event?.event_type || event?.type || ""),
      paymentId: payment?.payment_id ? String(payment.payment_id) : null,
      referenceNumber: payment?.reference_number ? String(payment.reference_number) : null,
      invoiceNumber: payment?.invoice_number ? String(payment.invoice_number) : null,
      amount: payment?.amount !== undefined ? String(payment.amount) : null,
      currency: payment?.currency ? String(payment.currency) : null,
      status: payment?.status ? String(payment.status) : null,
      metadata,
    };
  }
}

export const zohoPayments = new ZohoPaymentsService();