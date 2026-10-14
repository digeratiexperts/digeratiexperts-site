import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Heart,
  House,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import lawScalesImg from "@assets/Rectangle-152058-1_1767027918697.webp";
import healthcareImg from "@assets/Rectangle-152058-2_1767027918698.webp";
import realEstateImg from "@assets/Rectangle-152058-3_1767027918698.webp";
import animalHospitalImg from "@assets/Rectangle-152058-4_1767027918698.webp";
// Generated 2026-10-06 (kie.ai job home-cpa-card-2026-10-06, Joe: "generate the CPA image"); replaces a Turkish law-book photo.
import cpaCalculatorImg from "@/assets/industries/cpa-calculator-2026-10-06.webp";
import "./10-industries.css";
import { StoryBackdrop } from "../story/StoryBackdrop";

/**
 * 10 · Industries we serve (mock: sections/10-industries.html).
 * Joe, 2026-10-01: keep the photo cards ("a lot of subtle work can be lost so be careful").
 * Kept from live DigeratiIndustriesSection: the five photographs and their mapping, grayscale
 * at rest, colour on hover AND keyboard focus (300ms), hairline → magenta border, IconWell,
 * always-visible description, "View …" link with the arrow nudge, and the phone/tablet
 * snap rail whose scroll buttons and edge fades appear only when there is somewhere to go.
 * All hover/focus visuals are CSS (10-industries.css); React only drives the rail state.
 */

type Industry = {
  icon: LucideIcon;
  name: string;
  testId: string;
  slug: string;
  description: string;
  image: string;
};

const industries: Industry[] = [
  {
    icon: Briefcase,
    name: "Law Firms",
    testId: "industry-law",
    slug: "law-firms",
    description: "Protect client privilege and meet ABA compliance requirements",
    image: lawScalesImg,
  },
  {
    icon: Calculator,
    name: "CPA Firms",
    testId: "industry-cpa",
    slug: "accounting-finance",
    description: "Secure tax data and ensure IRS/FTC compliance",
    image: cpaCalculatorImg,
  },
  {
    icon: Stethoscope,
    name: "Medical Practices",
    testId: "industry-medical",
    slug: "healthcare",
    description: "HIPAA compliance and patient data protection",
    image: healthcareImg,
  },
  {
    icon: House,
    name: "Real Estate Firms",
    testId: "industry-realestate",
    slug: "real-estate",
    description: "Wire fraud prevention and transaction security",
    image: realEstateImg,
  },
  {
    icon: Heart,
    name: "Animal Hospitals",
    testId: "industry-animal",
    slug: "animal-hospitals",
    description: "Veterinary practice and client data protection",
    image: animalHospitalImg,
  },
];

const icon = { strokeWidth: 1.8, "aria-hidden": true } as const;

export function V9Industries(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  const railRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const sync = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanLeft(rail.scrollLeft > 0);
    setCanRight(rail.scrollLeft < rail.scrollWidth - rail.clientWidth - 10);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    sync();
    rail.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      rail.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const scroll = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * 300, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  const shown = (on: boolean) => ({ opacity: on ? 1 : 0, pointerEvents: on ? ("auto" as const) : ("none" as const) });

  return (
    <section className="f-surface v9-section v9-grain" aria-labelledby="industries-heading">
      <StoryBackdrop chapter="sectors" />
      <div className="v9-canvas">
        <motion.div className="ind-head" {...reveal}>
          <div className="v9-head">
            <p className="v9-eyebrow">Specialized Solutions</p>
            <h2 className="v9-h2" id="industries-heading">
              Industries We Serve
              <span className="v9-colon" aria-hidden="true">
                :
              </span>
            </h2>
            <p className="v9-lede">Specialized cybersecurity solutions for Arizona's essential sectors</p>
          </div>
          <a className="v9-btn v9-btn--primary" href="/book" data-testid="button-industries-cta">
            Get Industry-Specific Protection <ArrowRight size={18} {...icon} />
          </a>
        </motion.div>

        <motion.div className="ind-wrap" {...reveal}>
          <button
            className="ind-scroll ind-scroll--l"
            type="button"
            aria-label="Scroll left"
            onClick={() => scroll(-1)}
            style={shown(canLeft)}
            tabIndex={canLeft ? undefined : -1}
            data-testid="industries-scroll-left"
          >
            <ChevronLeft size={20} {...icon} />
          </button>
          <button
            className="ind-scroll ind-scroll--r"
            type="button"
            aria-label="Scroll right"
            onClick={() => scroll(1)}
            style={shown(canRight)}
            tabIndex={canRight ? undefined : -1}
            data-testid="industries-scroll-right"
          >
            <ChevronRight size={20} {...icon} />
          </button>
          <span className="ind-fade ind-fade--l" aria-hidden="true" style={{ opacity: canLeft ? 1 : 0 }} />
          <span className="ind-fade ind-fade--r" aria-hidden="true" style={{ opacity: canRight ? 1 : 0 }} />

          <ul className="ind-rail" aria-label="Industries" ref={railRef}>
            {industries.map((ind) => {
              const Icon = ind.icon;
              return (
                <li className="ind-card" key={ind.testId}>
                  <a className="ind-card__link" href={`/industries/${ind.slug}`} data-testid={ind.testId}>
                    <span
                      className="ind-card__img"
                      style={{ backgroundImage: `url(${ind.image})` }}
                      aria-hidden="true"
                    />
                    <span className="ind-card__shade" aria-hidden="true" />
                    <span className="ind-card__body">
                      <span className="v9-iconwell v9-iconwell--sm">
                        <Icon size={20} {...icon} />
                      </span>
                      <span className="ind-card__name">{ind.name}</span>
                      <span className="ind-card__desc">{ind.description}</span>
                      <span className="ind-card__more">
                        View {ind.name}{" "}
                        <span className="ind-card__arrow">
                          <ArrowRight size={16} {...icon} />
                        </span>
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </motion.div>

        <a className="v9-btn v9-btn--primary ind-ask" href="/book">
          Get Industry-Specific Protection <ArrowRight size={18} {...icon} />
        </a>
      </div>
    </section>
  );
}
