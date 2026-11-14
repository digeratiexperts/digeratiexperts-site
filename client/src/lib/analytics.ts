import { isPaymentPagePath } from "@shared/paymentPage";
import { marketingAllowedByConsent, navigatorSignalsGpc } from "@shared/gpc";
import {
  isPortalContext as portalContextOf,
  skipMarketingPixels as skipMarketingPixelsFor,
} from "@shared/trackingExclusions";


declare function gtag(...args: any[]): void;

const CONSENT_KEY = "de_cookie_consent_v2";
const GA_ID = "G-1YDMJ38SXD";
let lastGaPagePath: string | undefined;
let lastMarketingPagePath: string | undefined;
let readyPage: { path: string; title: string } | undefined;
let previousPublicLocation: string | undefined;
let visit = 0;
let pendingGaEvents: Array<{event: string; params?: Record<string, any>}> = [];
let readinessObserver: MutationObserver | undefined;

/** Called before a same-document path change, including back/forward. */
export function beginPageVisit() {
  visit++;
  readinessObserver?.disconnect();
  readinessObserver = undefined;
  pendingGaEvents = [];
  readyPage = undefined;
  lastGaPagePath = undefined;
  lastMarketingPagePath = undefined;
}

export function disableAnalytics() {
  (window as any)[`ga-disable-${GA_ID}`] = true;
}

/** SEO hooks/Helmet signal completion, never the early route-change effect. */
export function reportPageReady(path: string, title: string) {
  if (skipMarketingPixels() || path !== window.location.pathname || !title.trim()) return;
  readyPage = { path, title };
  const currentVisit = visit;
  // Coalesce child/parent SEO effects in the same commit; parent metadata wins.
  queueMicrotask(() => flushReadyPage(currentVisit));
}

function flushReadyPage(currentVisit: number) {
  if (visit !== currentVisit || !readyPage || readyPage.path !== window.location.pathname || skipMarketingPixels()) return;
  if (document.querySelector?.("[data-page-loading]")) {
    // Helmet can commit its title during concurrent rendering, before React
    // reveals the lazy page. Resume on the actual Suspense reveal, not a timer.
    if (!readinessObserver && typeof MutationObserver !== "undefined") {
      readinessObserver = new MutationObserver(() => flushReadyPage(currentVisit));
      readinessObserver.observe(document.getElementById?.("app-canvas") || document.documentElement, {
        childList: true, subtree: true,
      });
    }
    return;
  }
  readinessObserver?.disconnect();
  readinessObserver = undefined;
  analytics.pageView(readyPage.path, readyPage.title);
}

function publicReferrer(value: string): string {
  try {
    const url = new URL(value);
    return isPortalContext(url.hostname, url.pathname) ? "" : url.origin + url.pathname;
  } catch { return ""; }
}

function skipMarketingPixels(): boolean {
  if (typeof window === "undefined") return false;
  return skipMarketingPixelsFor(window.location.hostname, window.location.pathname);
}

function readGpc(): boolean {
  try {
    return navigatorSignalsGpc((navigator as any).globalPrivacyControl);
  } catch {
    return false;
  }
}

/** Basic consent mode: no Google tag request before analytics consent. */
function initGoogleAnalytics(consent: ConsentConfig, page?: { page_location: string; page_referrer: string; page_title: string }): boolean {
  const w = window as any;
  w[`ga-disable-${GA_ID}`] = skipMarketingPixels() || !consent.analytics;
  if (skipMarketingPixels() || !consent.analytics || w.__DE_GA_INIT__ || !page) return false;
  // index.html supplies a denied-by-default dataLayer/gtag queue.
  if (typeof gtag === "undefined") return false;
  gtag("js", new Date());
  gtag("config", GA_ID, {
    send_page_view: false,
    anonymize_ip: true,
    ...page,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  w.__DE_GA_INIT__ = true;
  return true;
}

export type ConsentConfig = {
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
};

function getConsent(): ConsentConfig {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return applyGpc({ analytics: parsed?.analytics === true, marketing: parsed?.marketing === true });
    }
    const legacy = localStorage.getItem("de_cookie_consent");
    if (legacy === "accepted") return applyGpc({ analytics: true, marketing: true });
    if (legacy === "rejected") return applyGpc({ analytics: false, marketing: false });
  } catch {}
  return applyGpc({ analytics: false, marketing: false });
}

