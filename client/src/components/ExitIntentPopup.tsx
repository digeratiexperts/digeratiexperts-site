import { useState, useEffect, useCallback, useId, useRef } from "react";
import { analytics } from "@/lib/analytics";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ArrowRight, Mail, CheckCircle2, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { CTA } from "@/lib/ctaCopy";
import { DE_LOGO_REVERSE } from '@/lib/brandAssets';
import { PRIMARY_PHONE } from "@/data/companyContact";
import { isDoor2Path } from "@/lib/isDoor2Path";
import { isWarehousePath } from "@/lib/warehousePaths";

const PUBLIC_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
];

const BENEFITS = [
  "Independent findings",
  "No switch required",
  "Arizona-based experts",
  "Practical next steps",
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

          <div className="pointer-events-none fixed inset-0 z-[10051] flex items-center justify-center p-4">
            <motion.div
              {...motionProps}
              className="pointer-events-auto w-full max-w-[32rem]"
              data-testid="popup-exit-intent"
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                className="relative overflow-hidden rounded-2xl border border-[var(--de-paper-hairline)] bg-[var(--de-paper-raised)] shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
              >
                <div className="h-1 bg-[#D3126A]" aria-hidden="true" />

                <div className="flex items-center justify-between gap-3 bg-[#0a0a0a] px-4 py-3 md:px-5">
                  <img
                    src={DE_LOGO_REVERSE}
                    alt="Digerati Experts"
                    className="h-8 w-auto md:h-9"
                    width={160}
                    height={36}
                  />
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={handleClose}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                    aria-label="Close"
                    data-testid="button-close-exit-popup"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="bg-[var(--de-paper)] px-5 pb-6 pt-5 md:px-8 md:pb-8 md:pt-6">
                  {!isSuccess ? (
                    <>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D3126A]">
                        Cyber Risk Assessment
                      </p>
                      <h2
                        id={titleId}
                        className="mt-2 font-heading text-[1.55rem] font-semibold leading-[1.18] tracking-[-0.02em] text-[#1A1228] md:text-[1.75rem]"
                      >
                        Leave with a clear picture of your cyber risk.
                      </h2>
                      <p
                        id={descId}
                        className="mt-3 text-[16px] font-medium leading-relaxed text-[#2A2438]"
                      >
                        Drop your work email. We’ll send a short intro — independent findings you can
                        use with your current IT or with us.
                      </p>

                      <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-xl border border-[var(--de-paper-hairline)] bg-white px-4 py-3.5 sm:grid-cols-2">
                        {BENEFITS.map((item) => (
                          <li key={item} className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-snug text-[#1A1228]">
                            <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <form onSubmit={handleSubmit} className="mt-6 space-y-3" noValidate>
                        <div>
                          <label
                            htmlFor="exit-intent-email"
                            className="mb-1.5 block text-sm font-semibold text-[#1A1228]"
                          >
                            Work email
                          </label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A5368]" />
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
                              className="h-12 border-[var(--de-paper-hairline)] bg-white pl-11 text-[16px] text-[#1A1228] placeholder:text-[#8A8496] hover:border-black/25 focus-visible:border-[#D3126A] focus-visible:ring-[#D3126A]/40"
                              data-testid="input-exit-popup-email"
                            />
                          </div>
                          {fieldError ? (
                            <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-700">
                              {fieldError}
                            </p>
                          ) : null}
                          {submitError ? (
                            <p role="alert" className="mt-2 text-sm font-medium text-rose-700">
                              {submitError}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#D3126A] text-[16px] font-semibold text-white transition-colors hover:bg-[#f0187a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)] disabled:opacity-60"
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
                      </form>

                      <div className="mt-5 flex flex-col gap-2 border-t border-[var(--de-paper-hairline)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[15px] font-medium text-[#2A2438]">
                          Prefer to call?{" "}
                          <a
                            href={PRIMARY_PHONE.telHref}
                            className="font-semibold text-[#1A1228] underline-offset-2 hover:text-[#D3126A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                          >
                            <Phone className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
                            {PRIMARY_PHONE.display}
                          </a>
                        </p>
                        <p className="text-[13px] font-medium leading-relaxed text-[#5A5368]">
                          No spam. Follow-up on the assessment only.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
                        <div>
                          <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] text-[#1A1228]">
                            You’re on the list
                          </h2>
                          <p className="mt-2 text-[16px] font-medium leading-relaxed text-[#2A2438]">
                            We’ll follow up with assessment next steps — no spam.
                          </p>
                        </div>
                      </div>
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
