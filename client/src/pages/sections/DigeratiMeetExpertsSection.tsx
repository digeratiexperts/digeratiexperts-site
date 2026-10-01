import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { ArrowRight, ShieldCheck, Cpu, Users, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useBooking } from "@/contexts/BookingContext";
import { IconWell } from "@/components/visual/IconWell";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  cardDark,
  indexClass,
} from "@/components/home/HomeChapter";

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
    <HomeChapter tone="well" data-testid="section-meet-experts">
      <HomeContainer>
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <HomeChapterHeader
            tone="well"
            eyebrow="Human trust & ownership"
            title={
              <>
                The people behind <span className="de-hero-accent">your technology</span>
              </>
            }
            lede="When something happens, you should know who owns it — not wonder which anonymous queue picked up your ticket."
            link={{ label: "Meet the team", href: "/about/team" }}
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <motion.div
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
            className="relative overflow-hidden rounded-xl border border-de-hairline bg-de-raised lg:col-span-4"
          >
            <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <MapPin className="h-3 w-3 text-de-magenta-ink" aria-hidden="true" />
              <span>Chandler, Arizona HQ</span>
            </div>
            <img
              src="/images/founder/joe-petro-studio-blazer-white.jpg"
              alt="Joseph Petro, Founder of Digerati Experts"
              className="block aspect-[3/4] w-full object-cover object-[center_20%]"
              loading="lazy"
              decoding="async"
              width={768}
              height={1024}
              data-testid="img-founder-joe"
            />
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-14">
              <p className="text-lg font-semibold text-white">Joseph Petro</p>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-de-magenta-ink">
                Founder &amp; Chief Technology Strategist
              </p>
            </div>
          </motion.div>

          <div className="flex min-w-0 flex-col justify-between gap-8 lg:col-span-8">
            <div>
              <h3 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-white md:text-3xl">
                Principal-Led Managed Security Operations
              </h3>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
                Based right here in Chandler, Arizona. Joe stays directly involved in risk assessments,
                infrastructure architecture, and key client milestones — so growing organizations get
                elite cybersecurity-first managed IT without becoming account number four thousand.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {roles.map((r, index) => {
                const IconComponent = r.icon;
                return (
                  <div key={r.title} className={`${cardDark} flex flex-col p-5`}>
                    <div className="flex items-center justify-between">
                      <IconWell icon={IconComponent} size="sm" surface="dark" />
                      <span className={indexClass("well")}>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">{r.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/65">{r.detail}</p>
                  </div>
                );
              })}
            </div>

            <div>
              <button
                type="button"
                onClick={() => openBooking("meet_experts")}
                className={buttonPrimary("well")}
                data-testid="button-talk-to-expert"
              >
                Talk to an Expert
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
