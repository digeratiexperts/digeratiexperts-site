import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { PrimaryAction, ChapterLabel } from "./V4Primitives";
import { V4Sizer } from "./V4Sizer";
import { V4ScopeChapter } from "./V4ScopeChapter";
import { V4PathChapter } from "./V4PathChapter";
import { V4BlocksChapter } from "./V4BlocksChapter";
import { V4DeskChapter } from "./V4DeskChapter";
import { V4OutcomesChapter } from "./V4OutcomesChapter";
import { V4ProofChapter } from "./V4ProofChapter";
import { V4FitChapter } from "./V4FitChapter";
import { V4CloseChapter } from "./V4CloseChapter";

/**
 * Digerati Experts homepage — Version 4.
 *
 * Governed by docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md.
 *
 * Third cut. The first led with an abstract constellation and read as
 * generic; the second put real things on the first two screens and left
 * chapters 04–07 as four identical grids. This cut gives every chapter its
 * own form, and every chapter leads with something real:
 *
 *   01  the promise, one action, and the published guarantee beside it
 *   02  a working tool: three numbers in, the visitor's own environment out
 *   03  the assessment's scope, sized to those numbers — the peak
 *   04  the assessment as the trunk, three ways in, and the honest fourth exit
 *   05  the eight blocks drawn as a wall standing on a continuous slab
 *   06  the real DE Desk capture beside the nine capabilities
 *   07  a paper ledger: each outcome, and the named thing that delivers it
 *   08  the founder, and DE's own published words quoted verbatim
 *   09  who this is for, then the three operating models on a rail
 *   10  return to the visitor's environment, one edge around it, one action
 *
 * Rendered inside the same site chrome production uses (MegaMenu above, the
 * site footer below), so the preview is judged as the page would actually
 * ship: the header carries the phone number and the assessment button, and
 * the hero has to clear it and the cookie banner at every width.
 *
 * Native scroll throughout. No sticky stage, no scroll-driven state. The
 * only state on the page is the environment draft the store already keeps,
 * and the only motion is on the visitor's own data.
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
      <figcaption className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/55">
        From the published guarantee
      </figcaption>
      <blockquote className="mt-3 font-['Space_Grotesk',sans-serif] text-[clamp(1.2rem,2vw,1.55rem)] font-bold leading-snug text-[#F7F5F2] text-balance">
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
    <div className="min-h-screen bg-[#050312] text-[#F7F5F2]">
      <MegaMenu />

      <main className="min-w-0">
        {/* ── 01 Hero. Orients, asks for one thing, and puts a real commitment
               beside the promise. de-nav-clear clears the fixed MegaMenu; the
               cookie banner publishes its height as --de-cookie-h and the
               action is kept clear of it. ── */}
        <section aria-labelledby="v4-ch1" className="de-nav-clear">
          <div className="mx-auto w-full max-w-[1240px] px-5 pt-10 pb-[calc(3rem+var(--de-cookie-h,0px))] sm:px-8 lg:pt-3 lg:pb-[calc(3rem+var(--de-cookie-h,0px))]">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
              <div>
                <ChapterLabel n="01">Digerati Experts · Arizona</ChapterLabel>
                {/* Two lines on desktop, one sentence each: with the real header
                    (167px) and the cookie banner (~215px) on a 1440×844 screen,
                    a four-line headline pushed the action under the banner. The
                    size is tied to the viewport so each sentence keeps to its
                    line from 1024px up; below that the grid is one column and
                    the headline wraps normally. */}
                <h1
                  id="v4-ch1"
                  className="max-w-[16ch] font-['Space_Grotesk',sans-serif] text-[clamp(2.4rem,6vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.02em] text-balance lg:max-w-none lg:whitespace-nowrap lg:text-[clamp(2.4rem,3.6vw,3.3rem)]"
                >
                  You lead the business.
                  <span className="block text-white/55">We lead the technology.</span>
                </h1>
                <p className="mt-5 max-w-[60ch] text-[clamp(1rem,1.4vw,1.1rem)] leading-relaxed text-white/60">
                  Cybersecurity-first managed technology for Arizona businesses that cannot
                  afford downtime. You keep command of the business; we take ownership of
                  the technology it runs on, starting with what you actually have.
                </p>
                <div className="mt-7">
                  <PrimaryAction testId="v4-cta-hero" />
                </div>
              </div>

              {/* Real artifact, first screen. Where competitors put a slogan or a
                  stock photo, DE puts the thing it actually signs its name to. */}
              <div className="lg:pt-4">
                <GuaranteeFigure />
              </div>
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
                <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-white/60">
                  Most providers put a phone number here. We would rather you see the
                  shape of your own environment first — and the rest of this page will
                  use it.
                </p>
              </div>
              <V4Sizer reduced={reduced} />
            </div>
          </div>
        </section>

        <V4ScopeChapter />
        <V4PathChapter />
        <V4BlocksChapter />
        <V4DeskChapter />
        <V4OutcomesChapter />
        <V4ProofChapter />
        <V4FitChapter />
        <V4CloseChapter reduced={reduced} />
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
}
