/**
 * The store's behaviour across the idle boundary, exercised through the
 * in-memory fallback so no database is required. The fallback and the Neon path
 * share one definition of a run (portalChatSessions), so what this pins down is
 * the store's own contract: a stale chat is closed, not resumed, and nothing is
 * thrown away when it closes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  appendMessage,
  conversationIdForUser,
  currentSessionId,
  ensureWelcomeMessage,
  listMessages,
  listSessions,
} from "./portalChatStore";
import { PORTAL_CHAT_IDLE_MS } from "./portalChatSessions";

let seq = 0;
function freshUser(): string {
  seq += 1;
  return `test-user-${Date.now()}-${seq}`;
}

const START = new Date("2026-03-01T09:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("portal chat runs", () => {
  it("keeps a back-and-forth within the idle window in one chat", async () => {
    const conv = conversationIdForUser(freshUser());
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "Is my backup running?",
    });

    vi.setSystemTime(new Date(START.getTime() + 30 * 60 * 1000));
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "DE Support",
      senderRole: "support",
      content: "Yes, last night at 01:12.",
    });

    const sessions = await listSessions(conv);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].messageCount).toBe(2);
    expect(sessions[0].open).toBe(true);
  });

  it("does not resume a chat from days ago", async () => {
    const conv = conversationIdForUser(freshUser());
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "Old question",
    });
    const first = await currentSessionId(conv);

    vi.setSystemTime(new Date(START.getTime() + 5 * 24 * 60 * 60 * 1000));
    const second = await currentSessionId(conv);
    expect(second).not.toBe(first);

    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "New question",
    });

    const sessions = await listSessions(conv);
    expect(sessions).toHaveLength(2);
    // The old chat is closed but still here — that is what "saved for us to
    // pick up" means.
    expect(sessions[0].open).toBe(false);
    expect(sessions[0].preview).toBe("Old question");
    expect(sessions[1].open).toBe(true);
    expect(sessions[1].preview).toBe("New question");
  });

  it("splits exactly at the idle boundary, not before it", async () => {
    const conv = conversationIdForUser(freshUser());
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "first",
    });

    vi.setSystemTime(new Date(START.getTime() + PORTAL_CHAT_IDLE_MS));
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "still the same chat",
    });
    expect(await listSessions(conv)).toHaveLength(1);

    vi.setSystemTime(new Date(START.getTime() + PORTAL_CHAT_IDLE_MS * 2 + 1000));
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "a new one",
    });
    expect(await listSessions(conv)).toHaveLength(2);
  });

  it("reads back only the messages of the chat asked for", async () => {
    const conv = conversationIdForUser(freshUser());
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "older",
    });

    vi.setSystemTime(new Date(START.getTime() + 5 * 24 * 60 * 60 * 1000));
    await appendMessage({
      conversationId: conv,
      userId: "u",
      senderName: "Client",
      senderRole: "client",
      content: "newer",
    });

    const [older, newer] = await listSessions(conv);
    const olderMessages = await listMessages(conv, { sessionId: older.sessionId });
    const newerMessages = await listMessages(conv, { sessionId: newer.sessionId });

    expect(olderMessages.map((m) => m.content)).toEqual(["older"]);
    expect(newerMessages.map((m) => m.content)).toEqual(["newer"]);
  });

  it("welcomes each new chat once, and does not re-welcome an open one", async () => {
    const conv = conversationIdForUser(freshUser());
    const userId = "u";

    expect(await ensureWelcomeMessage(conv, userId)).not.toBeNull();
    expect(await ensureWelcomeMessage(conv, userId)).toBeNull();

    vi.setSystemTime(new Date(START.getTime() + 5 * 24 * 60 * 60 * 1000));
    const second = await ensureWelcomeMessage(conv, userId);
    expect(second).not.toBeNull();

    const sessions = await listSessions(conv);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.messageCount === 1)).toBe(true);
  });
});
