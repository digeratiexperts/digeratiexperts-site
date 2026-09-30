import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistPublicSolutionRequest as persist } from "./publicSolutionRequestPersistence";

/**
 * These tests fake Postgres behind the real ./db module so the actual
 * ensureSchema/persist/load code paths in publicSolutionRequestPersistence.ts
 * run for real — the fake only replaces the network round trip, not the
 * SQL-shaped logic in this file. That gives genuine restart/idempotency/
 * expiry/privacy coverage without a live database in CI.
 */

type FakeRow = {
  id: string;
  session_id: string;
  status: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

let table: FakeRow[] = [];

function matchesUnexpired(row: FakeRow): boolean {
  if (row.status === "submitted") return true;
  return !row.expires_at || new Date(row.expires_at).getTime() >= Date.now();
}

async function fakeQuery(sql: string, params: unknown[] = []) {
  const text = sql.trim();
  if (text.startsWith("CREATE TABLE") || text.startsWith("CREATE INDEX")) {
    return { rows: [] };
  }
  if (text.startsWith("INSERT INTO public_solution_requests")) {
    const [id, sessionId, status, payloadJson, createdAt, updatedAt, expiresAt] = params as [
      string,
      string,
      string,
      string,
      string,
      string,
      Date | null,
    ];
    const payload = JSON.parse(payloadJson);
    const existingIndex = table.findIndex((row) => row.id === id);
    const row: FakeRow = {
      id,
      session_id: sessionId,
      status,
      payload,
      created_at: createdAt,
      updated_at: updatedAt,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };
    if (existingIndex >= 0) table[existingIndex] = row;
    else table.push(row);
    return { rows: [] };
  }
  if (text.startsWith("DELETE FROM public_solution_requests WHERE status = 'draft'")) {
    table = table.filter((row) => !(row.status === "draft" && row.expires_at && new Date(row.expires_at).getTime() < Date.now()));
    return { rows: [] };
  }
  if (text.startsWith("DELETE FROM public_solution_requests WHERE id = $1")) {
    const [id] = params as [string];
    table = table.filter((row) => row.id !== id);
    return { rows: [] };
  }
  if (text.includes("WHERE session_id = $1")) {
    const [sessionId] = params as [string];
    const rows = table
      .filter((row) => row.session_id === sessionId && matchesUnexpired(row))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return { rows: rows.slice(0, 1).map((row) => ({ payload: row.payload })) };
  }
  if (text.includes("WHERE id = $1")) {
    const [id] = params as [string];
    const row = table.find((entry) => entry.id === id && matchesUnexpired(entry));
    return { rows: row ? [{ payload: row.payload }] : [] };
  }
  throw new Error(`Unhandled fake SQL: ${text}`);
}

vi.mock("./db", () => {
  const fakePool = {
    query: (sql: string, params?: unknown[]) => fakeQuery(sql, params),
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => fakeQuery(sql, params),
      release: () => {},
    }),
  };
  return {
    pool: fakePool,
    initPromise: Promise.resolve(true),
    db: null,
    dbReady: true,
    initAttempted: true,
    dbType: "postgresql",
  };
});

