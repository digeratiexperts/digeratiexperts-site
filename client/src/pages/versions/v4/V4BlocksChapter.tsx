import { Chapter } from "./V4Primitives";

/**
 * 05 — The foundation, drawn as what it is.
 *
 * Seven blocks laid as a wall — adjacent, hairline mortar, nothing boxed —
 * and Risk & Exposure as the slab the wall stands on, running the full
 * width beneath all seven. The layout carries "continuous, beneath and
 * across" so the copy does not have to insist on it. The site has already
 * shipped this wrong twice: as a ninth identical card, and as "six domains".
 *
 * Names are canon. Nothing here states a metric, a customer result, an
 * availability state or a certification.
 */

const WALL: Array<[string, string]> = [
  ["Identity & Access", "Who can reach what, proven rather than assumed."],
  ["Endpoint", "The devices work happens on, managed and recoverable."],
  ["Email & Collaboration", "Where most attacks still arrive and spread."],
  ["Browser & Web", "The surface people actually spend the day inside."],
  ["Network", "Cloud Edge / SASE, site networking, or both."],
  ["Detection & Response", "Something is wrong; someone owns what happens next."],
  ["Human Risk", "The decisions people make under pressure."],
];

export function V4BlocksChapter() {
  return (
    <Chapter
      id="v4-ch5"
      n="05"
      eyebrow="The foundation"
      heading="Eight blocks. Seven you build, one that never stops."
      lede="The security architecture everything else rests on. The questions in the chapter above become these blocks. Seven cover the environment. The eighth is not another block — it runs underneath all of them, because exposure does not hold still between reviews."
      testId="v4-blocks"
    >
      <figure className="mt-12" data-testid="v4-wall">
        {/* The wall: hairline mortar between adjacent blocks. On phones it
            stacks into a column, which still stands on the slab below. */}
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-t-2xl border border-white/15 bg-white/15 sm:grid-cols-7">
          {WALL.map(([name, line], i) => (
            <li
              key={name}
              // Names hang from the same line in every block; the varying
              // description lengths fall away at the bottom, which is where
              // unevenness reads as natural rather than as a mistake.
              className="flex min-w-0 flex-col bg-[#0a0a0a] px-4 py-4 sm:min-h-[168px] sm:px-3.5 lg:px-4"
            >
              <p className="font-mono text-[10px] tabular-nums text-white/50">0{i + 1}</p>
              <div className="mt-3 sm:mt-6">
                <h3 className="font-['Space_Grotesk',sans-serif] text-[14.5px] font-bold leading-tight text-[#F7F5F2] sm:text-[13.5px] lg:text-[14.5px]">
                  {name}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/50 sm:hidden lg:block">
                  {line}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* The slab. Magenta rule along the top edge, full width, deliberately
            not shaped like the blocks above it. */}
        <div className="rounded-b-2xl border border-t-0 border-white/15 bg-[#D3126A]/[0.07]">
          <div className="h-px w-full bg-gradient-to-r from-[#D3126A] via-[#D3126A]/60 to-[#D3126A]/15" />
          <div className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-start sm:gap-8 sm:px-6">
            <div className="shrink-0 sm:w-[220px]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F04C97]">
                08 · runs continuously
              </p>
              <h3 className="mt-1.5 font-['Space_Grotesk',sans-serif] text-[17px] font-bold text-[#F7F5F2]">
                Risk &amp; Exposure
              </h3>
            </div>
            <p className="min-w-0 max-w-[62ch] text-[13.5px] leading-relaxed text-white/60">
              Beneath and across all seven, not beside them. What is exposed, what changed,
              and what it means for this environment specifically — reviewed on a cadence
              rather than discovered during an incident.
            </p>
          </div>
        </div>
        <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
          The DE security model · eight blocks · code-drawn, states no metric
        </figcaption>
      </figure>
    </Chapter>
  );
}
