import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { Input } from "@/components/ui/input";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { useBooking } from "@/contexts/BookingContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const operatingPoints = [
  "Audit readiness support",
  "Microsoft-aligned stack",
  "HIPAA-minded controls",
  "Documented standards",
];

export const DigeratiCTASection = (): JSX.Element => {
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
    openBooking("homepage-cta");
  };

  return (
    <section className="de-dark-well relative py-8 md:py-14">
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
          <div className="mx-auto max-w-3xl relative z-10">
            <motion.div
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#D3126A] md:text-base">
                Cyber Risk Assessment
              </p>
              <h2 className="mb-4 font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228] md:text-4xl lg:text-5xl">
                Start with a Cyber Risk Assessment
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-[#2A2438] md:text-lg">
                Discover identity, endpoint, email, backup, and operating gaps before you buy a package.
              </p>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5A5368]">
                Assessment-led recommendations. Final scope confirmed after we see the environment.
              </p>
              <p className="mt-3 text-base font-semibold text-[#1A1228]">
                Serving Arizona professional services, healthcare, and growing SMBs.
              </p>
            </motion.div>

            <motion.ul
              className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 rounded-2xl border border-[var(--de-paper-hairline)] bg-white px-5 py-5 sm:grid-cols-2 md:px-7 md:py-6"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              {operatingPoints.map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-snug text-[#1A1228]"
                  data-testid={`badge-${item.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </motion.ul>

            <motion.form
              onSubmit={handleSubmit}
              className="mt-8 space-y-3"
              noValidate
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <div>
                <label htmlFor="homepage-cta-email" className="mb-1.5 block text-sm font-semibold text-[#1A1228]">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A5368]" />
                  <Input
                    ref={emailRef}
                    id="homepage-cta-email"
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
                    className="h-12 border-[var(--de-paper-hairline)] bg-white pl-11 text-[16px] text-[#1A1228] placeholder:text-[#8A8496] hover:border-black/25 focus-visible:border-[#D3126A] focus-visible:ring-[#D3126A]/40"
                    data-testid="input-cta-email"
                  />
                </div>
                {fieldError ? (
                  <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-700">
                    {fieldError}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#D3126A] text-[16px] font-semibold text-white transition-colors hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)] sm:w-auto sm:px-8"
                data-testid="button-cta-assessment"
              >
                {CTA.primary}
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.form>

            <motion.div
              className="mt-6 flex flex-col gap-2 border-t border-[var(--de-paper-hairline)] pt-5 sm:flex-row sm:items-center sm:justify-between"
              initial={prefersReducedMotion ? false : { opacity: 0.55 }}
              whileInView={{ opacity: 1 }}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <a
                href="#contact"
                className="text-sm font-medium text-[#A30E52] underline-offset-4 hover:text-[#D3126A] hover:underline"
                data-testid="link-cta-contact"
              >
                Or send a message below
              </a>
              <p className="text-sm font-medium text-[#5A5368]">
                Prefer to call?{" "}
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="font-semibold text-[#1A1228] underline-offset-2 hover:text-[#D3126A] hover:underline"
                >
                  {PRIMARY_PHONE.display}
                </a>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
