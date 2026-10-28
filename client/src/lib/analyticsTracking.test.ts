import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

let commands: any[][];
let scripts: any[];
let storage: Map<string, string>;
let location: {hostname: string; pathname: string};
let api: typeof import("./analytics");

beforeEach(async () => {
  vi.resetModules();
  commands = [];
  scripts = [];
  storage = new Map();
  location = { hostname: "digeratiexperts.com", pathname: "/", origin: "https://digeratiexperts.com" } as any;
  vi.stubGlobal("window", { location: { ...location, reload: vi.fn() } });
  location = window.location as any;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("gtag", (...args: any[]) => commands.push(args));
  vi.stubGlobal("document", {
    title: "Home",
    referrer: "https://example.com/campaign?email=private",
    querySelector: vi.fn(() => null),
    head: { appendChild: (script: any) => scripts.push(script) },
    createElement: () => ({}),
  });
  for (const key of ["VITE_CLARITY_ID", "VITE_LINKEDIN_PARTNER_ID", "VITE_META_PIXEL_ID", "VITE_BING_UET_TAG_ID", "VITE_GOOGLE_SITE_VERIFICATION", "VITE_BING_SITE_VERIFICATION"]) vi.stubEnv(key, "");
  api = await import("./analytics");
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const accepted = {analytics: true, marketing: false};
function consent(value = accepted) { storage.set("de_cookie_consent_v2", JSON.stringify(value)); }
function views() { return commands.filter(a => a[0] === "event" && a[1] === "page_view"); }

describe("GA4 consent and pageview ownership", () => {
  it("keeps only the denied-by-default queue in the HTML", () => {
    const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain("'analytics_storage': 'denied'");
    expect(html).not.toMatch(/gtag\(['"]config['"]/);
    expect(html).not.toContain("gtag/js?id=");
  });

  it("does not load or send GA before analytics consent", () => {
    api.initAnalytics(); api.analytics.pageView("/", "Home");
    expect(scripts).toHaveLength(0); expect(views()).toHaveLength(0);
    expect(commands.filter(a => a[0] === "config")).toHaveLength(0);
  });

  it("configures once with automatic pageviews off and sends one initial view", () => {
    consent(); api.initAnalytics(); api.initAnalytics();
    api.analytics.pageView("/", "Home"); api.analytics.pageView("/", "Home");
    expect(scripts).toHaveLength(1); expect(views()).toHaveLength(1);
    expect(commands.filter(a => a[0] === "config")).toHaveLength(1);
    expect(commands.find(a => a[0] === "config")?.[2]).toMatchObject({send_page_view: false});
  });

  it("counts A to B to A but suppresses repeated same-route effects", () => {
    consent(); api.initAnalytics();
    for (const path of ["/", "/solutions", "/solutions", "/"]) {
      location.pathname = path; api.analytics.pageView(path, path);
    }
    expect(views().map(a => a[2].page_path)).toEqual(["/", "/solutions", "/"]);
  });

  it("counts only the current page on consent grant and does not replay denied history", async () => {
    api.initAnalytics(); api.analytics.pageView("/", "Home");
    location.pathname = "/solutions"; document.title = "Solutions";
    api.reportPageReady("/solutions", "Solutions");
    await Promise.resolve();
    api.saveConsent(accepted); api.saveConsent(accepted); await Promise.resolve();
    expect(views()).toHaveLength(1);
    expect(views()[0][2]).toMatchObject({page_path: "/solutions", page_title: "Solutions"});
  });

  it("stops on revocation and tears down revoked SDKs with a fresh document", async () => {
    consent(); api.initAnalytics(); api.reportPageReady("/", "Home"); await Promise.resolve();
    api.saveConsent({analytics:false, marketing:false});
    expect((window as any)["ga-disable-G-1YDMJ38SXD"]).toBe(true);
    api.analytics.pageView("/", "Home"); api.analytics.chatOpened();
    expect(views()).toHaveLength(1);
    expect(commands.some(a => a[1] === "chat_opened")).toBe(false);
    expect(window.location.reload).toHaveBeenCalledOnce();
    api.saveConsent(accepted); await Promise.resolve(); expect(views()).toHaveLength(2); expect(scripts).toHaveLength(1);
  });

  it("does not initialize GA for marketing-only consent", () => {
    api.saveConsent({analytics:false, marketing:true}); api.analytics.pageView("/", "Home");
    expect(scripts).toHaveLength(0); expect(views()).toHaveLength(0);
  });

  it.each([
    ["portal.digeratiexperts.com", "/"],
    ["digeratiexperts.com", "/portal"],
    ["digeratiexperts.com", "/portal/tickets"],
  ])("blocks every explicit event sink on %s%s", (hostname, pathname) => {
    location.hostname = hostname; location.pathname = pathname;
    consent({analytics:true, marketing:true});
    const meta = vi.fn(), bing = vi.fn();
    (window as any).fbq = meta; (window as any).uetq = {push: bing};
    api.initAnalytics(); api.saveConsent({analytics:true, marketing:true});
    api.analytics.pageView(pathname, "Private"); api.analytics.leadCaptured("private");
    api.analytics.bookingOpened("private"); api.analytics.quoteWizardStarted(); api.analytics.chatOpened();
    expect(scripts).toHaveLength(0); expect(views()).toHaveLength(0);
    expect(commands).toHaveLength(0); expect(meta).not.toHaveBeenCalled(); expect(bing).not.toHaveBeenCalled();
  });

  it("disables GA when the public SPA enters a portal route", () => {
    consent(); api.initAnalytics(); api.analytics.pageView("/", "Home");
    location.pathname = "/portal/tickets";
    api.analytics.pageView("/portal/tickets", "Private"); api.analytics.chatOpened();
    expect(views()).toHaveLength(1);
    expect((window as any)["ga-disable-G-1YDMJ38SXD"]).toBe(true);
  });
  it("waits for actual metadata readiness after a slow route and coalesces parent title", async () => {
    consent(); api.initAnalytics();
    expect(views()).toHaveLength(0);
    api.reportPageReady("/", "Child title"); api.reportPageReady("/", "Final title");
    await Promise.resolve();
    expect(views()).toHaveLength(1); expect(views()[0][2].page_title).toBe("Final title");
    api.beginPageVisit(); location.pathname = "/solutions";
    api.reportPageReady("/", "Stale callback"); await Promise.resolve();
    expect(views()).toHaveLength(1);
    api.reportPageReady("/solutions", "Solutions"); await Promise.resolve();
    expect(views()).toHaveLength(2);
    expect(views()[1][2].page_referrer).toBe("https://digeratiexperts.com/");
  });

  it("does not use an inherited document title when consent precedes page readiness", async () => {
    api.saveConsent(accepted); expect(views()).toHaveLength(0);
    api.reportPageReady("/", "Final home title"); await Promise.resolve();
    expect(views()).toHaveLength(1); expect(views()[0][2].page_title).toBe("Final home title");
  });

  it("drops obsolete queued page readiness after a redirect", async () => {
    consent(); api.initAnalytics(); api.reportPageReady("/", "Old");
    api.beginPageVisit(); location.pathname = "/contact";
    api.reportPageReady("/contact", "Contact"); await Promise.resolve();
    expect(views().map(a => a[2].page_path)).toEqual(["/contact"]);
  });

  it("removes query/fragment data and private portal referrers", () => {
    consent(); (document as any).referrer = "https://portal.digeratiexperts.com/portal/tickets/123?token=private";
    api.initAnalytics(); api.analytics.pageView("/", "Home");
    expect(views()[0][2]).toMatchObject({page_location:"https://digeratiexperts.com/",page_referrer:""});
    expect(JSON.stringify(commands)).not.toContain("token=");
  });

  it.each(["/login", "/signup", "/agreement-gate", "/PORTAL/tickets", "/portal?token=x", "/internal/warehouse", "/official-network-planner"])("blocks portal alias %s", path => {
    consent(); location.pathname = path; api.initAnalytics(); api.analytics.pageView(path, "Private");
    expect(scripts).toHaveLength(0); expect(views()).toHaveLength(0);
  });

  it("deduplicates marketing pageviews when multiple metadata effects report readiness", async () => {
    consent({analytics:true,marketing:true}); const meta = vi.fn(); (window as any).fbq = meta;
    api.reportPageReady("/", "Child"); api.reportPageReady("/", "Home"); await Promise.resolve();
    expect(meta).toHaveBeenCalledTimes(1); expect(views()).toHaveLength(1);
  });

  it("reloads when marketing is revoked while analytics remains accepted", () => {
    consent({analytics:true,marketing:true}); api.initAnalytics();
    api.saveConsent({analytics:true,marketing:false});
    expect(window.location.reload).toHaveBeenCalledOnce();
    expect((window as any)["ga-disable-G-1YDMJ38SXD"]).toBe(true);
  });

  it("supports legacy consent and fails closed on malformed or blocked storage", async () => {
    storage.set("de_cookie_consent", "accepted"); api.initAnalytics();
    api.reportPageReady("/", "Home"); await Promise.resolve(); expect(views()).toHaveLength(1);
    storage.delete("de_cookie_consent"); storage.set("de_cookie_consent_v2", "broken-json");
    api.beginPageVisit(); api.analytics.pageView("/", "Home"); expect(views()).toHaveLength(1);
    vi.stubGlobal("localStorage", {getItem:()=>{throw Error("blocked")},setItem:()=>{throw Error("blocked")}});
    api.beginPageVisit(); api.saveConsent(accepted); api.analytics.pageView("/", "Home");
    expect(views()).toHaveLength(1);
  });

  it("excludes private documents even when every optional vendor is configured", () => {
    for (const key of ["VITE_CLARITY_ID", "VITE_LINKEDIN_PARTNER_ID", "VITE_META_PIXEL_ID", "VITE_BING_UET_TAG_ID"]) vi.stubEnv(key, "qa-vendor");
    consent({analytics:true,marketing:true}); location.pathname = "/portal/dashboard";
    api.initAnalytics(); expect(scripts).toHaveLength(0); expect(commands).toHaveLength(0);
  });

  it("loads GA only after page readiness and retains consented events from that visit", async () => {
    consent(); api.initAnalytics(); api.analytics.pricingViewed("IT");
    expect(scripts).toHaveLength(0); expect(commands.some(a=>a[1]==="view_item")).toBe(false);
    api.reportPageReady("/", "Home"); await Promise.resolve();
    expect(commands.filter(a=>a[0]==="event").map(a=>a[1])).toEqual(["page_view","view_item"]);
  });

  it("discards pending engagement on navigation and updates GA context without automatic views", async () => {
    consent(); api.initAnalytics(); api.analytics.pricingViewed("abandoned"); api.beginPageVisit();
    location.pathname="/contact"; api.reportPageReady("/contact","Contact"); await Promise.resolve();
    expect(commands.some(a=>a[1]==="view_item")).toBe(false);
    api.beginPageVisit(); location.pathname="/solutions"; api.reportPageReady("/solutions","Solutions"); await Promise.resolve();
    expect(commands.filter(a=>a[0]==="config" && a[2].update)).toEqual([
      ["config","G-1YDMJ38SXD",{update:true,send_page_view:false,page_location:"https://digeratiexperts.com/solutions",page_referrer:"https://digeratiexperts.com/contact",page_title:"Solutions"}],
    ]);
  });

  it("resumes a Helmet title committed before Suspense reveals and cancels stale observers", async () => {
    let loading = true;
    let notify: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("MutationObserver", class {
      constructor(fn: () => void) { notify = fn; }
      observe() {}
      disconnect = disconnect;
    });
    (document.querySelector as any).mockImplementation(() => loading ? {} : null);
    consent(); api.reportPageReady("/", "Home"); await Promise.resolve();
    expect(views()).toHaveLength(0); expect(scripts).toHaveLength(0);
    loading = false; notify!();
    expect(views()).toHaveLength(1); expect(disconnect).toHaveBeenCalled();
    api.beginPageVisit(); location.pathname = "/contact"; loading = true;
    api.reportPageReady("/contact", "Contact"); await Promise.resolve();
    const stale = notify!;
    api.beginPageVisit(); location.pathname = "/solutions"; loading = false;
    stale(); expect(views()).toHaveLength(1);
  });

});
