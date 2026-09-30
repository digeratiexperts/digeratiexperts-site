import { Chapter, T } from "./V4Primitives";

/**
 * 07 — What you get to do. The one paper chapter.
 *
 * A ledger, not a grid: each outcome on its own line, the verb set large, and
 * in the right-hand column the thing DE actually runs to deliver it — the
 * published package lines (client/src/data/pricing.ts, /ecosystem-pricing)
 * and the canon network names (docs/DE-NAMING-CANON.md). That column is what
 * makes this specific to DE rather than to any provider: an outcome is only
 * worth printing if something real stands behind it.
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
    // Threadline and Switchboard are canon names with no published page or
    // package behind them yet (docs/DE-NAMING-CANON.md only). Until a page
    // exists, this column names the lines the pricing page actually lists.
    verb: "Communicate",
    meaning: "Mail, voice and meetings run as one system, not three vendors.",
    runs: ["Microsoft 365 / Google Workspace / Zoho workspace support", "UCaaS: Voice & Meetings"],
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
    runs: ["Backup & Disaster Recovery (BCDR)", "Endpoint Backup · User Cloud Storage Backup"],
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
            className="grid gap-x-8 gap-y-2 border-b border-black/10 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)_minmax(0,2fr)] sm:items-baseline"
          >
            <dt className={`${T.figure} text-de-bg`}>{row.verb}</dt>
            <dd className={`${T.body} text-black/60`}>{row.meaning}</dd>
            <dd className={`flex flex-col gap-1 ${T.label} leading-relaxed text-black/60 sm:text-right`}>
              {row.runs.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className={`mt-4 ${T.micro} text-black/60`}>
        Right column: service names as DE publishes them · no supplier is named · no tier is priced here
      </p>
    </Chapter>
  );
}
