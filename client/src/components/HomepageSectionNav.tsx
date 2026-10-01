import { useEffect, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion, useScroll } from "framer-motion";
import { ArrowRight, Phone, Shield } from "lucide-react";
import { useOptionalFullPageScroll } from "@/components/FullPageScroll";
import { useBooking } from "@/contexts/BookingContext";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { CTA } from "@/lib/ctaCopy";

/** Homepage chapters in the thin top table of contents. */
const TOP_CHAPTERS = new Set([
  "hero",
  "stats",
  "services",
  "pricing",
  "industries",
  "contact",
]);

/** Concise dock chapters — same system as the top TOC. */
const DOCK_CHAPTERS = new Set([
  "hero",
  "stats",
  "services",
  "pricing",
  "industries",
  "contact",
]);

function nearestNavIndex(
  items: Array<{ index: number }>,
  currentSection: number
): number {
  if (items.some(({ index }) => index === currentSection)) return currentSection;
  let best = items[0]?.index ?? 0;
  let bestDist = Infinity;
  for (const { index } of items) {
    const dist = Math.abs(index - currentSection);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }
  return best;
}

/**
 * Slim homepage table of contents under the global MegaMenu.
 * Desktop secondary row only — never inside the compact logo bar below lg.
 * Mobile/tablet jumps live in the MegaMenu drawer.
 *
 * Its own field (raised graphite, not the nav's black) so it reads as the
 * page's instrument rather than a second nav. Two controlled motions only:
 * the active marker glides between chapters and a hairline fills with read
 * progress. Both are scroll-linked or spring-damped; nothing loops or pulses.
 */
