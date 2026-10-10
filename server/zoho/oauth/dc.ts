/**
 * Zoho data-center (DC) host map.
 *
 * A Zoho account lives in exactly one DC, and every host — accounts (OAuth),
 * the unified API domain, and the product hosts that are NOT on the unified
 * API domain (Desk, Mail, Sign, Payments) — must come from that same DC. Zoho tells us
 * the DC on every token exchange (`api_domain`) and on the authorization
 * redirect (`accounts-server`, `location`); we derive the rest from this table
 * instead of hardcoding `.com` or reusing `api_domain` for products it does not
 * serve (Desk's API lives on desk.zoho.<dc>, not www.zohoapis.<dc>).
 */

export interface ZohoDcUrls {
  dc: string;
  accounts: string;
  api: string;
  desk: string;
  mail: string;
  sign: string;
  /** Zoho Payments API and hosted checkout (not on the unified API domain). */
  payments: string;
}

const DCS: Record<string, ZohoDcUrls> = {
  us: {
    dc: "us",
    accounts: "https://accounts.zoho.com",
    api: "https://www.zohoapis.com",
    desk: "https://desk.zoho.com",
    mail: "https://mail.zoho.com",
    sign: "https://sign.zoho.com",
    payments: "https://payments.zoho.com",
  },
  eu: {
    dc: "eu",
    accounts: "https://accounts.zoho.eu",
    api: "https://www.zohoapis.eu",
    desk: "https://desk.zoho.eu",
    mail: "https://mail.zoho.eu",
    sign: "https://sign.zoho.eu",
    payments: "https://payments.zoho.eu",
  },
  in: {
    dc: "in",
    accounts: "https://accounts.zoho.in",
    api: "https://www.zohoapis.in",
    desk: "https://desk.zoho.in",
    mail: "https://mail.zoho.in",
    sign: "https://sign.zoho.in",
    payments: "https://payments.zoho.in",
  },
  au: {
    dc: "au",
    accounts: "https://accounts.zoho.com.au",
    api: "https://www.zohoapis.com.au",
    desk: "https://desk.zoho.com.au",
    mail: "https://mail.zoho.com.au",
    sign: "https://sign.zoho.com.au",
    payments: "https://payments.zoho.com.au",
  },
  cn: {
    dc: "cn",
    accounts: "https://accounts.zoho.com.cn",
    api: "https://www.zohoapis.com.cn",
    desk: "https://desk.zoho.com.cn",
    mail: "https://mail.zoho.com.cn",
    sign: "https://sign.zoho.com.cn",
    payments: "https://payments.zoho.com.cn",
  },
  jp: {
    dc: "jp",
    accounts: "https://accounts.zoho.jp",
    api: "https://www.zohoapis.jp",
    desk: "https://desk.zoho.jp",
    mail: "https://mail.zoho.jp",
    sign: "https://sign.zoho.jp",
    payments: "https://payments.zoho.jp",
  },
  ca: {
    dc: "ca",
    accounts: "https://accounts.zohocloud.ca",
    api: "https://www.zohoapis.ca",
    desk: "https://desk.zohocloud.ca",
    mail: "https://mail.zohocloud.ca",
    sign: "https://sign.zohocloud.ca",
    payments: "https://payments.zohocloud.ca",
  },
  sa: {
    dc: "sa",
    accounts: "https://accounts.zoho.sa",
    api: "https://www.zohoapis.sa",
    desk: "https://desk.zoho.sa",
    mail: "https://mail.zoho.sa",
    sign: "https://sign.zoho.sa",
    payments: "https://payments.zoho.sa",
  },
};

export const DEFAULT_ZOHO_DC: ZohoDcUrls = DCS.us;

/**
 * The DC every legacy (env) credential lives in. DE's Zoho org is in the US
 * DC; ZOHO_ACCOUNTS_SERVER (e.g. https://accounts.zoho.eu) moves every legacy
 * token and API host together. A Zoho Connect grant carries its own DC.
 */
export function zohoDefaultDc(env: NodeJS.ProcessEnv = process.env): ZohoDcUrls {
  return zohoDcFromUrl(env.ZOHO_ACCOUNTS_SERVER);
}

/** Map a Zoho host suffix (after zoho/zohoapis/zohocloud) to a DC key. */
function dcKeyForHost(host: string): string | null {
  const h = host.toLowerCase();
  if (h.endsWith("zohocloud.ca") || h.endsWith("zohoapis.ca")) return "ca";
  const m = /(?:^|\.)zoho(?:apis)?\.(com\.au|com\.cn|com|eu|in|jp|sa)$/.exec(h);
  if (!m) return null;
  switch (m[1]) {
    case "com":
      return "us";
    case "com.au":
      return "au";
    case "com.cn":
      return "cn";
    default:
      return m[1];
  }
}

function hostOf(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).hostname;
  } catch {
    return null;
  }
}

/**
 * Resolve DC hosts from any Zoho URL we were handed (api_domain,
 * accounts-server, ...). Unknown or non-Zoho hosts fall back to the US DC so a
 * malformed value can never point a token at a foreign host.
 */
export function zohoDcFromUrl(...candidates: Array<string | null | undefined>): ZohoDcUrls {
  for (const c of candidates) {
    if (!c) continue;
    const host = hostOf(c);
    if (!host) continue;
    const key = dcKeyForHost(host);
    if (key && DCS[key]) return DCS[key];
  }
  return DEFAULT_ZOHO_DC;
}

/** True when `url` is an https Zoho accounts server we recognise. */
export function isZohoAccountsServer(url: string): boolean {
  const host = hostOf(url);
  if (!host || !url.trim().toLowerCase().startsWith("https://")) return false;
  return Object.values(DCS).some((d) => new URL(d.accounts).hostname === host);
}
