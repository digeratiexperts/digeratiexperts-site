import { getHubProjection } from "./hubEvents";

/**
 * Company display name is the only field both sides share.
 * Hub accounts.name stays authoritative. Portal auth fields never ride on this command.
 */

const NAME_KEYS = new Set(["name", "companyname"]);
const SESSION_KEYS = new Set(["portalclientid", "actoruserid", "canonicalaccountid", "accountid"]);

function token(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const PROFILE_COMMAND_MAX_BYTES = 4096;

export type PortalProfileCommand =
  | {
      ok: true;
      canonicalAccountId: string;
      payload: { name: string; portalClientId: string; actorUserId: string | null };
    }
  | { ok: false; status: 400 | 409 | 413; code: string; error: string };

export function buildPortalProfileCommand(input: {
  hubAccountId: string | null | undefined;
  portalClientId: string;
  actorUserId: string | null;
  payload: Record<string, unknown>;
}): PortalProfileCommand {
  if (Buffer.byteLength(JSON.stringify(input.payload), "utf8") > PROFILE_COMMAND_MAX_BYTES) {
    return { ok: false, status: 413, code: "profile_payload_too_large", error: "Profile command is too large" };
  }
  const hubAccountId = String(input.hubAccountId || "").trim();
  if (!/^[1-9]\d*$/.test(hubAccountId)) {
    return {
      ok: false,
      status: 409,
      code: "account_mapping_required",
      error: "Profile changes require a mapped Hub account",
    };
  }

  const rejected: string[] = [];
  for (const key of Object.keys(input.payload)) {
    const normalized = token(key);
    if (NAME_KEYS.has(normalized) || SESSION_KEYS.has(normalized)) continue;
    rejected.push(key);
  }
  if (rejected.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "profile_field_rejected",
      error: `Profile command cannot set ${rejected.join(", ")}`,
    };
  }

  const forged = input.payload.accountId ?? input.payload.canonicalAccountId;
  if (forged !== undefined && forged !== null && String(forged).trim() !== hubAccountId) {
    return {
      ok: false,
      status: 409,
      code: "identity_conflict",
      error: "Profile command account id does not match the signed-in company",
    };
  }
  const bodyClient =
    typeof input.payload.portalClientId === "string" ? input.payload.portalClientId.trim() : "";
  if (bodyClient && bodyClient !== input.portalClientId) {
    return {
      ok: false,
      status: 409,
      code: "identity_conflict",
      error: "portalClientId does not match the signed-in company",
    };
  }

  const nameRaw = typeof input.payload.name === "string" ? input.payload.name : "";
  const companyRaw = typeof input.payload.companyName === "string" ? input.payload.companyName : "";
  if (normalizeName(nameRaw) && normalizeName(companyRaw) && normalizeName(nameRaw) !== normalizeName(companyRaw)) {
    return { ok: false, status: 400, code: "profile_field_rejected", error: "name and companyName do not match" };
  }
  const name = (nameRaw.trim() || companyRaw.trim()).replace(/\s+/g, " ");
  if (!name) {
    return { ok: false, status: 400, code: "profile_field_rejected", error: "Company name is required" };
  }

  return {
    ok: true,
    canonicalAccountId: hubAccountId,
    payload: {
      name,
      portalClientId: input.portalClientId,
      actorUserId: input.actorUserId,
    },
  };
}

/** Linked companies show the Hub projection. Unlinked companies keep the local name. */
export async function companyNameForPortal(
  hubAccountId: string | null | undefined,
  localName: string | null,
): Promise<string | null> {
  const id = String(hubAccountId || "").trim();
  if (!/^[1-9]\d*$/.test(id)) return localName;
  const projected = await getHubProjection("account", id);
  const name = typeof projected?.name === "string" ? projected.name.trim() : "";
  return name || localName;
}