export function HomepageOnPageNav() {
  const ctx = useOptionalFullPageScroll();
  const rootRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const sections = ctx?.sections ?? [];
  const currentSection = ctx?.currentSection ?? 0;
  const scrollToSection = ctx?.scrollToSection;
  const items = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => TOP_CHAPTERS.has(section.id));

  const activeIndex = nearestNavIndex(items, currentSection);
  const activePosition = Math.max(0, items.findIndex(({ index }) => index === activeIndex));

  useEffect(() => {
    const root = document.documentElement;
    const el = rootRef.current;
    if (!el) {
      root.style.setProperty("--de-spy-h", "0px");
      return;
    }

    const publish = () => {
      root.style.setProperty("--de-spy-h", `${Math.round(el.offsetHeight)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--de-spy-h", "0px");
    };
  }, [ctx]);

  if (!ctx || items.length === 0) return null;

  return (
    <nav
      ref={rootRef}
      aria-label="On this page"
      data-testid="homepage-section-spy"
      className="relative hidden border-t border-white/[0.08] bg-[#151217] max-lg:!hidden lg:block"
    >
      <div className="mx-auto flex max-w-[var(--de-canvas)] items-center gap-4 px-5 sm:px-8 lg:px-10 xl:px-12">
        <span
          className="hidden shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 xl:inline"
          aria-hidden="true"
        >
          On this page
        </span>
        <LayoutGroup id="home-spy">
          <ul className="flex min-h-10 flex-1 items-center justify-start gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map(({ section, index }) => {
              const isActive = activeIndex === index;
              return (
                <li key={section.id} className="relative flex shrink-0">
                  <a
                    href={`#${section.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      scrollToSection?.(index);
                    }}
                    className={`relative inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-inset ${
                      isActive ? "text-white" : "text-white/60 hover:text-white"
                    }`}
                    aria-current={isActive ? "true" : undefined}
                    data-testid={`nav-dot-${section.id}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="home-spy-active"
                        className="absolute inset-0 -z-10 rounded-full border border-[#D3126A]/50 bg-[#D3126A]/15"
                        transition={
                          prefersReducedMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 420, damping: 38, mass: 0.6 }
                        }
                        aria-hidden="true"
                      />
                    )}
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </LayoutGroup>
        <span
          className="hidden shrink-0 font-mono text-[11px] font-semibold tracking-[0.2em] text-white/45 lg:inline"
          aria-hidden="true"
        >
          {String(activePosition + 1).padStart(2, "0")}
          <span className="text-white/25"> / </span>
          {String(items.length).padStart(2, "0")}
        </span>
      </div>
      {/* Read progress — the one hairline that moves, and only with the scroll. */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#D3126A]"
        style={{ scaleX: scrollYProgress }}
        aria-hidden="true"
      />
    </nav>
  );
}

export function useHomepageDockVisibility() {
  const ctx = useOptionalFullPageScroll();
  const [scrolledAway, setScrolledAway] = useState(false);
  const [nearFooter, setNearFooter] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [cookieClear, setCookieClear] = useState(() => {
    try {
      return !!localStorage.getItem("de_cookie_consent_v2") || !!localStorage.getItem("de_cookie_consent");
    } catch {
      return true;
    }
  });

  const sections = ctx?.sections ?? [];
  const items = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => DOCK_CHAPTERS.has(section.id));

  useEffect(() => {
    const onConsent = () => setCookieClear(true);
    window.addEventListener("de-cookie-consent", onConsent);
    return () => window.removeEventListener("de-cookie-consent", onConsent);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolledAway(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setNearFooter(entry.isIntersecting && entry.intersectionRatio > 0.28),
      { threshold: [0, 0.28, 0.5] }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const showMenu =
    Boolean(ctx) && isDesktop && scrolledAway && !nearFooter && cookieClear && items.length > 0;

  return { showMenu, nearFooter, isDesktop };
}

/**
 * Homepage chapters for the unified bottom bar.
 * Protected? stays a fixed lead-in; chapter links flex across leftover
 * width so the row fills instead of clustering left of the actions.
 */
export function HomepageDockMenu() {
  const ctx = useOptionalFullPageScroll();
  const sections = ctx?.sections ?? [];
  const currentSection = ctx?.currentSection ?? 0;
  const scrollToSection = ctx?.scrollToSection;
  const items = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => DOCK_CHAPTERS.has(section.id));
  const topItems = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => TOP_CHAPTERS.has(section.id));
  const conceptualActiveIndex = nearestNavIndex(topItems, currentSection);
  const conceptualActiveId = sections[conceptualActiveIndex]?.id;

  if (!ctx || items.length === 0) return null;

  return (
    <nav
      className="flex w-full min-w-0 items-center gap-2 overflow-hidden"
      aria-label="On this page"
      data-testid="homepage-section-dock"
    >
      <div className="hidden h-10 shrink-0 items-center gap-2 border-r border-white/20 pr-3 xl:flex">
        <Shield className="h-4 w-4 text-de-magenta-ink" aria-hidden="true" />
        <span className="whitespace-nowrap text-base font-semibold text-white">Protected?</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-none">
        {items.map(({ section, index }) => {
          const isActive = section.id === conceptualActiveId;
          return (
            <div key={section.id} className="flex shrink-0 justify-center">
              <a
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection?.(index);
                }}
                className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-base font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink ${
                  isActive
                    ? "bg-de-magenta text-white shadow-lg shadow-[#D3126A]/40"
                    : "text-de-muted-soft hover:bg-white/10 hover:text-white"
                }`}
                aria-current={isActive ? "true" : undefined}
                data-testid={`nav-dock-${section.id}`}
              >
                {isActive && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]"
                    aria-hidden="true"
                  />
                )}
                {section.label}
              </a>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** Phone + Risk Assessment — sits in the bottom-bar action cluster. */
export function HomepageDockActions() {
  const { openBooking } = useBooking();

  return (
    <div className="flex items-center gap-1.5" data-testid="homepage-dock-actions">
      <a
        href={PRIMARY_PHONE.telHref}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-base font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"
        data-testid="nav-phone"
        aria-label={`Call ${PRIMARY_PHONE.display}`}
      >
        <Phone className="h-4 w-4 text-de-magenta-ink" aria-hidden="true" />
        <span className="hidden xl:inline">{PRIMARY_PHONE.display}</span>
      </a>

      <button
        type="button"
        onClick={() => openBooking("homepage_section_dock")}
        className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-de-magenta px-3.5 text-base font-semibold text-white shadow-lg shadow-[#D3126A]/35 transition-colors duration-200 hover:bg-de-magenta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"
        data-testid="nav-cta-assessment"
      >
        {CTA.primaryNavCompact}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** @deprecated Use SiteBottomBar — kept so existing homepage imports stay safe during the swap. */
export function HomepageSectionDock() {
  return null;
}
