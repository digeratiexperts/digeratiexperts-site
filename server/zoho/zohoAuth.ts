/**
 * The website's CRM and Desk token managers (server/zoho/oauth).
 *
 * Both products take their token from the one Zoho Connect grant, and only
 * from it (2026-11-06, issue #974): the legacy Self Client env refresh tokens
 * are no longer read. The grant is used while ZOHO_CONNECT_ENABLED is on and
 * its scopes cover the product. Inventory: docs/ZOHO-OAUTH-INVENTORY.md.
 */
import { createZohoProductAuth, zohoConnectCovers, type ZohoAuthProblem } from "./oauth";
import { ZohoOAuthError, type ZohoOAuthErrorCode } from "./zohoOAuthErrors";

const PROBLEM_CODES: Record<ZohoAuthProblem, ZohoOAuthErrorCode> = {
  not_configured: 'not_configured',
  revoked: 'invalid_refresh_token',
  client: 'invalid_client',
};

// One pair per ZohoClient (server/zoho/zohoClient.ts); production has one client.
export const createCrmAuth = () => createZohoProductAuth({
  product: 'crm',
  notConfigured: (message, problem) =>
    new ZohoOAuthError({ message, code: PROBLEM_CODES[problem], product: 'crm' }),
});

export const createDeskAuth = () => createZohoProductAuth({
  product: 'desk',
  notConfigured: (message, problem) =>
    new ZohoOAuthError({ message, code: PROBLEM_CODES[problem], product: 'desk' }),
});

/** Synchronous presence check (no Zoho call): the Connect grant covers CRM. */
export function crmCredentialsPresent(): boolean {
  return zohoConnectCovers('crm');
}

/** Synchronous presence check (no Zoho call): the Connect grant covers the Desk. */
export function deskCredentialsPresent(): boolean {
  return zohoConnectCovers('desk');
}
