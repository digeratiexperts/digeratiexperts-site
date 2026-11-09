/**
 * Microsoft Graph: licence assignment in a client's Microsoft 365 tenant.
 *
 * One multi-tenant app registration in DE's tenant, consented in each client
 * tenant (Organization.Read.All + User.ReadWrite.All, application
 * permissions). Client-credentials tokens are taken per client tenant.
 *   Commercial and GCC: MS_GRAPH_CLIENT_ID, login.microsoftonline.com +
 *     graph.microsoft.com.
 *   GCC High: MS_GRAPH_GOV_CLIENT_ID (an app in Azure Government),
 *     login.microsoftonline.us + graph.microsoft.us.
 *
 * Two ways to prove the app's identity (docs/runbooks/msgraph-certificate-auth.md):
 *   - Certificate (preferred; the MS Admin worker is certificate-only). Used
 *     whenever any certificate setting is present for that app:
 *     MS_GRAPH_CERT_PRIVATE_KEY or MS_GRAPH_CERT_PRIVATE_KEY_PATH, plus
 *     MS_GRAPH_CERT or MS_GRAPH_CERT_PATH (GCC High: the MS_GRAPH_GOV_CERT_*
 *     equivalents). The token request carries a PS256-signed client assertion
 *     (RFC 7523) with the certificate's x5t#S256. A certificate setting that
 *     is present but unusable fails closed: the secret is NOT used instead.
 *   - Client secret (MS_GRAPH_CLIENT_SECRET / MS_GRAPH_GOV_CLIENT_SECRET): the
 *     fallback while no certificate is configured; health then warns.
 * Key material comes from the server environment only and is never logged.
 * Every call returns { ok, error } and never throws.
 */
import { constants, createHash, createPrivateKey, randomUUID, sign, X509Certificate, type KeyObject } from "crypto";
import { readFileSync } from "fs";
import type { MicrosoftCloud } from "@shared/vendorPush";

type Endpoints = { login: string; graph: string; idVar: string; secretVar: string; certPrefix: string };
const CLOUDS: Record<MicrosoftCloud, Endpoints> = {
  commercial: { login: "https://login.microsoftonline.com", graph: "https://graph.microsoft.com", idVar: "MS_GRAPH_CLIENT_ID", secretVar: "MS_GRAPH_CLIENT_SECRET", certPrefix: "MS_GRAPH_CERT" },
  gcc: { login: "https://login.microsoftonline.com", graph: "https://graph.microsoft.com", idVar: "MS_GRAPH_CLIENT_ID", secretVar: "MS_GRAPH_CLIENT_SECRET", certPrefix: "MS_GRAPH_CERT" },
  gcc_high: { login: "https://login.microsoftonline.us", graph: "https://graph.microsoft.us", idVar: "MS_GRAPH_GOV_CLIENT_ID", secretVar: "MS_GRAPH_GOV_CLIENT_SECRET", certPrefix: "MS_GRAPH_GOV_CERT" },
};

export const MS_GRAPH_SECRET_WARNING =
  "Microsoft Graph signs in with a client secret; the MS Admin worker is certificate-only. Upload the certificate and remove the secret (docs/runbooks/msgraph-certificate-auth.md).";

/** The certificate env var names for one app (names only, never values). */
export function msGraphCertVars(cloud: MicrosoftCloud) {
  const p = CLOUDS[cloud].certPrefix;
  return { key: `${p}_PRIVATE_KEY`, keyPath: `${p}_PRIVATE_KEY_PATH`, cert: p, certPath: `${p}_PATH` };
}

type Cert = { key: KeyObject; x5tS256: string };
type CertResult = { state: "absent" } | { state: "ok"; cert: Cert } | { state: "invalid"; error: string };

const env = (name: string) => (process.env[name] || "").trim();
/** A PEM pasted into .env on one line usually carries literal "\n" sequences. */
const pem = (v: string) => v.replace(/\\n/g, "\n");

const certCache = new Map<string, CertResult>();

