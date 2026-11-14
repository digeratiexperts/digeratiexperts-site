/**
 * Global Privacy Control (GPC) is treated as an opt-out of sale or share,
 * which on this site means advertising / marketing pixels stay off.
 */

export const GPC_HEADER = "sec-gpc";

export function headerSignalsGpc(headerValue: string | string[] | undefined): boolean {
  if (headerValue == null) return false;
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return String(value).trim() === "1";
}

export function navigatorSignalsGpc(flag: unknown): boolean {
  return flag === true || flag === 1 || flag === "1";
}

/** Marketing (sale/share) is off when GPC is present, even if a prior consent grant said otherwise. */
export function marketingAllowedByConsent(marketingChoice: boolean, gpc: boolean): boolean {
  if (gpc) return false;
  return marketingChoice === true;
}
