import { describe, expect, it } from "vitest";
import {
  MemoryPortalSessionRepository,
  createPortalSessionMemoryState,
  hashPortalSessionId,
  validatePortalRepositorySessionBinding,
} from "./portalSessionRepository";

const NOW = new Date("2026-08-23T12:00:00.000Z");

describe("durable portal session contract", () => {
  it("shares revocation state across repository instances without storing the raw cookie", async () => {
    const state = createPortalSessionMemoryState();
    const firstProcess = new MemoryPortalSessionRepository(state);
    const secondProcess = new MemoryPortalSessionRepository(state);
    const created = await firstProcess.create("user-1", {
      now: NOW,
      sessionIdFactory: () => "opaque-session-id-00000000000001",
    });

    expect(state.records.has(created.sessionId)).toBe(false);
    expect(state.records.has(hashPortalSessionId(created.sessionId))).toBe(true);
    await expect(secondProcess.find(created.sessionId)).resolves.toMatchObject({ userId: "user-1" });

    expect(await secondProcess.revoke(created.sessionId, NOW)).toBe(true);
    await expect(validatePortalRepositorySessionBinding({
      repository: firstProcess,
      cookieSessionId: created.sessionId,
      tokenSessionId: created.sessionId,
      tokenUserId: "user-1",
      now: NOW,
    })).resolves.toMatchObject({ ok: false, reason: "session_revoked" });
  });

  it("rotates atomically from the caller's perspective and rejects the old binding", async () => {
    const repository = new MemoryPortalSessionRepository();
    const original = await repository.create("user-1", {
      now: NOW,
      sessionIdFactory: () => "opaque-session-id-00000000000001",
    });
    const rotated = await repository.rotate(original.sessionId, "user-1", {
      now: new Date(NOW.getTime() + 1_000),
      sessionIdFactory: () => "opaque-session-id-00000000000002",
    });

    await expect(validatePortalRepositorySessionBinding({
      repository,
      cookieSessionId: original.sessionId,
      tokenSessionId: original.sessionId,
      tokenUserId: "user-1",
      now: new Date(NOW.getTime() + 2_000),
    })).resolves.toMatchObject({ ok: false, reason: "session_revoked" });
    await expect(validatePortalRepositorySessionBinding({
      repository,
      cookieSessionId: rotated.sessionId,
      tokenSessionId: rotated.sessionId,
      tokenUserId: "user-1",
      now: new Date(NOW.getTime() + 2_000),
    })).resolves.toMatchObject({ ok: true });
  });

  it("fails closed on expiration, token/cookie mismatch, and user mismatch", async () => {
    const repository = new MemoryPortalSessionRepository();
    const created = await repository.create("user-1", {
      now: NOW,
      maxAgeMs: 1_000,
      sessionIdFactory: () => "opaque-session-id-00000000000001",
    });

    await expect(validatePortalRepositorySessionBinding({
      repository,
      cookieSessionId: created.sessionId,
      tokenSessionId: "different-session-id",
      tokenUserId: "user-1",
      now: NOW,
    })).resolves.toMatchObject({ ok: false, reason: "session_mismatch" });
    await expect(validatePortalRepositorySessionBinding({
      repository,
      cookieSessionId: created.sessionId,
      tokenSessionId: created.sessionId,
      tokenUserId: "user-2",
      now: NOW,
    })).resolves.toMatchObject({ ok: false, reason: "session_user_mismatch" });
    await expect(validatePortalRepositorySessionBinding({
      repository,
      cookieSessionId: created.sessionId,
      tokenSessionId: created.sessionId,
      tokenUserId: "user-1",
      now: new Date(NOW.getTime() + 1_000),
    })).resolves.toMatchObject({ ok: false, reason: "session_expired" });
  });
});
