import type { Express, Request, RequestHandler, Response } from "express";
import { INTEGRATION_PROVIDERS, readIntegrationStatus, type IntegrationArea } from "./portalIntegrations";
import { listManualRecords, type ManualRecordKind } from "./portalManualRecords";
import { listClients } from "./portalAuthStore";
import { loadVpnData, readVpnClientMap, VPN_CLIENT_MAP_ENV } from "./integrations/vpn/index";
import {
  CYTRACOM_TOKEN_ENV_PREFIX,
  loadPhoneData,
  PHONE_CLIENT_MAP_ENV,
  phoneSetupStatus,
  readPhoneClientMap,
} from "./integrations/phone/index";
import { loadShippingData, readShippingClientMap, SHIPPING_CLIENT_MAP_ENV } from "./integrations/shipping/index";

/**
 * DE-admin "Data sources" setup page (/portal/admin/data-sources).
 *
 * When Joe gets a vendor key he needs to see which variables to set and to
 * confirm the page then works. This module answers that without ever reading
 * a secret out: the JSON carries env var NAMES and booleans ("set" / not set),
 * never a value.
 *
 *   GET  /api/portal/admin/data-sources        per area: mode, allowed values,
 *                                              each provider's env checklist;
 *                                              per company: mapping coverage;
 *                                              QA login variables set or not
 *   POST /api/portal/admin/data-sources/check  { area, clientId }: runs that
 *                                              area's live loader for one company
 *                                              and answers counts only
 *
 * Guards come from the caller: authMiddleware + requireAdmin.
 */

type Env = Record<string, string | undefined>;

// ---------- requirement table ----------

export type EnvSpec = {
  /** The environment variable name. Its value is never read out. */
  name: string;
  /** What it holds, in plain words. */
  purpose: string;
};

export type EnvGroup = {
  id: string;
  label: string;
  /**
   * all       every variable in the single option must be set
   * any       at least one option (a set of variables) must be fully set
   * optional  nothing is required; shown for completeness
   */
  rule: "all" | "any" | "optional";
  options: EnvSpec[][];
  /** Placeholder for something not built yet: never counts toward "ready". */
  reserved?: boolean;
};

export type ProviderRequirement = {
  label: string;
  /**
   * built     the adapter exists and PORTAL_<AREA>_PROVIDER accepts the value
   * notBuilt  the value is accepted but the adapter always answers "not available"
   * reserved  not accepted yet (no adapter); listed so the setup is known in advance
   */
  status: "built" | "notBuilt" | "reserved";
  /** Needs an entry per company in PORTAL_<AREA>_CLIENT_MAP. */
  needsClientMap: boolean;
  /** What a client-map value holds for this provider. */
  scopeHint?: string;
  groups: EnvGroup[];
  /** A variable per company, named by the client-map value (Cytracom tokens). */
  perCompanyEnv?: { pattern: string; purpose: string };
  note?: string;
};

export const AREA_LABELS: Record<IntegrationArea, string> = {
  vpn: "VPN Access",
  phone: "Cytracom Phone",
  shipping: "Ship Center",
};

export const AREA_PROVIDER_ENV: Record<IntegrationArea, string> = {
  vpn: "PORTAL_VPN_PROVIDER",
  phone: "PORTAL_PHONE_PROVIDER",
  shipping: "PORTAL_SHIPPING_PROVIDER",
};

export const AREA_CLIENT_MAP_ENV: Record<IntegrationArea, string> = {
  vpn: VPN_CLIENT_MAP_ENV,
  phone: PHONE_CLIENT_MAP_ENV,
  shipping: SHIPPING_CLIENT_MAP_ENV,
};

