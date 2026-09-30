// FROZEN — homepage version 3, snapshot of client/src/pages/sections/ReferenceHeroSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "@/components/graphics";
import { PronunciationCard } from "@/components/PronunciationCard";
import { useBooking } from "@/contexts/BookingContext";
import { analytics } from "@/lib/analytics";
import { CTA } from "@/lib/ctaCopy";
import { COMPANY, PRIMARY_PHONE } from "@/data/companyContact";
// 50KB WebP (was a 2.0MB PNG): at 30% opacity under the dark field, the
// aggressive compression is invisible — review finding F1.
import heroCityLights from "@assets/de-hero-arizona-dusk-1600.webp";

const trustItems = [
  {
    icon: ShieldCheck,
    code: "01 / CYBERSECURITY FIRST",
    title: "Six domains, one accountable team.",
    body: "Identity, endpoints, email, network, backup and recovery, security operations.",
  },
  {
    icon: CheckCircle2,
    code: "02 / PROACTIVE IT",
    title: "Operated, not watched.",
    body: "Assessment, roadmap, implementation, then continuous management with reviews at your tier's cadence.",
  },
  {
    icon: ClipboardCheck,
    code: "03 / COMPLIANCE READY",
    title: "Evidence, not claims.",
    body: "HIPAA, PCI DSS, SOC 2 and cyber-insurance readiness support. Framework names are your requirements, not our certifications.",
  },
  {
    icon: MapPin,
    code: "04 / LOCAL & RESPONSIVE",
    title: `${COMPANY.addressLocality}, Arizona.`,
    body: `${COMPANY.streetAddress}. Call ${PRIMARY_PHONE.display}. Response targets are published in our SLA.`,
  },
];

// Per Joe (2026-08-30): no vendor names in the hero — DE does not surface
// stack vendors on the public homepage. Positioning line only.

// The invented generic ShieldIllustration was removed under the DE Product
// Preservation Law (governance §18): the hero's visual is DE's own Cyber Risk
// Assessment preview (DashboardMockup), upgraded into the reference's dark
// precision field — not replaced by borrowed imagery.

