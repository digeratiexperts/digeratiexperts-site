import { Chapter } from "./V4Primitives";

/**
 * 04 — How this starts.
 *
 * The assessment is the trunk; the three ways in hang off it. Drawn as a
 * decision tree rather than three equal cards because that is the actual
 * shape of the model: nobody chooses a door before the environment is
 * understood, and the fourth exit — no engagement, findings kept — is real
 * and is drawn too, quieter.
 *
 * The three doors are the production site's own (DigeratiThreeDoorsChallenger
 * and the store), in their own words. No links here: the page's one action
 * is the assessment, and it is the trunk.
 */

const DOORS: Array<{ n: string; title: string; kind: string; detail: string }> = [
  {
    n: "A",
    title: "Handle our IT",
    kind: "Ongoing relationship",
    detail:
      "One accountable team for the technology. ProActive when DE runs it; Co-Managed when your own IT team keeps a defined scope.",
  },
  {
    n: "B",
    title: "Solve a business need",
    kind: "Defined outcome",
    detail:
      "Start with the problem — security, cloud, identity, communications, automation, recovery — and get a package built for it, with a start and an end.",
  },
  {
    n: "C",
    title: "Client marketplace",
    kind: "Existing clients",
    detail:
      "Add to the environment DE already knows, without starting from zero each time.",
  },
];

export function V4PathChapter() {
  return (
    <Chapter
      id="v4-ch4"
      n="04"
      eyebrow="How this starts"
      heading="Assessment first. Then a way in that matches how you operate."
      lede="The assessment is not one of the options. It is what makes choosing between them honest."
      testId="v4-path"
    >
      {/* The tree. A left rail on phones; a trunk with a crossbar on wide screens. */}
      <div className="mt-12">
        {/* Trunk node */}
        <div className="relative pl-7 sm:pl-0">
          <span
            aria-hidden="true"
            className="absolute left-0 top-3 h-3 w-3 rounded-full bg-[#D3126A] ring-4 ring-[#D3126A]/20 sm:hidden"
          />
          <div className="max-w-[640px] rounded-2xl border border-[#D3126A]/35 bg-[#D3126A]/[0.06] px-5 py-5 sm:px-7">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#F04C97]">
              Step zero · every path begins here
            </p>
            <h3 className="mt-2 font-['Space_Grotesk',sans-serif] text-[clamp(1.15rem,2.2vw,1.5rem)] font-bold leading-snug">
              Understand the environment
            </h3>
            <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-white/60">
              What you have, what it is exposed to, who currently owns each part, and what we
              would not take on.
            </p>
          </div>
        </div>

        {/* Connector: the rail drops from the trunk node's left edge, a
            crossbar runs as far as the third door's column, and one drop
            lands on each door's left edge — the same edge its text starts
            on. The first cut hung the drops at 0 / 50% / 100% of a centred
            bar, which put every one of them beside its door instead of
            above it. */}
        <div aria-hidden="true" className="hidden sm:block">
          <div className="h-10 w-px bg-white/20" />
          <div className="relative">
            <div
              className="absolute left-0 top-0 h-px bg-white/20"
              style={{ right: "calc((100% - 4rem) / 3)" }}
            />
            <div className="grid grid-cols-3 gap-x-8">
              <span className="h-6 w-px bg-white/20" />
              <span className="h-6 w-px bg-white/20" />
              <span className="h-6 w-px bg-white/20" />
            </div>
          </div>
        </div>

        <ol className="relative mt-4 grid gap-y-8 border-l border-white/20 pl-7 sm:mt-3 sm:grid-cols-3 sm:gap-x-8 sm:border-l-0 sm:pl-0">
          {DOORS.map((door) => (
            <li key={door.n} className="relative min-w-0">
              <span
                aria-hidden="true"
                className="absolute -left-[31px] top-2 h-2 w-2 rounded-full border border-white/40 bg-[#050312] sm:hidden"
              />
              <div className="border-t border-white/15 pt-4 sm:border-t-0 sm:pt-0">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/40">
                  <span className="mr-2 text-[#F7F5F2]">{door.n}</span>
                  {door.kind}
                </p>
                <h3 className="mt-2 font-['Space_Grotesk',sans-serif] text-[19px] font-bold leading-snug text-[#F7F5F2]">
                  {door.title}
                </h3>
                <p className="mt-2 max-w-[42ch] text-[13.5px] leading-relaxed text-white/55">
                  {door.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* The honest fourth exit, drawn on the same rail. */}
        <div className="relative mt-8 border-l border-dashed border-white/20 pl-7 sm:mt-10">
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-2 h-2 w-2 rounded-full border border-dashed border-white/40 bg-[#050312]"
          />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/40">
            <span className="mr-2 text-white/60">D</span>
            No engagement
          </p>
          <p className="mt-1.5 max-w-[48ch] text-[13.5px] leading-relaxed text-white/50">
            The assessment finds you are already in good hands, or that the fix is one you can
            make yourself. You keep the findings. This exit exists and we say so.
          </p>
        </div>
      </div>
    </Chapter>
  );
}
