declare function gtag(...args: any[]): void;

const CONSENT_KEY = "de_cookie_consent_v2";

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
      return { analytics: !!parsed.analytics, marketing: !!parsed.marketing };
    }
    const legacy = localStorage.getItem("de_cookie_consent");
    if (legacy === "accepted") return { analytics: true, marketing: true };
    if (legacy === "rejected") return { analytics: false, marketing: false };
  } catch {}
  return { analytics: false, marketing: false };
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
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ ...config, timestamp: new Date().toISOString() })
    );
    localStorage.setItem("de_cookie_consent", config.analytics || config.marketing ? "accepted" : "rejected");
  } catch {}
  updateGtagConsent(config);
  updateClarityConsent(config);
  updateMetaConsent(config);
  updateBingConsent(config);
  if (config.marketing || config.analytics) {
    initAnalytics();
  }
}

export function initAnalytics() {
  injectSearchVerificationTags();
  const consent = getConsent();
  updateGtagConsent(consent);

  // Microsoft Clarity (analytics-gated)
  const clarityId = import.meta.env.VITE_CLARITY_ID;
  if (clarityId && consent.analytics && !(window as any).__CLARITY_ID__) {
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
    fbq("track", "PageView");
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
  try {
    if (typeof gtag === "undefined") return;
    gtag("event", event, { ...params, send_to: "G-1YDMJ38SXD" });
  } catch {}
}

function fireMetaPixel(event: string, params?: Record<string, any>) {
  try {
    const f = window as any;
    if (!f.fbq) return;
    f.fbq("track", event, params);
  } catch {}
}

function fireBing(event: string, params?: Record<string, any>) {
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
    const consent = getConsent();
    if (consent.analytics) {
      try {
        if (typeof gtag !== "undefined") {
          gtag("event", "page_view", {
            page_path: path,
            page_title: title,
            send_to: "G-1YDMJ38SXD",
          });
        }
      } catch {}
    }
    if (consent.marketing) {
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