const CARRIER_TRACKING_GROUP: EnvGroup = {
  id: "carrier-tracking",
  label:
    "Carrier tracking (optional: each carrier with both its id and secret set gets live status; " +
    "PORTAL_CARRIER_TRACKING=off stops every lookup; PORTAL_CARRIER_<UPS|FEDEX|USPS>_ENV=sandbox for test hosts)",
  rule: "optional",
  options: [
    [
      { name: "PORTAL_CARRIER_UPS_CLIENT_ID", purpose: "UPS developer app client id" },
      { name: "PORTAL_CARRIER_UPS_CLIENT_SECRET", purpose: "UPS developer app client secret" },
    ],
    [
      { name: "PORTAL_CARRIER_FEDEX_CLIENT_ID", purpose: "FedEx developer project API key (client id)" },
      { name: "PORTAL_CARRIER_FEDEX_CLIENT_SECRET", purpose: "FedEx developer project secret key" },
    ],
    [
      { name: "PORTAL_CARRIER_USPS_CLIENT_ID", purpose: "USPS developer app consumer key (client id)" },
      { name: "PORTAL_CARRIER_USPS_CLIENT_SECRET", purpose: "USPS developer app consumer secret" },
    ],
  ],
};

/**
 * What each provider needs, from each area's README / adapter
 * (server/integrations/<area>/README.md). Add a provider here, in one place,
 * and the setup page lists it. Names marked reserved are placeholders until
 * their adapter lands.
 */
