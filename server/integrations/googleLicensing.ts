/**
 * Google Workspace Enterprise License Manager: assign a licence to a user.
 *
 * DE's service account (GOOGLE_LICENSING_SERVICE_ACCOUNT: the JSON key, or
 * the JSON base64-encoded) is granted domain-wide delegation in each client's
 * Admin console for https://www.googleapis.com/auth/apps.licensing, and acts
 * as that client's super admin (the admin email linked in the patch bay).
 * Secrets come from the server environment only. Every call returns
 * { ok, error } and never throws.
 */
import { createSign } from "crypto";

const SCOPE = "https://www.googleapis.com/auth/apps.licensing";
const API = "https://licensing.googleapis.com/apps/licensing/v1";

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

function serviceAccount(): ServiceAccount | null {
  const raw = (process.env.GOOGLE_LICENSING_SERVICE_ACCOUNT || "").trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json);
    return sa?.client_email && sa?.private_key ? sa : null;
  } catch {
    return null;
  }
}

export function googleLicensingConfigured(): boolean {
  return serviceAccount() !== null;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const tokens = new Map<string, { token: string; expires: number }>();

async function token(adminEmail: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const sa = serviceAccount();
  if (!sa) return { ok: false, error: "GOOGLE_LICENSING_SERVICE_ACCOUNT not set on the server" };
  const hit = tokens.get(adminEmail.toLowerCase());
  if (hit && hit.expires > Date.now() + 60_000) return { ok: true, token: hit.token };
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: sa.client_email, sub: adminEmail, scope: SCOPE, aud, iat: now, exp: now + 3600 }),
  )}`;
  try {
    const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
    const res = await fetch(aud, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
      signal: AbortSignal.timeout(15_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      return {
        ok: false,
        error:
          data.error === "unauthorized_client"
            ? "Domain-wide delegation is not set up for DE's service account in this client's Google Admin"
            : data.error_description || data.error || `Token request failed (${res.status})`,
      };
    }
    tokens.set(adminEmail.toLowerCase(), { token: data.access_token, expires: Date.now() + Number(data.expires_in || 3000) * 1000 });
    return { ok: true, token: data.access_token };
  } catch (error: any) {
    return { ok: false, error: `Could not get a Google token: ${error?.message || error}` };
  }
}

/** Assigns productId/skuId to the user. Already holding that licence counts as done. */
export async function googleAssignLicense(
  adminEmail: string,
  productId: string,
  skuId: string,
  userEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const t = await token(adminEmail);
  if (!t.ok) return { ok: false, error: t.error };
  try {
    const res = await fetch(`${API}/product/${encodeURIComponent(productId)}/sku/${encodeURIComponent(skuId)}/user`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userEmail }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok || res.status === 409) return { ok: true };
    const data: any = await res.json().catch(() => null);
    if (res.status === 404) return { ok: false, error: `No user ${userEmail}, or the client has no ${skuId} subscription` };
    return { ok: false, error: data?.error?.message || `Google answered ${res.status}` };
  } catch (error: any) {
    return { ok: false, error: `Could not reach Google: ${error?.message || error}` };
  }
}