function applyGpc(config: ConsentConfig): ConsentConfig {
  return {
    ...config,
    marketing: marketingAllowedByConsent(config.marketing, readGpc()),
  };
}

function updateGtagConsent(config: ConsentConfig) {
  try {
    if (typeof gtag === "undefined") return;
    gtag("consent", "update", {
      analytics_storage: config.analytics ? "granted" : "denied",
      ad_storage: config.marketing ? "granted" : "denied",
      ad_user_data: config.marketing ? "granted" : "denied",
      ad_personalization: config.marketing ? "granted" : "denied",
    });
  } catch {}
}

function updateClarityConsent(config: ConsentConfig) {
  try {
    const clarityId = (window as any).__CLARITY_ID__;
    if (!clarityId || !(window as any).clarity) return;
    if (!config.analytics) {
      (window as any).clarity("stop");
    }
  } catch {}
}

function updateMetaConsent(config: ConsentConfig) {
  try {
    const f = window as any;
    if (!f.fbq) return;
    f.fbq("consent", config.marketing ? "grant" : "revoke");
  } catch {}
}

function updateBingConsent(config: ConsentConfig) {
  try {
    const w = window as any;
    w.uetq = w.uetq || [];
    w.uetq.push("consent", "update", {
      ad_storage: config.marketing ? "granted" : "denied",
    });
  } catch {}
}

/** Inject Google / Bing webmaster verification tags when build env provides them. */
export function injectSearchVerificationTags() {
  const google = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined;
  const bing = import.meta.env.VITE_BING_SITE_VERIFICATION as string | undefined;
  if (google) {
    let tag = document.querySelector('meta[name="google-site-verification"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "google-site-verification");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", google);
  }
  if (bing) {
    let tag = document.querySelector('meta[name="msvalidate.01"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "msvalidate.01");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", bing);
  }
}

export function saveConsent(config: ConsentConfig) {
  const previous = getConsent();
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ ...config, timestamp: new Date().toISOString() })
    );
    localStorage.setItem("de_cookie_consent", config.analytics || config.marketing ? "accepted" : "rejected");
  } catch {}
  // Disable collection before the consent update; denying storage alone can
  // still permit cookieless pings from a previously loaded Google tag.
  (window as any)[`ga-disable-${GA_ID}`] = skipMarketingPixels() || !config.analytics;
  if (!config.analytics) { lastGaPagePath = undefined; pendingGaEvents = []; }
  if (!config.marketing) lastMarketingPagePath = undefined;
  if (skipMarketingPixels()) return;
  updateGtagConsent(config);
  updateClarityConsent(config);
  updateMetaConsent(config);
  updateBingConsent(config);
  if ((previous.analytics && !config.analytics) || (previous.marketing && !config.marketing)) {
    // Third-party SDKs cannot all be unloaded reliably. A new document starts
    // with the reduced consent and no revoked SDKs (notably LinkedIn/Clarity).
    disableAnalytics();
    window.location.reload();
    return;
  }
  if (config.marketing || config.analytics) initAnalytics();
  // The initial SPA effect ran while consent was denied. Count only the
  // current public page on a new grant, never replay pre-consent navigation.
  if (((!previous.analytics && config.analytics) || (!previous.marketing && config.marketing)) &&
      readyPage?.path === window.location.pathname) {
    reportPageReady(readyPage.path, readyPage.title);
  }
}

/**
 * Signed-in client portal pages carry tickets, invoices and people. Marketing
 * analytics (GA, Meta, LinkedIn, Bing and Clarity session recording) never
 * load there, whatever the visitor accepted on the public site. Auth aliases,
 * staff-only internal routes and the standalone challenger preview are also excluded.
 */