export const PROVIDER_REQUIREMENTS: Record<IntegrationArea, Record<string, ProviderRequirement>> = {
  vpn: {
    tailscale: {
      label: "Tailscale",
      status: "built",
      needsClientMap: true,
      scopeHint: 'a device tag per company, e.g. "tag:acme"',
      groups: [
        {
          id: "credentials",
          label: "Credentials: an OAuth client (preferred, does not expire) or an API key",
          rule: "any",
          options: [
            [
              { name: "PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID", purpose: "OAuth client id with device read access" },
              { name: "PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_SECRET", purpose: "OAuth client secret" },
            ],
            [{ name: "PORTAL_VPN_TAILSCALE_API_KEY", purpose: "API access token (tskey-api-..., expires in 1 to 90 days)" }],
          ],
        },
        {
          id: "tailnet",
          label: "Tailnet (optional; default is the token's own tailnet)",
          rule: "optional",
          options: [[{ name: "PORTAL_VPN_TAILSCALE_TAILNET", purpose: "Tailnet name" }]],
        },
      ],
    },
    twingate: {
      label: "Twingate",
      status: "built",
      needsClientMap: true,
      scopeHint: "a Twingate group id per company",
      groups: [
        {
          id: "credentials",
          label: "Network and Admin API token",
          rule: "all",
          options: [
            [
              { name: "PORTAL_VPN_TWINGATE_NETWORK", purpose: "Subdomain of <network>.twingate.com" },
              { name: "PORTAL_VPN_TWINGATE_API_KEY", purpose: "Admin API token (Settings > API)" },
            ],
          ],
        },
      ],
      note: "Run the devices query once in Twingate's API explorer before switching on (see the VPN README).",
    },
    perimeter81: {
      label: "Perimeter 81 (Harmony SASE)",
      status: "notBuilt",
      needsClientMap: false,
      groups: [],
      note: "No documented devices endpoint, so the page always says data isn't available.",
    },
    manual: {
      label: "Staff-entered (WireGuard / OpenVPN)",
      status: "built",
      needsClientMap: false,
      groups: [],
      note: "Nothing to set. View as the company and add devices on its VPN Access page, or import many at once with POST /api/portal/admin/manual-records/import (kind vpn_device).",
    },
    timus: {
      label: "Timus",
      status: "notBuilt",
      // The adapter does not read PORTAL_VPN_CLIENT_MAP yet; it will once Timus documents its API.
      needsClientMap: false,
      groups: [
        {
          id: "credentials",
          label: "Credentials (reserved; nothing reads them until the adapter is built)",
          rule: "optional",
          reserved: true,
          options: [
            [
              { name: "PORTAL_VPN_TIMUS_API_KEY", purpose: "Timus API credential (reserved)" },
              { name: "PORTAL_VPN_TIMUS_BASE_URL", purpose: "Timus API base URL (reserved)" },
            ],
          ],
        },
      ],
      note: "Not built: Timus publishes no API reference yet, so the page says data isn't available. See server/integrations/vpn/timus.ts.",
    },
  },
  phone: {
    cytracom: {
      label: "Cytracom",
      status: "built",
      needsClientMap: true,
      scopeHint: 'a token key per company, e.g. "ACME" (letters, digits, underscore)',
      groups: [
        {
          id: "call-history",
          label: "Call history (reserved; not built, nothing reads it yet)",
          rule: "optional",
          reserved: true,
          options: [[{ name: "PORTAL_PHONE_CALL_HISTORY", purpose: "Switch for call history once it is built" }]],
        },
      ],
      perCompanyEnv: {
        pattern: `${CYTRACOM_TOKEN_ENV_PREFIX}<KEY>`,
        purpose: "API token created by that company's Cytracom account admin (Users > Tokens)",
      },
    },
  },
  shipping: {
    shipstation: {
      label: "ShipStation",
      status: "built",
      needsClientMap: true,
      scopeHint: 'a ShipStation store id per company, e.g. "123456"',
      groups: [
        {
          id: "credentials",
          label: "API key and secret (Account Settings > API Settings)",
          rule: "all",
          options: [
            [
              { name: "PORTAL_SHIPPING_SHIPSTATION_API_KEY", purpose: "API key" },
              { name: "PORTAL_SHIPPING_SHIPSTATION_API_SECRET", purpose: "API secret" },
            ],
          ],
        },
      ],
    },
    easypost: {
      label: "EasyPost",
      status: "built",
      needsClientMap: true,
      scopeHint: '"user_<child user id>" or "reference:ACME-"',
      groups: [
        {
          id: "credentials",
          label: "Parent account production API key",
          rule: "all",
          options: [[{ name: "PORTAL_SHIPPING_EASYPOST_API_KEY", purpose: "Production API key" }]],
        },
      ],
    },
    shippo: {
      label: "Shippo",
      status: "built",
      needsClientMap: true,
      scopeHint: '"account:<Shippo account id>" or "metadata:ACME-"',
      groups: [
        {
          id: "credentials",
          label: "Live API token",
          rule: "all",
          options: [[{ name: "PORTAL_SHIPPING_SHIPPO_API_TOKEN", purpose: "Live token (shippo_live_...)" }]],
        },
      ],
    },
    manual: {
      label: "Staff-entered tracking",
      status: "built",
      needsClientMap: false,
      groups: [CARRIER_TRACKING_GROUP],
      note: "Nothing to set. View as the company and add tracking numbers on its Ship Center page, or import many at once with POST /api/portal/admin/manual-records/import (kind shipment).",
    },
  },
};

export const QA_LOGIN_ENV = { email: "PORTAL_QA_EMAIL", password: "PORTAL_QA_PASSWORD" } as const;

// ---------- status report ----------

const AREAS: IntegrationArea[] = ["vpn", "phone", "shipping"];

function isSet(env: Env, name: string): boolean {
  return typeof env[name] === "string" && env[name]!.trim().length > 0;
}

export type EnvVarCheck = EnvSpec & { set: boolean };

export type ProviderChecklist = {
  provider: string;
  label: string;
  status: ProviderRequirement["status"];
  active: boolean;
  needsClientMap: boolean;
  scopeHint: string | null;
  note: string | null;
  groups: Array<{
    id: string;
    label: string;
    rule: EnvGroup["rule"];
    reserved: boolean;
    satisfied: boolean;
    options: Array<{ vars: EnvVarCheck[]; complete: boolean }>;
  }>;
  perCompanyEnv: { pattern: string; purpose: string; mapped: number; set: number } | null;
  /** Every required variable is set (and, with a client map, the map parses). */
  ready: boolean;
};

