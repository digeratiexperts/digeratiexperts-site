/**
 * Cross-system tenant join for Client Portal ↔ Intelligence-Hub ↔ Zoho.
 *
 * Canonical commercial id is Hub accounts.id (portal_clients.hub_account_id).
 * Zoho CRM Account id is a secondary join, never a Deal/Potential id.
 *
 * Fail-closed: if two sides both present an id of the same kind and they
 * disagree, the request is a tenant mismatch. Missing ids do not invent a
 * match.
 */

export const MATURITY_STAGES = [
  "prospect",
  "quoted",
  "onboarded",
  "active",
  "comanaged",
] as const;

export type MaturityStage = (typeof MATURITY_STAGES)[number];

export const HUB_LIFECYCLES = [
  "suspect",
  "prospect",
  "lead",
  "qualified_opportunity",
  "client_pending_activation",
  "active_client",
  "former_client",
  "disqualified",
  "closed_lost",
] as const;

export type HubLifecycle = (typeof HUB_LIFECYCLES)[number];

/**
 * Account Lifecycle Status disclosure boundary.
 *
 * See docs/ACCOUNT-LIFECYCLE-STATUS.md. The field is internal classification:
 * governed everywhere, displayed nowhere client-facing. Compliance means the
 * value is absent from the payload a client or the public receives — hiding it
 * in the UI does not count.
 *
 * The canonical v1.1 vocabulary. Storage/wire forms vary (spacing, case,
 * snake_case), so comparison is normalized.
 */
export const ACCOUNT_LIFECYCLE_STATUSES = [
  "Suspect",
  "Prospect",
  "Tentative",
  "Pending",
  "Onboarding",
  "Active",
  "Paused",
  "At Risk",
  "Offboarding",
  "Inactive",
  "Former",
  "Disqualified",
  "Do Not Engage",
] as const;

export type AccountLifecycleStatus = (typeof ACCOUNT_LIFECYCLE_STATUSES)[number];

/** Field names that carry the lifecycle value and must not reach a client. */
export const LIFECYCLE_DISCLOSURE_KEYS = [
  "accountlifecyclestatus",
  "lifecyclestatus",
  "hublifecycle",
  "accountlifecycle",
  "lifecycle",
] as const;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const LIFECYCLE_VALUE_TOKENS: ReadonlySet<string> = new Set([
  ...ACCOUNT_LIFECYCLE_STATUSES.map((s) => normalizeToken(s)),
  ...HUB_LIFECYCLES.map((s) => normalizeToken(s)),
]);

/**
 * Values that are legitimately client-visible in their own domain and must not
 * be mistaken for a lifecycle disclosure. `active`/`inactive` describe a portal
 * user account; `pending` describes a request; `prospect` is an existing
 * client-visible storeRole. They are only a violation under a lifecycle key.
 */
const AMBIGUOUS_VALUE_TOKENS: ReadonlySet<string> = new Set([
  "active",
  "inactive",
  "pending",
  "prospect",
  "paused",
  "former",
]);

export type LifecycleDisclosure = { path: string; reason: "key" | "value"; found: string };

/**
 * Walk a client-bound payload and report every Account Lifecycle Status
 * disclosure. Returns [] when the payload is clean.
 *
 * A key match is always a violation: naming a field `lifecycle` and putting
 * anything in it discloses the classification. A value match is a violation
 * only for unambiguous lifecycle terms, so this does not fire on a portal
 * user's `status: "active"`.
 */
export function findLifecycleDisclosures(
  payload: unknown,
  path = "$",
  seen = new WeakSet<object>(),
): LifecycleDisclosure[] {
  if (payload === null || payload === undefined) return [];

  if (typeof payload === "string") {
    const token = normalizeToken(payload);
    if (LIFECYCLE_VALUE_TOKENS.has(token) && !AMBIGUOUS_VALUE_TOKENS.has(token)) {
      return [{ path, reason: "value", found: payload }];
    }
    return [];
  }

  if (typeof payload !== "object") return [];
  if (seen.has(payload as object)) return [];
  seen.add(payload as object);

  if (Array.isArray(payload)) {
    return payload.flatMap((item, i) => findLifecycleDisclosures(item, `${path}[${i}]`, seen));
  }

  const out: LifecycleDisclosure[] = [];
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const keyPath = `${path}.${key}`;
    if (LIFECYCLE_DISCLOSURE_KEYS.includes(normalizeToken(key) as any)) {
      out.push({ path: keyPath, reason: "key", found: key });
      continue;
    }
    out.push(...findLifecycleDisclosures(value, keyPath, seen));
  }
  return out;
}

/** Throw if a client-bound payload discloses Account Lifecycle Status. */
export function assertNoLifecycleDisclosure(payload: unknown, label = "payload"): void {
  const found = findLifecycleDisclosures(payload);
  if (found.length === 0) return;
  const detail = found.map((f) => `${f.path} (${f.reason}: ${f.found})`).join(", ");
  throw new Error(
    `Account Lifecycle Status disclosed in client-bound ${label}: ${detail}. ` +
      `See docs/ACCOUNT-LIFECYCLE-STATUS.md — omit it at the serialization boundary.`,
  );
}

