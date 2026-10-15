import { and, eq, or, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { portalAgreementSignatures } from "@shared/schema";
import type { AgreementScope, AgreementSignatureRef } from "@shared/portalAgreements";

/**
 * Client Portal agreement signatures. Postgres when the database is up
 * (migrations/0016_portal_agreements.sql, verified not created); memory
 * otherwise, for the dev server and route tests. Append-only: a signature is
 * never edited or removed by the app.
 */

export interface AgreementSignatureRecord extends AgreementSignatureRef {
  id: string;
  clientId: string;
  userId: string;
  signerEmail: string;
  documentSha256: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const useDb = () => Boolean(dbReady && db);
const mem: AgreementSignatureRecord[] = [];

export function _resetAgreementMemory() {
  mem.length = 0;
}

let verified = false;
async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.portal_agreement_signatures') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[agreements] table portal_agreement_signatures is missing; run `npm run db:migrate` (migrations/0016_portal_agreements.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[agreements] could not verify table:", error?.message || error);
  }
}

function toRecord(row: any): AgreementSignatureRecord {
  return {
    id: row.id,
    key: row.agreementKey,
    version: row.agreementVersion,
    scope: row.scope as AgreementScope,
    clientId: row.clientId,
    userId: row.userId,
    signerName: row.signerName,
    signerEmail: row.signerEmail,
    documentSha256: row.documentSha256 ?? null,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    signedAt: new Date(row.signedAt).toISOString(),
  };
}

/** Company signatures for the company plus this person's own signatures. */
export async function listSignatures(clientId: string, userId: string): Promise<{ company: AgreementSignatureRecord[]; user: AgreementSignatureRecord[] }> {
  await ensureSchema();
  let rows: AgreementSignatureRecord[];
  if (useDb()) {
    const found = await db
      .select()
      .from(portalAgreementSignatures)
      .where(
        or(
          and(eq(portalAgreementSignatures.scope, "company"), eq(portalAgreementSignatures.clientId, clientId)),
          and(eq(portalAgreementSignatures.scope, "user"), eq(portalAgreementSignatures.userId, userId)),
        ),
      );
    rows = found.map(toRecord);
  } else {
    rows = mem.filter((r) => (r.scope === "company" && r.clientId === clientId) || (r.scope === "user" && r.userId === userId));
  }
  return { company: rows.filter((r) => r.scope === "company"), user: rows.filter((r) => r.scope === "user") };
}

/** Every signature for a company (DE admin view). */
export async function listCompanySignatureLog(clientId: string): Promise<AgreementSignatureRecord[]> {
  await ensureSchema();
  if (useDb()) {
    const found = await db.select().from(portalAgreementSignatures).where(eq(portalAgreementSignatures.clientId, clientId));
    return found.map(toRecord).sort((a: AgreementSignatureRecord, b: AgreementSignatureRecord) => a.signedAt.localeCompare(b.signedAt));
  }
  return mem.filter((r) => r.clientId === clientId);
}

/**
 * Record a signature. A second signature for the same company/person and
 * version is ignored (unique index), so a double submit is harmless.
 */
export async function recordSignature(input: Omit<AgreementSignatureRecord, "id" | "signedAt">): Promise<void> {
  await ensureSchema();
  if (useDb()) {
    await db
      .insert(portalAgreementSignatures)
      .values({
        agreementKey: input.key,
        agreementVersion: input.version,
        scope: input.scope,
        clientId: input.clientId,
        userId: input.userId,
        signerName: input.signerName,
        signerEmail: input.signerEmail,
        documentSha256: input.documentSha256,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })
      .onConflictDoNothing();
    return;
  }
  const dup = mem.some(
    (r) =>
      r.key === input.key &&
      r.version === input.version &&
      r.scope === input.scope &&
      (input.scope === "company" ? r.clientId === input.clientId : r.userId === input.userId),
  );
  if (!dup) mem.push({ ...input, id: `sig-${mem.length + 1}`, signedAt: new Date().toISOString() });
}
