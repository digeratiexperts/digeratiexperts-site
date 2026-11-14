import crypto from "crypto";
import { normalizePaymentAmount } from "./paymentIntegrity";

const ZOHO_PAYMENTS_BASE_URL = "https://payments.zoho.com/api/v1";
const ZOHO_ACCOUNTS_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_HOSTED_CHECKOUT_URL = "https://payments.zoho.com/hostedcheckout";
const ZOHO_METADATA_MAX_ITEMS = 5;
const ZOHO_METADATA_KEY_MAX_LENGTH = 20;
const ZOHO_METADATA_VALUE_MAX_LENGTH = 500;
const ZOHO_PAYMENT_REFERENCE_MAX_LENGTH = 50;
const ZOHO_REQUEST_TIMEOUT_MS = 4_000;

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
  eventId: string | null;
  eventTimeMs: number | null;
  liveMode: boolean | null;
  eventType: string;
  paymentId: string | null;
  paymentSessionId: string | null;
  referenceNumber: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  currency: string | null;
  status: string | null;
  metadata: Array<{ key: string; value: string }>;
}

export interface ZohoPaymentSessionSnapshot {
  paymentSessionId: string | null;
  referenceNumber: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  currency: string | null;
  status: string | null;
  payments: Array<{ paymentId: string; status: string }>;
}

export interface WebhookSignatureVerificationOptions {
  nowMs?: number;
  maxAgeMs?: number;
  futureToleranceMs?: number;
}

function safeText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function requiredPaymentReference(value: unknown): string {
  const reference = String(value ?? "").trim();
  if (!reference) throw new Error("Zoho Payments requires a payment reference.");
  if (reference.length > ZOHO_PAYMENT_REFERENCE_MAX_LENGTH) {
    throw new Error("Zoho Payments references must be 50 characters or fewer.");
  }
  return reference;
}

function isSensitiveMetadataKey(key: string): boolean {
  return /(email|name|phone|address|company)/i.test(key);
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

  private async fetchWithTimeout(input: string | URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ZOHO_REQUEST_TIMEOUT_MS);
    const upstreamSignal = init.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);

    if (upstreamSignal?.aborted) abortFromUpstream();
    else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    }
  }

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

    const response = await this.fetchWithTimeout(ZOHO_ACCOUNTS_TOKEN_URL, {
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
    const response = await this.fetchWithTimeout(url, {
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

    const orderNumber = requiredPaymentReference(params.orderNumber);
    const normalizedPayment = normalizePaymentAmount(
      params.totalAmount,
      params.currency || "USD",
    );
    const providerAmount = Number(normalizedPayment.amountDecimal);
    const providerRoundTrip = normalizePaymentAmount(providerAmount, normalizedPayment.currency);
    if (providerRoundTrip.amountMinor !== normalizedPayment.amountMinor) {
      throw new Error("Zoho Payments amount cannot be represented exactly.");
    }
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
      .filter(([key]) => !isSensitiveMetadataKey(key))
      .slice(0, ZOHO_METADATA_MAX_ITEMS)
      .map(([key, value]) => ({
        key: safeText(key, ZOHO_METADATA_KEY_MAX_LENGTH),
        value: safeText(value, ZOHO_METADATA_VALUE_MAX_LENGTH),
      }));

    const payload = {
      amount: providerAmount,
      currency: normalizedPayment.currency,
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

  async getPaymentSessionSnapshot(sessionId: string): Promise<ZohoPaymentSessionSnapshot> {
    const session = await this.getPaymentSession(sessionId);
    const payments = Array.isArray(session?.payments)
      ? session.payments
          .filter((payment: any) => payment?.payment_id || payment?.id)
          .map((payment: any) => ({
            paymentId: String(payment.payment_id || payment.id),
            status: String(payment.status || ""),
          }))
      : [];

    return {
      paymentSessionId: session?.payments_session_id || session?.payment_session_id || session?.id
        ? String(session.payments_session_id || session.payment_session_id || session.id)
        : null,
      referenceNumber: session?.reference_number ? String(session.reference_number) : null,
      invoiceNumber: session?.invoice_number ? String(session.invoice_number) : null,
      amount: session?.amount !== undefined ? String(session.amount) : null,
      currency: session?.currency ? String(session.currency) : null,
      status: session?.status ? String(session.status) : null,
      payments,
    };
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signatureHeader: string,
    options: WebhookSignatureVerificationOptions = {},
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

    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || timestampNumber <= 0) {
      return false;
    }
    const timestampMs = timestampNumber < 1_000_000_000_000
      ? timestampNumber * 1000
      : timestampNumber;
    const nowMs = options.nowMs ?? Date.now();
    const maxAgeMs = options.maxAgeMs ?? 5 * 60_000;
    const futureToleranceMs = options.futureToleranceMs ?? 60_000;
    if (timestampMs < nowMs - maxAgeMs || timestampMs > nowMs + futureToleranceMs) {
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

  parseWebhookPayload(payload: string | Buffer): Record<string, unknown> {
    const raw = typeof payload === "string" ? payload : payload.toString("utf-8");
    const numericEventId = raw.match(/"event_id"\s*:\s*(-?\d+)/);
    if (numericEventId && (!/^\d{1,40}$/.test(numericEventId[1]) || numericEventId[1] === "0")) {
      throw new Error("Zoho Payments webhook event_id is invalid.");
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Zoho Payments webhook payload must be a JSON object.");
    }
    if (numericEventId) parsed.event_id = numericEventId[1];
    return parsed;
  }

  parseWebhookEvent(event: any): ZohoPaymentWebhookEvent {
    const payment = event?.event_object?.payment || event?.data?.payment || event?.data || {};
    const metadata = Array.isArray(payment?.meta_data)
      ? payment.meta_data
          .filter((item: any) => item && item.key !== undefined)
          .map((item: any) => ({ key: String(item.key), value: String(item.value ?? "") }))
      : [];

    return {
      eventId: event?.event_id !== undefined && event?.event_id !== null
        ? String(event.event_id)
        : event?.id !== undefined && event?.id !== null
          ? String(event.id)
          : null,
      eventTimeMs: (() => {
        const raw = Number(event?.event_time ?? event?.created_time);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return raw < 1_000_000_000_000 ? raw * 1000 : raw;
      })(),
      liveMode: typeof event?.live_mode === "boolean" ? event.live_mode : null,
      eventType: String(event?.event_type || event?.type || ""),
      paymentId: payment?.payment_id ? String(payment.payment_id) : null,
      paymentSessionId: payment?.payments_session_id || payment?.payment_session_id
        ? String(payment.payments_session_id || payment.payment_session_id)
        : null,
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
