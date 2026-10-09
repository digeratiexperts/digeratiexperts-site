import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalUserSession } from "@/lib/portalRoles";

/**
 * First-login guided tour of the portal shell: a spotlight that glides from
 * one control to the next with a short "press here for…" card beside it.
 *
 * Starts on its own once per person (first dashboard visit after the gate),
 * from /portal/dashboard?tour=1 (the gate's "Take the portal tour"), or from
 * the account menu (window event `de-portal-tour`). Targets are matched by
 * selector; a target that is hidden at this width (the sidebar on a phone)
 * gets a centred card instead of a spotlight, so the tour never dead-ends.
 */

export const PORTAL_TOUR_EVENT = "de-portal-tour";
const TOUR_VERSION = "v1";
const seenKey = (userId: string) => `dePortalTour:${TOUR_VERSION}:${userId}`;

export function startPortalTour() {
  window.dispatchEvent(new Event(PORTAL_TOUR_EVENT));
}

type Step = { target?: string; title: string; body: string };

const STEPS: Step[] = [
  {
    title: "Welcome to your Client Portal",
    body: "Here is where you get help, track work, approve requests and find your documents. This tour takes about a minute. Use the arrow keys or the buttons; Esc ends it.",
  },
  { target: '[data-tour="nav-dashboard"]', title: "Your dashboard", body: "Start here. It shows what needs you now, your open tickets and recent activity." },
  { target: '[data-tour="nav-tickets"]', title: "Something broken? Press here", body: "Open a support ticket and follow it to the fix. You get a number and an update every time it moves." },
  { target: '[data-tour="nav-self-service"]', title: "Need something new?", body: "Access, a new device, a licence, a new starter: Self-Service has the right form and routes approvals for you." },
  { target: '[data-tour="search"]', title: "Search or jump anywhere", body: "Press Ctrl+K (Cmd+K on a Mac), type a page or a task, and press Enter." },
  { target: '[data-testid="button-live-updates"]', title: "Updates land here", body: "The bell shows changes to your tickets, requests and approvals as they happen." },
  { target: '[data-tour="nav-contracts"]', title: "Your agreements and documents", body: "Signed agreements, including the ones you just accepted, live in Contracts. Files DE shares with you are under Files & Downloads." },
  { target: '[data-tour="nav-settings"]', title: "Lock down your account", body: "Turn on multi-factor authentication in Settings. A passkey is the strongest option, and DE will never ask for your password." },
  { target: '[data-testid="button-user-menu"]', title: "Your account menu", body: "Light or dark theme, settings, sign out, and this tour again whenever you want it." },
  {
    title: "That's the tour",
    body: "For anything urgent, such as an outage or a security worry, call us rather than opening a ticket. Otherwise, welcome aboard.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;
const CARD_W = 320;

function visibleRect(selector: string | undefined): Rect | null {
  if (!selector) return null;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && style.visibility !== "hidden" && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight) {
      return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    }
  }
  return null;
}

/** Card beside the spotlight: right of a sidebar item, below a topbar control, clamped to the viewport. */
function cardPosition(rect: Rect | null): { top: number; left: number } | null {
  if (!rect) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  let left: number;
  let top: number;
  if (rect.left + rect.width + 16 + w <= vw - 12) {
    left = rect.left + rect.width + 16;
    top = rect.top;
  } else {
    left = rect.left + rect.width - w;
    top = rect.top + rect.height + 12;
  }
  left = Math.max(12, Math.min(left, vw - w - 12));
  top = Math.max(12, Math.min(top, vh - 220));
  return { top, left };
}

