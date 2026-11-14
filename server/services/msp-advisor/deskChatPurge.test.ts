import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendDeskMessage,
  deleteDeskSession,
  deskChatRetentionDays,
  getDeskSessionMessages,
  purgeExpiredDeskChats,
  setDeskChatLegalHold,
  setDeskChatLinkedTicket,
  setDeskChatUpdatedAt,
} from "./persist";

function daysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("DE Desk transcript retention", () => {
  it("treats an unset, empty, or invalid DESK_CHAT_RETENTION_DAYS as disabled", () => {
    assert.equal(deskChatRetentionDays({}), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "" }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "  " }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "0" }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "-3" }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "nope" }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "30" }), 30);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: " 45.9 " }), 45);
  });

  it("does not delete anything when retention is unset", async () => {
    const tag = Math.random().toString(36).slice(2);
    const sessionId = `purge-off-${tag}`;
    await appendDeskMessage({ sessionId, role: "user", content: "keep me" });
    await setDeskChatUpdatedAt(sessionId, daysAgo(400));
    const result = await purgeExpiredDeskChats({ env: {}, now: new Date() });
    assert.deepEqual(result, {
      enabled: false,
      retentionDays: null,
      deletedSessions: 0,
      deletedMessages: 0,
      skippedLegalHold: 0,
      skippedTicket: 0,
    });
    assert.equal((await getDeskSessionMessages(sessionId)).session?.sessionId, sessionId);
    await deleteDeskSession(sessionId);
  });

  it("deletes expired sessions and is safe to run again", async () => {
    const tag = Math.random().toString(36).slice(2);
    const expiredId = `purge-old-${tag}`;
    const freshId = `purge-new-${tag}`;
    const now = new Date("2026-11-13T12:00:00.000Z");
    await appendDeskMessage({ sessionId: expiredId, role: "user", content: "old one" });
    await appendDeskMessage({ sessionId: expiredId, role: "assistant", content: "reply" });
    await setDeskChatUpdatedAt(expiredId, daysAgo(40, now));
    await appendDeskMessage({ sessionId: freshId, role: "user", content: "recent" });
    await setDeskChatUpdatedAt(freshId, daysAgo(5, now));

    const first = await purgeExpiredDeskChats({
      env: { DESK_CHAT_RETENTION_DAYS: "30" },
      now,
    });
    assert.equal(first.enabled, true);
    assert.equal(first.retentionDays, 30);
    assert.equal(first.deletedSessions, 1);
    assert.equal(first.deletedMessages, 2);
    assert.equal((await getDeskSessionMessages(expiredId)).session, null);
    assert.equal((await getDeskSessionMessages(freshId)).session?.sessionId, freshId);

    const second = await purgeExpiredDeskChats({
      env: { DESK_CHAT_RETENTION_DAYS: "30" },
      now,
    });
    assert.equal(second.deletedSessions, 0);
    assert.equal(second.deletedMessages, 0);
    await deleteDeskSession(freshId);
  });

  it("skips expired sessions under legal hold", async () => {
    const tag = Math.random().toString(36).slice(2);
    const sessionId = `purge-hold-${tag}`;
    const now = new Date("2026-11-13T12:00:00.000Z");
    await appendDeskMessage({ sessionId, role: "user", content: "held" });
    await setDeskChatLegalHold(sessionId, true);
    await setDeskChatUpdatedAt(sessionId, daysAgo(90, now));
    const result = await purgeExpiredDeskChats({
      env: { DESK_CHAT_RETENTION_DAYS: "30" },
      now,
    });
    assert.equal(result.deletedSessions, 0);
    assert.equal(result.skippedLegalHold, 1);
    assert.equal((await getDeskSessionMessages(sessionId)).session?.sessionId, sessionId);
    await deleteDeskSession(sessionId);
  });

  it("skips expired sessions linked to a ticket", async () => {
    const tag = Math.random().toString(36).slice(2);
    const sessionId = `purge-ticket-${tag}`;
    const now = new Date("2026-11-13T12:00:00.000Z");
    await appendDeskMessage({ sessionId, role: "user", content: "ticketed" });
    await setDeskChatLinkedTicket(sessionId, `desk-${tag}`);
    await setDeskChatUpdatedAt(sessionId, daysAgo(90, now));
    const result = await purgeExpiredDeskChats({
      env: { DESK_CHAT_RETENTION_DAYS: "30" },
      now,
    });
    assert.equal(result.deletedSessions, 0);
    assert.equal(result.skippedTicket, 1);
    assert.equal((await getDeskSessionMessages(sessionId)).session?.sessionId, sessionId);
    await deleteDeskSession(sessionId);
  });
});