export type TenantIds = {
  portalClientId?: string | null;
  hubAccountId?: string | null;
  zohoAccountId?: string | null;
  zohoContactId?: string | null;
  zohoDeskAccountId?: string | null;
  zohoBooksCustomerId?: string | null;
};

export type PortalActor = {
  id?: string | null;
  role?: string | null;
  storeRole?: string | null;
  clientId?: string | null;
  isActive?: boolean | null;
};

export type PortalClientSnapshot = {
  id: string;
  companyName?: string | null;
  serviceType?: string | null;
  status?: string | null;
  hubAccountId?: string | null;
  zohoAccountId?: string | null;
};

export type TenantGate =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 409; error: string; code: string };

const MUTATING_PORTAL_COMMANDS = new Set([
  "account.profile_update_requested",
  "quote.requested",
  "quote.response_submitted",
  "approval.submitted",
  "assessment.response_submitted",
  "onboarding.response_submitted",
  "document.acknowledged",
  "service.change_requested",
]);

const COMMANDS_REQUIRING_HUB_ACCOUNT = new Set([
  "quote.response_submitted",
  "document.acknowledged",
  "service.change_requested",
  "onboarding.response_submitted",
]);

export function normalizeTenantId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function compactTenantIds(ids: TenantIds): TenantIds {
  return {
    portalClientId: normalizeTenantId(ids.portalClientId),
    hubAccountId: normalizeTenantId(ids.hubAccountId),
    zohoAccountId: normalizeTenantId(ids.zohoAccountId),
    zohoContactId: normalizeTenantId(ids.zohoContactId),
    zohoDeskAccountId: normalizeTenantId(ids.zohoDeskAccountId),
    zohoBooksCustomerId: normalizeTenantId(ids.zohoBooksCustomerId),
  };
}

function pairMismatch(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a !== b);
}

export function assertSameTenant(actor: TenantIds, resource: TenantIds): TenantGate {
  const left = compactTenantIds(actor);
  const right = compactTenantIds(resource);

  const pairs: Array<[keyof TenantIds, string]> = [
    ["portalClientId", "portal_client_id"],
    ["hubAccountId", "hub_account_id"],
    ["zohoAccountId", "zoho_account_id"],
    ["zohoContactId", "zoho_contact_id"],
    ["zohoDeskAccountId", "zoho_desk_account_id"],
    ["zohoBooksCustomerId", "zoho_books_customer_id"],
  ];

  for (const [key, label] of pairs) {
    if (pairMismatch(left[key], right[key])) {
      return {
        ok: false,
        status: 403,
        code: "tenant_mismatch",
        error: `Tenant mismatch on ${label}`,
      };
    }
  }

  const shared = pairs.some(([key]) => left[key] && right[key] && left[key] === right[key]);
  const resourceHasAny = pairs.some(([key]) => Boolean(right[key]));
  const actorHasAny = pairs.some(([key]) => Boolean(left[key]));

  if (resourceHasAny && actorHasAny && !shared) {
    return {
      ok: false,
      status: 403,
      code: "tenant_unjoined",
      error: "No shared tenant identifier between actor and resource",
    };
  }

  return { ok: true };
}

export function mapHubLifecycleToMaturity(
  lifecycle?: string | null,
): MaturityStage | "former" | "closed" | "unknown" {
  switch ((lifecycle || "").trim()) {
    case "suspect":
    case "prospect":
    case "lead":
      return "prospect";
    case "qualified_opportunity":
      return "quoted";
    case "client_pending_activation":
      return "onboarded";
    case "active_client":
      return "active";
    case "former_client":
      return "former";
    case "disqualified":
    case "closed_lost":
      return "closed";
    default:
      return "unknown";
  }
}

export function mapPortalMaturity(input: {
  serviceType?: string | null;
  storeRole?: string | null;
  status?: string | null;
  hasHubQuote?: boolean;
  hasHubAgreement?: boolean;
  hubLifecycle?: string | null;
}): { stage: MaturityStage | "former" | "closed" | "unknown"; hole: string | null } {
  const service = (input.serviceType || "").toLowerCase();
  const store = (input.storeRole || "").toLowerCase();
  const status = (input.status || "").toLowerCase();
  const hubStage = mapHubLifecycleToMaturity(input.hubLifecycle);

  if (service === "comanaged" || store === "comanaged") {
    return { stage: "comanaged", hole: null };
  }
  if (service === "managed" || store === "managed") {
    return { stage: "active", hole: null };
  }
  if (status.includes("onboard") || hubStage === "onboarded") {
    return {
      stage: "onboarded",
      hole: service === "prospect" ? "portal serviceType still prospect after Hub activation pending" : null,
    };
  }
  if (input.hasHubQuote || hubStage === "quoted") {
    return {
      stage: "quoted",
      hole: "portal_clients.hub_account_id may still be empty until first Hub pull or event",
    };
  }
  if (store === "prospect" || service === "prospect" || hubStage === "prospect") {
    return {
      stage: "prospect",
      hole: "website register / lead ingest does not write portalClientId back onto Hub accounts",
    };
  }
  if (hubStage === "former" || hubStage === "closed") {
    return { stage: hubStage, hole: "portal has no former/closed serviceType" };
  }
  return { stage: "unknown", hole: "no portal serviceType/storeRole and no Hub lifecycle" };
}

