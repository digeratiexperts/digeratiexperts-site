import {
  DE_STORE_CONSUMER_CHECKOUT_ENV,
  DE_STORE_ENABLED_ENV,
  DE_STORE_EXCLUDED_STATES_ENV,
  DE_STORE_PREVIEW_CATALOG_ENV,
  DE_STORE_STATE_BLOCKLIST_ENABLED_ENV,
  DE_STORE_STATE_LIST_MODE_ENV,
} from "@shared/deStoreContract";
import { parseRegionList, parseStateListMode, type StateListConfig } from "@shared/deStoreStateList";

const ENABLED = /^(1|true|yes|on)$/i;

export function isDeStoreEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ENABLED.test(env[DE_STORE_ENABLED_ENV]?.trim() ?? "");
}

export function isDeStoreConsumerCheckoutEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ENABLED.test(env[DE_STORE_CONSUMER_CHECKOUT_ENV]?.trim() ?? "");
}

export function isDeStorePreviewCatalogEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ENABLED.test(env[DE_STORE_PREVIEW_CATALOG_ENV]?.trim() ?? "");
}

export function readSiteStateListConfig(env: NodeJS.ProcessEnv = process.env): StateListConfig {
  const parsed = parseRegionList(env[DE_STORE_EXCLUDED_STATES_ENV] ?? "");
  return {
    enabled: ENABLED.test(env[DE_STORE_STATE_BLOCKLIST_ENABLED_ENV]?.trim() ?? ""),
    mode: parseStateListMode(env[DE_STORE_STATE_LIST_MODE_ENV]),
    regions: parsed.ok ? parsed.regions : [],
  };
}

export {
  DE_STORE_CONSUMER_CHECKOUT_ENV,
  DE_STORE_ENABLED_ENV,
  DE_STORE_EXCLUDED_STATES_ENV,
  DE_STORE_PREVIEW_CATALOG_ENV,
  DE_STORE_STATE_BLOCKLIST_ENABLED_ENV,
  DE_STORE_STATE_LIST_MODE_ENV,
};
