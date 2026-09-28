import { ChapterLabel, PrimaryAction } from "./V4Primitives";
import { EnvironmentMap } from "./V4EnvironmentMap";
import { environmentStarted, useEnvironmentDraft } from "./useEnvironmentDraft";

/**
 * 10 — The final frame.
 *
 * Return to the environment the visitor drew in chapter 02 — the same
 * people, devices and sites — now with one edge around all of it, which is
 * the offer: one accountable team for the whole thing. If nothing was typed,
 * the close still resolves: the promise, and the one action.
 *
 * The close holds. It is a full screen with the action in it, not a fade
 * into the footer.
 */
export function V4CloseChapter({ reduced }: { reduced: boolean }) {
  const env = useEnvironmentDraft();
  const started = environmentStarted(env);

  return (
    <section
      aria-labelledby="v4-ch10"
      className="border-t border-white/10 bg-[#050312] text-[#F7F5F2]"
      data-testid="v4-close"
      data-personal={started ? "true" : "false"}
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col justify-center px-5 py-24 sm:px-8 lg:min-h-[86vh] lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
          <div>
            <ChapterLabel n="10">Where this ends up</ChapterLabel>
            <h2
              id="v4-ch10"
              className="max-w-[16ch] font-['Space_Grotesk',sans-serif] text-[clamp(2.2rem,6vw,4rem)] font-bold leading-[1.02] tracking-[-0.02em] text-balance"
            >
              You lead the business.
              <span className="block text-white/55">We lead the technology.</span>
            </h2>
            <p className="mt-6 max-w-[50ch] text-[clamp(1rem,1.4vw,1.1rem)] leading-relaxed text-white/60">
              {started
                ? "The same environment you drew above — with one team accountable for all of it, and a guarantee you can read before you sign anything."
                : "Start by understanding what you actually have. The findings are yours whichever way you go."}
            </p>
            <div className="mt-9">
              <PrimaryAction testId="v4-cta-close" />
            </div>
          </div>

          <div className="lg:pt-6">
            {started ? (
              <EnvironmentMap environment={env} reduced={reduced} framed />
            ) : (
              <div className="border-l border-white/20 pl-6 sm:pl-8">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/55">
                  Thirty days, in writing
                </p>
                {/* Verbatim from client/src/pages/about/Guarantee.tsx — the
                    wording DE signs, not a tidier paraphrase of it. */}
                <blockquote className="mt-3 max-w-[44ch] font-['Space_Grotesk',sans-serif] text-[clamp(1.1rem,1.8vw,1.45rem)] font-bold leading-snug text-[#F7F5F2] text-balance">
                  “If you are not over-the-top thrilled with our support, customer service, or
                  problem-resolution by the end of the first 30 days, you can cancel your
                  agreement and we'll refund 100% of your services fees, no questions asked.”
                </blockquote>
                <p className="mt-3 text-[13.5px] text-white/50">
                  From the published guarantee, quoted on the first screen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