export type CompanyCoverage = {
  /** Company has an entry in the area's client map (always false for providers without one). */
  mapped: boolean;
  /** The active provider needs no client map (manual). */
  noMapNeeded: boolean;
  /** Manual provider only: staff-entered records for this company. */
  records: number | null;
  /** Phone only: the token variable this company's map entry names is set. */
  tokenSet: boolean | null;
  /** Phone only: that variable's NAME (never its value); null when unmapped or the key is invalid. */
  tokenEnvName: string | null;
};

type CompanyLike = { id: string; companyName?: string | null; type?: string | null };

function readMap(area: IntegrationArea, env: Env): { map: Record<string, string>; error: boolean } {
  try {
    if (area === "vpn") return { map: readVpnClientMap(env), error: false };
    if (area === "phone") return { map: readPhoneClientMap(env), error: false };
    return { map: readShippingClientMap(env), error: false };
  } catch {
    return { map: {}, error: true };
  }
}

function buildChecklist(
  provider: string,
  req: ProviderRequirement,
  ctx: {
    env: Env;
    activeProvider: string | null;
    accepted: readonly string[];
    mapError: boolean;
    perCompanyCounts: { mapped: number; set: number };
  },
): ProviderChecklist {
  // A provider PORTAL_<AREA>_PROVIDER does not accept yet is a reservation, whatever the table says.
  const status: ProviderRequirement["status"] = ctx.accepted.includes(provider) ? req.status : "reserved";
  const groups = req.groups.map((g) => {
    const options = g.options.map((opt) => {
      const vars = opt.map((v) => ({ ...v, set: isSet(ctx.env, v.name) }));
      return { vars, complete: vars.every((v) => v.set) };
    });
    const satisfied = g.rule === "optional" ? true : options.some((o) => o.complete);
    return { id: g.id, label: g.label, rule: g.rule, reserved: !!g.reserved, satisfied, options };
  });
  let perCompanyEnv: ProviderChecklist["perCompanyEnv"] = null;
  if (req.perCompanyEnv) perCompanyEnv = { ...req.perCompanyEnv, ...ctx.perCompanyCounts };
  const ready =
    status === "built" &&
    groups.every((g) => g.satisfied) &&
    (!req.needsClientMap || !ctx.mapError) &&
    (!perCompanyEnv || perCompanyEnv.set === perCompanyEnv.mapped);
  return {
    provider,
    label: req.label,
    status,
    active: ctx.activeProvider === provider,
    needsClientMap: req.needsClientMap,
    scopeHint: req.scopeHint ?? null,
    note: req.note ?? null,
    groups,
    perCompanyEnv,
    ready,
  };
}

const MANUAL_KIND: Partial<Record<IntegrationArea, ManualRecordKind>> = { vpn: "vpn_device", shipping: "shipment" };

