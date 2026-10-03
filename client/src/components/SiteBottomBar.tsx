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
import { useDockAutohide } from "@/hooks/useDockAutohide";
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
/** Phones: where the Ask DE nudge waits for the reader to leave the first screen. */
const NUDGE_PHONE_QUERY = "(max-width: 767px)";
/** Phones: scroll distance after which a shown nudge steps away. */
const NUDGE_PHONE_SCROLL_AWAY = 160;

type QuickMenuItem = {
  title: string;
  description: string;
  icon: typeof Headphones;
  testId: string;
  onSelect: () => void;
};

/**
 * The Ask DE badge: one treatment for the launcher and the chooser header, so
 * the two always match (Joe, 2026-10-03: "B on desktop, C on mobile, with the
 * same speech mark and gold tone throughout").
 * - Labelled ("Ask DE" written beside it, `sm` and up): a Signal Gold ring on
 *   charcoal with a white mark. The words explain the action, so the icon stays
 *   quiet. The mark stays white on hover; only the ring and a faint gold fill
 *   respond.
 * - Alone (phones, where the label is hidden below `sm`, and the compact
 *   launcher): a solid gold disc with a dark mark, which reads best at that size.
 */
const ASK_DE_BADGE_ALONE =
  "border-2 border-transparent bg-[#E3B23C] text-[#0b0b0d] group-hover:bg-[#EDBE4C]";
const ASK_DE_BADGE_LABELLED =
  "border-2 border-transparent bg-[#E3B23C] text-[#0b0b0d] group-hover:bg-[#EDBE4C] sm:border-[#E3B23C] sm:bg-[#0b0b0d] sm:text-[#f5f5f4] sm:group-hover:border-[#EDBE4C] sm:group-hover:bg-[rgba(227,178,60,0.10)]";

function askDeBadgeClasses(compact: boolean): string {
  return compact ? ASK_DE_BADGE_ALONE : ASK_DE_BADGE_LABELLED;
}

/**
 * One Ask DE entry point. The launcher opens a single black and gold chooser:
 * visitors choose what they need first, then the existing Desk opens directly
 * on that function. This avoids presenting three competing tabs as the first
 * decision.
 */
