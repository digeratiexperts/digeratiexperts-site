import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PrimaryAction, ChapterLabel } from "./V4Primitives";
import { V4Sizer } from "./V4Sizer";
import {
  ChapterAssessFirst,
  ChapterSecurityFoundation,
  ChapterOperatingSystem,
  ChapterOutcomes,
} from "./V4ProductChapters";

/**
 * Digerati Experts homepage — Version 4.
 *
 * Governed by docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md.
 *
 * Second cut of the opening. The first cut led with an abstract constellation
 * — nine unnamed dots resolving into a ring. It measured well and read as
 * generic: nothing on screen belonged to the visitor, and it was the same
 * "abstract lines" idiom already rejected on Experience v1. This cut leads
 * with real things, in evidence-ladder order:
 *
 *   01  the promise, who it is for, one action — and beside it the one thing
 *       DE publishes that its competitors do not: the guarantee, quoted from
 *       the page that publishes it. A real artifact where a slogan would go.
 *   02  a working tool: three numbers in, the visitor's OWN environment out,
 *       written to the same draft the store reads so nothing is asked twice
 *   03  assess-first, stated plainly
 *
 * The sizer is deliberately NOT in the hero. The audience rule outranks the
 * product: someone arriving from a breach scare or an insurance form wants
 * to know DE is real before being asked to type anything. So screen one
 * orients — and proves — and screen two is where the page starts working
 * for them.
 *
 * Native scroll throughout. No sticky stage, no scroll-driven state.
 */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return reduced;
}

/** The guarantee as DE publishes it at /about/guarantee — not a paraphrase. */
function GuaranteeFigure() {
  return (
    <figure className="border-l border-white/20 pl-6 sm:pl-8">
      <figcaption className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/40">
        From the published guarantee
      </figcaption>
      <blockquote className="mt-3 font-['Space_Grotesk',sans-serif] text-[clamp(1.25rem,2.2vw,1.7rem)] font-bold leading-snug text-[#F7F5F2] text-balance">
        “Digerati Experts 30-day, no-questions-asked money-back guarantee on managed IT
        and cybersecurity services.”
      </blockquote>
      <p className="mt-3 text-[14.5px] leading-relaxed text-white/60">
        Release from contracts without penalties. No questions asked, no fine print.
      </p>
      <Link
        href="/about/guarantee"
        data-testid="v4-link-guarantee"
        className="group mt-4 inline-flex items-center gap-2 text-[13.5px] font-semibold text-[#F7F5F2] underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050312]"
      >
        Read the guarantee
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </figure>
  );
}

export default function HomepageV4() {
  const reduced = useReducedMotion();

  return (
    <main className="min-w-0 bg-[#050312] text-[#F7F5F2]">
      {/* ── 01 Hero. Orients, asks for one thing, and puts a real commitment
             beside the promise. The cookie banner publishes its height as
             --de-cookie-h and the action is kept clear of it. ── */}
      <section
        aria-labelledby="v4-ch1"
        className="mx-auto w-full max-w-[1240px] px-5 pt-20 pb-[calc(3rem+var(--de-cookie-h,0px))] sm:px-8 lg:pt-14 lg:pb-[calc(4rem+var(--de-cookie-h,0px))]"
      >
        <div className="grid gap-12 lg:min-h-[66vh] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
          <div>
            <ChapterLabel n="01">Digerati Experts · Arizona</ChapterLabel>
            <h1
              id="v4-ch1"
              className="max-w-[16ch] font-['Space_Grotesk',sans-serif] text-[clamp(2.4rem,7vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.02em] text-balance"
            >
              You lead the business.
              <span className="block text-white/55">We lead the technology.</span>
            </h1>
            <p className="mt-7 max-w-[54ch] text-[clamp(1rem,1.5vw,1.15rem)] leading-relaxed text-white/60">
              Cybersecurity-first managed technology for Arizona businesses that cannot
              afford downtime. You keep command of the business. We take ownership of
              the technology it runs on — and we start by understanding what you
              actually have.
            </p>
            <div className="mt-9">
              <PrimaryAction testId="v4-cta-hero" />
            </div>
          </div>

          {/* Real artifact, first screen. Where competitors put a slogan or a
              stock photo, DE puts the thing it actually signs its name to. */}
          <div className="lg:pt-10">
            <GuaranteeFigure />
          </div>
        </div>
      </section>

      {/* ── 02 Start with what you have. The page starts working here. ── */}
      <section aria-labelledby="v4-ch2" className="border-t border-white/10">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
          <ChapterLabel n="02">Start with what you have</ChapterLabel>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <h2
                id="v4-ch2"
                className="max-w-[18ch] font-['Space_Grotesk',sans-serif] text-[clamp(1.8rem,4.4vw,2.9rem)] font-bold leading-[1.08] tracking-[-0.015em] text-balance"
              >
                Three numbers. No contract, no vendor catalog.
              </h2>
              <p className="mt-5 max-w-[46ch] text-[15.5px] leading-relaxed text-white/60">
                Tell the page how many people, computers and sites you run and it draws
                your environment. It is the same profile the store sizes every solution
                from, so nothing is asked twice.
              </p>
              <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-white/45">
                Most providers put a phone number here. We would rather you see the
                shape of your own environment first.
              </p>
            </div>
            <V4Sizer reduced={reduced} />
          </div>
        </div>
      </section>

      {/* ── 03 Before anything is proposed. ── */}
      <section aria-labelledby="v4-ch3" className="border-t border-white/10">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
          <ChapterLabel n="03">Before anything is proposed</ChapterLabel>
          <h2
            id="v4-ch3"
            className="max-w-[22ch] font-['Space_Grotesk',sans-serif] text-[clamp(1.9rem,4.8vw,3.15rem)] font-bold leading-[1.06] tracking-[-0.015em] text-balance"
          >
            We do not promise outcomes before we understand the environment.
          </h2>
          <p className="mt-6 max-w-[56ch] text-[15.5px] leading-relaxed text-white/60">
            Any provider can list the same services. The difference is whether they
            looked first. We assess what you have, name what is exposed, and tell you
            what we would not do — before anyone signs anything.
          </p>
        </div>
      </section>

      {/* Chapters 04–07 stand as first built and are queued for the same
          treatment: each a different form, each leading with a real thing. */}
      <ChapterAssessFirst />
      <ChapterSecurityFoundation />
      <ChapterOperatingSystem />
      <ChapterOutcomes />

      <div
        className="mx-auto max-w-[1240px] border-t border-white/10 px-5 py-14 sm:px-8"
        data-testid="v4-stage-marker"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">
          Chapters 08–10 — in build
        </p>
      </div>
    </main>
  );
}
