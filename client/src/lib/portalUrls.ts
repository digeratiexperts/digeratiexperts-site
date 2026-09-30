/**
 * Canonical Client Portal URLs.
 *
 * Never send marketing-site visitors through apex `/portal/*` — Cloudflare on
 * digeratexperts.com currently strips `/portal` and 301s to
 * `https://portal.digeratiexperts.com//login`. Always deep-link the portal host
 * with the `/portal` path intact.
 *
 * Canonical login: https://portal.digeratiexperts.com/portal/login
 */
import {
  PORTAL_DASHBOARD_PATH,
  PORTAL_MARKETPLACE_PATH,
  marketplaceReturnTo,
} from "@shared/portalReturnTo";

export const PORTAL_ORIGIN = "https://portal.digeratiexperts.com";
export const PORTAL_LOGIN = `${PORTAL_ORIGIN}/portal/login`;
export const PORTAL_FORGOT_PASSWORD = `${PORTAL_ORIGIN}/portal/forgot-password`;
export const PORTAL_HOME = `${PORTAL_ORIGIN}/portal`;
export const PORTAL_MARKETPLACE = `${PORTAL_ORIGIN}${PORTAL_MARKETPLACE_PATH}`;
export const PORTAL_TICKETS = `${PORTAL_ORIGIN}/portal/tickets`;
export const PORTAL_FILES = `${PORTAL_ORIGIN}/portal/files`;
export const PORTAL_CONTRACTS = `${PORTAL_ORIGIN}/portal/contracts`;
export const REMOTE_SUPPORT_HREF = "https://assist.zoho.com/";

export { PORTAL_MARKETPLACE_PATH };

export function portalLoginWithReturn(returnTo?: string): string {
  if (!returnTo) return PORTAL_LOGIN;
  const safe = marketplaceReturnTo(returnTo);
  const params = new URLSearchParams({ returnTo: safe });
  return `${PORTAL_LOGIN}?${params.toString()}`;
}

/** Existing clients leaving public Store should land in Client Marketplace, not portal home. */
export function portalMarketplaceLoginUrl(): string {
  const params = new URLSearchParams({ returnTo: PORTAL_MARKETPLACE_PATH });
  return `${PORTAL_LOGIN}?${params.toString()}`;
}

export function portalReturnLabel(returnTo: string): string {
  const safe = marketplaceReturnTo(returnTo);
  if (safe === PORTAL_MARKETPLACE_PATH) return "Client Marketplace";
  if (safe === PORTAL_DASHBOARD_PATH || safe === "/portal") return "Client Portal";
  return "your destination";
}
