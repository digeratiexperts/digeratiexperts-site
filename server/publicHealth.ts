/**
 * The part of GET /api/health an anonymous caller may see.
 *
 * Monitors need only "is it up, is the database there, are the Zoho tokens
 * working": production-health.yml reads `services.database`, and the Zoho
 * states are states only (docs/ZOHO-OAUTH-INVENTORY.md). Everything else in
 * the full map (deployed commit, env, port, which integrations are
 * configured, spool counts, staging-review state) tells an outsider how the
 * site is built and is kept for signed-in DE staff.
 */
export interface FullHealth {
  status: string;
  timestamp: string;
  uptime: number;
  services: {
    database: string;
    zohoDesk?: unknown;
    zoho?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PublicHealth {
  status: string;
  timestamp: string;
  uptime: number;
  services: { database: string; zohoDesk?: unknown; zoho?: unknown };
}

export function publicHealthView(full: FullHealth): PublicHealth {
  return {
    status: full.status,
    timestamp: full.timestamp,
    uptime: full.uptime,
    services: {
      database: full.services.database,
      zohoDesk: full.services.zohoDesk,
      zoho: full.services.zoho,
    },
  };
}
