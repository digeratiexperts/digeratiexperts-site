import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DESK_CHAT_MAX_MESSAGES,
  DESK_CHAT_STORAGE_KEY,
  DESK_CHAT_TTL_MS,
  clearDeskChat,
  readDeskChat,
  ticketDraftFromChat,
  writeDeskChat,
  type DeskStoredMessage,
} from "./deskChatSession";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const welcome: DeskStoredMessage = { id: "welcome", role: "assistant", content: "DE Desk here." };
const user = (id: string, content: string): DeskStoredMessage => ({ id, role: "user", content, createdAt: "2026-09-30T05:00:00.000Z" });

describe("Ask DE conversation kept for the tab", () => {
  let store: MemoryStorage;
  beforeEach(() => {
    store = new MemoryStorage();
    (globalThis as unknown as { window: unknown }).window = { sessionStorage: store };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("does not save a conversation the visitor has not joined", () => {
    writeDeskChat(null, [welcome]);
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).toBeNull();
  });

  it("round-trips the session id and messages", () => {
    const now = 1_000_000;
    writeDeskChat("s-1", [welcome, user("u1", "Outlook keeps asking for my password")], now);
    const back = readDeskChat(now + 1000);
    expect(back?.sessionId).toBe("s-1");
    expect(back?.messages.map((m) => m.id)).toEqual(["welcome", "u1"]);
  });

  it("expires after the TTL and removes the stale entry", () => {
    writeDeskChat("s-1", [welcome, user("u1", "hi")], 0);
    expect(readDeskChat(DESK_CHAT_TTL_MS + 1)).toBeNull();
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).toBeNull();
  });

  it("ignores malformed storage instead of throwing", () => {
    store.setItem(DESK_CHAT_STORAGE_KEY, "{not json");
    expect(readDeskChat()).toBeNull();
    store.setItem(DESK_CHAT_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), messages: [{ id: 1, role: "hacker", content: {} }] }));
    expect(readDeskChat()).toBeNull();
  });

  it("keeps only the newest messages", () => {
    const many = Array.from({ length: DESK_CHAT_MAX_MESSAGES + 10 }, (_, i) => user(`u${i}`, `m${i}`));
    writeDeskChat("s", many, 5);
    const back = readDeskChat(6);
    expect(back?.messages).toHaveLength(DESK_CHAT_MAX_MESSAGES);
    expect(back?.messages.at(-1)?.id).toBe(`u${DESK_CHAT_MAX_MESSAGES + 9}`);
  });

  it("keeps a reply's next steps, and drops any that fail the allowlist", () => {
    writeDeskChat(
      "s",
      [
        user("u1", "hi"),
        {
          id: "a1",
          role: "assistant",
          content: "Here you go",
          actions: [
            { type: "open_portal", label: "Open Client Portal", href: "https://portal.digeratiexperts.com/portal/login" },
          ],
        },
      ],
      10,
    );
    expect(readDeskChat(11)?.messages[1].actions).toEqual([
      { type: "open_portal", label: "Open Client Portal", href: "https://portal.digeratiexperts.com/portal/login" },
    ]);
    const raw = JSON.parse(store.getItem(DESK_CHAT_STORAGE_KEY)!);
    raw.messages[1].actions = [{ type: "navigate", label: "x", href: "javascript:alert(1)" }];
    store.setItem(DESK_CHAT_STORAGE_KEY, JSON.stringify(raw));
    expect(readDeskChat(12)?.messages[1].actions).toBeUndefined();
  });

  it("clears on Start over", () => {
    writeDeskChat("s", [welcome, user("u1", "hi")]);
    clearDeskChat();
    expect(readDeskChat()).toBeNull();
  });

  it("works with no storage at all", () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(() => writeDeskChat("s", [user("u1", "hi")])).not.toThrow();
    expect(readDeskChat()).toBeNull();
  });
});

describe("ticket drafted from the conversation", () => {
  it("uses only the visitor's words, first message as the summary", () => {
    const draft = ticketDraftFromChat([
      welcome,
      user("u1", "Outlook keeps asking   for my password"),
      { id: "a1", role: "assistant", content: "Try signing out of Office." },
      user("u2", "Still happening on two laptops"),
    ]);
    expect(draft?.subject).toBe("Outlook keeps asking for my password");
    expect(draft?.message).toBe(
      "From my Ask DE conversation:\n- Outlook keeps asking for my password\n- Still happening on two laptops",
    );
    expect(draft?.message).not.toMatch(/signing out of Office/);
  });

  it("shortens a long first message to a summary", () => {
    const draft = ticketDraftFromChat([user("u1", "x".repeat(200))]);
    expect(draft?.subject.length).toBeLessThanOrEqual(78);
    expect(draft?.subject.endsWith("…")).toBe(true);
  });

  it("returns nothing when the visitor has not said anything", () => {
    expect(ticketDraftFromChat([welcome])).toBeNull();
  });
});
