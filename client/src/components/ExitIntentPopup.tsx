import { useState, useEffect, useCallback, useId, useRef } from "react";
import { analytics } from "@/lib/analytics";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  ArrowRight,
  Mail,
  CheckCircle2,
  Phone,
  Scale,
  FileText,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { CTA } from "@/lib/ctaCopy";
import { DE_LOGO_REVERSE } from "@/lib/brandAssets";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { isDoor2Path } from "@/lib/isDoor2Path";
import { isWarehousePath } from "@/lib/warehousePaths";
import { IconWell } from "@/components/visual/IconWell";

const PUBLIC_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
];

/**
 * Three facts, each one true of the assessment as sold today. Anything with a
 * number or a delivery promise needs a source in docs/CLAIMS-REGISTER.md first.
 */
const FACTS: readonly { lead: string; rest: string; icon: LucideIcon }[] = [
  {
    lead: "Independent",
    rest: "Your provider shouldn’t grade its own work.",
    icon: Scale,
  },
  {
    lead: "Plain English",
    rest: "Findings ranked by risk for the person who writes the checks.",
    icon: FileText,
  },
  {
    lead: "No switch required",
    rest: "Use it with the IT you have, or with us.",
    icon: ArrowLeftRight,
  },
] as const;

/**
 * Compact EXAMPLE FORMAT strip (design/VISUAL_EVIDENCE.md) — not a real report.
 * Kept short so the dialog fits the viewport with the Teams-level card layout.
 */
const EXAMPLE_CHIPS = [
  { area: "Identity", state: "Priority" },
  { area: "Backups", state: "Review" },
  { area: "Endpoint", state: "Baseline" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ExitIntentPopupProps {
  delay?: number;
}

function validateBusinessEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your business email.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && PUBLIC_EMAIL_DOMAINS.includes(domain)) {
    return "Use your company email — personal inboxes aren’t accepted.";
  }
  return null;
}

