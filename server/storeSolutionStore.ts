import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { computeSolutionSnapshot, money, type SolutionLineInput, type SolutionSnapshot } from "@shared/storeCommerce";
import { storeCarts } from "@shared/schema";
import { storeProducts } from "../client/src/data/storeProducts";
import { db, dbReady, initPromise } from "./db";

export type StoredSolution = {
  id: string;
  sessionId: string;
  userId: string | null;
  name: string;
  status: "draft" | "saved" | "archived";
  items: SolutionLineInput[];
  savedForLater: SolutionLineInput[];
  snapshot: SolutionSnapshot;
  updatedAt: string;
  createdAt: string;
};

const solutions = new Map<string, StoredSolution>();
const GUEST_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function catalog() {
  return storeProducts.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    basePrice: product.basePrice,
    pricingType: product.pricingType,
    pricingUnit: product.pricingUnit,
    minimumQuantity: product.minimumQuantity,
    isCheckoutEnabled: product.isCheckoutEnabled,
    isContractOnly: product.isContractOnly,
  }));
}

function hydrate(record: StoredSolution): StoredSolution {
  return {
    ...record,
    snapshot: computeSolutionSnapshot(record.items, catalog()),
  };
}

function expireGuests() {
  const cutoff = Date.now() - GUEST_TTL_MS;
  for (const [id, record] of solutions) {
    if (record.userId) continue;
    if (new Date(record.updatedAt).getTime() < cutoff) solutions.delete(id);
  }
}

export function createSolution(sessionId: string, userId: string | null = null): StoredSolution {
  expireGuests();
  const now = new Date().toISOString();
  const record: StoredSolution = {
    id: randomUUID(),
    sessionId,
    userId,
    name: "Your Solution",
    status: "draft",
    items: [],
    savedForLater: [],
    snapshot: computeSolutionSnapshot([], catalog()),
    createdAt: now,
    updatedAt: now,
  };
  solutions.set(record.id, record);
  return record;
}

export function getSolution(id: string): StoredSolution | undefined {
  const record = solutions.get(id);
  return record ? hydrate(record) : undefined;
}

/**
 * Thrown when a caller names a solution id it does not own (#244). A raw row id
 * is not a bearer capability: the caller must be the record's portal user, or
 * be on the browser session that holds it.
 */
export class SolutionOwnershipError extends Error {
  readonly code = "SOLUTION_OWNERSHIP_MISMATCH";
  constructor() {
    super("This solution belongs to another session.");
    this.name = "SolutionOwnershipError";
  }
}

/**
 * Who may read or write a stored solution by its id.
 * - A user-owned record: that user, or an anonymous caller on the same browser
 *   session (the device the user built it on, before or after sign-in). A
 *   different signed-in user is refused even on a matching session.
 * - A guest record: only the session that holds it (a user signing in on that
 *   session may pick it up, which is what claim does).
 */
export function solutionOwnedBy(
  record: Pick<StoredSolution, "sessionId" | "userId">,
  caller: { sessionId?: string | null; userId?: string | null },
): boolean {
  const userId = typeof caller.userId === "string" ? caller.userId.trim() : "";
  const sessionId = typeof caller.sessionId === "string" ? caller.sessionId.trim() : "";
  const sameSession = Boolean(sessionId) && Boolean(record.sessionId) && sessionId === record.sessionId;
  if (record.userId) {
    if (userId) return userId === record.userId;
    return sameSession;
  }
  return sameSession;
}

export function findSolution(opts: { id?: string; sessionId?: string; userId?: string | null }): StoredSolution | undefined {
  expireGuests();
  if (opts.id) {
    const exact = solutions.get(opts.id);
    if (exact && solutionOwnedBy(exact, opts)) return hydrate(exact);
  }
  if (opts.userId) {
    const owned = [...solutions.values()].find((record) => record.userId === opts.userId && record.status !== "archived");
    if (owned) return hydrate(owned);
  }
  if (opts.sessionId) {
    const guest = [...solutions.values()].find(
      (record) =>
        record.sessionId === opts.sessionId && record.status !== "archived" && solutionOwnedBy(record, opts),
    );
    if (guest) return hydrate(guest);
  }
  return undefined;
}