export function isPortalContext(hostname: string, pathname: string): boolean {
  return portalContextOf(hostname, pathname);
}


export function initAnalytics() {
  injectSearchVerificationTags();
  if (skipMarketingPixels()) {
    (window as any)[`ga-disable-${GA_ID}`] = true;
    return;
  }
  const consent = getConsent();
  updateGtagConsent(consent);
  initGoogleAnalytics(consent);

  // Microsoft Clarity (analytics-gated)
  const clarityId = import.meta.env.VITE_CLARITY_ID;
  if (clarityId && consent.analytics && !(window as any).__CLARITY_ID__ && !(window as any).__DE_DESK_OPEN__) {
    const w = window as any;
    w.clarity = w.clarity || function () { (w.clarity.q = w.clarity.q || []).push(arguments); };
    // Strict masking: all text and inputs are masked.
    w.clarity("set", "maskAllText", true);
    w.clarity("set", "maskAllInputs", true);
    (function (c: any, l: any, a: any, r: any, i: any) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      const t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
      c.__CLARITY_ID__ = i;
    })(window, document, "clarity", "script", clarityId);
  }

  // LinkedIn Insight Tag (marketing-gated)
  const linkedinId = import.meta.env.VITE_LINKEDIN_PARTNER_ID;
  if (linkedinId && consent.marketing && !(window as any).__LI_INIT__) {
    (window as any)._linkedin_partner_id = linkedinId;
    (window as any)._linkedin_data_partner_ids = (window as any)._linkedin_data_partner_ids || [];
    (window as any)._linkedin_data_partner_ids.push(linkedinId);
    const s = document.getElementsByTagName("script")[0];
    const b = document.createElement("script");
    b.type = "text/javascript";
    b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode?.insertBefore(b, s);
    (window as any).__LI_INIT__ = true;
  }

  // Meta Pixel (marketing-gated)
  const metaPixelId = import.meta.env.VITE_META_PIXEL_ID;
  if (metaPixelId && consent.marketing && !(window as any).__FB_INIT__) {
    const f = window as any;
    const fbq: any = function (...args: any[]) {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    f.fbq = fbq;
    f._fbq = fbq;
    const n = document.createElement("script");
    n.async = true;
    n.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(n);
    fbq("consent", "grant");
    fbq("init", metaPixelId);
    f.__FB_INIT__ = true;
  }

  // Bing UET (marketing-gated)
  const bingUet = import.meta.env.VITE_BING_UET_TAG_ID as string | undefined;
  if (bingUet && consent.marketing && !(window as any).__BING_UET__) {
    const w = window as any;
    w.uetq = w.uetq || [];
    (function (w: any, d: Document, t: string, r: string, u: string) {
      let f: any, n: any, i: any;
      w[u] = w[u] || [];
      f = function () {
        const o: any = { ti: bingUet, enableAutoSpaTracking: true };
        o.q = w[u];
        // UET is defined globally by bat.js
        w[u] = new (w as any).UET(o);
        w[u].push("pageLoad");
      };
      n = d.createElement(t);
      n.src = r;
      n.async = 1;
      n.onload = n.onreadystatechange = function (this: any) {
        const s = this.readyState;
        if (!s || s === "loaded" || s === "complete") {
          f();
          n.onload = n.onreadystatechange = null;
        }
      };
      i = d.getElementsByTagName(t)[0];
      i.parentNode?.insertBefore(n, i);
    })(window, document, "script", "https://bat.bing.com/bat.js", "uetq");
    w.__BING_UET__ = true;
  }
}

function fireGtag(event: string, params?: Record<string, any>) {
  if (skipMarketingPixels() || !getConsent().analytics) return;
  if (!readyPage || readyPage.path !== window.location.pathname || !(window as any).__DE_GA_INIT__) {
    // Preserve consented events from the current commit until its metadata is
    // ready. Navigation/revocation discards this buffer; denied events never enter.
    pendingGaEvents.push({ event, params });
    return;
  }
  try {
    if (typeof gtag === "undefined") return;
    gtag("event", event, { ...params, send_to: "G-1YDMJ38SXD" });
  } catch {}
}

