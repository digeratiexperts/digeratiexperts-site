import { beforeEach, afterEach, it, expect, vi } from "vitest";

const begin = vi.fn(), disable = vi.fn();
vi.mock("./analytics", async importOriginal => ({
  ...(await importOriginal<typeof import("./analytics")>()),
  beginPageVisit: begin, disableAnalytics: disable,
}));

let w: any, events: Map<string, (event: Event) => void>;
beforeEach(() => {
  vi.resetModules(); begin.mockClear(); disable.mockClear(); events = new Map();
  const location: any = new URL("https://digeratiexperts.com/");
  location.assign = vi.fn(); location.replace = vi.fn(); location.reload = vi.fn();
  w = {
    location,
    history: {
      pushState: vi.fn((_data, _unused, url) => { location.href = new URL(url, location.href).href; }),
      replaceState: vi.fn((_data, _unused, url) => { location.href = new URL(url, location.href).href; }),
    },
    addEventListener: (name: string, fn: (event: Event) => void) => events.set(name, fn),
  };
  vi.stubGlobal("window", w);
});
afterEach(() => vi.unstubAllGlobals());

it.each(["pushState", "replaceState"])("%s crosses to portal through a fresh document before mutating history", async method => {
  const {installAnalyticsNavigationBoundary} = await import("./analyticsNavigation");
  const original = w.history[method]; installAnalyticsNavigationBoundary(w);
  w.history[method]({}, "", "/portal/tickets?test=1");
  expect(original).not.toHaveBeenCalled(); expect(w.location.pathname).toBe("/");
  expect(disable).toHaveBeenCalledOnce();
  const fullNavigation = method === "pushState" ? w.location.assign : w.location.replace;
  expect(fullNavigation).toHaveBeenCalledWith("https://digeratiexperts.com/portal/tickets?test=1");
});

it("keeps public navigation in the SPA and starts a fresh visit for pathname changes only", async () => {
  const {installAnalyticsNavigationBoundary} = await import("./analyticsNavigation");
  installAnalyticsNavigationBoundary(w);
  w.history.pushState({}, "", "/solutions");
  w.history.replaceState({}, "", "/solutions?q=1#part");
  expect(begin).toHaveBeenCalledOnce(); expect(w.location.pathname).toBe("/solutions");
  expect(w.location.assign).not.toHaveBeenCalled();
});

it("portal to public also requires a new document", async () => {
  w.location.pathname = "/portal/login";
  const {installAnalyticsNavigationBoundary} = await import("./analyticsNavigation");
  installAnalyticsNavigationBoundary(w); w.history.pushState({}, "", "/");
  expect(w.location.assign).toHaveBeenCalledWith("https://digeratiexperts.com/");
  expect(w.location.pathname).toBe("/portal/login");
});

it("allows portal-to-portal navigation without loading a public document", async () => {
  w.location.pathname = "/portal/login";
  const {installAnalyticsNavigationBoundary} = await import("./analyticsNavigation");
  installAnalyticsNavigationBoundary(w); w.history.pushState({}, "", "/portal/dashboard");
  expect(w.location.pathname).toBe("/portal/dashboard"); expect(w.location.assign).not.toHaveBeenCalled();
});

it("reloads and prevents rendering for legacy cross-context history entries", async () => {
  const {installAnalyticsNavigationBoundary, isAnalyticsDocumentContextCurrent} = await import("./analyticsNavigation");
  installAnalyticsNavigationBoundary(w); w.location.pathname = "/portal/tickets";
  events.get("popstate")!(new Event("popstate"));
  expect(disable).toHaveBeenCalledOnce(); expect(w.location.reload).toHaveBeenCalledOnce();
  expect(isAnalyticsDocumentContextCurrent()).toBe(false);
});

it("counts public back/forward visits and preserves native cross-origin history behavior", async () => {
  const {installAnalyticsNavigationBoundary} = await import("./analyticsNavigation");
  const original = w.history.pushState;
  installAnalyticsNavigationBoundary(w); w.location.pathname = "/contact"; events.get("popstate")!(new Event("popstate"));
  expect(begin).toHaveBeenCalledOnce();
  w.history.pushState({}, "", "https://other.example/portal");
  expect(original).toHaveBeenCalledWith({}, "", "https://other.example/portal");
  expect(w.location.assign).not.toHaveBeenCalled();
});
