import { Chapter, GridCell, HairGrid } from "./V4Primitives";

/**
 * Chapters 04–07 — the Precision Product Company layer.
 *
 * These four chapters explain a model, and a visible hard grid communicates a
 * model better than a row of decorated cards does. Hairlines divide; nothing
 * is boxed; the structure is the point.
 *
 * Naming is canon, from docs/DE-NAMING-CANON.md and design/PROOF_SYSTEM.md.
 * Nothing here states a metric, a customer result, an availability state or a
 * certification, so nothing here needs a claims-register row. The page stays
 * vendor-neutral: capabilities and outcomes, never a supplier list.
 */

/** 04 — Assessment sits ABOVE the pathways, never as a fourth peer product. */
export function ChapterAssessFirst() {
  return (
    <Chapter
      id="v4-ch4"
      n="04"
      eyebrow="How this starts"
      heading="Assessment first. Then a way in that matches how you operate."
      lede="The assessment is not one of the options. It is what makes choosing between them honest — including the outcome where the answer is that you do not need us for this."
    >
      {/* The assessment band. Full width, above the doors, visibly not a peer. */}
      <div className="mt-10 rounded-2xl border border-[#D3126A]/30 bg-[#D3126A]/[0.06] px-5 py-6 sm:px-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#F04C97]">
          Step zero · before any pathway
        </p>
        <h3 className="mt-2.5 font-['Space_Grotesk',sans-serif] text-[clamp(1.15rem,2.2vw,1.5rem)] font-bold leading-snug">
          Understand the environment
        </h3>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-white/60">
          What you have, what it is exposed to, who currently owns each part, and
          what we would not take on. You keep the findings whichever way you go.
        </p>
      </div>

      <p className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/30">
        Then one of three ways in
      </p>

      <HairGrid cols="md:grid-cols-3">
        <GridCell
          label="Pathway 01"
          title="Handle our IT"
          detail="You want one accountable team for the technology estate. ProActive for fully managed; Co-Managed where your own IT team or another provider keeps a defined scope."
        />
        <GridCell
          label="Pathway 02"
          title="Solve a business need"
          detail="Something specific is in the way — a migration, a compliance requirement, a site, a system. Standalone work with a defined start and end."
        />
        <GridCell
          label="Pathway 03"
          title="Client marketplace"
          detail="Already working with us. Add capability to the environment we already run, without a new procurement exercise each time."
        />
      </HairGrid>
    </Chapter>
  );
}

/**
 * 05 — The eight-block architecture. Seven blocks, and Risk & Exposure as the
 * continuous layer beneath and across them — NOT a ninth identical card, which
 * is the mistake the site has already made once by shipping "six domains".
 */
const BLOCKS: Array<[string, string]> = [
  ["Identity & Access", "Who can reach what, proven rather than assumed."],
  ["Endpoint", "The devices work happens on, managed and recoverable."],
  ["Email & Collaboration", "Where most attacks still arrive and spread."],
  ["Browser & Web", "The surface people actually spend the day inside."],
  ["Network", "Cloud Edge / SASE, site networking, or both."],
  ["Detection & Response", "Something is wrong; someone owns what happens next."],
  ["Human Risk", "The decisions people make under pressure."],
];

