import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { Link } from "wouter";
import { analytics } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Building, FileCheck, Shield, Check } from "lucide-react";
import { DashboardMockup } from "@/components/graphics";
import heroBgImage from "@assets/de-hero-arizona-dusk.png";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE, hasPublicPhone } from "@/data/companyContact";
import { PhoneLink } from "@/components/PhoneLink";

export const ModernHeroSection = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();

  const features = [
    { icon: FileCheck, text: "Insurance & Compliance-Ready" },
    { icon: Shield, text: "24/7 Human-Led Monitoring" },
    { icon: Building, text: "Built for Small Businesses" },
    { icon: CheckCircle, text: "Easy-to-Read Risk Reports" },
  ];

  const handleSchedule = () => {
    analytics.bookingOpened("hero");
    openBooking("hero");
  };

  return (
    <section
      ref={containerRef}
      id="home"
      className="de-field-grain-film relative flex min-h-[100svh] shrink-0 scroll-mt-[var(--de-nav-offset)] flex-col lg:min-h-screen"
      style={{ position: "relative" }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src={heroBgImage}
          alt=""
          loading="eager"
          decoding="async"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: 0.94,
            objectPosition: "center 64%",
          }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(90deg, rgba(5,3,18,0.48) 0%, rgba(5,3,18,0.22) 46%, rgba(5,3,18,0.08) 78%, rgba(5,3,18,0.18) 100%), linear-gradient(180deg, rgba(5,3,18,0.28) 0%, rgba(5,3,18,0.06) 42%, rgba(5,3,18,0.08) 72%, rgba(5,3,18,0.42) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute right-0 top-[12%] h-[320px] w-[320px]"
          style={{
            background:
              "radial-gradient(circle at 60% 40%, rgba(211, 18, 106, 0.10) 0%, rgba(91, 69, 224, 0.08) 42%, transparent 70%)",
          }}
        />
      </div>

      <motion.div
        className="relative z-10 flex flex-1 w-full items-center px-5 sm:px-8 lg:px-10 xl:px-12 pt-[calc(var(--de-nav-offset)+1.75rem)] pb-16 sm:pb-20 lg:pt-[calc(var(--de-nav-offset)+2.25rem)] lg:pb-28"
      >
        <div className="mx-auto w-full max-w-[var(--de-canvas)]">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:gap-12">
            <motion.div
              className="flex flex-col gap-5 sm:gap-6 w-full min-w-0"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: "easeOut" }}
            >
              <motion.p
                className="text-sm font-semibold uppercase tracking-[0.16em] text-pink-300/95 sm:text-base sm:tracking-[0.18em]"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: prefersReducedMotion ? 0 : 0.05 }}
              >
                Arizona MSP · Cybersecurity &amp; Managed IT
              </motion.p>

              <h1 className="text-[clamp(1.7rem,3.2vw,3.55rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white">
                <span className="whitespace-nowrap">Your Arizona business,</span>
                <br />
                <span className="text-[#D3126A]">protected 24/7.</span>
              </h1>

              <div className="relative w-fit max-w-[36.5rem] -mx-2 -my-2 p-2.5 sm:-mx-3 sm:p-3.5">
                <div
                  className="pointer-events-none absolute inset-0 -z-10 rounded-[1.5rem]"
                  aria-hidden="true"
                  style={{
                    background:
                      "radial-gradient(ellipse 85% 85% at 30% 50%, rgba(6, 4, 12, 0.42) 0%, rgba(6, 4, 12, 0.18) 55%, transparent 100%)",
                  }}
                />
                <p className="de-copy-on-dark text-[17px] leading-[1.6] sm:text-lg text-white/95">
                  Cybersecurity and managed IT for growing businesses—reducing risk, supporting
                  compliance, and keeping your team productive without building an internal IT
                  department.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2.5 min-[420px]:grid-cols-2">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.text}
                      className="flex min-w-0 items-center gap-2"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.28,
                        delay: prefersReducedMotion ? 0 : 0.1 + index * 0.03,
                      }}
                    >
                      <feature.icon className="h-4 w-4 shrink-0 text-[#D3126A]" strokeWidth={1.75} aria-hidden="true" />
                      <span className="de-copy-on-dark text-[14px] font-medium leading-5 text-white/90">{feature.text}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mt-0.5 flex flex-col items-start gap-3" id="assessment-cta">
                <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    data-testid="button-hero-schedule"
                    onClick={handleSchedule}
                    variant="brand"
                    className="h-12 w-full sm:w-auto px-6 sm:px-7 text-base font-semibold"
                  >
                    {CTA.primary}
                    <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    asChild
                    data-testid="button-hero-pricing"
                    className="h-12 w-full rounded-lg border border-white/20 bg-[#151217] px-6 text-base font-semibold text-white shadow-none hover:bg-white/[0.06] hover:border-white/35 sm:w-auto sm:px-7"
                  >
                    <Link href={CTA.secondaryHref}>{CTA.secondary}</Link>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[14px] text-white/70">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    No obligation
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    Response within one business day
                  </span>
                </div>

                <p className="text-[14px] leading-5 text-white/60">
                  Arizona-based · Principal-led
                  {hasPublicPhone() && (
                    <>
                      {" "}
                      · Call{" "}
                      <PhoneLink
                        className="font-medium text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50"
                        data-testid="link-hero-phone"
                      >
                        {PRIMARY_PHONE.display}
                      </PhoneLink>
                    </>
                  )}
                </p>
              </div>
            </motion.div>

            <div
              className="relative flex w-full justify-center lg:justify-end"
              data-testid="hero-assessment-card"
            >
              <motion.div
                className="relative w-full max-w-[560px] lg:max-w-[600px]"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.45,
                  delay: prefersReducedMotion ? 0 : 0.12,
                  ease: "easeOut",
                }}
              >
                <div
                  className="pointer-events-none absolute -inset-6 -z-10 rounded-[1.75rem]"
                  aria-hidden="true"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(91, 69, 224, 0.16) 0%, transparent 68%)",
                  }}
                />
                <DashboardMockup className="w-full" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-gradient-to-t from-[#050312] to-transparent" />
    </section>
  );
};