function fireMetaPixel(event: string, params?: Record<string, any>) {
  if (skipMarketingPixels()) return;
  try {
    const f = window as any;
    if (!f.fbq) return;
    f.fbq("track", event, params);
  } catch {}
}

function fireBing(event: string, params?: Record<string, any>) {
  if (skipMarketingPixels()) return;
  try {
    const w = window as any;
    if (!w.uetq) return;
    w.uetq.push("event", event, params || {});
  } catch {}
}

function track(event: string, params?: Record<string, any>) {
  const consent = getConsent();
  if (!consent.analytics) return;
  fireGtag(event, params);
}

function trackMarketing(gaEvent: string, metaEvent: string, params?: Record<string, any>) {
  const consent = getConsent();
  if (consent.analytics) fireGtag(gaEvent, params);
  if (consent.marketing) {
    fireMetaPixel(metaEvent, params);
    fireBing(metaEvent, params);
  }
}

export const analytics = {
  leadCaptured(source: string, method: string = "form") {
    trackMarketing("generate_lead", "Lead", { source, method, event_category: "conversion" });
  },

  bookingOpened(source: string) {
    track("book_appointment", { source, event_category: "engagement" });
    const consent = getConsent();
    if (consent.marketing) {
      fireMetaPixel("Schedule", { source });
      fireBing("schedule", { source });
    }
  },

  contactFormSubmitted(subject: string) {
    trackMarketing("contact", "Contact", { subject, event_category: "conversion" });
  },

  pricingViewed(tier: string) {
    track("view_item", { item_name: tier, item_category: "pricing", event_category: "engagement" });
  },

  pricingCTAClicked(tier: string, action: "schedule" | "checkout") {
    track("select_item", { item_name: tier, item_category: "pricing", action, event_category: "conversion" });
  },

  /** `variant` is the exit popup split-test version (lib/exitPopupVariant.ts). */
  exitIntentShown(variant?: string) {
    track("exit_intent_shown", { event_category: "engagement", ...(variant ? { variant } : {}) });
  },

  exitIntentConverted(variant?: string) {
    trackMarketing("generate_lead", "Lead", { source: "exit_intent", method: "popup", event_category: "conversion", ...(variant ? { variant } : {}) });
  },

  quoteWizardStarted() {
    track("begin_checkout", { event_category: "quote_wizard" });
    const consent = getConsent();
    if (consent.marketing) fireMetaPixel("InitiateCheckout", { content_name: "quote_wizard" });
  },

  quoteWizardStep(step: number, stepName: string) {
    track("checkout_progress", { step, checkout_step: step, step_name: stepName, event_category: "quote_wizard" });
  },

  quoteWizardCompleted(data: { industry?: string; users?: number; budget?: string }) {
    trackMarketing("generate_lead", "Lead", {
      source: "quote_wizard",
      method: "wizard",
      ...data,
      event_category: "conversion",
    });
    const consent = getConsent();
    if (consent.marketing) fireMetaPixel("SubmitApplication", data);
  },

  scrollDepth(percent: number, page: string) {
    track("scroll", { percent_scrolled: percent, page_path: page, event_category: "engagement" });
  },

  pageView(path: string, title: string) {
    if (skipMarketingPixels() || isPortalContext(window.location.hostname, path.split(/[?#]/)[0])) {
      (window as any)[`ga-disable-${GA_ID}`] = true;
      lastGaPagePath = undefined;
      return;
    }
    const consent = getConsent();
    const page = {
      page_location: window.location.origin + path.split(/[?#]/)[0],
      page_referrer: previousPublicLocation ?? publicReferrer(document.referrer),
      page_title: title,
    };
    const initialized = initGoogleAnalytics(consent, page);
    if (consent.analytics && lastGaPagePath !== path) {
      try {
        if (typeof gtag !== "undefined") {
          if (!initialized) {
            // Keep subsequent automatic engagement events on the current page.
            // update:true merges context without reinitializing the destination.
            gtag("config", GA_ID, { update: true, send_page_view: false, ...page });
          }
          gtag("event", "page_view", { page_path: path, ...page, send_to: GA_ID });
          lastGaPagePath = path;
          previousPublicLocation = page.page_location;
          const pending = pendingGaEvents;
          pendingGaEvents = [];
          for (const item of pending) fireGtag(item.event, item.params);
        }
      } catch {}
    }
    if (consent.marketing && lastMarketingPagePath !== path) {
      lastMarketingPagePath = path;
      fireMetaPixel("PageView");
      try {
        const w = window as any;
        w.uetq = w.uetq || [];
        w.uetq.push("event", "page_view", { page_path: path });
      } catch {}
    }
  },

  storeAddToCart(productName: string, price: number, productId: string) {
    trackMarketing("add_to_cart", "AddToCart", {
      currency: "USD",
      value: price,
      items: [{ item_id: productId, item_name: productName, price }],
    });
  },

  storeRemoveFromCart(productName: string, productId: string) {
    track("remove_from_cart", {
      item_id: productId,
      item_name: productName,
      event_category: "ecommerce",
    });
  },

  storeViewCart(value: number, itemCount: number) {
    track("view_cart", { currency: "USD", value, item_count: itemCount, event_category: "ecommerce" });
  },

  storeRequestQuote(value: number) {
    track("request_quote", { currency: "USD", value, event_category: "ecommerce" });
  },

  storeAcceptRecommendation(productName: string, reason: string) {
    track("accept_recommendation", {
      item_name: productName,
      reason,
      event_category: "ecommerce",
    });
  },

  storeCoverageGapViewed(label: string) {
    track("coverage_gap_viewed", { coverage_label: label, event_category: "ecommerce" });
  },

  storeCheckoutStarted(value: number) {
    trackMarketing("begin_checkout", "InitiateCheckout", {
      currency: "USD",
      value,
      event_category: "ecommerce",
    });
  },

  storeOrderCompleted(orderId: string, value: number) {
    trackMarketing("purchase", "Purchase", {
      transaction_id: orderId,
      value,
      currency: "USD",
      event_category: "ecommerce",
    });
  },

  chatOpened() {
    track("chat_opened", { event_category: "advisor_chat" });
  },
  chatConversationStarted() {
    track("conversation_started", { event_category: "advisor_chat" });
  },
  chatQualifiedQuestion() {
    track("qualified_question", { event_category: "advisor_chat" });
  },
  chatServiceRecommended() {
    track("service_recommended", { event_category: "advisor_chat" });
  },
  chatAssessmentOffered() {
    track("assessment_offered", { event_category: "advisor_chat" });
  },
  chatLeadCaptureStarted() {
    track("lead_capture_started", { event_category: "advisor_chat" });
  },
  chatLeadCreated() {
    trackMarketing("generate_lead", "Lead", {
      source: "virtual_msp_advisor",
      method: "chat",
      event_category: "conversion",
    });
    track("lead_created", { event_category: "advisor_chat" });
  },
  chatBookingClicked() {
    track("booking_clicked", { event_category: "advisor_chat" });
  },
  chatSupportRouted() {
    track("support_routed", { event_category: "advisor_chat" });
  },
  chatAbandoned() {
    track("conversation_abandoned", { event_category: "advisor_chat" });
  },
  chatOffTopicRedirected() {
    track("off_topic_redirected", { event_category: "advisor_chat" });
  },
};


// DE Desk is a widget on marketing pages. Pause Clarity while it is open so
// session replay is not captured inside the chat. Marketing pixels are already
// skipped on portal, checkout, and store paths.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("de-desk-open-change", ((event: Event) => {
    const open = !!(event as CustomEvent<{ open?: boolean }>).detail?.open;
    (window as any).__DE_DESK_OPEN__ = open;
    try {
      if (open && (window as any).clarity) (window as any).clarity("stop");
    } catch {}
  }) as EventListener);
}