export function ReferenceHeroSection(): JSX.Element {
  const { openBooking } = useBooking();
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const cityLightsY = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ["0%", "0%"] : ["0%", "9%"],
  );

  const openAssessment = () => {
    analytics.bookingOpened("hero-reference");
    openBooking("hero-reference");
  };

  return (
    <section ref={sectionRef} id="home" className="relative overflow-hidden bg-[#050312] text-white scroll-mt-[var(--de-nav-offset)]">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 78% 36%, rgba(87,68,255,0.22), transparent 30%), radial-gradient(circle at 92% 68%, rgba(211,18,106,0.10), transparent 25%), linear-gradient(110deg, #050312 0%, #060617 52%, #090924 100%)",
        }}
      />
      {/* Phoenix city-lights landscape (aerial overview), returned per Joe
          2026-08 — kept faint under the dark precision field so the approved
          reference's premium black still dominates. Masked so the left text
          column stays high-contrast. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Gentle scroll parallax on the city lights (Joe 2026-08-31) —
            oversized ~12% and translated by scroll so no edge ever shows;
            reduced motion holds the still. */}
        <motion.img
          src={heroCityLights}
          alt=""
          width={1600}
          height={1067}
          loading="eager"
          decoding="async"
          // react-dom 18 doesn't know camelCase fetchPriority (unknown-prop
          // warning); pass the lowercase DOM attribute directly.
          {...({ fetchpriority: "low" } as Record<string, string>)}
          className="absolute h-[112%] w-full object-cover"
          style={{
            y: cityLightsY,
            top: "-6%",
            opacity: 0.3,
            objectPosition: "center 58%",
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.95) 68%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.95) 68%, black 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,3,18,0.55) 0%, rgba(5,3,18,0.12) 34%, rgba(5,3,18,0.1) 66%, rgba(5,3,18,0.72) 100%)",
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 opacity-30"
        aria-hidden="true"
        style={{
          width: "58%",
          backgroundImage:
            "linear-gradient(rgba(123,108,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(123,108,255,0.14) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "linear-gradient(to left, black, transparent)",
        }}
      />

      <div className="relative mx-auto grid min-h-[680px] max-w-[var(--de-canvas)] items-center gap-10 px-5 pb-14 pt-[calc(var(--de-nav-offset)+3rem)] sm:px-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)] lg:px-10 lg:pb-20 lg:pt-[calc(var(--de-nav-offset)+3.5rem)] xl:px-12">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: "easeOut" }}
          className="relative z-10"
          style={{ maxWidth: 760 }}
        >
          <p className="mb-5 text-xs font-semibold uppercase text-[#a99cff] sm:text-sm" style={{ letterSpacing: "0.2em" }}>
            Arizona MSP · Cybersecurity &amp; Managed IT
          </p>
          <h1
            className="font-semibold text-[#fbfaf8]"
            style={{ maxWidth: 730, fontSize: "clamp(2.2rem,4.6vw,4.75rem)", lineHeight: 1.04, letterSpacing: "-0.045em" }}
          >
            <span className="lg:block">Cybersecurity-First</span>{" "}
            <span className="lg:block">IT That Powers</span>{" "}
            <span className="block w-fit bg-gradient-to-r from-[#9a8bff] via-[#7b6cff] to-[#d3126a] bg-clip-text text-transparent">
              Your Business
            </span>
          </h1>
          <p className="mt-7 leading-7 text-white/72 sm:leading-8" style={{ maxWidth: 650, fontSize: 17 }}>
            Managed IT, security, and compliance &mdash; built for Arizona businesses that can&apos;t afford downtime.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={openAssessment}
              size="lg"
              className="h-12 rounded-lg border-0 bg-gradient-to-r from-[#5f4ae8] to-[#7d5cf4] px-7 text-base font-semibold text-white hover:brightness-110"
              style={{ boxShadow: "0 14px 36px -18px rgba(111,92,255,0.9)" }}
              data-testid="button-hero-schedule"
            >
              {CTA.primary}
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-lg border border-white/20 bg-transparent px-7 text-base font-semibold text-white hover:border-white/40 hover:bg-white/5 hover:text-white"
              data-testid="button-hero-pricing"
            >
              <Link href={CTA.secondaryHref}>{CTA.secondary}</Link>
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[14px] text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              No obligation
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              Response within one business day
            </span>
            <a
              href={PRIMARY_PHONE.telHref}
              className="font-medium text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50"
              data-testid="link-hero-phone"
            >
              Call {PRIMARY_PHONE.display}
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/58">
            <span>Assessment-led</span>
            <span aria-hidden="true">·</span>
            <span>Client-owned access</span>
            <span aria-hidden="true">·</span>
            <span>Fully managed or co-managed</span>
          </div>

          <div className="mt-7" style={{ maxWidth: 620 }}>
            <PronunciationCard />
          </div>
        </motion.div>

        {/* DE Cyber Risk Assessment preview — the existing product artwork,
            upgraded with the reference field's violet depth glow. Visible on
            all breakpoints (stacked under copy on mobile), as before. */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.52, delay: prefersReducedMotion ? 0 : 0.08, ease: "easeOut" }}
          className="relative z-10 flex w-full justify-center lg:justify-end"
          data-testid="hero-assessment-card"
        >
          <div className="relative w-full max-w-[560px] lg:max-w-[600px]">
            <div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(91, 69, 224, 0.18) 0%, transparent 68%)",
              }}
            />
            <DashboardMockup className="w-full" />
          </div>
        </motion.div>
      </div>

      <div className="relative border-t border-black/10 bg-[#f7f5f2] text-[#17141f]">
        <div className="mx-auto max-w-[var(--de-canvas)] px-5 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-12">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-black/10 pb-4">
            <p className="text-xl font-semibold sm:text-2xl" style={{ letterSpacing: "-0.02em" }}>
              Trusted IT Partner for Arizona Businesses
            </p>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#5e5868]">
              Managed security · Managed IT · {COMPANY.addressLocality}, {COMPANY.addressRegion}
            </p>
          </div>
          <div className="grid divide-y divide-black/10 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4" data-testid="hero-trust-strip">
            {trustItems.map(({ icon: Icon, code, title, body }, index) => (
              <div
                key={code}
                className={`flex flex-col gap-2 py-5 sm:px-5 ${index > 0 ? "sm:border-l sm:border-black/10" : "sm:pl-0"} ${index === 2 ? "sm:border-l-0 lg:border-l" : ""}`}
              >
                <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#A30E52]">
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {code}
                </p>
                <h2 className="font-heading text-[17px] font-semibold leading-snug text-[#17141f]">{title}</h2>
                <p className="text-sm leading-6 text-[#5e5868]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
