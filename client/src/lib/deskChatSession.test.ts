import { CRISIS_HISTORY_PLACEHOLDER, CRISIS_REPLY } from "@shared/deskCrisis";
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

describe("Ask DE conversation never keeps card data", () => {
  let store: MemoryStorage;
  beforeEach(() => {
    store = new MemoryStorage();
    (globalThis as unknown as { window: unknown }).window = { sessionStorage: store };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("refuses to write a PAN to sessionStorage and drops one on read", () => {
    const pan = "4111111111111111";
    writeDeskChat("s-card", [welcome, user("u-pan", `please charge ${pan}`)], 10);
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).toBeNull();

    writeDeskChat("s-ok", [welcome, user("u1", "Outlook is broken"), user("u-pan", `please charge ${pan}`)], 10);
    const raw = store.getItem(DESK_CHAT_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain(pan);
    const back = readDeskChat(11);
    expect(back?.messages.map((m) => m.id)).toEqual(["welcome", "u1"]);
    const draft = ticketDraftFromChat(back?.messages || []);
    expect(draft?.message).not.toContain(pan);
  });
});


describe("Ask DE crisis history privacy", () => {
  const crisis = "I'm lonely and want to die";
  const ordinary = "Please kill the stuck process; the battery is dead";
  let store: MemoryStorage;
  beforeEach(() => {
    store = new MemoryStorage();
    (globalThis as unknown as { window: unknown }).window = { sessionStorage: store };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("redacts a new crisis turn before any reply arrives without mutating live messages", () => {
    const messages = [welcome, user("crisis", crisis)];
    writeDeskChat("s", messages, 10);
    const raw = store.getItem(DESK_CHAT_STORAGE_KEY)!;
    expect(raw).not.toContain(crisis);
    expect(JSON.parse(raw).messages[1]).toMatchObject({ id: "crisis", content: CRISIS_HISTORY_PLACEHOLDER });
    expect(messages[1].content).toBe(crisis);
    expect(ticketDraftFromChat(messages)).toBeNull();
  });

  it("cleans legacy storage on read and keeps its original expiry", () => {
    store.setItem(DESK_CHAT_STORAGE_KEY, JSON.stringify({
      sessionId: "legacy", savedAt: 10,
      messages: [user("crisis", crisis), { id: "reply", role: "assistant", content: CRISIS_REPLY }, user("it", ordinary)],
    }));
    const back = readDeskChat(20)!;
    expect(back.savedAt).toBe(10);
    expect(back.messages.map(m => m.content)).toEqual([CRISIS_HISTORY_PLACEHOLDER, CRISIS_REPLY, ordinary]);
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).not.toContain(crisis);
    expect(JSON.parse(store.getItem(DESK_CHAT_STORAGE_KEY)!).savedAt).toBe(10);
    expect(ticketDraftFromChat(back.messages)?.subject).toBe(ordinary);
    expect(readDeskChat(10 + DESK_CHAT_TTL_MS + 1)).toBeNull();
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).toBeNull();
  });

  it("removes unsafe legacy data when rewriting storage fails", () => {
    store.setItem(DESK_CHAT_STORAGE_KEY, JSON.stringify({ savedAt: 10, messages: [user("crisis", crisis)] }));
    store.setItem = () => { throw new Error("quota"); };
    expect(() => readDeskChat(11)).not.toThrow();
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).toBeNull();
  });

  it("handles a crisis-only legacy conversation and repeats safely", () => {
    store.setItem(DESK_CHAT_STORAGE_KEY, JSON.stringify({ savedAt: 10, messages: [user("crisis", crisis)] }));
    for (let now = 11; now < 15; now++) {
      const back = readDeskChat(now)!;
      expect(back.messages[0].content).toBe(CRISIS_HISTORY_PLACEHOLDER);
      expect(ticketDraftFromChat(back.messages)).toBeNull();
      writeDeskChat(back.sessionId, back.messages, now);
      expect(store.getItem(DESK_CHAT_STORAGE_KEY)).not.toContain(crisis);
    }
  });

  it("keeps ordinary IT chat and the resource reply across repeated crisis/reload flows", () => {
    let messages: DeskStoredMessage[] = [user("it", ordinary)];
    for (let turn = 0; turn < 3; turn++) {
      messages.push(user(`crisis-${turn}`, crisis), { id: `reply-${turn}`, role: "assistant", content: CRISIS_REPLY });
      writeDeskChat("s", messages, 10 + turn);
      messages = readDeskChat(11 + turn)!.messages;
      expect(messages.filter(m => m.role === "assistant").every(m => m.content === CRISIS_REPLY)).toBe(true);
      expect(ticketDraftFromChat(messages)).toEqual({ subject: ordinary, message: `From my Ask DE conversation:\n- ${ordinary}` });
      expect(store.getItem(DESK_CHAT_STORAGE_KEY)).not.toContain(crisis);
    }
  });

  it("excludes raw crisis and restored placeholders from mixed ticket drafts", () => {
    const draft = ticketDraftFromChat([user("crisis", crisis), user("placeholder", CRISIS_HISTORY_PLACEHOLDER), user("it", ordinary)]);
    expect(draft).toEqual({ subject: ordinary, message: `From my Ask DE conversation:\n- ${ordinary}` });
    expect(ticketDraftFromChat([user("placeholder", CRISIS_HISTORY_PLACEHOLDER)])).toBeNull();
  });

  it("retains the message cap and card-data guard alongside crisis redaction", () => {
    const messages = Array.from({ length: 70 }, (_, i) => user(`u${i}`, i % 2 ? crisis : ordinary));
    messages.push(user("pan", "please charge 4111111111111111"));
    writeDeskChat("s", messages, 10);
    const back = readDeskChat(11)!;
    expect(back.messages).toHaveLength(DESK_CHAT_MAX_MESSAGES);
    expect(back.messages.at(-1)?.id).toBe("u69");
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).not.toContain(crisis);
    expect(store.getItem(DESK_CHAT_STORAGE_KEY)).not.toContain("4111111111111111");
  });
});