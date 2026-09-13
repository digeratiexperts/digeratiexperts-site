import { describe, expect, it, vi, afterEach } from "vitest";
import {
  DESK_INCIDENT_STARTER,
  DESK_PAGE_COPY,
  greetingForPage,
  inferDeskPageType,
  prefersReducedMotion,
  startersForPage,
  streamWords,
  typewriteText,
} from "./deskAskDeMotion";

describe("deskAskDeMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps acceptance routes to page-aware greetings", () => {
    const cases: Array<[string, keyof typeof DESK_PAGE_COPY]> = [
      ["/", "home"],
      ["/pricing", "pricing"],
      ["/compliance/hipaa", "compliance"],
      ["/store", "store"],
    ];
    for (const [path, page] of cases) {
      expect(inferDeskPageType(path)).toBe(page);
      expect(greetingForPage(page)).toBe(DESK_PAGE_COPY[page].greet);
    }
  });

  it("returns four contextual starters plus security incident last", () => {
    for (const path of ["/", "/pricing", "/compliance/hipaa", "/store"]) {
      const chips = startersForPage(inferDeskPageType(path));
      expect(chips).toHaveLength(5);
      expect(chips.slice(0, 4).every((c) => !c.ticketChip)).toBe(true);
      expect(chips[4]).toEqual(DESK_INCIDENT_STARTER);
    }
  });

  it("typewrite and stream are instant under reduced motion", () => {
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    expect(prefersReducedMotion()).toBe(true);

    const typed: string[] = [];
    let typedDone = false;
    typewriteText(
      "Hello — world?",
      (p) => typed.push(p),
      () => {
        typedDone = true;
      },
    );
    expect(typed).toEqual(["Hello — world?"]);
    expect(typedDone).toBe(true);

    const streamed: string[] = [];
    let streamDone = false;
    streamWords(
      "one two three",
      (p) => streamed.push(p),
      () => {
        streamDone = true;
      },
    );
    expect(streamed).toEqual(["one two three"]);
    expect(streamDone).toBe(true);
  });
});
