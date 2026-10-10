import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Phone, Shield, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { isStorePath } from "@/lib/storeChromeGestures";
import { cn } from "@/lib/utils";
import {
  STICKY_CTA_AUTO_HIDE_MS,
  STICKY_CTA_RESHOW_DELTA_PX,
  STICKY_CTA_SCROLL_IDLE_MS,
  isNearDocumentEnd,
  isPageFooterOnScreen,
  isPastStickyCtaThreshold,
  isStickyCtaPinnedRoute,
  isStickyCtaRouteAllowed,
  isCookieFirst,
  isTooShortToReachStickyThreshold,
  rectOverlapsPageContent,
  shouldShowStickyCta,
} from "@/lib/stickyCtaVisibility";
import { isCookieBannerBlocking } from "@/lib/deskAskDeMotion";

function publishStickyCtaHeight(px: number) {
  document.documentElement.style.setProperty("--de-sticky-cta-h", `${Math.round(px)}px`);
}

export function StickyCTABar() {
  const [location] = useLocation();
  const light = isStorePath(location);
  const reduceMotion = useReducedMotion() ?? false;
  const [dismissed, setDismissed] = useState(false);
  const [pastThreshold, setPastThreshold] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [overlapping, setOverlapping] = useState(false);
  const [autoHidden, setAutoHidden] = useState(false);
  const [cookieFirst, setCookieFirst] = useState(false);
  const { openBooking } = useBooking();
  const barRef = useRef<HTMLDivElement>(null);
  const lastShowScroll = useRef(0);
  // 0, not a fallback height: nothing should reserve this bar's space until it has
  // actually shown once (it publishes its real measured height at that point).
  const lastHeight = useRef(0);

  const routeAllowed = isStickyCtaRouteAllowed(location);
  const pinned = isStickyCtaPinnedRoute(location);
  const visible = shouldShowStickyCta({
    dismissed,
    routeAllowed,
    pastThreshold,
    scrolling,
    overlapping,
    autoHidden,
    pinned,
    cookieFirst,
  });

  useEffect(() => {
    if (sessionStorage.getItem("stickyCtaDismissed")) {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (dismissed || !routeAllowed) {
      document.documentElement.dataset.stickyCtaScrolling = "false";
      setPastThreshold(false);
      setScrolling(false);
      setOverlapping(false);
      setAutoHidden(false);
      return;
    }

    let idleTimer: number | undefined;
    let ticking = false;
    // A lazy route mounts as a short skeleton, so "too short to scroll" must
    // hold on two reads with the same height before it counts. Read once at
    // mount, it showed the bar over the hero on every page until a scroll.
    let lastScrollH = -1;
    const settledShortPage = () => {
      const scrollH = document.documentElement.scrollHeight;
      const stable = scrollH === lastScrollH;
      lastScrollH = scrollH;
      return stable && isTooShortToReachStickyThreshold(window.innerHeight, scrollH);
    };
    const evaluateThreshold = () => {
      setPastThreshold(
        pinned || settledShortPage() || isPastStickyCtaThreshold(window.scrollY, window.innerHeight),
      );
      setCookieFirst(isCookieFirst(isCookieBannerBlocking()));
    };

    const measureOverlap = () => {
      const bar = barRef.current;
      const height = bar?.offsetHeight || lastHeight.current;
      const width = bar?.offsetWidth || window.innerWidth - 32;
      const bottomGap = 16;
      const unified = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--de-unified-bar-h"),
      ) || 0;
      const cookie = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--de-cookie-h"),
      ) || 0;
      const top = window.innerHeight - bottomGap - cookie - unified - height;
      const left = bar?.getBoundingClientRect().left ?? 16;
      const rect = {
        top,
        left,
        width,
        height,
        right: left + width,
      };
      const overlayHits = rectOverlapsPageContent(rect, (x) =>
        document.elementsFromPoint(x, top + Math.min(20, height / 2)),
      );
      const shortPage = isTooShortToReachStickyThreshold(
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
      // Pinned checkout (and other short pages) always have the footer in view.
      // Parking for that would make the Risk Assessment bar never appear.
      const parkForFooter = !pinned && !shortPage;
      const footerHits =
        parkForFooter &&
        Array.from(document.querySelectorAll("footer")).some((el) => {
          if (el.closest("[role='dialog']") || el.closest(".de-desk-shell")) return false;
          return isPageFooterOnScreen(el.getBoundingClientRect().top, window.innerHeight);
        });
      const endHits =
        parkForFooter &&
        isNearDocumentEnd(
          window.scrollY,
          window.innerHeight,
          document.documentElement.scrollHeight,
        );
      setOverlapping(Boolean(overlayHits || footerHits || endHits));
      evaluateThreshold();
    };

    const markScrolling = (on: boolean) => {
      document.documentElement.dataset.stickyCtaScrolling = on ? "true" : "false";
      setScrolling(on);
    };

    const onScroll = () => {
      const scrollY = window.scrollY;
      evaluateThreshold();
      if (!pinned) {
        markScrolling(true);
      }
      if (Math.abs(scrollY - lastShowScroll.current) >= STICKY_CTA_RESHOW_DELTA_PX) {
        setAutoHidden(false);
      }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        markScrolling(false);
        measureOverlap();
      }, pinned ? 0 : STICKY_CTA_SCROLL_IDLE_MS);
    };

    const onScrollRaf = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScrollRaf, { passive: true });
    window.addEventListener("resize", measureOverlap);
    window.addEventListener("de-cookie-consent", measureOverlap);
    const overlapPoll = window.setInterval(measureOverlap, 500);
    return () => {
      window.clearTimeout(idleTimer);
      window.clearInterval(overlapPoll);
      window.removeEventListener("scroll", onScrollRaf);
      window.removeEventListener("resize", measureOverlap);
      window.removeEventListener("de-cookie-consent", measureOverlap);
      document.documentElement.dataset.stickyCtaScrolling = "false";
    };
  }, [dismissed, routeAllowed, pinned]);

  useEffect(() => {
    if (dismissed || !routeAllowed) {
      publishStickyCtaHeight(0);
      return;
    }
    if (!visible) {
      // Keep the reserved slot while the bar is only parked so the page does not jump.
      publishStickyCtaHeight(lastHeight.current);
      return;
    }
    lastShowScroll.current = window.scrollY;
    const el = barRef.current;
    if (!el) return;
    const publish = () => {
      lastHeight.current = el.offsetHeight;
      publishStickyCtaHeight(el.offsetHeight);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    const hideTimer = pinned
      ? undefined
      : window.setTimeout(() => setAutoHidden(true), STICKY_CTA_AUTO_HIDE_MS);
    return () => {
      ro.disconnect();
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [visible, dismissed, routeAllowed, pinned]);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("stickyCtaDismissed", "true");
    publishStickyCtaHeight(0);
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={barRef}
          initial={reduceMotion ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: 16, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
          className="de-bottom-bar"
          data-testid="sticky-cta-bar"
          data-sticky-cta-chrome="true"
          data-surface={light ? "light" : "dark"}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border",
              light
                ? "border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.16)]"
                : "border-de-hairline bg-de-raised",
            )}
          >
            <button
              onClick={handleDismiss}
              className={cn(
                "absolute right-1 top-1/2 z-10 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 sm:right-2 sm:top-2 sm:translate-y-0",
                light
                  ? "hover:bg-black/5 focus-visible:ring-offset-white"
                  : "hover:bg-white/10 focus-visible:ring-offset-de-raised",
              )}
              aria-label="Close banner"
              data-testid="button-dismiss-sticky-cta"
            >
              <X className={cn("h-4 w-4", light ? "text-slate-600" : "text-white/70")} />
            </button>

            {/* Mobile: single compact row so the bar never buries page content.
                sm+: the original roomier layout. */}
            <div className="px-3 py-2 pr-11 sm:px-4 sm:py-3">
              <div className="flex items-center justify-between gap-2 sm:gap-3 lg:gap-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex",
                      light ? "bg-black/[0.04]" : "bg-white/10",
                    )}
                  >
                    <Shield className="h-5 w-5 text-de-accent-ink" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p
                      className={cn(
                        "text-xs font-semibold leading-snug sm:text-base md:text-lg",
                        light ? "text-slate-900" : "text-white",
                      )}
                    >
                      Independent Risk Assessment
                    </p>
                    <p
                      className={cn(
                        "hidden max-w-xl text-sm leading-snug lg:block md:text-base",
                        light ? "text-slate-600" : "text-white/70",
                      )}
                    >
                      Your current provider has a conflict grading their own work.
                      {" "}
                      <span className={light ? "text-slate-800" : "text-white/90"}>
                        We map the gaps, build a plan, and can collaborate with them — switching is optional.
                      </span>
                    </p>
                  </div>
                </div>

                <div className="hidden items-center xl:flex">
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide",
                      light
                        ? "border-black/10 bg-black/[0.03] text-slate-700"
                        : "border-white/20 bg-white/5 text-white/80",
                    )}
                    data-testid="sticky-cta-reassurance"
                  >
                    No switch required
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 md:gap-4">
                  <a
                    href={PRIMARY_PHONE.telHref}
                    className={cn(
                      "hidden items-center gap-2 text-base transition-colors md:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 rounded-sm",
                      light
                        ? "text-slate-600 hover:text-slate-900 focus-visible:ring-offset-white"
                        : "text-white/75 hover:text-white focus-visible:ring-offset-de-raised",
                    )}
                    data-testid="link-phone-sticky"
                  >
                    <Phone className="w-4 h-4" />
                    <span>{PRIMARY_PHONE.display}</span>
                  </a>

                  <Button
                    size="sm"
                    className="h-9 px-3 text-sm font-semibold sm:h-11 sm:px-5 sm:text-base"
                    variant="brand"
                    data-testid="button-sticky-cta-assessment"
                    onClick={() => openBooking("sticky_cta")}
                    aria-label={CTA.primary}
                  >
                    {CTA.primaryNavCompact}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
