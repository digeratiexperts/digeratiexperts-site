import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  BookOpen,
  ChevronRight,
  Headphones,
  MessageSquareText,
  Wrench,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  HomepageDockActions,
  HomepageDockMenu,
  useHomepageDockVisibility,
} from "@/components/HomepageSectionNav";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import { isDoor2Path } from "@/lib/isDoor2Path";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { AskDeGlyph } from "@/components/icons/AskDeGlyph";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  hasDeskNudgeBeenShown,
  isCookieBannerBlocking,
  isDeskNudgeDismissed,
  markDeskNudgeDismissed,
  markDeskNudgeShown,
  prefersReducedMotion,
} from "@/lib/deskAskDeMotion";

/** Original used 0.28s easeOut layout + 300ms grid. Keep that pacing without transform. */
const EXPAND_S = 0.4;
const EXPAND_EASE = "easeOut" as const;

type QuickMenuItem = {
  title: string;
  description: string;
  icon: typeof Headphones;
  testId: string;
  onSelect: () => void;
};

/**
 * One Ask DE entry point. The launcher opens a single white chooser inspired by
 * the approved reference: visitors choose what they need first, then the
 * existing Desk opens directly on that function. This avoids presenting three
 * competing tabs as the first decision.
 */
function AskDELauncherButton({ compact = false }: { compact?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const isMobile = useIsMobile();
  // Focus trap keeps Tab inside the chooser and restores focus to the
  // launcher when it closes (Escape, outside tap, X, or a selection).
  const popoverRef = useFocusTrap<HTMLDivElement>({ enabled: showMenu });
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showMenu || showNudge) return;
    if (isDeskNudgeDismissed() || hasDeskNudgeBeenShown()) return;
    const delay = prefersReducedMotion() ? 0 : 6000;
    const timer = window.setTimeout(() => {
      if (isDeskNudgeDismissed() || hasDeskNudgeBeenShown()) return;
      if (isCookieBannerBlocking()) return;
      if (document.documentElement.hasAttribute("data-de-desk-open")) return;
      markDeskNudgeShown();
      setShowNudge(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [showMenu, showNudge]);

  useEffect(() => {
    if (!showMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target) || launcherRef.current?.contains(target)) return;
      setShowMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMenu(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showMenu, popoverRef]);

  const openDesk = (detail: Parameters<typeof openMspAdvisor>[0]) => {
    setShowMenu(false);
    setShowNudge(false);
    markDeskNudgeDismissed();
    openMspAdvisor(detail);
  };

  const dismissNudge = () => {
    setShowNudge(false);
    markDeskNudgeDismissed();
  };

  const menuItems: QuickMenuItem[] = [
    {
      title: "Get Support",
      description: "Open a ticket or report an issue",
      icon: Headphones,
      testId: "ask-de-choice-support",
      onSelect: () => openDesk({ tab: "ticket" }),
    },
    {
      title: "Get Help",
      description: "Ask DE a question and get guidance",
      icon: BookOpen,
      testId: "ask-de-choice-help",
      onSelect: () => openDesk({ tab: "chat" }),
    },
    {
      title: "Client Tools",
      description: "Access tools and resources for your business",
      icon: Wrench,
      testId: "ask-de-choice-tools",
      onSelect: () => openDesk({ tab: "resources" }),
    },
    {
      title: "Give Feedback",
      description: "Share feedback or suggestions",
      icon: MessageSquareText,
      testId: "ask-de-choice-feedback",
      onSelect: () =>
        openDesk({
          tab: "chat",
          seedMessage: "I'd like to share feedback about my experience with Digerati Experts.",
        }),
    },
  ];

  return (
    <div className="relative flex shrink-0 items-center">
      {showNudge ? (
        <div
          className="de-ask-nudge fixed z-[10035] max-w-[240px] rounded-[14px_14px_4px_14px] px-3 py-2.5 text-left text-[13px] font-medium leading-snug shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          style={{
            // Fixed outside document flow so the nudge cannot cause CLS.
            right: "max(1rem, env(safe-area-inset-right))",
            bottom: "calc(var(--de-unified-bar-h, 3.5rem) + 0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
          data-testid="ask-de-nudge"
        >
          <button
            type="button"
            className="de-ask-nudge-x absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"
            aria-label="Dismiss Ask DE suggestion"
            data-testid="ask-de-nudge-dismiss"
            onClick={(event) => {
              event.stopPropagation();
              dismissNudge();
            }}
          >
            ×
          </button>
          {/* R1: primary action is a real <button>, not a focusable dialog div. */}
          <button
            type="button"
            className="de-ask-nudge-body block w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"
            aria-label="Ask DE suggestion"
            onClick={() => openDesk({ tab: "chat" })}
          >
            Stuck on something IT or security?
            <small className="de-ask-nudge-sub mt-0.5 block text-[12px] font-normal">
              Ask DE — real engineers, clear next step.
            </small>
          </button>
        </div>
      ) : null}
      <AnimatePresence>
        {showMenu && isMobile && (
          <motion.div
            key="ask-de-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/70"
            aria-hidden="true"
            data-testid="ask-de-sheet-scrim"
          />
        )}
        {showMenu && (
          <motion.div
            key="ask-de-panel"
            ref={popoverRef}
            initial={isMobile ? { opacity: 0, y: 32 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { opacity: 0, y: 24 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={
              isMobile
                ? "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-black/10 bg-[#fbfbfa] p-5 text-left text-[#151219] shadow-2xl"
                : "absolute right-0 z-20 w-[min(380px,calc(100vw-1.5rem))] overflow-visible rounded-[24px] border border-black/10 bg-[#fbfbfa] p-5 text-left text-[#151219] shadow-[0_28px_80px_rgba(5,3,18,0.28),0_8px_24px_rgba(5,3,18,0.12)]"
            }
            style={
              isMobile
                ? { paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }
                : { bottom: "calc(100% + var(--de-store-cart-h, 0px) + 1rem)" }
            }
            role="dialog"
            aria-modal={isMobile || undefined}
            aria-label="Ask DE support options"
            data-testid="ask-de-quick-menu"
          >
            {!isMobile && (
              <div className="pointer-events-none absolute -bottom-2 right-7 h-4 w-4 rotate-45 border-b border-r border-black/10 bg-[#fbfbfa]" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-[#65616c] transition-colors hover:bg-black/[0.06] hover:text-[#111116] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111116]"
              aria-label="Close Ask DE"
              data-testid="ask-de-close"
            >
              <X className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} aria-hidden="true" />
            </button>

            <div className="mb-5 flex items-start justify-between gap-4 pr-8">
              <div>
                <p className="text-[24px] font-semibold leading-tight tracking-[-0.035em] text-[#111116]">Ask DE</p>
                <p className="mt-1 text-[15px] leading-6 text-[#65616c]">How can we help you today?</p>
              </div>
              <div className="mt-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white shadow-[0_8px_24px_rgba(15,15,18,0.08)]">
                <AskDeGlyph className="h-10 w-10 text-[#111116]" />
              </div>
            </div>

            <div className="space-y-2.5">
              {menuItems.map(({ title, description, icon: Icon, testId, onSelect }) => (
                <button
                  key={title}
                  type="button"
                  onClick={onSelect}
                  className="group flex min-h-[88px] w-full items-center gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3 text-left transition-[background-color,border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-black/20 hover:bg-[#f8f7f5] hover:shadow-[0_10px_24px_-18px_rgba(15,15,18,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111116] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfbfa]"
                  data-testid={testId}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f1ef] text-[#111116]">
                    <Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold leading-5 text-[#111116]">{title}</span>
                    <span className="mt-1 block text-[13.5px] leading-5 text-[#65616c]">{description}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#2c2931] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-black/10 pt-4 text-sm text-[#65616c]">
              <p className="font-medium text-[#2b2830]">We&apos;re here to help!</p>
              <a
                href={PRIMARY_PHONE.telHref}
                className="mt-1 inline-flex font-medium text-[#111116] underline decoration-black/20 underline-offset-4 hover:decoration-black/60"
                data-testid="ask-de-choice-phone"
              >
                Call {PRIMARY_PHONE.display}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          setShowNudge(false);
          setShowMenu((open) => !open);
        }}
        className="group flex h-10 shrink-0 items-center gap-2 rounded-full px-1 pr-1.5 text-white transition-colors duration-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        data-testid="button-open-asap-widget"
        aria-label={compact ? "Open Ask DE support options" : "Open Ask DE"}
        aria-expanded={showMenu}
        aria-haspopup="dialog"
      >
        <span className="de-ask-fab relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white text-[#111116] shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform duration-150 group-hover:scale-[1.04]">
          <AskDeGlyph className="h-[26px] w-[26px]" />
          <span
            className="de-ask-fab-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
            title="Engineers on shift"
            aria-hidden="true"
          />
        </span>
        {!compact && (
          <span className="hidden text-left sm:block">
            <span className="block text-base font-semibold leading-4 tracking-tight">Ask DE</span>
            <span className="block text-base leading-4 text-white/70">We&apos;re here to help.</span>
          </span>
        )}
      </button>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* B2: nudge sits on dark site chrome — paper site tokens only (not --desk-*). */
            .de-ask-nudge {
              background: var(--de-paper-raised);
              color: var(--de-bg);
              border: 1px solid var(--de-paper-hairline);
            }
            .de-ask-nudge-body {
              background: transparent;
              border: 0;
              padding: 0;
              color: inherit;
              font: inherit;
            }
            .de-ask-nudge-sub {
              color: color-mix(in srgb, var(--de-bg) 60%, transparent);
            }
            .de-ask-nudge-x {
              background: var(--de-bg);
              color: var(--de-paper-raised);
              border: 2px solid var(--de-paper-raised);
            }
            .de-ask-fab::before {
              content: "";
              position: absolute;
              inset: -6px;
              border-radius: 50%;
              border: 2px solid color-mix(in srgb, var(--de-magenta-ink, #D3126A) 55%, transparent);
              animation: de-ask-breathe 2.8s ease-out infinite;
              pointer-events: none;
            }
            .de-ask-fab-dot {
              background: var(--de-ask-status, #22c55e);
              border-color: var(--de-ask-fab-dot-border, #fff);
            }
            @keyframes de-ask-breathe {
              0% { transform: scale(0.86); opacity: 0.9; }
              70% { transform: scale(1.18); opacity: 0; }
              100% { transform: scale(1.18); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .de-ask-fab::before { animation: none; opacity: 0; }
            }
          `,
        }}
      />
    </div>
  );
}

/**
 * One bottom chrome shell: homepage chapter menu (after scroll), scroll-to-top,
 * and the Ask DE launcher. Desk window stays in ZohoASAPWidget.
 *
 * Width is tweened as CSS width (not Framer `layout` / scale) so backdrop-filter
 * on the static glass layer does not smear text while the capsule grows.
 */
export function SiteBottomBar() {
  const [location] = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const { showMenu } = useHomepageDockVisibility();
  const [farDown, setFarDown] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const [compactW, setCompactW] = useState(0);
  const isPortal = location.startsWith("/portal");

  const syncFarDown = useCallback(() => {
    setFarDown(window.scrollY > 500);
  }, []);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        syncFarDown();
        ticking = false;
      });
    };
    syncFarDown();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [syncFarDown]);

  useEffect(() => {
    const onDesk = (event: Event) => {
      const open = !!(event as CustomEvent<{ open?: boolean }>).detail?.open;
      setDeskOpen(open);
    };
    window.addEventListener("de-desk-open-change", onDesk as EventListener);
    return () => window.removeEventListener("de-desk-open-change", onDesk as EventListener);
  }, []);

  const showScrollTop = farDown;
  const showAskDE = !deskOpen;
  const compactAskDE = isDoor2Path(location);
  const expanded = showMenu;
  const showBar = !isPortal && (showAskDE || expanded || showScrollTop);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const actions = actionsRef.current;
    if (!track) return;
    const measure = () => ({
      track: Math.round(track.getBoundingClientRect().width),
      // Compact capsule = action cluster + even 6px padding + 2px border each side.
      compact: actions ? Math.round(actions.getBoundingClientRect().width + 16) : 0,
    });
    const publish = () => {
      const m = measure();
      setTrackW(m.track);
      if (actions) setCompactW(m.compact);
    };
    // Initial publish must be synchronous (pre-paint) so the first expand
    // animates from a real width.
    publish();
    // While the scroll-top button width-tweens (~0.4s), the actions cluster
    // resizes every frame. Publishing each intermediate width retargets the
    // capsule tween per frame (an easeOut chase that keeps settling after the
    // button finishes). Debounce observer publishes until the size holds
    // still for two frames, so the capsule retargets once, to the final width.
    let raf = 0;
    let last: { track: number; compact: number } | null = null;
    const settle = () => {
      const m = measure();
      if (last && m.track === last.track && m.compact === last.compact) {
        raf = 0;
        last = null;
        setTrackW(m.track);
        if (actions) setCompactW(m.compact);
        return;
      }
      last = m;
      raf = requestAnimationFrame(settle);
    };
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      last = null;
      raf = requestAnimationFrame(settle);
    });
    ro.observe(track);
    if (actions) ro.observe(actions);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showAskDE, showScrollTop, location]);

  useEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    if (!showBar || !el) {
      root.style.setProperty("--de-unified-bar-h", "0px");
      root.style.setProperty("--de-section-dock-h", "0px");
      return;
    }

    const publish = () => {
      const height = `${Math.round(el.offsetHeight)}px`;
      root.style.setProperty("--de-unified-bar-h", height);
      root.style.setProperty("--de-section-dock-h", expanded ? height : "0px");
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--de-unified-bar-h", "0px");
      root.style.setProperty("--de-section-dock-h", "0px");
    };
  }, [showBar, expanded, showAskDE, showScrollTop]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  if (!showBar) return null;

  const duration = prefersReducedMotion ? 0 : EXPAND_S;

  return (
    <div
      ref={trackRef}
      className="de-unified-bar pointer-events-none flex items-end justify-end"
      data-testid="site-bottom-bar"
    >
      <motion.div
        ref={barRef}
        className={`de-unified-bar-shell pointer-events-auto relative flex items-center rounded-full border border-white/20 py-1.5 shadow-2xl ${
          expanded
            ? "w-full min-w-0 justify-between gap-6 pl-3 pr-2.5"
            : "shrink-0 justify-end gap-0 pl-1.5 pr-1.5"
        }`}
        initial={false}
        layout={false}
        transformTemplate={() => "none"}
        animate={{
          width: expanded ? (trackW > 0 ? trackW : "100%") : compactW > 0 ? compactW : "auto",
        }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: EXPAND_S, ease: EXPAND_EASE }
        }
        style={{
          // The px-padding/gap classes swap between states; tween them in step
          // with the width so the content doesn't hop at animation start.
          transition: prefersReducedMotion
            ? undefined
            : "gap 0.4s ease-out, padding 0.4s ease-out",
        }}
      >
        <span className="de-unified-bar-glass" aria-hidden="true" />

        {/* Keep the wrapper's flex participation constant and animate only the
            interpolable pair 0fr <-> 1fr (minmax(0,1fr) <-> 0fr cannot
            interpolate, and the old w-0/flex-none toggle snapped the content
            box closed before the capsule width tween caught up). */}
        <div
          className={`relative z-[1] grid min-w-0 flex-1 ${
            prefersReducedMotion ? "" : "transition-[grid-template-columns,opacity] duration-[400ms] ease-out"
          } ${
            expanded
              ? "grid-cols-[1fr] opacity-100"
              : "pointer-events-none grid-cols-[0fr] opacity-0"
          }`}
          aria-hidden={!expanded}
          // aria-hidden alone leaves the collapsed menu's links in the tab
          // order (axe: aria-hidden-focus, serious). `inert` removes them from
          // focus and the accessibility tree while collapsed. React 18 passes
          // the attribute through as a string, hence "" rather than a boolean.
          {...(!expanded ? { inert: "" } : {})}
        >
          <div className="w-full min-w-0 overflow-hidden">
            <HomepageDockMenu />
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 items-center gap-1.5">
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="dock-actions"
                className="flex items-center overflow-hidden"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: EXPAND_S, ease: EXPAND_EASE }
                }
              >
                <div className="flex w-max shrink-0 items-center gap-1.5">
                  <div className="h-6 w-px shrink-0 bg-white/20" aria-hidden="true" />
                  <HomepageDockActions />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={actionsRef} className="flex shrink-0 items-center gap-1.5">
            {/* Decorative status dot removed per reference direction — no dot
                unless it reflects a real state. */}
            <AnimatePresence initial={false}>
              {showScrollTop && (
                <motion.button
                  key="scroll-top"
                  type="button"
                  initial={{ opacity: 0, width: "0rem" }}
                  animate={{ opacity: 1, width: "2.5rem" }}
                  exit={{ opacity: 0, width: "0rem" }}
                  transition={{ duration, ease: EXPAND_EASE }}
                  onClick={scrollToTop}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"
                  aria-label="Scroll to top"
                  data-testid="button-scroll-to-top"
                >
                  <ArrowUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>

            {showAskDE && <AskDELauncherButton compact={compactAskDE} />}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