export function upsertSolution(input: {
  id?: string;
  sessionId: string;
  userId?: string | null;
  name?: string;
  items: SolutionLineInput[];
  savedForLater?: SolutionLineInput[];
}): StoredSolution {
  if (input.id) {
    const named = solutions.get(input.id);
    // Never rebind someone else's record to this caller; refuse instead (#244).
    if (named && !solutionOwnedBy(named, input)) throw new SolutionOwnershipError();
  }
  const existing = findSolution({ id: input.id, sessionId: input.sessionId, userId: input.userId });
  const now = new Date().toISOString();
  const base = existing ?? createSolution(input.sessionId, input.userId ?? null);
  const next: StoredSolution = {
    ...base,
    sessionId: input.sessionId || base.sessionId,
    userId: input.userId ?? base.userId,
    name: input.name?.trim() || base.name,
    items: input.items,
    savedForLater: input.savedForLater ?? base.savedForLater,
    updatedAt: now,
    snapshot: computeSolutionSnapshot(input.items, catalog()),
  };
  solutions.set(next.id, next);
  return next;
}

function mergeLines(primary: SolutionLineInput[], secondary: SolutionLineInput[]): SolutionLineInput[] {
  const map = new Map<string, number>();
  for (const line of [...primary, ...secondary]) {
    map.set(line.productId, Math.max(map.get(line.productId) ?? 0, line.quantity));
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Attach a guest solution to a portal user. Union quantities; never drop either side. */
/** A session's solution may be claimed only if it is a guest record or already this user's. */
function claimableBy(record: StoredSolution | undefined, userId: string): StoredSolution | undefined {
  return record && (!record.userId || record.userId === userId) ? record : undefined;
}

export function claimSolution(sessionId: string, userId: string): StoredSolution {
  const guest = claimableBy(findSolution({ sessionId }), userId);
  const owned = findSolution({ userId });
  if (guest && owned && guest.id !== owned.id) {
    const merged = upsertSolution({
      id: owned.id,
      sessionId,
      userId,
      items: mergeLines(owned.items, guest.items),
      savedForLater: mergeLines(owned.savedForLater, guest.savedForLater),
    });
    solutions.delete(guest.id);
    return merged;
  }
  if (guest) {
    guest.userId = userId;
    guest.updatedAt = new Date().toISOString();
    solutions.set(guest.id, guest);
    return hydrate(guest);
  }
  if (owned) return owned;
  return createSolution(sessionId, userId);
}

export function publicSolution(record: StoredSolution) {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    items: record.items,
    savedForLater: record.savedForLater,
    snapshot: record.snapshot,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
  };
}

export type CartPayloadV1 = {
  version: 1;
  items: SolutionLineInput[];
  savedForLater: SolutionLineInput[];
  name: string;
  status: StoredSolution["status"];
};

function asLine(raw: unknown): SolutionLineInput | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const productId = typeof item.productId === "string" ? item.productId.trim() : "";
  const sku = typeof item.sku === "string" ? item.sku.trim() : undefined;
  const quantity = Number(item.quantity);
  if (!productId || !Number.isFinite(quantity)) return null;
  return { productId, sku, quantity };
}

export function serializeCartPayload(record: StoredSolution): CartPayloadV1 {
  return {
    version: 1,
    items: record.items,
    savedForLater: record.savedForLater,
    name: record.name,
    status: record.status,
  };
}

export function parseCartPayload(raw: unknown): Pick<StoredSolution, "items" | "savedForLater" | "name" | "status"> {
  if (Array.isArray(raw)) {
    return {
      items: raw.map(asLine).filter((line): line is SolutionLineInput => !!line),
      savedForLater: [],
      name: "Your Solution",
      status: "draft",
    };
  }
  if (raw && typeof raw === "object") {
    const payload = raw as Record<string, unknown>;
    const status = payload.status === "saved" || payload.status === "archived" ? payload.status : "draft";
    return {
      items: Array.isArray(payload.items)
        ? payload.items.map(asLine).filter((line): line is SolutionLineInput => !!line)
        : [],
      savedForLater: Array.isArray(payload.savedForLater)
        ? payload.savedForLater.map(asLine).filter((line): line is SolutionLineInput => !!line)
        : [],
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 80) : "Your Solution",
      status,
    };
  }
  return { items: [], savedForLater: [], name: "Your Solution", status: "draft" };
}

function rowToSolution(row: {
  id: string;
  sessionId: string | null;
  userId: string | null;
  items: unknown;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): StoredSolution {
  const payload = parseCartPayload(row.items);
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || new Date().toISOString());
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt || new Date().toISOString());
  return hydrate({
    id: row.id,
    sessionId: row.sessionId || "",
    userId: row.userId,
    name: payload.name,
    status: payload.status,
    items: payload.items,
    savedForLater: payload.savedForLater,
    snapshot: computeSolutionSnapshot([], catalog()),
    createdAt,
    updatedAt,
  });
}

