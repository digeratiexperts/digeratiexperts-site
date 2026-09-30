import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, Clock, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "@/components/graphics";
import { PronunciationCard } from "@/components/PronunciationCard";
import { IconWell } from "@/components/visual/IconWell";
import { Eyebrow, containerClass } from "@/components/home/HomeChapter";
import { useBooking } from "@/contexts/BookingContext";
import { analytics } from "@/lib/analytics";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
// 50KB WebP (was a 2.0MB PNG): under the dark field the aggressive
// compression is invisible — review finding F1.
import heroCityLights from "@assets/de-hero-arizona-dusk-1600.webp";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Cybersecurity First",
    body: "We secure your business from the inside out.",
  },
  {
    icon: CheckCircle2,
    title: "Proactive IT",
    body: "Prevent issues before they impact your business.",
  },
  {
    icon: ClipboardCheck,
    title: "Compliance Ready",
    body: "Stay compliant with industry standards and regulations.",
  },
  {
    icon: MapPin,
    title: "Local & Responsive",
    body: "Arizona-based team, always here when you need us.",
  },
];

const reassurance = [
  { icon: Check, label: "No obligation" },
  { icon: Clock, label: "Response within one business day" },
];

const positioning = ["Assessment-led", "Client-owned access", "Fully managed or co-managed"];

// Per Joe (2026-08-30): no vendor names in the hero — DE does not surface
// stack vendors on the public homepage. Positioning line only.

// The hero's visual is DE's own Cyber Risk Assessment preview
// (DashboardMockup), not borrowed imagery (governance §18).

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
    <section
      ref={sectionRef}
      id="home"
      className="relative overflow-hidden bg-[#050312] text-white scroll-mt-[var(--de-nav-offset)]"
    >
      {/* Field: one violet light source top-right, magenta warmth low-right. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 40% 60% at 80% 20%, rgba(87,68,255,0.22), transparent 70%), radial-gradient(ellipse 30% 40% at 95% 85%, rgba(211,18,106,0.12), transparent 70%), linear-gradient(110deg, #050312 0%, #060617 52%, #090924 100%)",
        }}
      />
      {/* Phoenix city-lights plate (Joe 2026-08): reads clearly on the right,
          masked under the copy column so the headline stays high-contrast. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.img
          src={heroCityLights}
          alt=""
          width={1600}
          height={1067}
          loading="eager"
          decoding="async"
          {...({ fetchpriority: "low" } as Record<string, string>)}
          className="absolute h-[112%] w-full object-cover"
          style={{
            y: cityLightsY,
            top: "-6%",
            opacity: 0.42,
            objectPosition: "center 60%",
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.3) 38%, rgba(0,0,0,0.9) 62%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.3) 38%, rgba(0,0,0,0.9) 62%, black 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,3,18,0.6) 0%, rgba(5,3,18,0.08) 30%, rgba(5,3,18,0.08) 62%, rgba(5,3,18,0.85) 100%)",
          }}
        />
      </div>

      <div
        className={`${containerClass} relative grid items-start gap-10 pb-12 pt-[calc(var(--de-nav-offset)+2.25rem)] lg:grid-cols-[minmax(0,1fr)_minmax(400px,520px)] lg:gap-14 lg:pb-16 lg:pt-[calc(var(--de-nav-offset)+2.75rem)] xl:grid-cols-[minmax(0,1fr)_minmax(440px,560px)] xl:gap-16`}
      >
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: "easeOut" }}
          className="relative z-10 max-w-[680px]"
        >
          <Eyebrow tone="well" className="mb-5">
            Arizona MSP · Cybersecurity &amp; Managed IT
          </Eyebrow>
          <h1
            className="font-heading font-semibold text-[#fbfaf8]"
            style={{ fontSize: "clamp(2.4rem,4.4vw,4.25rem)", lineHeight: 1.04, letterSpacing: "-0.04em" }}
          >
            <span className="lg:block">Cybersecurity-First</span>{" "}
            <span className="lg:block">IT That Powers</span>{" "}
            <span className="block w-fit bg-gradient-to-r from-[#9a8bff] via-[#7b6cff] to-[#d3126a] bg-clip-text text-transparent">
              Your Business
            </span>
          </h1>
          <p className="mt-5 max-w-[560px] text-[17px] leading-7 text-white/72 sm:leading-8">
            Managed IT, security, and compliance &mdash; built for Arizona businesses that can&apos;t afford downtime.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
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

          <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75">
            {reassurance.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4 text-de-magenta-ink" aria-hidden="true" />
                {label}
              </li>
            ))}
            <li>
              <a
                href={PRIMARY_PHONE.telHref}
                className="inline-flex min-h-11 items-center gap-2 font-medium text-white/85 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50"
                data-testid="link-hero-phone"
              >
                <Phone className="h-4 w-4 text-de-magenta-ink" aria-hidden="true" />
                Call {PRIMARY_PHONE.display}
              </a>
            </li>
          </ul>

          <p className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-sm text-white/55">
            {positioning.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-2.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-white/30">
                    ·
                  </span>
                )}
                {item}
              </span>
            ))}
          </p>

          <div className="mt-7 max-w-[600px]">
            <PronunciationCard variant="compact" />
          </div>
        </motion.div>

        {/* DE Cyber Risk Assessment preview — top-aligned with the headline. */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.52, delay: prefersReducedMotion ? 0 : 0.08, ease: "easeOut" }}
          className="relative z-10 flex w-full justify-center lg:justify-end lg:pt-1"
          data-testid="hero-assessment-card"
        >
          <div className="relative w-full max-w-[560px]">
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

      {/* Trust strip — one paper row attached to the hero (archetype "Trust strip"). */}
      <div className="relative border-t border-black/10 bg-[#f7f5f2] text-[#1A1228]">
        <div className={`${containerClass} flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:gap-8`}>
          <h2 className="shrink-0 border-l-2 border-[#D3126A] pl-4 text-xs font-semibold uppercase leading-5 tracking-[0.18em] text-[#5e5868] lg:w-44">
            Trusted IT partner
            <span className="block text-[#1A1228]">for Arizona businesses</span>
          </h2>
          <ul className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-black/10">
            {trustItems.map(({ icon, title, body }) => (
              <li key={title} className="flex items-start gap-3 lg:px-5 lg:first:pl-0 lg:last:pr-0">
                <IconWell icon={icon} size="sm" surface="light" />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-5">{title}</h3>
                  <p className="mt-0.5 text-sm leading-5 text-[#5e5868]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
