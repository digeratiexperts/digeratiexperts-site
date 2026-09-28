import { Chapter } from "./V4Primitives";

/**
 * 06 — What sits on the foundation.
 *
 * The real thing is DE Desk: the support surface on this site, captured from
 * the running product with the QA placeholder details removed
 * (client/public/images/evidence/de-desk-shell.webp). It is the top rung of
 * the evidence ladder — a real interface — where the first cut had nine
 * identical cells. The nine capabilities run beside it as a list, because
 * that is what they are: a list of what one operating environment covers,
 * not nine products.
 *
 * Classification is visible, per design/VISUAL_EVIDENCE.md: the badge copy is
 * the plain-language line EvidenceFrame uses, and the code is on
 * data-classification. Vendor-neutral throughout.
 */

const CAPABILITIES: Array<[string, string]> = [
  ["Workplace", "devices, identity and the daily working environment"],
  ["Communications", "mail and voice, and their continuity across providers"],
  ["Network", "Cloud Edge / SASE · Managed Physical Site Network · Hybrid / Multi-Site"],
  ["Cloud & data", "where the business's information lives and how it is protected"],
  ["Business systems", "the applications the work actually runs on"],
  ["Automation", "removing the repeated manual steps between systems"],
  ["Support", "a route to a person who owns the outcome (DE Desk, pictured)"],
  ["Governance", "standards, documentation, and what was agreed"],
  ["Continuity", "what happens when something fails, decided in advance"],
];

export function V4DeskChapter() {
  return (
    <Chapter
      id="v4-ch6"
      n="06"
      eyebrow="What sits on it"
      heading="Secured first, then run as one operating environment."
      lede="Once the foundation holds, the rest of the technology can be run as a single system rather than nine separate relationships. Which supplier sits behind each part is a decision for your environment, not a badge for our homepage."
      testId="v4-desk"
    >
      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-16">
        <ol className="border-t border-white/15">
          {CAPABILITIES.map(([name, line], i) => (
            <li
              key={name}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-white/10 py-3.5 sm:grid-cols-[2.5rem_minmax(0,11rem)_minmax(0,1fr)]"
            >
              <span className="font-mono text-[10.5px] tabular-nums text-white/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-[15px] font-semibold leading-snug text-[#F7F5F2]">{name}</h3>
              <p className="col-start-2 text-[13.5px] leading-relaxed text-white/50 sm:col-start-3">
                {line}
              </p>
            </li>
          ))}
        </ol>

        {/* Real product, first-class. */}
        <figure
          className="mx-auto w-full max-w-[360px] lg:mx-0 lg:justify-self-end"
          data-testid="v4-desk-figure"
          data-classification="SANITIZED_REAL"
        >
          <div className="overflow-hidden rounded-[22px] border border-white/15 bg-[#F7F5F2] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
            <img
              src="/images/evidence/de-desk-shell.webp"
              alt="DE Desk, the support panel on this site: Direct Engineering Support, a possible-security-incident route, and the list of what you need help with."
              width={880}
              height={1520}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] leading-relaxed text-white/50">
            <span className="inline-flex items-center rounded border border-white/15 bg-[#151217] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/80">
              Real, details removed
            </span>
            <span>
              DE Desk — the support surface on every page of this site. Open the real one
              from the launcher at the bottom right.
            </span>
          </figcaption>
        </figure>
      </div>
    </Chapter>
  );
}