export async function buildDataSourcesReport(env: Env, companies: CompanyLike[]) {
  const areas = [];
  const coverage: Record<string, Partial<Record<IntegrationArea, CompanyCoverage>>> = {};
  for (const c of companies) coverage[c.id] = {};

  for (const area of AREAS) {
    const status = readIntegrationStatus(area, env);
    const rawValue = (env[AREA_PROVIDER_ENV[area]] || "").trim().toLowerCase();
    const { map, error: mapError } = readMap(area, env);
    const accepted = INTEGRATION_PROVIDERS[area];
    const reqs = PROVIDER_REQUIREMENTS[area];
    // Phone: which token variables are set (names and booleans only), for every
    // company and every map entry (an entry may name a company id the store no longer has).
    let phoneSetup: ReturnType<typeof phoneSetupStatus> = {};
    if (area === "phone" && !mapError) {
      try {
        phoneSetup = phoneSetupStatus(env, Array.from(new Set([...companies.map((c) => c.id), ...Object.keys(map)])));
      } catch {
        phoneSetup = {};
      }
    }
    const mapIds = area === "phone" ? Object.keys(map) : [];
    const perCompanyCounts = {
      mapped: mapIds.length,
      set: mapIds.filter((id) => phoneSetup[id]?.tokenSet).length,
    };
    const providers = [
      ...accepted,
      ...Object.keys(reqs).filter((p) => !accepted.includes(p)),
    ].map((p) =>
      buildChecklist(p, reqs[p] ?? { label: p, status: "built", needsClientMap: true, groups: [] }, {
        env,
        activeProvider: status.provider,
        accepted,
        mapError,
        perCompanyCounts,
      }),
    );
    const activeReq = status.provider ? reqs[status.provider] : undefined;
    const noMapNeeded = !!status.provider && activeReq?.needsClientMap === false;
    const manualKind = status.provider === "manual" ? MANUAL_KIND[area] : undefined;

    const counts = await Promise.all(
      companies.map(async (c) => {
        if (!manualKind) return null;
        try {
          return (await listManualRecords(c.id, manualKind)).length;
        } catch (err) {
          console.warn(`[portal-data-sources] manual record count failed for ${c.id}: ${err instanceof Error ? err.message : err}`);
          return null;
        }
      }),
    );
    let mappedCount = 0;
    companies.forEach((c, i) => {
      const key = Object.prototype.hasOwnProperty.call(map, c.id) ? map[c.id] : null;
      if (key) mappedCount += 1;
      coverage[c.id][area] = {
        mapped: !!key,
        noMapNeeded,
        records: counts[i],
        tokenSet: area === "phone" ? (phoneSetup[c.id]?.tokenSet ?? false) : null,
        tokenEnvName: area === "phone" ? (phoneSetup[c.id]?.tokenEnvName ?? null) : null,
      };
    });

    areas.push({
      area,
      label: AREA_LABELS[area],
      providerEnv: AREA_PROVIDER_ENV[area],
      providerEnvSet: rawValue.length > 0,
      /** Set to something readIntegrationStatus does not accept, so the page falls back to sample. */
      providerValueUnrecognized:
        rawValue.length > 0 && status.mode === "sample" && rawValue !== "sample",
      status,
      allowedValues: ["sample", "hidden", ...accepted],
      clientMapEnv: AREA_CLIENT_MAP_ENV[area],
      clientMapSet: isSet(env, AREA_CLIENT_MAP_ENV[area]),
      mapError,
      mappedCompanies: mappedCount,
      providers,
    });
  }

  return {
    areas,
    companies: companies.map((c) => ({
      id: c.id,
      name: c.companyName || c.id,
      type: c.type === "msp" ? "msp" : "client",
      areas: coverage[c.id],
    })),
    qaLogin: {
      emailEnv: QA_LOGIN_ENV.email,
      passwordEnv: QA_LOGIN_ENV.password,
      emailSet: isSet(env, QA_LOGIN_ENV.email),
      passwordSet: isSet(env, QA_LOGIN_ENV.password),
    },
    envExample: "deploy/vps/env.production.example",
  };
}

// ---------- live check ----------