function readCert(cloud: MicrosoftCloud, raw: { key: string; keyPath: string; cert: string; certPath: string }): CertResult {
  const v = msGraphCertVars(cloud);
  let keyPem = raw.key ? pem(raw.key) : "";
  let certPem = raw.cert ? pem(raw.cert) : "";
  try {
    if (!keyPem && raw.keyPath) keyPem = readFileSync(raw.keyPath, "utf8");
  } catch {
    return { state: "invalid", error: `${v.keyPath} could not be read` };
  }
  try {
    if (!certPem && raw.certPath) certPem = readFileSync(raw.certPath, "utf8");
  } catch {
    return { state: "invalid", error: `${v.certPath} could not be read` };
  }
  if (!keyPem) return { state: "invalid", error: `${v.key} or ${v.keyPath} is required with the certificate` };
  if (!certPem) return { state: "invalid", error: `${v.cert} or ${v.certPath} is required with the private key` };
  let key: KeyObject;
  let x509: X509Certificate;
  try {
    key = createPrivateKey(keyPem);
  } catch {
    return { state: "invalid", error: `${v.key} is not a readable PEM private key` };
  }
  try {
    x509 = new X509Certificate(certPem);
  } catch {
    return { state: "invalid", error: `${v.cert} is not a readable PEM certificate` };
  }
  if (key.asymmetricKeyType !== "rsa") return { state: "invalid", error: "The Graph certificate must use an RSA key" };
  if (!x509.checkPrivateKey(key)) return { state: "invalid", error: "The Graph private key does not match the certificate" };
  if (Date.parse(x509.validTo) <= Date.now()) return { state: "invalid", error: "The Graph certificate has expired" };
  return { state: "ok", cert: { key, x5tS256: createHash("sha256").update(x509.raw).digest("base64url") } };
}

function loadCert(cloud: MicrosoftCloud): CertResult {
  const v = msGraphCertVars(cloud);
  const raw = { key: env(v.key), keyPath: env(v.keyPath), cert: env(v.cert), certPath: env(v.certPath) };
  if (!raw.key && !raw.keyPath && !raw.cert && !raw.certPath) return { state: "absent" };
  const cacheKey = createHash("sha256").update(JSON.stringify([cloud, raw])).digest("hex");
  const hit = certCache.get(cacheKey);
  if (hit && hit.state === "ok") return hit;
  // Unusable results are re-read each time, so a fixed file is picked up without a restart.
  const result = readCert(cloud, raw);
  if (result.state === "ok") certCache.set(cacheKey, result);
  return result;
}

type Creds =
  | (Endpoints & { id: string; mode: "certificate"; cert: Exclude<CertResult, { state: "absent" }> })
  | (Endpoints & { id: string; mode: "secret"; secret: string });

const creds = (cloud: MicrosoftCloud): Creds | null => {
  const c = CLOUDS[cloud];
  const id = env(c.idVar);
  if (!id) return null;
  const cert = loadCert(cloud);
  if (cert.state !== "absent") return { ...c, id, mode: "certificate", cert };
  const secret = env(c.secretVar);
  return secret ? { ...c, id, mode: "secret", secret } : null;
};

export function msGraphConfigured(cloud: MicrosoftCloud): boolean {
  return creds(cloud) !== null;
}

export function msGraphMissingVars(cloud: MicrosoftCloud): string {
  return `${CLOUDS[cloud].idVar} / ${CLOUDS[cloud].secretVar}`;
}

export type MsGraphAuthHealth = {
  /**
   * certificate: signs with the certificate · secret: the client-secret
   * fallback (with a warning) · invalid: a certificate setting is present but
   * unusable, so Graph fails closed · not_configured.
   */
  authMode: "certificate" | "secret" | "invalid" | "not_configured";
  warning?: string;
  /** Env var names and our own wording only, never a value. */
  error?: string;
};

/** Which credential a Graph app would use. Reads env and local files only; never calls Microsoft. */
export function msGraphAuthHealth(cloud: MicrosoftCloud): MsGraphAuthHealth {
  const c = creds(cloud);
  if (!c) return { authMode: "not_configured" };
  if (c.mode === "secret") return { authMode: "secret", warning: MS_GRAPH_SECRET_WARNING };
  if (c.cert.state === "invalid") return { authMode: "invalid", error: c.cert.error };
  return { authMode: "certificate" };
}

