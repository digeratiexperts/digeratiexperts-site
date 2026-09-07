import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { Input } from "@/components/ui/input";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { useBooking } from "@/contexts/BookingContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Challenger-only version of the homepage "next step" section.
 *
 * The existing email capture behavior is intentionally preserved while the
 * presentation is reduced from a second long-form chapter to one compact
 * conversion band. The canonical DigeratiCTASection remains untouched so the
 * production homepage can be compared against this branch cleanly.
 */
export const DigeratiCTASectionChallenger = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();

    if (!value) {
      setFieldError("Enter your work email.");
      emailRef.current?.focus();
      return;
    }

    if (!EMAIL_RE.test(value)) {
      setFieldError("Enter a valid work email.");
      emailRef.current?.focus();
      return;
    }

    setFieldError(null);
    openBooking("homepage-challenger-cta");
  };

  return (
    <section className="de-dark-well relative py-5 md:py-7" aria-labelledby="challenger-cta-heading">
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#120d1b] px-5 py-6 shadow-2xl shadow-black/20 sm:px-7 md:px-8 md:py-7"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_50%,rgba(211,18,106,0.16),transparent_62%)]" aria-hidden="true" />

          <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(30rem,0.9fr)] xl:items-center">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#F15A9B]">
                Next step
              </p>
              <h2
                id="challenger-cta-heading"
                className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-3xl"
              >
                Know where your IT and security stand.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                Start with a practical Cyber Risk Assessment, or talk directly with Digerati Experts about your environment.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <button
                  type="button"
                  onClick={() => openBooking("homepage-challenger-talk")}
                  className="font-semibold text-white underline-offset-4 transition-colors hover:text-[#F15A9B] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120d1b]"
                  data-testid="button-challenger-talk"
                >
                  Talk to DE
                </button>
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="inline-flex items-center gap-1.5 font-medium text-white/60 transition-colors hover:text-white"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  {PRIMARY_PHONE.display}
                </a>
                <a
                  href="#contact"
                  className="font-medium text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  Send a message below
                </a>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="w-full">
              <label htmlFor="homepage-challenger-cta-email" className="mb-2 block text-sm font-semibold text-white">
                Work email
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
                  <Input
                    ref={emailRef}
                    id="homepage-challenger-cta-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@company.com"
                    value={email}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? errorId : undefined}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    className="h-12 border-white/20 bg-white/[0.06] pl-11 text-[16px] text-white placeholder:text-white/40 hover:border-white/30 focus-visible:border-[#D3126A] focus-visible:ring-[#D3126A]/40"
                    data-testid="input-challenger-cta-email"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#D3126A] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120d1b]"
                  data-testid="button-challenger-cta-assessment"
                >
                  {CTA.primary}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {fieldError ? (
                <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-300">
                  {fieldError}
                </p>
              ) : (
                <p className="mt-2 text-xs leading-5 text-white/40">
                  Assessment-led recommendations. Final scope is confirmed after we see the environment.
                </p>
              )}
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
