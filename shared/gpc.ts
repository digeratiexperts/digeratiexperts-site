/**
 * Global Privacy Control (GPC) is treated as an opt-out of sale or share,
 * which on this site means advertising / marketing pixels stay off.
 */

export const GPC_HEADER = "sec-gpc";
export const GPC_COOKIE = "de_gpc";

export function headerSignalsGpc(headerValue: string | string[] | undefined): boolean {
  if (headerValue == null) return false;
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return String(value).trim() === "1";
}

export function navigatorSignalsGpc(flag: unknown): boolean {
  return flag === true || flag === 1 || flag === "1";
}

export function cookieSignalsGpc(cookieHeaderOrJar: string | undefined): boolean {
  if (!cookieHeaderOrJar) return false;
  return /(?:^|;\s*)de_gpc=1(?:;|$)/.test(cookieHeaderOrJar);
}

/** Honors the JS flag or a Sec-GPC cookie set from the request header. */
export function clientSignalsGpc(navFlag: unknown, cookieHeaderOrJar?: string): boolean {
  return navigatorSignalsGpc(navFlag) || cookieSignalsGpc(cookieHeaderOrJar);
}

/** Marketing (sale/share) is off when GPC is present, even if a prior consent grant said otherwise. */
export function marketingAllowedByConsent(marketingChoice: boolean, gpc: boolean): boolean {
  if (gpc) return false;
  return marketingChoice === true;
}
