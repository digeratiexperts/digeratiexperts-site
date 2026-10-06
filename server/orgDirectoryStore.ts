import { and, eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { clientOrgProfiles, clientPeople, clientUnitLeaders } from "@shared/schema";
import {
  defaultOrgProfile,
  formatDePersonId,
  orgProfileSchema,
  type OrgProfile,
  type PersonProfile,
  type SupportTier,
  type UnitKind,
  type UnitLeader,
} from "@shared/orgDirectory";

/**
 * Company structure and the people directory. Postgres when the database is
 * up (migrations/0011_org_structure_people.sql, verified not created); memory
 * otherwise, for the dev server and route tests.
 *
 * A DE person ID is assigned the first time a person is listed or routed and
 * never changes afterwards, even if the company's prefix changes later.
 */

const useDb = () => Boolean(dbReady && db);
const memProfiles = new Map<string, OrgProfile>();
const memLeaders = new Map<string, UnitLeader & { clientId: string }>();
const memPeople = new Map<string, PersonProfile>();
let memSeq = 0;

export function _resetOrgDirectoryMemory() {
  memProfiles.clear();
  memLeaders.clear();
  memPeople.clear();
  memSeq = 0;
}

let verified = false;
async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.client_people') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[org-directory] table client_people is missing; run `npm run db:migrate` (migrations/0011_org_structure_people.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[org-directory] could not verify tables:", error?.message || error);
  }
}

// ---------- profile ----------

export async function getOrgProfile(clientId: string, companyName: string): Promise<OrgProfile> {
  await ensureSchema();
  const fallback = defaultOrgProfile(companyName);
  let stored: unknown = null;
  if (useDb()) {
    const [row] = await db.select().from(clientOrgProfiles).where(eq(clientOrgProfiles.clientId, clientId)).limit(1);
    stored = row?.profile ?? null;
  } else {
    stored = memProfiles.get(clientId) ?? null;
  }
  if (!stored) return fallback;
  const parsed = orgProfileSchema.safeParse({ ...fallback, ...(stored as object) });
  return parsed.success ? parsed.data : fallback;
}

export async function setOrgProfile(clientId: string, profile: OrgProfile, updatedBy: string | null): Promise<void> {
  await ensureSchema();
  if (useDb()) {
    await db
      .insert(clientOrgProfiles)
      .values({ clientId, profile, updatedBy, updatedAt: new Date() })
      .onConflictDoUpdate({ target: clientOrgProfiles.clientId, set: { profile, updatedBy, updatedAt: new Date() } });
    return;
  }
  memProfiles.set(clientId, profile);
}

// ---------- leaders ----------

export async function listUnitLeaders(clientId: string): Promise<UnitLeader[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.select().from(clientUnitLeaders).where(eq(clientUnitLeaders.clientId, clientId));
    return rows.map((r: any) => ({
      unitKind: r.unitKind as UnitKind,
      unitId: r.unitId,
      leaderUserId: r.leaderUserId ?? null,
      backupUserId: r.backupUserId ?? null,
      ccLeader: Boolean(r.ccLeader),
    }));
  }
  return [...memLeaders.values()].filter((l) => l.clientId === clientId).map(({ clientId: _c, ...l }) => ({ ...l }));
}

export async function getUnitLeader(clientId: string, unitKind: UnitKind, unitId: string): Promise<UnitLeader | null> {
  return (await listUnitLeaders(clientId)).find((l) => l.unitKind === unitKind && l.unitId === unitId) ?? null;
}

