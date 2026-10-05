import { describe, it, expect } from "vitest";
import {
  PORTAL_CHAT_IDLE_MS,
  continuesSession,
  groupIntoSessions,
  newSessionId,
  type SessionableMessage,
} from "./portalChatSessions";

const CONV = "live-user-1";

function msg(
  timestamp: string,
  overrides: Partial<SessionableMessage> = {},
): SessionableMessage {
  return {
    id: `m-${timestamp}`,
    content: "hello",
    senderRole: "client",
    senderName: "Visitor",
    timestamp,
    ...overrides,
  };
}

describe("continuesSession", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("has no run to continue when there is no last message", () => {
    expect(continuesSession(null, now)).toBe(false);
    expect(continuesSession(undefined, now)).toBe(false);
    expect(continuesSession("not a date", now)).toBe(false);
  });

  it("continues a chat that was active within the idle window", () => {
    const recent = new Date(now.getTime() - PORTAL_CHAT_IDLE_MS + 1000).toISOString();
    expect(continuesSession(recent, now)).toBe(true);
  });

  it("closes a chat once the quiet gap is longer than the window", () => {
    const old = new Date(now.getTime() - PORTAL_CHAT_IDLE_MS - 1000).toISOString();
    expect(continuesSession(old, now)).toBe(false);
  });

  it("does not resume a chat from days ago", () => {
    expect(continuesSession("2026-03-07T12:00:00.000Z", now)).toBe(false);
  });

  it("treats a future timestamp as clock skew, not as a gap", () => {
    const ahead = new Date(now.getTime() + 60_000).toISOString();
    expect(continuesSession(ahead, now)).toBe(true);
  });
});

describe("newSessionId", () => {
  it("carries the start date and sorts chronologically", () => {
    const first = newSessionId(CONV, new Date("2026-03-01T09:30:00.000Z"));
    const second = newSessionId(CONV, new Date("2026-03-02T09:30:00.000Z"));
    expect(first).toBe("live-user-1:20260301T093000Z");
    expect(second > first).toBe(true);
  });
});

describe("groupIntoSessions", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("returns nothing for an empty conversation", () => {
    expect(groupIntoSessions(CONV, [], now)).toEqual([]);
  });

  it("keeps messages minutes apart in one chat", () => {
    const sessions = groupIntoSessions(
      CONV,
      [msg("2026-03-10T11:00:00.000Z"), msg("2026-03-10T11:04:00.000Z")],
      now,
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].messageCount).toBe(2);
    expect(sessions[0].open).toBe(true);
  });

  it("splits runs separated by more than the idle window", () => {
    const sessions = groupIntoSessions(
      CONV,
      [
        msg("2026-03-01T09:00:00.000Z"),
        msg("2026-03-01T09:05:00.000Z"),
        msg("2026-03-08T14:00:00.000Z"),
        msg("2026-03-10T11:30:00.000Z"),
      ],
      now,
    );
    expect(sessions.map((s) => s.messageCount)).toEqual([2, 1, 1]);
    // Only the most recent run is still open; history is read-only.
    expect(sessions.map((s) => s.open)).toEqual([false, false, true]);
  });

  it("honours stored session ids over the clock", () => {
    // Two messages a minute apart that the store already recorded as separate
    // chats must not be glued back together.
    const sessions = groupIntoSessions(
      CONV,
      [
        msg("2026-03-10T11:00:00.000Z", { sessionId: "a" }),
        msg("2026-03-10T11:01:00.000Z", { sessionId: "b" }),
      ],
      now,
    );
    expect(sessions.map((s) => s.sessionId)).toEqual(["a", "b"]);
  });

  it("does not merge unstored history into a stored chat", () => {
    const sessions = groupIntoSessions(
      CONV,
      [
        msg("2026-03-10T11:00:00.000Z"),
        msg("2026-03-10T11:01:00.000Z", { sessionId: "stored" }),
      ],
      now,
    );
    expect(sessions).toHaveLength(2);
    expect(sessions[1].sessionId).toBe("stored");
  });

  it("gives a backfilled run an id derived from when it started", () => {
    const sessions = groupIntoSessions(CONV, [msg("2026-03-01T09:00:00.000Z")], now);
    expect(sessions[0].sessionId).toBe("live-user-1:20260301T090000Z");
    expect(sessions[0].startedAt).toBe("2026-03-01T09:00:00.000Z");
  });

  it("previews the visitor's last question, not the support reply", () => {
    const sessions = groupIntoSessions(
      CONV,
      [
        msg("2026-03-10T11:00:00.000Z", { content: "Is my backup running?" }),
        msg("2026-03-10T11:01:00.000Z", {
          content: "Checking that now.",
          senderRole: "support",
          senderName: "DE Support",
        }),
      ],
      now,
    );
    expect(sessions[0].preview).toBe("Is my backup running?");
  });

  it("previews nothing when only the welcome message exists", () => {
    const sessions = groupIntoSessions(
      CONV,
      [
        msg("2026-03-10T11:00:00.000Z", {
          content: "Welcome to Digerati Experts Live Chat.",
          senderRole: "support",
          senderName: "DE Support",
        }),
      ],
      now,
    );
    expect(sessions[0].preview).toBe("");
  });
});
