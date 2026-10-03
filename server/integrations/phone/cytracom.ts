import type { PhoneData, PhoneExtension } from "./types";

/**
 * Cytracom Public API adapter (Cytracom UCaaS business phone, not ControlOne).
 *
 * Official docs, help.cytracom.com section "Cytracom's Public API":
 *   https://help.cytracom.com/hc/en-us/sections/360003366471-Cytracom-s-Public-API
 *   Introduction:     https://help.cytracom.com/hc/en-us/articles/360021690072-API-Introduction
 *   Token management: https://help.cytracom.com/hc/en-us/articles/360022561751-API-Token-Management
 *   Data Services:    https://help.cytracom.com/hc/en-us/articles/360021912211-API-Data-Services
 *
 * What the docs give us and what this adapter uses:
 * - Base URL https://api.cytracom.net/v1.0, authenticated with a token that a
 *   customer-account admin creates; the documented request is
 *   `curl --user token:<<YOUR-TOKEN>>`, i.e. HTTP Basic with user "token" and
 *   the token as the password.
 * - A token belongs to ONE customer account and only an admin of that account
 *   can create it, so the token itself is the per-company scope. There is no
 *   documented partner-wide token or tenant filter.
 * - GET /data/users lists extensions with their users: name, extension_number,
 *   email (null when no user is assigned). `limit` default 100, max 1000.
 *
 * Not used (see README.md): Insights (call detail records) is documented but
 * the list endpoint's response envelope could not be confirmed from the docs
 * in this session, so call history is left unconnected; the docs describe no
 * endpoint for phone registration status or voicemail counts.
 */

export const CYTRACOM_BASE_URL = "https://api.cytracom.net/v1.0";

/** Max `limit` for GET /data/users per the Data Services doc. */
const USERS_LIMIT = 1000;

/** Raised for any non-success answer; carries no token and no vendor body. */
export class CytracomError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = "CytracomError";
  }
}

type FetchLike = typeof fetch;

/** Documented example shape of GET /data/users (Data Services doc). */
type CytracomUser = { name?: unknown; extension_number?: unknown; email?: unknown };

function basicAuth(token: string): string {
  // `--user token:<<YOUR-TOKEN>>` (API Introduction doc).
  return `Basic ${Buffer.from(`token:${token}`, "utf8").toString("base64")}`;
}

/** Normalizes the documented /data/users body. Throws on an unexpected shape. */
export function mapCytracomUsers(body: unknown): Array<PhoneExtension & { email: string | null }> {
  const users = (body as { data?: { users?: unknown } } | null)?.data?.users;
  if (!Array.isArray(users)) throw new CytracomError("unexpected /data/users response shape", null);
  const out: Array<PhoneExtension & { email: string | null }> = [];
  for (const raw of users as CytracomUser[]) {
    if (!raw || typeof raw !== "object") continue;
    const extension = typeof raw.extension_number === "string" || typeof raw.extension_number === "number"
      ? String(raw.extension_number).trim()
      : "";
    if (!extension) continue;
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : `Ext ${extension}`;
    const email = typeof raw.email === "string" && raw.email.trim() ? raw.email.trim().toLowerCase() : null;
    out.push({ name, extension, assigned: email !== null, email });
  }
  out.sort((a, b) => a.extension.localeCompare(b.extension, undefined, { numeric: true }));
  return out;
}

/** GET /data/users for the account the token belongs to. */
export async function fetchCytracomUsers(token: string, fetchImpl: FetchLike = fetch) {
  // https://help.cytracom.com/hc/en-us/articles/360021912211-API-Data-Services
  const url = `${CYTRACOM_BASE_URL}/data/users?limit=${USERS_LIMIT}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: { authorization: basicAuth(token), accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "network error";
    throw new CytracomError(`GET /data/users ${reason}`, null);
  }
  if (!res.ok) throw new CytracomError(`GET /data/users answered HTTP ${res.status}`, res.status);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new CytracomError("GET /data/users returned non-JSON", res.status);
  }
  return mapCytracomUsers(body);
}

/** The page's data for one company, read with that company's own token. */
export async function loadCytracomPhoneData(
  token: string,
  userEmail: string | null,
  fetchImpl: FetchLike = fetch,
  now: () => Date = () => new Date(),
): Promise<PhoneData> {
  const users = await fetchCytracomUsers(token, fetchImpl);
  const me = userEmail ? userEmail.trim().toLowerCase() : "";
  const mine = me ? users.find((u) => u.email === me) ?? null : null;
  // Emails stay server-side: the page needs names and extensions only.
  const strip = ({ name, extension, assigned }: PhoneExtension): PhoneExtension => ({ name, extension, assigned });
  return {
    provider: "cytracom",
    extensions: users.map(strip),
    myExtension: mine ? strip(mine) : null,
    unavailable: ["phoneStatus", "recentCalls", "voicemail"],
    fetchedAt: now().toISOString(),
  };
}
