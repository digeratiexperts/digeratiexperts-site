// FROZEN — homepage version 1, snapshot of client/src/pages/sections/DigeratiMeetExpertsSection.tsx from git ref origin/main on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { ArrowRight, ShieldCheck, Cpu, Users, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useBooking } from "@/contexts/BookingContext";

const roles = [
  {
    icon: ShieldCheck,
    title: "Security Operations",
    detail: "Monitoring, detection, and response ownership when threats appear.",
  },
  {
    icon: Cpu,
    title: "Technical Operations",
    detail: "Day-to-day support, identity, endpoints, and environment stability.",
  },
  {
    icon: Users,
    title: "Client Success",
    detail: "QBRs, roadmaps, and a named relationship — not a rotating ticket queue.",
  },
];

export const DigeratiMeetExpertsSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();

  return (
    <section
      className="de-dark-well de-chapter-hairline de-field-grain relative overflow-hidden py-12 md:py-16 lg:py-20"
      data-testid="section-meet-experts"
    >
      <div
        className="de-founder-seam pointer-events-none absolute inset-x-0 top-0"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <motion.div
          className="mb-10 md:mb-12"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-[#D3126A]/10 border border-[#D3126A]/20">
            <span className="h-2 w-2 rounded-full bg-[#D3126A] animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D3126A]">
              Human Trust & Ownership
            </p>
          </div>
          <h2 className="mb-3 font-heading text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl md:text-5xl">
            The people behind <span className="de-hero-accent">your technology</span>
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-white/80 md:text-lg">
            When something happens, you should know who owns it — not wonder which anonymous
            queue picked up your ticket.{" "}
            <Link href="/about/team">
              <span className="font-semibold text-white underline decoration-[#D3126A]/70 underline-offset-4 hover:decoration-[#D3126A]">
                Meet the team
              </span>
            </Link>
          </p>
        </motion.div>

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Founder Photo Column with illuminated metallic framing */}
          <motion.div
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
            className="group relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1a1522] to-[#0e0c13] shadow-2xl lg:col-span-5 lg:self-start"
          >
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <MapPin className="h-3 w-3 text-[#D3126A]" />
              <span>Chandler, Arizona HQ</span>
            </div>
            <img
              src="/images/founder/joe-petro-studio-blazer-white.jpg"
              alt="Joseph Petro, Founder of Digerati Experts"
              className="block aspect-[3/4] w-full object-cover object-[center_20%] transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
              width={768}
              height={1024}
              data-testid="img-founder-joe"
            />
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 pt-12">
              <p className="text-xl font-bold text-white">Joseph Petro</p>
              <p className="text-xs font-medium uppercase tracking-wider text-[#D3126A]">
                Founder & Chief Technology Strategist
              </p>
            </div>
          </motion.div>

          <motion.div
            className="flex w-full min-w-0 flex-col justify-between gap-8 lg:col-span-7 lg:py-1"
          >
            <div className="w-full">
              <h3 className="font-heading text-3xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem]">
                Principal-Led Managed Security Operations
              </h3>
              <p className="mt-4 w-full text-base leading-relaxed text-white/80 md:text-lg">
                Based right here in Chandler, Arizona. Joe stays directly involved in risk assessments,
                infrastructure architecture, and key client milestones — so growing organizations get
                elite cybersecurity-first managed IT without becoming account number four thousand.
              </p>
            </div>

            {/* Tactile Role Cards */}
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              {roles.map((r, index) => {
                const IconComponent = r.icon;
                return (
                  <div
                    key={r.title}
                    className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-gradient-to-b from-[#18141f] to-[#0e0c13] p-5 shadow-lg transition-all duration-300 hover:border-[#D3126A]/50 hover:-translate-y-1"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#D3126A]/10 text-[#D3126A] transition-colors group-hover:bg-[#D3126A] group-hover:text-white">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <span className="font-mono text-xs font-bold tracking-widest text-white/40 group-hover:text-[#D3126A]">
                          0{index + 1}
                        </span>
                      </div>
                      <p className="text-base font-bold text-white group-hover:text-white">{r.title}</p>
                      <p className="mt-2 text-xs leading-relaxed text-white/70">{r.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <button
                type="button"
                onClick={() => openBooking("meet_experts")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D3126A] to-[#E61E76] px-8 text-base font-bold text-white shadow-lg shadow-[#D3126A]/25 transition-all hover:brightness-110 sm:w-auto"
                data-testid="button-talk-to-expert"
              >
                Talk to an Expert
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