export function PortalTour({ user, enabled }: { user: PortalUserSession | null; enabled: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const userId = user?.id || "anon";

  const finish = useCallback(() => {
    try {
      localStorage.setItem(seenKey(userId), new Date().toISOString());
    } catch {
      /* private mode: the tour may show again, harmless */
    }
    setStep(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("tour")) {
      url.searchParams.delete("tour");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [userId]);

  // Triggers: ?tour=1, the account-menu event, or first visit to the dashboard.
  useEffect(() => {
    if (!enabled || !user) return;
    const onEvent = () => setStep(0);
    window.addEventListener(PORTAL_TOUR_EVENT, onEvent);
    const params = new URLSearchParams(window.location.search);
    let seen = true;
    try {
      seen = Boolean(localStorage.getItem(seenKey(userId)));
    } catch {
      /* treat as seen */
    }
    if (params.get("tour") === "1" || (!seen && user.role !== "admin" && window.location.pathname === "/portal/dashboard")) {
      const t = window.setTimeout(() => setStep(0), 400);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener(PORTAL_TOUR_EVENT, onEvent);
      };
    }
    return () => window.removeEventListener(PORTAL_TOUR_EVENT, onEvent);
  }, [enabled, user, userId]);

  // A sidebar item hidden at this width (phones) points at the menu button instead.
  const [viaMenu, setViaMenu] = useState(false);
  const measure = useCallback(() => {
    if (step === null) return;
    const target = STEPS[step].target;
    let r = visibleRect(target);
    let menu = false;
    if (!r && target?.startsWith('[data-tour="nav-')) {
      r = visibleRect('[data-sidebar="trigger"]');
      menu = Boolean(r);
    }
    setRect(r);
    setViaMenu(menu);
  }, [step]);

  useLayoutEffect(() => {
    if (step === null) return;
    const el = STEPS[step].target ? document.querySelector<HTMLElement>(STEPS[step].target!) : null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  useEffect(() => {
    if (step === null) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setStep((s) => (s === null ? s : s < STEPS.length - 1 ? s + 1 : (finish(), null)));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => (s && s > 0 ? s - 1 : s));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, finish]);

  if (step === null) return null;
  const current = STEPS[step];
  const pos = cardPosition(rect);
  const last = step === STEPS.length - 1;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 30 };

  return (
    <div className="fixed inset-0 z-[70]" data-testid="portal-tour">
      {/* Scrim: a full-screen dim when there is no target, otherwise a hole cut around it. */}
      <div className="absolute inset-0" onClick={finish} aria-hidden="true" />
      <AnimatePresence>
        {rect ? (
          <motion.div
            key="spot"
            className="pointer-events-none absolute rounded-lg"
            initial={false}
            animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, opacity: 1 }}
            transition={spring}
            style={{ boxShadow: "0 0 0 9999px rgb(5 3 18 / 0.62)" }}
            aria-hidden="true"
          >
            {!reduce && (
              <motion.span
                className="absolute inset-0 rounded-lg ring-2 ring-[rgb(var(--pt-brand))]"
                animate={{ opacity: [0.9, 0.25, 0.9], scale: [1, 1.06, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {reduce && <span className="absolute inset-0 rounded-lg ring-2 ring-[rgb(var(--pt-brand))]" />}
          </motion.div>
        ) : (
          <motion.div key="dim" className="pointer-events-none absolute inset-0 bg-[rgb(5_3_18/0.62)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true" />
        )}
      </AnimatePresence>

      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-tour-title"
        aria-describedby="portal-tour-body"
        tabIndex={-1}
        className="absolute rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl outline-none"
        style={{ width: `min(${CARD_W}px, calc(100vw - 24px))` }}
        initial={false}
        animate={
          pos
            ? { top: pos.top, left: pos.left, x: 0, y: 0 }
            : { top: "50%", left: "50%", x: "-50%", y: "-50%" }
        }
        transition={spring}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Step <span className="pt-num">{step + 1}</span> of <span className="pt-num">{STEPS.length}</span>
          </p>
          <button type="button" onClick={finish} className="-m-1 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="End the tour">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            <h2 id="portal-tour-title" className="mt-1 font-heading text-base font-semibold leading-snug">
              {current.title}
            </h2>
            <p id="portal-tour-body" className="mt-1 text-sm text-muted-foreground">
              {current.body}
            </p>
            {viaMenu && <p className="mt-2 text-xs font-medium pt-link">Open the menu at the top left to find it.</p>}
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 flex items-center gap-1" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? "h-1.5 w-4 rounded-full bg-[rgb(var(--pt-brand))]" : "h-1.5 w-1.5 rounded-full bg-muted-foreground/30"} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} data-testid="tour-back">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={finish} data-testid="tour-skip">
              Skip
            </Button>
          )}
          <Button size="sm" className="ml-auto" onClick={() => (last ? finish() : setStep(step + 1))} data-testid="tour-next">
            {last ? "Finish" : step === 0 ? "Show me around" : "Next"}
            {!last && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
