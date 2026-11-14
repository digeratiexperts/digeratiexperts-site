import { AUTORENEW_CONTRACT_ENV } from "@shared/autoRenewContract";

const ENABLED = /^(1|true|yes|on)$/i;

/**
 * Site-side switch for the Hub auto-renew subscription contract.
 * Disabled unless the env var is an explicit truthy value. Unset, empty,
 * "false", or any other value keeps the store on quote-only for gated SKUs
 * and hides portal cancel/list.
 */
export function isAutoRenewContractEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ENABLED.test(env[AUTORENEW_CONTRACT_ENV]?.trim() ?? "");
}

export { AUTORENEW_CONTRACT_ENV };