function AskDELauncherButton({ compact = false }: { compact?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [askMotionAllowed, setAskMotionAllowed] = useState(false);
  const isMobile = useIsMobile();
  // Focus trap keeps Tab inside the chooser and restores focus to the
  // launcher when it closes (Escape, outside tap, X, or a selection).
  const popoverRef = useFocusTrap<HTMLDivElement>({ enabled: showMenu });
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const syncAskMotion = () => {
      setAskMotionAllowed(!isCookieBannerBlocking() && !isDeskNudgeDismissed());
    };
    syncAskMotion();

    let timer = 0;
    // Phones: the nudge sits over the lower right of the first screen, which on
    // every homepage is the hero's CTAs and pronunciation row. Hold it until
    // the reader is past the first viewport, so it never covers the opener.
    const phone = window.matchMedia(NUDGE_PHONE_QUERY);
    const inOpener = () => phone.matches && window.scrollY < window.innerHeight;
    const fireNudge = () => {
      if (isDeskNudgeDismissed() || hasDeskNudgeBeenShown()) return;
      if (document.documentElement.hasAttribute("data-de-desk-open")) return;
      if (inOpener()) {
        window.addEventListener("scroll", onScroll, { passive: true });
        return;
      }
      markDeskNudgeShown();
      setShowNudge(true);
    };
    const arm = (ignoreBanner = false) => {
      window.clearTimeout(timer);
      if (showMenu || showNudge) return;
      if (isDeskNudgeDismissed() || hasDeskNudgeBeenShown()) return;
      if (!ignoreBanner && isCookieBannerBlocking()) return;
      if (inOpener()) {
        window.addEventListener("scroll", onScroll, { passive: true });
        return;
      }
      const delay = prefersReducedMotion() ? 0 : 6000;
      timer = window.setTimeout(fireNudge, delay);
    };
    function onScroll() {
      if (inOpener()) return;
      window.removeEventListener("scroll", onScroll);
      // Only registered once the cookie banner was already cleared.
      arm(true);
    }

    arm();
    const onConsent = () => {
      setAskMotionAllowed(!isDeskNudgeDismissed());
      arm(true);
    };
    window.addEventListener("de-cookie-consent", onConsent);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("de-cookie-consent", onConsent);
    };
  }, [showMenu, showNudge]);

  // Phones: once shown, the nudge steps away when the reader keeps scrolling
  // or starts typing, instead of covering what they are reading. It counts as
  // shown (once per session) but not dismissed, so the launcher keeps its cue.
  useEffect(() => {
    if (!showNudge || !window.matchMedia(NUDGE_PHONE_QUERY).matches) return;
    const startY = window.scrollY;
    const hide = () => setShowNudge(false);
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > NUDGE_PHONE_SCROLL_AWAY) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target;
      if (el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable=true]")) hide();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [showNudge]);

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
    setAskMotionAllowed(false);
    openMspAdvisor(detail);
  };

  const dismissNudge = () => {
    setShowNudge(false);
    markDeskNudgeDismissed();
    setAskMotionAllowed(false);
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
      // "Get Help" read too close to "Get Support" (Joe, 2026-10-03).
      title: "Ask a Question",
      description: "Get answers and guidance",
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
            // Same lift as the unified bar (--de-cookie-h). The nudge only arms
            // after consent today, so this keeps the two in step if it ever
            // shows while the cookie banner is up.
            right: "max(1rem, env(safe-area-inset-right))",
            bottom:
              "calc(var(--de-unified-bar-h, 3.5rem) + var(--de-store-cart-h, 0px) + var(--de-cookie-h, 0px) + 0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
          data-testid="ask-de-nudge"
        >
          <button
            type="button"
            className="de-ask-nudge-x absolute -right-3 -top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] leading-none before:absolute before:-inset-3 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"
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
            className="fixed inset-0 z-40 bg-[rgba(5,3,18,0.6)]"
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
                ? "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0b0b0d] p-5 text-left text-[#f5f5f4] shadow-2xl"
                : "absolute right-0 z-20 w-[min(380px,calc(100vw-1.5rem))] overflow-visible rounded-[24px] border border-white/10 bg-[#0b0b0d] p-5 text-left text-[#f5f5f4] shadow-[0_30px_80px_rgba(0,0,0,0.62),0_8px_24px_rgba(0,0,0,0.42)]"
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
              <div className="pointer-events-none absolute -bottom-2 right-7 h-4 w-4 rotate-45 border-b border-r border-white/10 bg-[#0b0b0d]" aria-hidden="true" />
            )}

            <div className="mb-5 flex items-start justify-between gap-4 pr-8">
              <div>
                <p className="text-[24px] font-semibold leading-tight tracking-[-0.035em] text-[#f5f5f4]">Ask DE</p>
                <p className="mt-1 text-[15px] leading-6 text-[#b4b4ba]">How can we help you today?</p>
              </div>
              <div
                className={`mt-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${askDeBadgeClasses(compact)}`}
                data-testid="ask-de-chooser-badge"
              >
                <AskDeGlyph className="h-10 w-10" />
              </div>
            </div>

            <div className="space-y-2.5">
              {menuItems.map(({ title, description, icon: Icon, testId, onSelect }) => (
                <button
                  key={title}
                  type="button"
                  onClick={onSelect}
                  className="group flex min-h-[88px] w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#19191c] px-4 py-3 text-left transition-[background-color,border-color] duration-150 hover:border-[rgba(227,178,60,0.5)] hover:bg-[#1f1f23] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3B23C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0d]"
                  data-testid={testId}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(227,178,60,0.35)] bg-[rgba(227,178,60,0.10)] text-[#E3B23C] transition-colors duration-150 group-hover:bg-[rgba(227,178,60,0.16)]">
                    <Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold leading-5 text-[#f5f5f4]">{title}</span>
                    <span className="mt-1 block text-[13.5px] leading-5 text-[#b4b4ba]">{description}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#9a9aa2] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 text-sm text-[#b4b4ba]">
              <p className="font-medium text-[#f5f5f4]">We&apos;re here to help!</p>
              <a
                href={PRIMARY_PHONE.telHref}
                className="mt-1 inline-flex font-medium text-[#f5f5f4] underline decoration-white/25 underline-offset-4 hover:decoration-white/60"
                data-testid="ask-de-choice-phone"
              >
                Call {PRIMARY_PHONE.display}
              </a>
            </div>
            {/* Last in the DOM, pinned top-right on screen: keyboard focus lands on
                the first choice when the chooser opens, not on Close. */}
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-[#b4b4ba] transition-colors hover:bg-white/[0.08] hover:text-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3B23C]"
              aria-label="Close Ask DE"
              data-testid="ask-de-close"
            >
              <X className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} aria-hidden="true" />
            </button>
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
        // One white focus ring that keeps the round shape. focus-visible:rounded-full
        // pins the radius so no global focus rule can square it off again.
        // Without a label the button is a 40px circle (no extra right padding).
        className={`group flex h-10 shrink-0 items-center gap-2 rounded-full px-1${compact ? "" : " sm:pr-1.5"} text-white transition-colors duration-200 hover:bg-white/[0.06] focus-visible:rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5f5f4] focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
        data-testid="button-open-asap-widget"
        aria-label={compact ? "Open Ask DE support options" : "Open Ask DE"}
        aria-expanded={showMenu}
        aria-haspopup="dialog"
      >
        <span
          className={`de-ask-fab relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${askDeBadgeClasses(compact)} shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-[transform,background-color,border-color] duration-150 group-hover:scale-[1.04]${askMotionAllowed ? " de-ask-fab--breathe" : ""}`}
          data-testid="ask-de-launcher-badge"
        >
          <AskDeGlyph className="h-[26px] w-[26px]" />
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
            .de-ask-fab.de-ask-fab--breathe::before {
              content: "";
              position: absolute;
              inset: -6px;
              border-radius: 50%;
              border: 2px solid rgba(227, 178, 60, 0.55);
              animation: de-ask-breathe 2.8s ease-out 3;
              animation-iteration-count: 3;
              pointer-events: none;
            }
            @keyframes de-ask-breathe {
              0% { transform: scale(0.86); opacity: 0.9; }
              70% { transform: scale(1.18); opacity: 0; }
              100% { transform: scale(1.18); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .de-ask-fab.de-ask-fab--breathe::before { animation: none; opacity: 0; }
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
/**
 * `autohide` (opt-in, used by /version-7): the chapter dock and back-to-top tuck
 * into the Ask DE button while the visitor reads down, and return on any sign of
 * intent. See useDockAutohide for the rules. Default off: production unchanged.
 */
export function SiteBottomBar({ autohide = false }: { autohide?: boolean } = {}) {
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

  const showAskDE = !deskOpen;
  const compactAskDE = isDoor2Path(location);
  const barMountedGuess = !isPortal && (showAskDE || showMenu || farDown);
  const { tucked, typing } = useDockAutohide(autohide, trackRef, barMountedGuess);
  const showScrollTop = farDown && !tucked;
  const expanded = showMenu && !tucked;
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
      // Typing (autohide, phone): the bar steps aside, so floating chrome stops clearing it.
      const height = typing ? "0px" : `${Math.round(el.offsetHeight)}px`;
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
  }, [showBar, expanded, showAskDE, showScrollTop, typing]);

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
      data-autohide={autohide ? (typing ? "typing" : tucked ? "tucked" : "shown") : undefined}
      style={
        typing
          ? {
              transform: "translateY(calc(100% + 24px))",
              opacity: 0,
              transition: prefersReducedMotion ? "opacity 120ms linear" : "transform 240ms cubic-bezier(.2,.8,.2,1), opacity 240ms cubic-bezier(.2,.8,.2,1)",
            }
          : autohide
            ? { transition: prefersReducedMotion ? "opacity 120ms linear" : "transform 240ms cubic-bezier(.2,.8,.2,1), opacity 240ms cubic-bezier(.2,.8,.2,1)" }
            : undefined
      }
      aria-hidden={typing || undefined}
      {...(typing ? { inert: "" } : {})}
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
            <HomepageDockMenu progress={autohide} />
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
