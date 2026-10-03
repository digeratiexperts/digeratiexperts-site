import { describe, expect, it } from "vitest";
import {
  DESK_COMPOSER_HINT_KEY,
  DESK_EXPAND_HINT_KEY,
  DESK_HINT_MAX,
  DESK_HINT_RETIRED,
  composerHintDecision,
  deskHintAllowed,
  expandHintShouldStart,
  readDeskHint,
  writeDeskHint,
} from "./deskHints";

/** An in-memory Storage stand-in. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    data,
  };
}

/** A storage that throws on every access, like a blocked or private-mode store. */
const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

const fresh = { used: false, shown: 0 };

describe("desk hint storage", () => {
  it("reads a missing record as a fresh one", () => {
    expect(readDeskHint(DESK_EXPAND_HINT_KEY, memoryStorage())).toEqual(fresh);
  });

  it("round-trips what it writes", () => {
    const store = memoryStorage();
    writeDeskHint(DESK_COMPOSER_HINT_KEY, { used: false, shown: 2 }, store);
    expect(readDeskHint(DESK_COMPOSER_HINT_KEY, store)).toEqual({ used: false, shown: 2 });
  });

  it("keeps the two hints in separate records", () => {
    const store = memoryStorage();
    writeDeskHint(DESK_COMPOSER_HINT_KEY, DESK_HINT_RETIRED, store);
    expect(readDeskHint(DESK_EXPAND_HINT_KEY, store)).toEqual(fresh);
  });

  it("treats garbage, negative and fractional counts as safe values", () => {
    expect(readDeskHint("k", memoryStorage({ k: "{not json" }))).toEqual(fresh);
    expect(readDeskHint("k", memoryStorage({ k: "null" }))).toEqual(fresh);
    expect(readDeskHint("k", memoryStorage({ k: '{"used":"yes","shown":"lots"}' }))).toEqual(fresh);
    expect(readDeskHint("k", memoryStorage({ k: '{"shown":-4}' }))).toEqual(fresh);
    expect(readDeskHint("k", memoryStorage({ k: '{"shown":2.7}' }))).toEqual({ used: false, shown: 2 });
  });

  it("never throws when storage is blocked, and reads blocked storage as fresh", () => {
    expect(() => writeDeskHint("k", DESK_HINT_RETIRED, throwingStorage)).not.toThrow();
    expect(readDeskHint("k", throwingStorage)).toEqual(fresh);
    expect(readDeskHint("k", null)).toEqual(fresh);
    expect(() => writeDeskHint("k", fresh, null)).not.toThrow();
  });

  it("allows a hint until it is used or has been shown the maximum number of times", () => {
    expect(deskHintAllowed(fresh)).toBe(true);
    expect(deskHintAllowed({ used: false, shown: DESK_HINT_MAX - 1 })).toBe(true);
    expect(deskHintAllowed({ used: false, shown: DESK_HINT_MAX })).toBe(false);
    expect(deskHintAllowed({ used: true, shown: 0 })).toBe(false);
    expect(deskHintAllowed(DESK_HINT_RETIRED)).toBe(false);
  });
});

describe("text box hint", () => {
  const ready = {
    isOpen: true,
    playedThisLoad: false,
    stored: fresh,
    visitorHasSpoken: false,
    agentLive: false,
    onAskDe: true,
    greetingComplete: true,
    expandHintShowing: false,
  };

  it("plays on Ask DE once the greeting has finished", () => {
    expect(composerHintDecision(ready)).toBe("play");
  });

  it("does nothing while the Desk is closed or once it has played this page load", () => {
    expect(composerHintDecision({ ...ready, isOpen: false })).toBe("idle");
    expect(composerHintDecision({ ...ready, playedThisLoad: true })).toBe("idle");
  });

  it("waits for the greeting, and never starts on top of the full-screen hint", () => {
    expect(composerHintDecision({ ...ready, greetingComplete: false })).toBe("wait");
    expect(composerHintDecision({ ...ready, expandHintShowing: true })).toBe("wait");
  });

  it("settles (so the full-screen hint may go) when it will not play", () => {
    expect(composerHintDecision({ ...ready, onAskDe: false })).toBe("settle");
    expect(composerHintDecision({ ...ready, visitorHasSpoken: true })).toBe("settle");
    expect(composerHintDecision({ ...ready, agentLive: true })).toBe("settle");
    expect(composerHintDecision({ ...ready, stored: DESK_HINT_RETIRED })).toBe("settle");
    expect(composerHintDecision({ ...ready, stored: { used: false, shown: DESK_HINT_MAX } })).toBe("settle");
  });

  it("settles rather than waits when it is ruled out, even before the greeting finishes", () => {
    // Otherwise a returning visitor would hold the full-screen hint back for no reason.
    expect(composerHintDecision({ ...ready, greetingComplete: false, stored: DESK_HINT_RETIRED })).toBe("settle");
  });
});

describe("full-screen hint", () => {
  const ready = {
    isOpen: true,
    canExpand: true,
    isFullscreen: false,
    agentLive: false,
    playedThisLoad: false,
    composerHintSettled: true,
    composerHintShowing: false,
    composerHasText: false,
    stored: fresh,
  };

  it("starts once the text box hint has settled", () => {
    expect(expandHintShouldStart(ready)).toBe(true);
  });

  it("waits for the text box hint, so the two never animate together", () => {
    expect(expandHintShouldStart({ ...ready, composerHintSettled: false })).toBe(false);
    expect(expandHintShouldStart({ ...ready, composerHintShowing: true })).toBe(false);
  });

  it("never starts while there is text in the box", () => {
    expect(expandHintShouldStart({ ...ready, composerHasText: true })).toBe(false);
  });

  it("stays off when it cannot help: closed, already full screen, too narrow to expand, or a person is live", () => {
    expect(expandHintShouldStart({ ...ready, isOpen: false })).toBe(false);
    expect(expandHintShouldStart({ ...ready, isFullscreen: true })).toBe(false);
    expect(expandHintShouldStart({ ...ready, canExpand: false })).toBe(false);
    expect(expandHintShouldStart({ ...ready, agentLive: true })).toBe(false);
  });

  it("plays once per page load and retires after use or the per-browser maximum", () => {
    expect(expandHintShouldStart({ ...ready, playedThisLoad: true })).toBe(false);
    expect(expandHintShouldStart({ ...ready, stored: DESK_HINT_RETIRED })).toBe(false);
    expect(expandHintShouldStart({ ...ready, stored: { used: false, shown: DESK_HINT_MAX } })).toBe(false);
  });

  it("is retired for good by the record the Desk writes when full screen is used", () => {
    const store = memoryStorage();
    writeDeskHint(DESK_EXPAND_HINT_KEY, DESK_HINT_RETIRED, store);
    expect(expandHintShouldStart({ ...ready, stored: readDeskHint(DESK_EXPAND_HINT_KEY, store) })).toBe(false);
  });
});
