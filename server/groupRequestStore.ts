import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, dbReady } from "./db";
import { portalGroupRequests } from "@shared/schema";
import type { GroupRequestKind, GroupRequestStatus } from "@shared/representation";

/**
 * Group-level requests filed by representatives. Postgres when the database
 * is up (migrations/0019_portal_group_requests.sql); memory otherwise, for
 * the dev server and route tests (same pattern as orgDirectoryStore).
 */

export type GroupRequest = {
  id: string;
  number: string;
  clientId: string;
  hubAccountId: string;
  scopeKey: string;
  groupName: string;
  kind: GroupRequestKind;
  subject: string;
  description: string;
  status: GroupRequestStatus;
  submittedByUserId: string;
  submittedByRole: "primary" | "backup";
  deskTicketId: string | null;
  createdAt: string;
  updatedAt: string;
};

const useDb = () => Boolean(dbReady && db);
const mem = new Map<string, GroupRequest>();
let memSeq = 0;

export function _resetGroupRequestMemory(): void {
  mem.clear();
  memSeq = 0;
}

function toRequest(r: any): GroupRequest {
  return {
    id: r.id,
    number: r.number,
    clientId: r.clientId,
    hubAccountId: r.hubAccountId,
    scopeKey: r.scopeKey,
    groupName: r.groupName,
    kind: r.kind,
    subject: r.subject,
    description: r.description,
    status: r.status,
    submittedByUserId: r.submittedByUserId,
    submittedByRole: r.submittedByRole,
    deskTicketId: r.deskTicketId ?? null,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

function nextNumber(now: Date): string {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, "");
  return `GR-${stamp}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function createGroupRequest(input: Omit<GroupRequest, "id" | "number" | "status" | "deskTicketId" | "createdAt" | "updatedAt">, now = new Date()): Promise<GroupRequest> {
  const number = nextNumber(now);
  if (useDb()) {
    const [row] = await db
      .insert(portalGroupRequests)
      .values({ ...input, number, status: "submitted", createdAt: now, updatedAt: now })
      .returning();
    return toRequest(row);
  }
  memSeq += 1;
  const row: GroupRequest = { ...input, id: `mem-${memSeq}`, number, status: "submitted", deskTicketId: null, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  mem.set(row.id, row);
  return { ...row };
}

export async function setGroupRequestDeskTicket(id: string, deskTicketId: string): Promise<void> {
  if (useDb()) {
    await db.update(portalGroupRequests).set({ deskTicketId, updatedAt: new Date() }).where(eq(portalGroupRequests.id, id));
    return;
  }
  const row = mem.get(id);
  if (row) row.deskTicketId = deskTicketId;
}

/** Requests of one company for the given groups only. Callers pass the groups the user currently represents. */
export async function listGroupRequests(clientId: string, scopeKeys: string[]): Promise<GroupRequest[]> {
  if (scopeKeys.length === 0) return [];
  if (useDb()) {
    const rows = await db
      .select()
      .from(portalGroupRequests)
      .where(and(eq(portalGroupRequests.clientId, clientId), inArray(portalGroupRequests.scopeKey, scopeKeys)))
      .orderBy(desc(portalGroupRequests.createdAt))
      .limit(200);
    return rows.map(toRequest);
  }
  return [...mem.values()]
    .filter((r) => r.clientId === clientId && scopeKeys.includes(r.scopeKey))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((r) => ({ ...r }));
}
