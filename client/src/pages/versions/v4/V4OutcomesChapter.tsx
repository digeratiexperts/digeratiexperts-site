import { Chapter } from "./V4Primitives";

/**
 * 07 — What you get to do. The one paper chapter.
 *
 * A ledger, not a grid: each outcome on its own line, the verb set large, and
 * in the right-hand column the thing DE actually runs to deliver it — named
 * with the canon vocabulary (docs/DE-NAMING-CANON.md) and the published
 * package lines (client/src/data/pricing.ts, /ecosystem-pricing). That column
 * is what makes this specific to DE rather than to any provider: an outcome
 * is only worth printing if something real stands behind it.
 *
 * Capabilities and service names only. No vendor is named, no metric is
 * stated, and no tier is priced here.
 */

const LEDGER: Array<{ verb: string; meaning: string; runs: string[] }> = [
  {
    verb: "Protect",
    meaning: "The environment is defended, and you can see how.",
    runs: ["DE Security Foundation — eight blocks", "Detection & Response"],
  },
  {
    verb: "Work better",
    meaning: "Technology stops being the reason things take longer.",
    runs: ["Managed Workplace", "DE Desk"],
  },
  {
    verb: "Communicate",
    meaning: "Mail and voice that keep working when a provider does not.",
    runs: ["Threadline Inbox · Threadline Continuity", "Switchboard"],
  },
  {
    verb: "Automate",
    meaning: "The repeated manual steps between systems stop being someone's job.",
    runs: ["Automation, scoped in the assessment"],
  },
  {
    verb: "Comply",
    meaning: "Evidence you can hand to an auditor, an insurer or a client.",
    runs: ["Compliance Evidence & Risk Reporting", "Framework alignment — HIPAA, SOC 2, cyber insurance"],
  },
  {
    verb: "Recover",
    meaning: "A failure becomes an interruption rather than an event.",
    runs: ["Backup & Disaster Recovery (BCDR)", "Threadline Recovery"],
  },
  {
    verb: "Grow",
    meaning: "Adding a person, a site or a system is routine, not a project.",
    runs: ["ProActive IT → Office → Business → Enterprise", "Hybrid / Multi-Site"],
  },
];

export function V4OutcomesChapter() {
  return (
    <Chapter
      id="v4-ch7"
      n="07"
      eyebrow="What you get to do"
      heading="Seven things that become possible."
      lede="Not a feature list. These are what the work is for — and, on the right, the thing we actually run to make each one true."
      tone="paper"
      testId="v4-ledger"
    >
      <dl className="mt-12 border-t border-black/15">
        {LEDGER.map((row) => (
          <div
            key={row.verb}
            className="grid gap-x-8 gap-y-2 border-b border-black/10 py-6 sm:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3fr)] sm:items-baseline"
          >
            <dt className="font-['Space_Grotesk',sans-serif] text-[clamp(1.6rem,3.2vw,2.3rem)] font-bold leading-none tracking-[-0.02em] text-[#14121a]">
              {row.verb}
            </dt>
            <dd className="text-[15px] leading-relaxed text-black/60">{row.meaning}</dd>
            <dd className="flex flex-col gap-1 font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-black/45 sm:text-right">
              {row.runs.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-black/35">
        Right column: service names as DE publishes them · no supplier is named · no tier is priced here
      </p>
    </Chapter>
  );
}
