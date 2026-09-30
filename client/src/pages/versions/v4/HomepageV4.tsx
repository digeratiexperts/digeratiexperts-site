import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { V4Environment } from "./V4Environment";
import { useChapterProgress, ease, ramp } from "./useChapterProgress";

/**
 * Digerati Experts homepage — Version 4. Chapters 01–03.
 *
 * Governed by docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md. Read it before
 * changing anything here; this file implements decisions recorded there
 * rather than making them.
 *
 * Three things this file is deliberately doing differently from the
 * production homepage, each answering a measured failure:
 *
 *   - ONE primary action. Production's hero carries 19 links; a visitor
 *     arriving frightened gets a menu instead of a direction.
 *   - ONE environment across three chapters, transforming. Production
 *     introduces a new unrelated illustration per section.
 *   - RHYTHM. Production is 20 near-identical blocks over 23.5 viewports, so
 *     nothing is bigger because it matters more. Chapter 03 is the peak and
 *     is visibly the longest; chapter 02 is deliberately quieter before it.
 *
 * Native scroll throughout. The environment is sticky across the three
 * chapters — one instance in the DOM, one on screen, never two and never
 * none — while the text scrolls past it normally. Nothing is scroll-jacked
 * and no range is dead: the text always moves and the environment always
 * changes.
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

/** The one action the page asks for, in both places it is asked. */
function PrimaryAction({ testId }: { testId: string }) {
  return (
    <Link
      href="/book"
      data-testid={testId}
      className="group inline-flex items-center gap-2.5 rounded-full bg-[#D3126A] px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#b80f5b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050312]"
    >
      Understand Your Environment
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ChapterLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
      <span className="text-[#F04C97]">{n}</span>
      <span className="h-px w-8 bg-white/15" />
      {children}
    </p>
  );
}

export default function HomepageV4() {
  const stageRef = useRef<HTMLDivElement>(null);
  const progress = useChapterProgress(stageRef);
  const reduced = useReducedMotion();

  // Text reveals ride the same progress as the environment, so copy and
  // picture can never disagree about where in the story the reader is.
  const p = reduced ? 1 : progress;
  const showDisconnect = reduced ? 1 : ease(ramp(p, 0.28, 0.42));
  const showAlign = reduced ? 1 : ease(ramp(p, 0.6, 0.74));

  return (
    <main className="min-w-0 bg-[#050312] text-[#F7F5F2]">
      <div ref={stageRef} className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        {/* ── The environment. One instance in the DOM at every width.
               It is an absolutely-positioned layer spanning the whole stage so
               that `sticky` has the full three chapters to travel through: a
               sticky child can only move within its own parent, and giving it
               a parent the height of one screen is what made it scroll away on
               phones in the first build. ── */}
        <div className="pointer-events-none absolute inset-0 z-0 lg:left-auto lg:right-0 lg:w-[46%]">
          <div className="sticky top-0 flex h-[42vh] items-center justify-center lg:h-screen">
            <div className="aspect-square w-full max-w-[min(82vw,420px)] opacity-55 lg:max-w-[460px] lg:opacity-100">
              <V4Environment progress={p} reduced={reduced} />
            </div>
          </div>
        </div>

        <div className="relative z-10 lg:w-[54%]">
          {/* ── 01 Hero. On phones the environment holds the opening frame and
                 the headline begins below it. ── */}
          <section
            aria-labelledby="v4-ch1"
            // The cookie banner publishes its height as --de-cookie-h. Reserving
            // against it keeps the one primary action above the fold on a first
            // visit, which is the only visit where the banner is up.
            className="flex min-h-[62vh] flex-col justify-center pt-[30vh] pb-[calc(2rem+var(--de-cookie-h,0px))] lg:min-h-screen lg:pt-12 lg:pb-[calc(3.5rem+var(--de-cookie-h,0px))]"
          >
            <ChapterLabel n="01">Digerati Experts</ChapterLabel>
            <h1
              id="v4-ch1"
              className="max-w-[16ch] font-['Space_Grotesk',sans-serif] text-[clamp(2.4rem,7vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.02em] text-balance"
            >
              You lead the business.
              <span className="block text-white/55">We lead the technology.</span>
            </h1>
            <p className="order-3 mt-6 max-w-[54ch] text-[clamp(1rem,1.5vw,1.15rem)] leading-relaxed text-white/60 lg:order-2 lg:mt-7">
              Cybersecurity-first managed technology for Arizona businesses that cannot
              afford downtime. You keep command of the business. We take ownership of the
              technology it runs on — and we start by understanding what you actually have.
            </p>
            <div className="order-2 mt-7 lg:order-3 lg:mt-9">
              <PrimaryAction testId="v4-cta-hero" />
            </div>
          </section>

          {/* ── 02 Disconnected environment. Deliberately the quieter chapter:
                 the one before the peak is quieter than the peak. ── */}
          <section
            aria-labelledby="v4-ch2"
            className="flex min-h-[70vh] flex-col justify-center py-16 lg:min-h-screen lg:py-24"
            style={{ opacity: reduced ? 1 : 0.25 + 0.75 * showDisconnect }}
          >
            <ChapterLabel n="02">The environment you already have</ChapterLabel>
            <h2
              id="v4-ch2"
              className="max-w-[20ch] font-['Space_Grotesk',sans-serif] text-[clamp(1.8rem,4.4vw,2.9rem)] font-bold leading-[1.08] tracking-[-0.015em] text-balance"
            >
              All of it exists. None of it was bought to work together.
            </h2>
            <p className="mt-6 max-w-[56ch] text-[15.5px] leading-relaxed text-white/60">
              People, identity, endpoints, email, cloud, network, applications, data and
              vendors. Every one of them was a reasonable decision on the day it was made.
              Each arrived on its own schedule, from its own supplier, with its own
              console and its own idea of who is responsible for it.
            </p>
            <p className="mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-white/45">
              Nothing here is broken. That is what makes it hard to see. The parts work;
              the estate does not — and the gaps between them are where the risk lives.
            </p>
          </section>

          {/* ── 03 Alignment / Why DE — the peak. Longest chapter by a visible
                 margin, and the only one that resolves the environment. ── */}
          <section
            aria-labelledby="v4-ch3"
            className="flex min-h-[110vh] flex-col justify-center py-16 lg:min-h-[150vh] lg:py-24"
            style={{ opacity: reduced ? 1 : 0.25 + 0.75 * showAlign }}
          >
            <ChapterLabel n="03">Why Digerati Experts</ChapterLabel>
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
            <p className="mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-white/45">
              What changes afterwards is not the parts. It is that they finally point the
              same way, and one accountable team owns the result.
            </p>

            <dl className="mt-10 grid max-w-[46ch] grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                ["Assess first", "Nothing is proposed before the estate is understood."],
                ["One owner", "A single accountable team, not a vendor list."],
                ["Said plainly", "Including what we will not take on."],
                ["Continuously", "Exposure changes. The review does too."],
              ].map(([term, detail]) => (
                <div key={term}>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
                    {term}
                  </dt>
                  <dd className="mt-1.5 text-[14px] leading-relaxed text-white/65">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      {/* Chapters 04–10 land here in the next build stages. */}
      <div
        className="mx-auto max-w-[1240px] border-t border-white/10 px-5 py-14 sm:px-8"
        data-testid="v4-stage-marker"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">
          Chapters 04–10 — in build
        </p>
      </div>
    </main>
  );
}