export function joinTenantIdentity(input: {
  client?: PortalClientSnapshot | null;
  actor?: PortalActor | null;
  hubAccountId?: string | null;
  zohoAccountId?: string | null;
}): TenantIds {
  return compactTenantIds({
    portalClientId: input.actor?.clientId || input.client?.id || null,
    hubAccountId: input.hubAccountId || input.client?.hubAccountId || null,
    zohoAccountId: input.zohoAccountId || input.client?.zohoAccountId || null,
  });
}

export function assertPortalActor(actor: PortalActor | null | undefined): TenantGate {
  if (!actor) {
    return { ok: false, status: 401, code: "unauthenticated", error: "Authentication required" };
  }
  if (actor.isActive === false) {
    return { ok: false, status: 403, code: "disabled_user", error: "Portal account is disabled" };
  }
  return { ok: true };
}

export function assertPortalCommandAllowed(input: {
  actor: PortalActor | null | undefined;
  client?: PortalClientSnapshot | null;
  eventType: string;
  payload?: Record<string, unknown> | null;
}): TenantGate {
  const actorGate = assertPortalActor(input.actor);
  if (!actorGate.ok) return actorGate;

  const actor = input.actor!;
  if (actor.role === "viewer") {
    return {
      ok: false,
      status: 403,
      code: "role_downgrade",
      error: "Viewer role cannot submit portal commands",
    };
  }

  if (!MUTATING_PORTAL_COMMANDS.has(input.eventType)) {
    return { ok: false, status: 403, code: "unsupported_command", error: "Unsupported portal command" };
  }

  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  const claimed = compactTenantIds({
    portalClientId: normalizeTenantId(payload.portalClientId) || actor.clientId || input.client?.id,
    hubAccountId:
      normalizeTenantId(payload.canonicalAccountId) ||
      normalizeTenantId(payload.hubAccountId) ||
      input.client?.hubAccountId,
    zohoAccountId: normalizeTenantId(payload.zohoAccountId) || input.client?.zohoAccountId,
  });

  const live = joinTenantIdentity({
    client: input.client,
    actor,
  });

  const same = assertSameTenant(live, claimed);
  if (!same.ok) return same;

  if (COMMANDS_REQUIRING_HUB_ACCOUNT.has(input.eventType) && !live.hubAccountId) {
    return {
      ok: false,
      status: 409,
      code: "unmapped_tenant",
      error:
        "This command requires a Hub account mapping. The company is still a prospect without canonicalAccountId.",
    };
  }

  return { ok: true };
}

export function assertLiveRecordScope(input: {
  actor: TenantIds;
  record: { userId?: string | null; clientId?: string | null; ownerUserId?: string | null };
  actorUserId?: string | null;
  isAdmin?: boolean;
}): TenantGate {
  if (input.isAdmin) return { ok: true };
  const recordClient = normalizeTenantId(input.record.clientId);
  const actorClient = normalizeTenantId(input.actor.portalClientId);
  if (recordClient && actorClient && recordClient === actorClient) return { ok: true };

  const owner = normalizeTenantId(input.record.userId) || normalizeTenantId(input.record.ownerUserId);
  const actorUser = normalizeTenantId(input.actorUserId);
  if (owner && actorUser && owner === actorUser) return { ok: true };

  return {
    ok: false,
    status: 403,
    code: "idor",
    error: "Access denied to another tenant's record",
  };
}

export const TENANT_JOIN_HOLES = [
  {
    stage: "prospect",
    hole: "Portal register creates portal_clients without hub_account_id. Hub website-lead creates accounts.id without portalClientId.",
  },
  {
    stage: "quoted",
    hole: "Hub quotes/deals exist, but portal only learns hubAccountId after a successful orders/documents pull or Hub event with portalClientId.",
  },
  {
    stage: "onboarded",
    hole: "Hub client_pending_activation has no portal serviceType write-back. Portal stays prospect/managed independently.",
  },
  {
    stage: "active",
    hole: "Zoho Books customer id is resolved by email at invoice read time and is not persisted on portal_clients.",
  },
  {
    stage: "comanaged",
    hole: "serviceType=comanaged is portal-local. Hub serviceRelationship is not synced back.",
  },
] as const;
