import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { saveConsent } from "@/lib/analytics";
import { isStorePath } from "@/lib/storeChromeGestures";
import { cn } from "@/lib/utils";

const LEGACY_KEY = "de_cookie_consent";
const CONSENT_KEY = "de_cookie_consent_v2";

/**
 * The consent banner is a public-site control. Inside the authenticated
 * portal it stacked over the app chrome on phones and repeated a prompt the
 * client already answered on the marketing site (Joe, 2026-09-12: suppress).
 * The portal's public auth pages (login, signup, password reset) still show it.
 */
const PORTAL_PUBLIC_PATHS = ["/portal/login", "/portal/signup", "/portal/forgot-password", "/portal/reset-password"];
export function isAuthenticatedPortalPath(pathname: string): boolean {
  const path = pathname.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  if (!(path === "/portal" || path.startsWith("/portal/"))) return false;
  return !PORTAL_PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

function hasStoredConsent(): boolean {
  try {
    return !!localStorage.getItem(CONSENT_KEY) || !!localStorage.getItem(LEGACY_KEY);
  } catch {
    return false;
  }
}

export function CookieConsentBanner() {
  const [location] = useLocation();
  const light = isStorePath(location);
  const reduceMotion = useReducedMotion() ?? false;
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(true);
  const [deskOpen, setDeskOpen] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasStoredConsent()) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const onDesk = (event: Event) => {
      const open = !!(event as CustomEvent<{ open?: boolean }>).detail?.open;
      setDeskOpen(open);
      if (open) setShowPreferences(false);
    };
    window.addEventListener("de-desk-open-change", onDesk as EventListener);
    return () => window.removeEventListener("de-desk-open-change", onDesk as EventListener);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const el = bannerRef.current;
    if (!visible || !el || deskOpen) {
      root.style.setProperty("--de-cookie-h", "0px");
      return;
    }
    const publish = () => {
      root.style.setProperty("--de-cookie-h", `${Math.round(el.offsetHeight)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--de-cookie-h", "0px");
    };
  }, [visible, deskOpen]);

  const finishConsent = () => {
    setVisible(false);
    setShowPreferences(false);
    window.dispatchEvent(new CustomEvent("de-cookie-consent"));
  };

  const accept = () => {
    saveConsent({ analytics: true, marketing: true });
    finishConsent();
  };

  const reject = () => {
    saveConsent({ analytics: false, marketing: false });
    finishConsent();
  };

  const savePreferences = () => {
    saveConsent({ analytics: analyticsEnabled, marketing: marketingEnabled });
    finishConsent();
  };

  const suppressed = isAuthenticatedPortalPath(location);

  return (
    <AnimatePresence>
      {visible && !suppressed && (
        <>
          {showPreferences && !deskOpen && (
            <motion.div
              key="prefs-overlay"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowPreferences(false)}
            />
          )}

          {showPreferences && !deskOpen && (
            <motion.div
              key="prefs-panel"
              initial={reduceMotion ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: reduceMotion ? 0 : 0.3 }}
              className={cn(
                "fixed bottom-[88px] left-4 right-4 z-[9995] rounded-2xl border p-6 shadow-2xl md:left-auto md:w-[420px]",
                light
                  ? "border-black/10 bg-white shadow-black/20"
                  : "border-de-hairline bg-de-raised shadow-black/50",
              )}
              style={{ right: "calc(var(--de-canvas-gutter) + 1.5rem)" }}
              data-testid="cookie-preferences-panel"
              data-surface={light ? "light" : "dark"}
            >
              <h3
                className={cn(
                  "mb-1 font-['Space_Grotesk'] text-lg font-semibold",
                  light ? "text-slate-900" : "text-white",
                )}
              >
                Cookie Preferences
              </h3>
              <p className={cn("mb-5 text-base leading-relaxed", light ? "text-slate-600" : "text-gray-300")}>
                Choose which cookies you allow. Strictly necessary cookies are always enabled.
              </p>

              <div className="space-y-4">
                <div
                  className={cn(
                    "flex items-start justify-between gap-4 rounded-xl border p-3",
                    light ? "border-black/10 bg-slate-50" : "border-white/10 bg-white/5",
                  )}
                >
                  <div>
                    <p className={cn("text-base font-medium", light ? "text-slate-900" : "text-white")}>
                      Strictly Necessary
                    </p>
                    <p className={cn("mt-0.5 text-base", light ? "text-slate-500" : "text-gray-400")}>
                      Required for the site to function.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-1 whitespace-nowrap text-base font-semibold",
                      light ? "text-emerald-700" : "text-emerald-400",
                    )}
                  >
                    Always On
                  </span>
                </div>

                <label
                  className={cn(
                    "flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-3",
                    light ? "border-black/10 bg-slate-50" : "border-white/10 bg-white/5",
                  )}
                >
                  <div>
                    <p className={cn("text-base font-medium", light ? "text-slate-900" : "text-white")}>
                      Analytics Cookies
                    </p>
                    <p className={cn("mt-0.5 text-base", light ? "text-slate-500" : "text-gray-400")}>
                      Help us understand how visitors interact with the site.
                    </p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={analyticsEnabled}
                    onClick={() => setAnalyticsEnabled(v => !v)}
                    className={`relative mt-1 h-5 w-10 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                      analyticsEnabled ? "bg-[#D3126A]" : light ? "bg-slate-300" : "bg-white/20"
                    }`}
                    data-testid="toggle-analytics"
                  >
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${analyticsEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </label>

                <label
                  className={cn(
                    "flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-3",
                    light ? "border-black/10 bg-slate-50" : "border-white/10 bg-white/5",
                  )}
                >
                  <div>
                    <p className={cn("text-base font-medium", light ? "text-slate-900" : "text-white")}>
                      Marketing Cookies
                    </p>
                    <p className={cn("mt-0.5 text-base", light ? "text-slate-500" : "text-gray-400")}>
                      Used to deliver relevant ads and track campaign effectiveness.
                    </p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={marketingEnabled}
                    onClick={() => setMarketingEnabled(v => !v)}
                    className={`relative mt-1 h-5 w-10 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                      marketingEnabled ? "bg-[#D3126A]" : light ? "bg-slate-300" : "bg-white/20"
                    }`}
                    data-testid="toggle-marketing"
                  >
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${marketingEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </label>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={savePreferences}
                  className="min-h-11 flex-1 rounded-xl bg-[#D3126A] py-2.5 text-base font-semibold text-white transition-colors hover:bg-[#e01874]"
                  data-testid="button-save-preferences"
                >
                  Save Preferences
                </button>
                <button
                  onClick={() => setShowPreferences(false)}
                  className={cn(
                    "min-h-11 rounded-xl px-4 py-2.5 text-base font-semibold transition-colors",
                    light
                      ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      : "bg-white/10 text-white hover:bg-white/20",
                  )}
                  data-testid="button-cancel-preferences"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          <motion.div
            key="cookie-banner"
            initial={reduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: "easeOut" }}
            className={`fixed z-[9991] de-fixed-in-canvas bottom-0${
              deskOpen ? " invisible pointer-events-none" : ""
            }`}
            data-testid="cookie-consent-banner"
            data-surface={light ? "light" : "dark"}
            aria-hidden={deskOpen || undefined}
          >
            <div
              ref={bannerRef}
              className="relative overflow-hidden"
              style={
                light
                  ? { background: "#ffffff", borderTop: "1px solid rgba(15, 23, 42, 0.12)" }
                  : { background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.1)" }
              }
            >
              {!light && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                    backgroundSize: "32px 32px",
                  }}
                />
              )}

              <div className="relative z-10 mx-auto flex max-w-screen-2xl flex-col items-stretch gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:gap-8 lg:px-8 lg:py-4">
                <p
                  className={cn(
                    "min-w-0 flex-1 text-base leading-relaxed",
                    light ? "hidden" : "hidden lg:block",
                    light ? "text-slate-700" : "text-gray-200",
                  )}
                >
                  Digerati Experts uses cookies and similar tracking technologies to collect information you provide and to capture your interaction with our site. We use this information to enhance site navigation, personalize content, analyze your use of our website, and assist in our marketing efforts and customer service. To deliver the best experience, analytics and hosting service providers may have access to this information. By clicking "Accept All," you consent to our collection, use, and disclosure of such information. For more information about our data processing practices, please see our{" "}
                  <Link
                    href="/legal/privacy-policy"
                    className={cn(
                      "font-medium underline underline-offset-2 transition-colors",
                      light ? "text-[#D3126A] hover:text-slate-900" : "text-[#D3126A] hover:text-white",
                    )}
                    data-testid="link-privacy-policy-cookie"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
                <p
                  className={cn(
                    "min-w-0 flex-1 text-sm font-medium leading-snug",
                    light ? "" : "lg:hidden",
                    light ? "text-slate-800" : "text-gray-200",
                  )}
                >
                  We use cookies.{" "}
                  <Link
                    href="/legal/privacy-policy"
                    className={cn(
                      "font-semibold underline underline-offset-2 transition-colors",
                      light ? "text-[#D3126A] hover:text-slate-900" : "text-[#D3126A] hover:text-white",
                    )}
                    data-testid="link-privacy-policy-cookie-mobile"
                  >
                    Privacy
                  </Link>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => setShowPreferences(v => !v)}
                    className={cn(
                      "font-semibold underline underline-offset-2",
                      light ? "text-[#D3126A] hover:text-slate-900" : "text-[#D3126A] hover:text-white",
                    )}
                    data-testid="button-manage-cookie-preferences-mobile"
                  >
                    Preferences
                  </button>
                </p>

                <div className="flex w-full flex-shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:justify-end">
                  <button
                    onClick={() => setShowPreferences(v => !v)}
                    className={cn(
                      "hidden min-h-11 whitespace-nowrap px-1 text-base font-semibold underline underline-offset-2 transition-colors md:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 rounded-sm",
                      light
                        ? "text-[#D3126A] hover:text-slate-900 focus-visible:ring-offset-white"
                        : "text-[#D3126A] hover:text-white focus-visible:ring-offset-[#0a0a0a]",
                    )}
                    data-testid="button-manage-cookie-preferences"
                  >
                    Manage Cookie Preferences
                  </button>

                  <div className="ml-auto flex items-center gap-2 md:ml-0">
                    <button
                      onClick={reject}
                      className={cn(
                        "min-h-11 whitespace-nowrap rounded border px-5 py-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2",
                        light
                          ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-offset-white"
                          : "border-white/20 bg-[#0a0a1a] text-white hover:bg-white/10 focus-visible:ring-offset-[#0a0a0a]",
                      )}
                      data-testid="button-reject-all-cookies"
                    >
                      Reject All
                    </button>

                    <button
                      onClick={accept}
                      className={cn(
                        "min-h-11 whitespace-nowrap rounded px-5 py-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2",
                        light
                          ? "bg-[#D3126A] text-white hover:bg-[#e01874] focus-visible:ring-offset-white"
                          : "border border-white/20 bg-[#0a0a1a] text-white hover:bg-white/10 focus-visible:ring-offset-[#0a0a0a]",
                      )}
                      data-testid="button-accept-all-cookies"
                    >
                      Accept All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