export async function setUnitLeader(clientId: string, leader: UnitLeader, updatedBy: string | null): Promise<void> {
  await ensureSchema();
  if (useDb()) {
    const empty = !leader.leaderUserId && !leader.backupUserId;
    if (empty) {
      await db
        .delete(clientUnitLeaders)
        .where(and(eq(clientUnitLeaders.clientId, clientId), eq(clientUnitLeaders.unitKind, leader.unitKind), eq(clientUnitLeaders.unitId, leader.unitId)));
      return;
    }
    const set = { leaderUserId: leader.leaderUserId, backupUserId: leader.backupUserId, ccLeader: leader.ccLeader, updatedBy, updatedAt: new Date() };
    await db
      .insert(clientUnitLeaders)
      .values({ clientId, unitKind: leader.unitKind, unitId: leader.unitId, ...set })
      .onConflictDoUpdate({ target: [clientUnitLeaders.clientId, clientUnitLeaders.unitKind, clientUnitLeaders.unitId], set });
    return;
  }
  const key = `${clientId}:${leader.unitKind}:${leader.unitId}`;
  if (!leader.leaderUserId && !leader.backupUserId) memLeaders.delete(key);
  else memLeaders.set(key, { ...leader, clientId });
}

// ---------- people ----------

function toPerson(r: any): PersonProfile {
  return {
    userId: r.userId,
    clientId: r.clientId,
    dePersonId: r.dePersonId,
    companyPersonId: r.companyPersonId ?? null,
    siteId: r.siteId ?? null,
    supportTier: r.supportTier === "vip" ? "vip" : "standard",
    awayUntil: r.awayUntil ? String(r.awayUntil).slice(0, 10) : null,
  };
}

export async function getPerson(userId: string): Promise<PersonProfile | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(clientPeople).where(eq(clientPeople.userId, userId)).limit(1);
    return row ? toPerson(row) : null;
  }
  const p = memPeople.get(userId);
  return p ? { ...p } : null;
}

export async function listPeople(clientId: string): Promise<PersonProfile[]> {
  await ensureSchema();
  if (useDb()) return (await db.select().from(clientPeople).where(eq(clientPeople.clientId, clientId))).map(toPerson);
  return [...memPeople.values()].filter((p) => p.clientId === clientId).map((p) => ({ ...p }));
}

/**
 * The person's directory row, created with a fresh DE person ID when missing.
 * A row from another company (the user moved) is re-homed, keeping the DE ID.
 */
export async function ensurePerson(userId: string, clientId: string, prefix: string): Promise<PersonProfile> {
  const existing = await getPerson(userId);
  if (existing) {
    if (existing.clientId === clientId) return existing;
    return updatePerson(userId, clientId, { companyPersonId: null, siteId: null }, null);
  }
  if (useDb()) {
    const result: any = await db.execute(sql`SELECT nextval('client_person_seq'::regclass) AS n`);
    const n = Number((Array.isArray(result) ? result[0] : result?.rows?.[0])?.n);
    const [row] = await db
      .insert(clientPeople)
      .values({ userId, clientId, dePersonId: formatDePersonId(prefix, n), supportTier: "standard" })
      .onConflictDoNothing({ target: clientPeople.userId })
      .returning();
    return row ? toPerson(row) : ((await getPerson(userId)) as PersonProfile);
  }
  memSeq += 1;
  const person: PersonProfile = {
    userId,
    clientId,
    dePersonId: formatDePersonId(prefix, memSeq),
    companyPersonId: null,
    siteId: null,
    supportTier: "standard",
    awayUntil: null,
  };
  memPeople.set(userId, person);
  return { ...person };
}

export type PersonPatch = Partial<{ companyPersonId: string | null; siteId: string | null; supportTier: SupportTier; awayUntil: string | null }>;

export async function updatePerson(userId: string, clientId: string, patch: PersonPatch, updatedBy: string | null): Promise<PersonProfile> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db
      .update(clientPeople)
      .set({ ...patch, clientId, updatedBy, updatedAt: new Date() })
      .where(eq(clientPeople.userId, userId))
      .returning();
    return toPerson(row);
  }
  const p = memPeople.get(userId);
  if (!p) throw new Error("Person not in the directory");
  Object.assign(p, patch, { clientId });
  return { ...p };
}

/** companyPersonId (lower case) → userId, for uniqueness checks. */
export async function companyIdHolders(clientId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const p of await listPeople(clientId)) if (p.companyPersonId) out.set(p.companyPersonId.toLowerCase(), p.userId);
  return out;
}