export type CheckResult = { result: "ok" | "notMapped" | "notLive" | "notBuilt" | "error"; summary: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const CHECK_ERROR_SUMMARY = "The provider did not answer. The reason is in the server log.";

export async function runDataSourceCheck(opts: {
  area: IntegrationArea;
  clientId: string;
  env: Env;
  fetchImpl?: typeof fetch;
}): Promise<CheckResult> {
  const { area, clientId, env, fetchImpl } = opts;
  const status = readIntegrationStatus(area, env);
  if (status.mode !== "live" || !status.provider) {
    return { result: "notLive", summary: status.mode === "hidden" ? "This page is hidden." : "This page shows sample data." };
  }
  const provider = status.provider;
  // An accepted provider without an adapter (perimeter81, timus) is not a misconfiguration.
  const req = PROVIDER_REQUIREMENTS[area][provider];
  if (req?.status === "notBuilt") {
    return { result: "notBuilt", summary: `${req.label} is not built yet, so the page says data isn't available.` };
  }
  try {
    if (area === "vpn") {
      const r = await loadVpnData({ provider, clientId, env, fetchImpl });
      if ("notMapped" in r) return { result: "notMapped", summary: "Not in the client map." };
      return { result: "ok", summary: plural(r.data.devices.length, "device", "devices") };
    }
    if (area === "phone") {
      const r = await loadPhoneData({ provider, clientId, userEmail: null, env, fetchImpl });
      if ("notMapped" in r) return { result: "notMapped", summary: "Not in the client map." };
      return { result: "ok", summary: plural(r.data.extensions.length, "extension", "extensions") };
    }
    const r = await loadShippingData({ provider, clientId, env, fetchImpl });
    if ("notMapped" in r) return { result: "notMapped", summary: "Not in the client map." };
    return { result: "ok", summary: plural(r.data.counts.total, "shipment", "shipments") };
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
    console.warn(`[portal-data-sources] check ${area}/${provider} failed for client ${clientId}: ${reason}`);
    return { result: "error", summary: CHECK_ERROR_SUMMARY };
  }
}

// ---------- rate limit ----------

const CHECK_LIMIT = 10;
const CHECK_WINDOW_MS = 60_000;
const checkHits = new Map<string, number[]>();

function allowCheck(key: string, now = Date.now()): boolean {
  const recent = (checkHits.get(key) || []).filter((t) => now - t < CHECK_WINDOW_MS);
  if (recent.length >= CHECK_LIMIT) {
    checkHits.set(key, recent);
    return false;
  }
  recent.push(now);
  checkHits.set(key, recent);
  return true;
}

/** Test seam. */
export function _resetDataSourceCheckLimit() {
  checkHits.clear();
}

// ---------- routes ----------

export const DATA_SOURCES_PATH = "/api/portal/admin/data-sources";

function isArea(v: unknown): v is IntegrationArea {
  return v === "vpn" || v === "phone" || v === "shipping";
}

export function registerPortalDataSourceRoutes(
  app: Express,
  opts: {
    guards: RequestHandler[];
    /** Test seams; production reads process.env, the global fetch and the portal company store. */
    env?: Env;
    fetchImpl?: typeof fetch;
    listCompanies?: () => CompanyLike[];
  },
) {
  const companiesOf = () => (opts.listCompanies ?? listClients)();

  app.get(DATA_SOURCES_PATH, ...opts.guards, async (_req: Request, res: Response) => {
    try {
      const report = await buildDataSourcesReport(opts.env ?? process.env, companiesOf());
      res.set("Cache-Control", "no-store");
      res.json({ success: true, ...report });
    } catch (err) {
      console.error(`[portal-data-sources] report failed: ${err instanceof Error ? err.message : err}`);
      res.status(500).json({ success: false, error: "Could not read the data source settings." });
    }
  });

  app.post(`${DATA_SOURCES_PATH}/check`, ...opts.guards, async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const area = body.area;
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!isArea(area)) return res.status(400).json({ success: false, error: "area must be vpn, phone or shipping" });
    if (!clientId) return res.status(400).json({ success: false, error: "clientId required" });
    if (!companiesOf().some((c) => c.id === clientId)) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }
    const user = (req as Request & { user?: { id?: string } }).user;
    if (!allowCheck(user?.id || req.ip || "anonymous")) {
      return res.status(429).json({ success: false, error: "Too many checks. Wait a minute and try again." });
    }
    const out = await runDataSourceCheck({ area, clientId, env: opts.env ?? process.env, fetchImpl: opts.fetchImpl });
    res.set("Cache-Control", "no-store");
    res.json({ success: true, ...out });
  });
}