/** Health for both Graph apps: commercial and GCC share one, GCC High has its own. */
export function msGraphHealth(): { commercial: MsGraphAuthHealth; gccHigh: MsGraphAuthHealth } {
  return { commercial: msGraphAuthHealth("commercial"), gccHigh: msGraphAuthHealth("gcc_high") };
}

/** RFC 7523 client assertion for the Microsoft identity platform (certificate credentials), valid 10 minutes. */
export function msGraphClientAssertion(cert: Cert, clientId: string, tokenUrl: string, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "PS256", typ: "JWT", "x5t#S256": cert.x5tS256 });
  const body = b64({ aud: tokenUrl, iss: clientId, sub: clientId, jti: randomUUID(), iat: now, nbf: now, exp: now + 600 });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), {
    key: cert.key,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

const tokens = new Map<string, { token: string; expires: number }>();

async function token(tenant: string, cloud: MicrosoftCloud): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const c = creds(cloud);
  if (!c) return { ok: false, error: `${msGraphMissingVars(cloud)} not set on the server` };
  // A broken certificate fails closed; the secret is never used in its place.
  if (c.mode === "certificate" && c.cert.state === "invalid") return { ok: false, error: c.cert.error };
  const key = `${cloud}|${c.mode}|${tenant.toLowerCase()}`;
  const hit = tokens.get(key);
  if (hit && hit.expires > Date.now() + 60_000) return { ok: true, token: hit.token };
  try {
    const tokenUrl = `${c.login}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
    const body =
      c.mode === "secret"
        ? new URLSearchParams({
            client_id: c.id,
            client_secret: c.secret,
            grant_type: "client_credentials",
            scope: `${c.graph}/.default`,
          })
        : new URLSearchParams({
            client_id: c.id,
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            client_assertion: msGraphClientAssertion((c.cert as { state: "ok"; cert: Cert }).cert, c.id, tokenUrl),
            grant_type: "client_credentials",
            scope: `${c.graph}/.default`,
          });
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      return { ok: false, error: data.error_description?.split("\r\n")[0] || data.error || `Token request failed (${res.status})` };
    }
    tokens.set(key, { token: data.access_token, expires: Date.now() + Number(data.expires_in || 3000) * 1000 });
    return { ok: true, token: data.access_token };
  } catch (error: any) {
    return { ok: false, error: `Could not reach Microsoft sign-in: ${error?.message || error}` };
  }
}

async function graph<T>(
  tenant: string,
  cloud: MicrosoftCloud,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const t = await token(tenant, cloud);
  if (!t.ok) return { ok: false, status: 0, error: t.error };
  try {
    const res = await fetch(`${CLOUDS[cloud].graph}/v1.0${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: data?.error?.message || `Graph answered ${res.status}` };
    return { ok: true, status: res.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, error: `Could not reach Microsoft Graph: ${error?.message || error}` };
  }
}

export type MsSku = { skuId: string; skuPartNumber: string; enabled: number; consumed: number };

/** The tenant's subscriptions, so a part number becomes a skuId (and an empty subscription is caught). */
export async function msSubscribedSkus(tenant: string, cloud: MicrosoftCloud): Promise<{ ok: boolean; skus?: MsSku[]; error?: string }> {
  const r = await graph<{ value: any[] }>(tenant, cloud, "/subscribedSkus");
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    skus: (r.data?.value || []).map((s) => ({
      skuId: String(s.skuId),
      skuPartNumber: String(s.skuPartNumber),
      enabled: Number(s.prepaidUnits?.enabled ?? 0),
      consumed: Number(s.consumedUnits ?? 0),
    })),
  };
}

/** Adds one licence to one user (by UPN/email). Already-assigned counts as done. */
export async function msAssignLicense(
  tenant: string,
  cloud: MicrosoftCloud,
  userPrincipalName: string,
  skuId: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await graph(tenant, cloud, `/users/${encodeURIComponent(userPrincipalName)}/assignLicense`, {
    method: "POST",
    body: JSON.stringify({ addLicenses: [{ skuId, disabledPlans: [] }], removeLicenses: [] }),
  });
  if (r.ok) return { ok: true };
  if (r.status === 404) return { ok: false, error: `No user ${userPrincipalName} in this tenant` };
  if (/usage location/i.test(r.error || "")) return { ok: false, error: "The user has no usage location set in Entra; set it, then send again" };
  return { ok: false, error: r.error };
}
