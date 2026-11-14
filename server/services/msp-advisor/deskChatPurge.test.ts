import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendDeskMessage,
  DEFAULT_DESK_CHAT_RETENTION_DAYS,
  deleteDeskSession,
  deskChatRetentionDays,
  getDeskSessionMessages,
  isDeskChatPurgeEnabled,
  purgeExpiredDeskChats,
  setDeskChatLegalHold,
  setDeskChatLinkedTicket,
  setDeskChatUpdatedAt,
} from "./persist";

function daysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

const enabled = { DESK_CHAT_PURGE_ENABLED: "true" };
const enabled30 = { DESK_CHAT_PURGE_ENABLED: "true", DESK_CHAT_RETENTION_DAYS: "30" };

describe("DE Desk transcript retention", () => {
  it("defaults DESK_CHAT_RETENTION_DAYS to 365 and rejects invalid values", () => {
    assert.equal(DEFAULT_DESK_CHAT_RETENTION_DAYS, 365);
    assert.equal(deskChatRetentionDays({}), 365);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "" }), 365);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "  " }), 365);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "0" }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "-3" }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "nope" }), null);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "30" }), 30);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: " 45.9 " }), 45);
    assert.equal(deskChatRetentionDays({ DESK_CHAT_RETENTION_DAYS: "365" }), 365);
  });

  it("keeps the purge off until DESK_CHAT_PURGE_ENABLED is set", () => {
    assert.equal(isDeskChatPurgeEnabled({}), false);
    assert.equal(isDeskChatPurgeEnabled({ DESK_CHAT_PURGE_ENABLED: "" }), false);
    assert.equal(isDeskChatPurgeEnabled({ DESK_CHAT_PURGE_ENABLED: "false" }), false);
    assert.equal(isDeskChatPurgeEnabled({ DESK_CHAT_PURGE_ENABLED: "true" }), true);
    assert.equal(isDeskChatPurgeEnabled({ DESK_CHAT_PURGE_ENABLED: "1" }), true);
    assert.equal(isDeskChatPurgeEnabled({ DESK_CHAT_PURGE_ENABLED: "YES" }), true);
    assert.equal(isDeskChatPurgeEnabled({ DESK_CHAT_PURGE_ENABLED: "on" }), true);
  });

  it("does not delete anything when the purge switch is off", async () => {
    const tag = Math.random().toString(36).slice(2);
    const sessionId = `purge-off-${tag}`;
    await appendDeskMessage({ sessionId, role: "user", content: "keep me" });
    await setDeskChatUpdatedAt(sessionId, daysAgo(400));
    const result = await purgeExpiredDeskChats({ env: {}, now: new Date() });
    assert.deepEqual(result, {
      enabled: false,
      retentionDays: 365,
      deletedSessions: 0,
      deletedMessages: 0,
      skippedLegalHold: 0,
      skippedTicket: 0,
      skippedLookupError: 0,
    });
    const stillOff = await purgeExpiredDeskChats({
      env: { DESK_CHAT_RETENTION_DAYS: "30" },
      now: new Date(),
    });
    assert.equal(stillOff.enabled, false);
    assert.equal(stillOff.deletedSessions, 0);
    assert.equal((await getDeskSessionMessages(sessionId)).session?.sessionId, sessionId);
    await deleteDeskSession(sessionId);
  });

  it("keeps a chat idle 364 days and purges one idle 366 days, based on last activity", async () => {
    const tag = Math.random().toString(36).slice(2);
    const keptId = `purge-364-${tag}`;
    const purgedId = `purge-366-${tag}`;
    const now = new Date("2026-11-13T12:00:00.000Z");
    await appendDeskMessage({ sessionId: keptId, role: "user", content: "still within a year" });
    await setDeskChatUpdatedAt(keptId, daysAgo(364, now));
    await appendDeskMessage({ sessionId: purgedId, role: "user", content: "past a year" });
    await appendDeskMessage({ sessionId: purgedId, role: "assistant", content: "reply" });
    await setDeskChatUpdatedAt(purgedId, daysAgo(366, now));

    const result = await purgeExpiredDeskChats({ env: enabled, now });
    assert.equal(result.enabled, true);
    assert.equal(result.retentionDays, 365);
    assert.equal(result.deletedSessions, 1);
    assert.equal(result.deletedMessages, 2);
    assert.equal((await getDeskSessionMessages(keptId)).session?.sessionId, keptId);
    assert.equal((await getDeskSessionMessages(purgedId)).session, null);
    await deleteDeskSession(keptId);
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

    const first = await purgeExpiredDeskChats({ env: enabled30, now });
    assert.equal(first.enabled, true);
    assert.equal(first.retentionDays, 30);
    assert.equal(first.deletedSessions, 1);
    assert.equal(first.deletedMessages, 2);
    assert.equal((await getDeskSessionMessages(expiredId)).session, null);
    assert.equal((await getDeskSessionMessages(freshId)).session?.sessionId, freshId);

    const second = await purgeExpiredDeskChats({ env: enabled30, now });
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
    await setDeskChatUpdatedAt(sessionId, daysAgo(366, now));
    const result = await purgeExpiredDeskChats({ env: enabled, now });
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
    await setDeskChatUpdatedAt(sessionId, daysAgo(366, now));
    const result = await purgeExpiredDeskChats({ env: enabled, now });
    assert.equal(result.deletedSessions, 0);
    assert.equal(result.skippedTicket, 1);
    assert.equal((await getDeskSessionMessages(sessionId)).session?.sessionId, sessionId);
    await deleteDeskSession(sessionId);
  });

  it("keeps a chat when the hold or ticket lookup fails", async () => {
    const tag = Math.random().toString(36).slice(2);
    const sessionId = `purge-lookup-${tag}`;
    const now = new Date("2026-11-13T12:00:00.000Z");
    await appendDeskMessage({ sessionId, role: "user", content: "lookup failed" });
    await setDeskChatUpdatedAt(sessionId, daysAgo(366, now));

    const rejected = await purgeExpiredDeskChats({
      env: enabled,
      now,
      lookupGuards: async () => ({ ok: false, legalHold: false, ticketLinked: false }),
    });
    assert.equal(rejected.deletedSessions, 0);
    assert.equal(rejected.skippedLookupError, 1);
    assert.equal((await getDeskSessionMessages(sessionId)).session?.sessionId, sessionId);

    const threw = await purgeExpiredDeskChats({
      env: enabled,
      now,
      lookupGuards: async () => {
        throw new Error("guard lookup unavailable");
      },
    });
    assert.equal(threw.deletedSessions, 0);
    assert.equal(threw.skippedLookupError, 1);
    assert.equal((await getDeskSessionMessages(sessionId)).session?.sessionId, sessionId);
    await deleteDeskSession(sessionId);
  });
});