export function ChapterSecurityFoundation() {
  return (
    <Chapter
      id="v4-ch5"
      n="05"
      eyebrow="The foundation"
      heading="Eight blocks. Seven you build, one that never stops."
      lede="This is the security architecture everything else rests on. Seven blocks cover the estate. The eighth is not another block — it runs underneath all of them, continuously, because exposure does not hold still between reviews."
    >
      <HairGrid cols="sm:grid-cols-2 lg:grid-cols-4">
        {BLOCKS.map(([title, detail], i) => (
          <GridCell key={title} label={`0${i + 1}`} title={title} detail={detail} />
        ))}
      </HairGrid>

      {/* Risk & Exposure. Drawn as a band running the full width beneath the
          seven, with a magenta rule along its top edge, so "continuous, beneath
          and across" is carried by the layout and not only asserted in the
          copy. It is deliberately NOT shaped like the seven cells above it —
          the site has already shipped this wrong once as a ninth identical
          card and as "six domains". */}
      <div className="mt-10">
        <div className="h-px w-full bg-gradient-to-r from-[#D3126A] via-[#D3126A]/45 to-transparent" />
        <div className="flex flex-col gap-4 bg-white/[0.035] px-5 py-6 sm:flex-row sm:items-start sm:gap-8 sm:px-7">
          <div className="shrink-0 sm:w-[210px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F04C97]">
              08 · runs continuously
            </p>
            <h3 className="mt-1.5 font-['Space_Grotesk',sans-serif] text-[17px] font-bold text-[#F7F5F2]">
              Risk &amp; Exposure
            </h3>
          </div>
          <p className="min-w-0 max-w-[62ch] text-[13.5px] leading-relaxed text-white/55">
            Beneath and across all seven, not beside them. What is exposed, what
            changed, and what it means for this environment specifically —
            reviewed on a cadence rather than discovered during an incident.
          </p>
        </div>
      </div>
    </Chapter>
  );
}

/** 06 — Security becomes the foundation for the wider managed environment. */
const OPERATING_SYSTEM: Array<[string, string]> = [
  ["Workplace", "Devices, identity and the daily working environment."],
  ["Communications", "Mail, voice and continuity across providers."],
  ["Network", "Cloud Edge / SASE, Managed Physical Site Network, Hybrid / Multi-Site."],
  ["Cloud & data", "Where the business's information lives and how it is protected."],
  ["Business systems", "The applications the work actually runs on."],
  ["Automation", "Removing the repeated manual steps between systems."],
  ["Support", "A route to a person who owns the outcome."],
  ["Governance", "Standards, documentation, and what was agreed."],
  ["Continuity", "What happens when something fails, decided in advance."],
];

export function ChapterOperatingSystem() {
  return (
    <Chapter
      id="v4-ch6"
      n="06"
      eyebrow="What sits on it"
      heading="Secured first, then run as one operating environment."
      lede="Once the foundation holds, the rest of the technology estate can be managed as a single system rather than nine separate relationships. These are capabilities, not products — which supplier sits behind each one is a decision for your environment, not a badge for our homepage."
    >
      <HairGrid cols="sm:grid-cols-2 lg:grid-cols-3">
        {OPERATING_SYSTEM.map(([title, detail]) => (
          <GridCell key={title} title={title} detail={detail} />
        ))}
      </HairGrid>
    </Chapter>
  );
}

/**
 * 07 — Outcomes. Deliberately on paper: one contrast chapter, placed where the
 * page turns from what DE runs to what the customer gets.
 */
const OUTCOMES: Array<[string, string]> = [
  ["Protect", "The estate is defended, and you can see how."],
  ["Work better", "The technology stops being the reason things take longer."],
  ["Communicate", "Mail and voice that survive a provider having a bad day."],
  ["Automate", "The repeated manual steps between systems stop being someone's job."],
  ["Comply", "Evidence you can hand to an auditor, an insurer or a client."],
  ["Recover", "A failure becomes an interruption rather than an event."],
  ["Grow", "Adding a person, a site or a system is routine, not a project."],
];

export function ChapterOutcomes() {
  return (
    <Chapter
      id="v4-ch7"
      n="07"
      eyebrow="What you get to do"
      heading="Seven things that become possible."
      lede="Not a feature list. These are the outcomes the work is for — the reason any of the architecture above is worth paying for."
      tone="paper"
    >
      <HairGrid cols="sm:grid-cols-2 lg:grid-cols-4" paper>
        {OUTCOMES.map(([title, detail]) => (
          <GridCell key={title} title={title} detail={detail} paper />
        ))}
      </HairGrid>
    </Chapter>
  );
}
