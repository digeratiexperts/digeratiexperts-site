import { eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { clientLicensePolicies, clientUserAccounts } from "@shared/schema";
import { EMPTY_POLICY, type AccountType, type LicensePolicy } from "@shared/licensing";

/**
 * Per-company licence policy and per-person account type. Postgres when the
 * database is up (migrations/0010_licensing_and_kb.sql, verified not created);
 * memory otherwise, for the dev server and route tests.
 */

export type StoredUserAccount = { userId: string; clientId: string; accountType: AccountType; tier: string | null; updatedAt: string };

const useDb = () => Boolean(dbReady && db);
const memPolicies = new Map<string, LicensePolicy>();
const memAccounts = new Map<string, StoredUserAccount>();

export function _resetLicensingMemory() {
  memPolicies.clear();
  memAccounts.clear();
}

let verified = false;
async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.client_license_policies') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[licensing] table client_license_policies is missing; run `npm run db:migrate` (migrations/0010_licensing_and_kb.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[licensing] could not verify tables:", error?.message || error);
  }
}

export async function getLicensePolicy(clientId: string): Promise<LicensePolicy> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(clientLicensePolicies).where(eq(clientLicensePolicies.clientId, clientId)).limit(1);
    return row ? ({ ...EMPTY_POLICY, ...(row.policy as LicensePolicy) } as LicensePolicy) : EMPTY_POLICY;
  }
  return memPolicies.get(clientId) ?? EMPTY_POLICY;
}

export async function setLicensePolicy(clientId: string, policy: LicensePolicy, updatedBy: string | null): Promise<void> {
  await ensureSchema();
  if (useDb()) {
    await db
      .insert(clientLicensePolicies)
      .values({ clientId, policy, updatedBy, updatedAt: new Date() })
      .onConflictDoUpdate({ target: clientLicensePolicies.clientId, set: { policy, updatedBy, updatedAt: new Date() } });
    return;
  }
  memPolicies.set(clientId, policy);
}

export async function getUserAccount(userId: string): Promise<StoredUserAccount | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(clientUserAccounts).where(eq(clientUserAccounts.userId, userId)).limit(1);
    return row
      ? { userId: row.userId, clientId: row.clientId, accountType: row.accountType as AccountType, tier: row.tier ?? null, updatedAt: new Date(row.updatedAt).toISOString() }
      : null;
  }
  return memAccounts.get(userId) ?? null;
}

export async function listUserAccounts(clientId: string): Promise<StoredUserAccount[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.select().from(clientUserAccounts).where(eq(clientUserAccounts.clientId, clientId));
    return rows.map((row: any) => ({
      userId: row.userId,
      clientId: row.clientId,
      accountType: row.accountType as AccountType,
      tier: row.tier ?? null,
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }
  return [...memAccounts.values()].filter((a) => a.clientId === clientId);
}

export async function setUserAccount(input: {
  userId: string;
  clientId: string;
  accountType: AccountType;
  tier: string | null;
  updatedBy: string | null;
}): Promise<StoredUserAccount> {
  await ensureSchema();
  const now = new Date();
  if (useDb()) {
    await db
      .insert(clientUserAccounts)
      .values({ ...input, updatedAt: now })
      .onConflictDoUpdate({
        target: clientUserAccounts.userId,
        set: { clientId: input.clientId, accountType: input.accountType, tier: input.tier, updatedBy: input.updatedBy, updatedAt: now },
      });
  } else {
    memAccounts.set(input.userId, { userId: input.userId, clientId: input.clientId, accountType: input.accountType, tier: input.tier, updatedAt: now.toISOString() });
  }
  return { userId: input.userId, clientId: input.clientId, accountType: input.accountType, tier: input.tier, updatedAt: now.toISOString() };
}

/** A person with no classification yet counts as a standard user, the common case. */
export async function classificationFor(userId: string, clientId: string): Promise<{ accountType: AccountType; tier: string | null; assigned: boolean }> {
  const row = await getUserAccount(userId);
  if (row && row.clientId === clientId) return { accountType: row.accountType, tier: row.tier, assigned: true };
  return { accountType: "standard", tier: null, assigned: false };
}
