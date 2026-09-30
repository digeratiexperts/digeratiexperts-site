import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { Input } from "@/components/ui/input";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { useBooking } from "@/contexts/BookingContext";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  buttonSecondary,
  cardDark,
  cardPaper,
  Eyebrow,
  ledeClass,
  titleClass,
  textLinkClass,
} from "@/components/home/HomeChapter";

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
    <HomeChapter tone="surface">
      <HomeContainer>
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <motion.div
            className="lg:col-span-6"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <Eyebrow tone="surface" className="mb-4">
              Cyber Risk Assessment
            </Eyebrow>
            <h2 className={`${titleClass} max-w-[20ch]`}>Start with a Cyber Risk Assessment</h2>
            <p className={`${ledeClass("surface")} mt-5 max-w-xl`}>
              Discover identity, endpoint, email, backup, and operating gaps before you buy a package.
            </p>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/55">
              Assessment-led recommendations. Final scope confirmed after we see the environment.
            </p>
            <p className="mt-3 text-base font-semibold text-white">
              Serving Arizona professional services, healthcare, and growing SMBs.
            </p>

            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {operatingPoints.map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-snug text-white/85"
                  data-testid={`badge-${item.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className={`${cardDark} p-6 md:p-7 lg:col-span-6`}
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="homepage-cta-email" className="mb-1.5 block text-sm font-semibold text-white">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" aria-hidden="true" />
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
                    className="de-paper-field h-12 border-[var(--de-paper-hairline)] bg-[var(--de-paper)] pl-11 text-[16px] text-[#1A1228] caret-[#1A1228] placeholder:text-black/50 hover:border-black/25 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/60"
                    data-testid="input-cta-email"
                  />
                </div>
                {fieldError ? (
                  <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-[#ff7ab3]">
                    {fieldError}
                  </p>
                ) : null}
              </div>

              <button type="submit" className={`${buttonPrimary("surface")} w-full sm:w-auto`} data-testid="button-cta-assessment">
                {CTA.primary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-2 border-t border-[var(--de-hairline)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <a href="#contact" className={textLinkClass("surface")} data-testid="link-cta-contact">
                Or send a message below
              </a>
              <p className="text-sm text-white/65">
                Prefer to call?{" "}
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="font-semibold text-white underline-offset-2 hover:text-de-magenta-ink hover:underline"
                >
                  {PRIMARY_PHONE.display}
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