export function ExitIntentPopup({ delay = 30000 }: ExitIntentPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);

  const showPopup = useCallback((force = false) => {
    if (shownRef.current) return;
    if (window.location.pathname.startsWith("/portal")) return;
    if (isDoor2Path(window.location.pathname)) return;
    if (isWarehousePath(window.location.pathname)) return;
    if (document.documentElement.hasAttribute("data-de-desk-open")) return;
    if (!force) {
      try {
        if (sessionStorage.getItem("exitPopupDismissed")) return;
      } catch {
        /* private mode / blocked storage */
      }
    }

    shownRef.current = true;
    try {
      analytics.exitIntentShown();
    } catch {
      /* tracking must never block the offer */
    }
    setIsVisible(true);
  }, []);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("exit_intent") === "1") {
        try {
          sessionStorage.removeItem("exitPopupDismissed");
        } catch {
          /* ignore */
        }
        showPopup(true);
      }
    } catch {
      /* ignore malformed URLs */
    }
  }, [showPopup]);

  useEffect(() => {
    if (document.documentElement.hasAttribute("data-de-desk-open")) {
      setIsVisible(false);
    }
    const onDesk = (event: Event) => {
      const open = !!(event as CustomEvent<{ open?: boolean }>).detail?.open;
      if (open) setIsVisible(false);
    };
    window.addEventListener("de-desk-open-change", onDesk as EventListener);
    return () => window.removeEventListener("de-desk-open-change", onDesk as EventListener);
  }, []);

  useEffect(() => {
    if (window.location.pathname.startsWith("/portal")) return;
    if (isDoor2Path(window.location.pathname)) return;
    if (isWarehousePath(window.location.pathname)) return;

    // Desktop leave toward the tab/address chrome only. No timer, no scroll bait.
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, delay);

    const leavingTowardChrome = (e: MouseEvent) => {
      if (!armed) return;
      if (e.clientY > 8) return;
      showPopup();
    };

    const html = document.documentElement;
    html.addEventListener("mouseleave", leavingTowardChrome);

    return () => {
      window.clearTimeout(arm);
      html.removeEventListener("mouseleave", leavingTowardChrome);
    };
  }, [delay, showPopup]);

  useEffect(() => {
    if (!isVisible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => emailRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(t);
    };
  }, [isVisible]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    sessionStorage.setItem("exitPopupDismissed", "true");
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href]",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isVisible, handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const nextError = validateBusinessEmail(email);
    if (nextError) {
      setFieldError(nextError);
      emailRef.current?.focus();
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/newsletter", {
        email: email.trim(),
        source: "exit_intent_popup",
        website_url: "",
      });

      analytics.exitIntentConverted();
      setIsSuccess(true);

      window.setTimeout(() => {
        handleClose();
      }, 4000);
    } catch {
      setSubmitError(`We couldn’t send that. Try again, or call us at ${PRIMARY_PHONE.display}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const motionProps = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.98, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 10 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10050] bg-black/80"
            onClick={handleClose}
            data-testid="overlay-exit-intent"
          />

          <div className="pointer-events-none fixed inset-0 z-[10051] flex items-center justify-center p-4 py-6 sm:p-6">
            <motion.div
              {...motionProps}
              className="pointer-events-auto w-full max-w-[40rem]"
              data-testid="popup-exit-intent"
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                className="relative max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain rounded-2xl border border-de-hairline bg-[#151217] shadow-[0_28px_80px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-4rem)]"
              >
                <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-b border-de-hairline bg-[#0a0a0a] px-5 py-3 md:px-7">
                  <img
                    src={DE_LOGO_REVERSE}
                    alt="Digerati Experts"
                    className="h-7 w-auto md:h-8"
                    width={160}
                    height={32}
                  />
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={handleClose}
                    className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                    aria-label="Close"
                    data-testid="button-close-exit-popup"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="px-5 pb-7 pt-6 md:px-8 md:pb-8 md:pt-7">
                  {!isSuccess ? (
                    <div className="mx-auto max-w-[34rem]">
                      <div className="text-center">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#D3126A]">
                          Cyber Risk Assessment
                        </p>
                        <h2
                          id={titleId}
                          className="mt-3 font-heading text-[1.55rem] font-semibold leading-[1.15] tracking-[-0.02em] text-white md:text-[1.85rem]"
                        >
                          Who checks the people who run your IT?
                        </h2>
                        <p
                          id={descId}
                          className="mx-auto mt-3 max-w-[28rem] text-[15px] font-medium leading-relaxed text-white/70 md:text-[16px]"
                        >
                          An independent second opinion from Arizona engineers — ranked by what
                          could actually hurt you. Nothing changes unless you decide it should.
                        </p>
                      </div>

                      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                        {FACTS.map((fact) => (
                          <li
                            key={fact.lead}
                            className="flex flex-col items-center rounded-xl border border-de-hairline bg-[#0a0a0a] px-4 py-6 text-center sm:min-h-[10.5rem] sm:justify-center"
                          >
                            <IconWell icon={fact.icon} size="md" surface="dark" />
                            <p className="mt-3.5 text-[15px] font-semibold leading-snug text-white">
                              {fact.lead}
                            </p>
                            <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/55">
                              {fact.rest}
                            </p>
                          </li>
                        ))}
                      </ul>

                      <aside
                        className="mt-5 rounded-xl border border-de-hairline bg-[#0a0a0a] px-3.5 py-3"
                        aria-label="Example format of assessment findings. Not a real report."
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                            Findings shape
                          </span>
                          <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200">
                            Example format
                          </span>
                        </div>
                        <ul className="mt-2.5 flex flex-wrap gap-2" aria-hidden="true">
                          {EXAMPLE_CHIPS.map((chip) => (
                            <li
                              key={chip.area}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-de-hairline px-2.5 py-1.5 text-[12px]"
                            >
                              <span className="font-semibold text-white/85">{chip.area}</span>
                              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
                                {chip.state}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </aside>

                      <form onSubmit={handleSubmit} className="mx-auto mt-7 max-w-[22rem] space-y-3" noValidate>
                        <div>
                          <label
                            htmlFor="exit-intent-email"
                            className="mb-1.5 block text-sm font-semibold text-white/90"
                          >
                            Work email
                          </label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                            <Input
                              ref={emailRef}
                              id="exit-intent-email"
                              type="email"
                              autoComplete="email"
                              inputMode="email"
                              placeholder="name@company.com"
                              value={email}
                              aria-invalid={fieldError ? true : undefined}
                              aria-describedby={fieldError ? errorId : undefined}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (fieldError) setFieldError(null);
                                if (submitError) setSubmitError(null);
                              }}
                              className="h-12 border-de-hairline bg-[#0a0a0a] pl-11 text-[16px] text-white placeholder:text-white/35 hover:border-white/25 focus-visible:border-[#D3126A] focus-visible:ring-[#D3126A]/40"
                              data-testid="input-exit-popup-email"
                            />
                          </div>
                          {fieldError ? (
                            <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-300">
                              {fieldError}
                            </p>
                          ) : null}
                          {submitError ? (
                            <p role="alert" className="mt-2 text-sm font-medium text-rose-300">
                              {submitError}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#D3126A] text-[15px] font-semibold text-white transition-colors hover:bg-[#f0187a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151217] disabled:opacity-60 md:text-[16px]"
                          data-testid="button-get-checklist"
                        >
                          {isSubmitting ? (
                            "Sending…"
                          ) : (
                            <>
                              {CTA.primary}
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                        <p className="text-center text-[12px] font-medium leading-relaxed text-white/45">
                          A DE engineer follows up to scope it. No spam.
                        </p>
                      </form>

                      <p className="mt-6 text-center text-[14px] font-medium text-white/55">
                        <a
                          href={PRIMARY_PHONE.telHref}
                          className="inline-flex items-center gap-1.5 font-semibold text-white/60 underline-offset-2 transition-colors hover:text-[#D3126A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          Prefer to call? {PRIMARY_PHONE.display}
                        </a>
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" aria-hidden="true" />
                      <h2 className="mt-4 font-heading text-xl font-semibold tracking-[-0.02em] text-white">
                        Got it. A DE engineer will be in touch.
                      </h2>
                      <p className="mx-auto mt-2 max-w-[26rem] text-[16px] font-medium leading-relaxed text-white/70">
                        We’ll reach out from a digeratiexperts.com address to scope your assessment.
                        No spam, just that follow-up.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
