import { describe, expect, it, vi, afterEach } from "vitest";
import {
  DESK_INCIDENT_STARTER,
  DESK_PAGE_COPY,
  greetingForPage,
  inferDeskPageType,
  isCookieBannerBlocking,
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

  it("treats missing cookie consent as blocking even before the banner mounts", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const banner = { present: false };
    vi.stubGlobal("document", { querySelector: () => (banner.present ? {} : null) });

    // No consent stored, banner not yet in the DOM (it mounts ~1.2 s after load): still blocking.
    expect(isCookieBannerBlocking()).toBe(true);
    // Consent stored and banner gone: not blocking.
    store.set("de_cookie_consent_v2", "{}");
    expect(isCookieBannerBlocking()).toBe(false);
    // Consent stored but banner still animating out: blocking until it is gone.
    banner.present = true;
    expect(isCookieBannerBlocking()).toBe(true);
  });
});