async function loadFromDb(opts: { id?: string; sessionId?: string; userId?: string | null }): Promise<StoredSolution | undefined> {
  await initPromise;
  if (!dbReady || !db) return undefined;
  try {
    let rows: any[] = [];
    if (opts.id) {
      rows = await db.select().from(storeCarts).where(eq(storeCarts.id, opts.id)).limit(1);
    } else if (opts.userId) {
      rows = await db.select().from(storeCarts).where(eq(storeCarts.userId, opts.userId)).limit(8);
    } else if (opts.sessionId) {
      rows = await db.select().from(storeCarts).where(eq(storeCarts.sessionId, opts.sessionId)).limit(8);
    }
    const now = Date.now();
    const fresh = rows
      .filter((row) => !row.expiresAt || new Date(row.expiresAt).getTime() > now)
      .sort(
        (left, right) =>
          new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime(),
      );
    const row = fresh[0];
    if (!row) return undefined;
    const record = rowToSolution(row);
    solutions.set(record.id, record);
    return record;
  } catch (error: any) {
    console.warn("[store-solution] database load skipped:", error?.message || error);
    return undefined;
  }
}

async function deleteCartRow(id: string): Promise<void> {
  await initPromise;
  if (!dbReady || !db) return;
  try {
    await db.delete(storeCarts).where(eq(storeCarts.id, id));
  } catch (error: any) {
    console.warn("[store-solution] database delete skipped:", error?.message || error);
  }
}

export async function persistSolutionRecord(record: StoredSolution): Promise<void> {
  solutions.set(record.id, record);
  await initPromise;
  if (!dbReady || !db) return;

  const expiresAt = new Date(Date.now() + (record.userId ? 90 : 30) * 24 * 60 * 60 * 1000);
  const values = {
    sessionId: record.sessionId || null,
    userId: record.userId,
    items: serializeCartPayload(record),
    subtotal: money(record.snapshot.totals.monthly + record.snapshot.totals.dueToday).toFixed(2),
    expiresAt,
    updatedAt: new Date(),
  };

  try {
    const existing = await db.select({ id: storeCarts.id }).from(storeCarts).where(eq(storeCarts.id, record.id)).limit(1);
    if (existing[0]) {
      await db.update(storeCarts).set(values).where(eq(storeCarts.id, record.id));
      return;
    }
    await db.insert(storeCarts).values({ id: record.id, ...values });
  } catch (error: any) {
    const message = String(error?.message || error);
    if (record.userId && /foreign key|violates/i.test(message)) {
      try {
        await db
          .insert(storeCarts)
          .values({ id: record.id, ...values, userId: null })
          .onConflictDoUpdate({
            target: storeCarts.id,
            set: { ...values, userId: null },
          });
        return;
      } catch (retryError: any) {
        console.warn("[store-solution] database persist skipped:", retryError?.message || retryError);
        return;
      }
    }
    console.warn("[store-solution] database persist skipped:", message);
  }
}

export async function findSolutionDurable(opts: {
  id?: string;
  sessionId?: string;
  userId?: string | null;
}): Promise<StoredSolution | undefined> {
  const memory = findSolution(opts);
  if (memory) return memory;
  if (opts.id) {
    const byId = await loadFromDb({ id: opts.id });
    if (byId && solutionOwnedBy(byId, opts)) return byId;
  }
  if (opts.userId) {
    const byUser = await loadFromDb({ userId: opts.userId });
    if (byUser) return byUser;
  }
  if (opts.sessionId) {
    const bySession = await loadFromDb({ sessionId: opts.sessionId });
    if (bySession && solutionOwnedBy(bySession, opts)) return bySession;
  }
  return undefined;
}

export async function upsertSolutionDurable(input: {
  id?: string;
  sessionId: string;
  userId?: string | null;
  name?: string;
  items: SolutionLineInput[];
  savedForLater?: SolutionLineInput[];
}): Promise<StoredSolution> {
  await findSolutionDurable({ id: input.id, sessionId: input.sessionId, userId: input.userId });
  const record = upsertSolution(input);
  await persistSolutionRecord(record);
  return record;
}

export async function claimSolutionDurable(sessionId: string, userId: string): Promise<StoredSolution> {
  const guest = claimableBy((await findSolutionDurable({ sessionId })) ?? findSolution({ sessionId }), userId);
  const owned = (await findSolutionDurable({ userId })) ?? findSolution({ userId });
  const result = claimSolution(sessionId, userId);
  await persistSolutionRecord(result);
  if (guest && owned && guest.id !== owned.id) {
    await deleteCartRow(guest.id);
  }
  return result;
}

export async function createSolutionDurable(sessionId: string, userId: string | null = null): Promise<StoredSolution> {
  const record = createSolution(sessionId, userId);
  return record;
}