describe("public solution request durable persistence", () => {
  beforeEach(() => {
    table = [];
    process.env.DATABASE_URL = "postgres://fake-test-only";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("survives a simulated server restart via session continuation", async () => {
    const store = await import("./publicSolutionRequestStore");
    const record = store.upsertPublicSolutionRequest({
      sessionId: "session-restart",
      selectedNeeds: [{ familyId: "it_operations", offerId: "de-it-operations-standalone", deliveryModel: "standalone" }],
      organizationName: "Acme Co",
    });
    await persist(record);

    // Simulate a restart: the in-memory Map is gone, only the fake DB remains.
    store.resetPublicSolutionRequestsForTests();

    const recovered = await store.findPublicSolutionRequestDurable("session-restart");
    expect(recovered?.id).toBe(record.id);
    expect(recovered?.selectedNeeds[0]?.familyId).toBe("it_operations");
    expect(recovered?.organizationName).toBe("Acme Co");
  });

  it("resumes a draft by its own id after a restart, independent of the session cookie", async () => {
    const store = await import("./publicSolutionRequestStore");
    const record = store.upsertPublicSolutionRequest({
      sessionId: "session-device-a",
      selectedNeeds: [{ familyId: "network_connectivity", offerId: null, deliveryModel: "unsure" }],
    });
    await persist(record);
    store.resetPublicSolutionRequestsForTests();

    // A different device has no session cookie for "session-device-a" at all,
    // only the draft id (e.g. from a bookmarked/shared resume link).
    const resumed = await store.getPublicSolutionRequestDurable(record.id);
    expect(resumed?.id).toBe(record.id);
    expect(resumed?.sessionId).toBe("session-device-a");
  });

  it("never resumes a draft for the wrong id or an unrelated session (privacy boundary)", async () => {
    const store = await import("./publicSolutionRequestStore");
    const record = store.upsertPublicSolutionRequest({ sessionId: "session-owner", organizationName: "Owner Co" });
    await persist(record);
    store.resetPublicSolutionRequestsForTests();

    const wrongId = await store.getPublicSolutionRequestDurable("00000000-0000-0000-0000-000000000000");
    expect(wrongId).toBeUndefined();

    const wrongSession = await store.findPublicSolutionRequestDurable("session-stranger");
    expect(wrongSession).toBeUndefined();
  });

  it("does not resurrect an expired draft, but never expires a submitted request", async () => {
    const store = await import("./publicSolutionRequestStore");
    const draft = store.upsertPublicSolutionRequest({ sessionId: "session-expiring" });
    const stale = { ...draft, updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() };
    await persist(stale);
    store.resetPublicSolutionRequestsForTests();

    const expired = await store.findPublicSolutionRequestDurable("session-expiring");
    expect(expired).toBeUndefined();

    const submitted = store.upsertPublicSolutionRequest({ sessionId: "session-submitted", contactEmail: "a@b.com" });
    const finalized = { ...submitted, status: "submitted" as const, updatedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString() };
    await persist(finalized);
    store.resetPublicSolutionRequestsForTests();

    const recovered = await store.findPublicSolutionRequestDurable("session-submitted");
    expect(recovered?.id).toBe(finalized.id);
  });

  it("upsert-durable recovers an in-flight draft by id after a restart instead of forking a duplicate", async () => {
    const store = await import("./publicSolutionRequestStore");
    const created = store.upsertPublicSolutionRequest({ sessionId: "session-continue", organizationName: "First save" });
    await persist(created);
    store.resetPublicSolutionRequestsForTests();

    const continued = await store.upsertPublicSolutionRequestDurable({
      id: created.id,
      sessionId: "session-continue",
      organizationName: "Second save",
    });
    expect(continued.record.id).toBe(created.id);
    expect(continued.record.organizationName).toBe("Second save");
    expect(continued.persisted).toBe(true);
    expect(continued.forked).toBe(false);
  });

  it("submit-durable is idempotent/replay-safe across a simulated restart", async () => {
    const store = await import("./publicSolutionRequestStore");
    const draft = store.upsertPublicSolutionRequest({
      sessionId: "session-submit",
      selectedNeeds: [{ familyId: "identity_access", offerId: "de-identity-standalone", deliveryModel: "standalone" }],
    });
    const contact = { name: "Jordan Buyer", email: "jordan@example.com", organizationName: "Acme" };
    const first = await store.submitPublicSolutionRequestDurable(draft, contact, "replay-key-1");
    expect(first.replayed).toBe(false);

    // Simulate the server restarting, then the client's browser retrying the
    // same POST. The real route always recovers current state through
    // upsert-durable before submit-durable, so the retry sees status
    // "submitted" from the database, not the stale pre-restart draft object.
    store.resetPublicSolutionRequestsForTests();
    const recovered = await store.upsertPublicSolutionRequestDurable({
      id: draft.id,
      sessionId: "session-submit",
    });

    expect(recovered.forked).toBe(false);
    expect(recovered.record.status).toBe("submitted");
    const second = await store.submitPublicSolutionRequestDurable(recovered.record, contact, "replay-key-1");
    expect(second.replayed).toBe(true);
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.reference).toBe(first.record.reference);

    // A save after submit, by contrast, forks: the session gets a new draft
    // and the submitted record stays exactly what DE received.
    const saved = await store.upsertPublicSolutionRequestDurable(
      { id: draft.id, sessionId: "session-submit", organizationName: "Changed my mind" },
      { forkSubmitted: true },
    );
    expect(saved.forked).toBe(true);
    expect(saved.previousReference).toBe(first.record.reference);
    expect(saved.record.id).not.toBe(first.record.id);
    expect(saved.record.status).toBe("draft");
    expect((await store.getPublicSolutionRequestDurable(first.record.id))?.organizationName).toBe("Acme");
  });
});
