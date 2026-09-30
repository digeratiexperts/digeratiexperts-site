import { Chapter, QuietLink, T } from "./V4Primitives";
import { V4Reviews } from "./V4Reviews";

/**
 * 08 — In writing.
 *
 * Proof and responsibility in one chapter, built only from things that exist:
 *
 *   - the founder, with the photograph already approved and live on the
 *     production homepage (DigeratiMeetExpertsSection) — a real person, not
 *     a generated face and not stock;
 *   - excerpts quoted verbatim from pages DE publishes: the Client Bill of
 *     Rights (client/src/pages/about/ClientBillOfRights.tsx), the Trust
 *     Center's own boundary on certifications (trust/TrustCenter.tsx), and the
 *     Critical response target from the SLA (legal/SLA.tsx).
 *
 * Reviews come through V4Reviews, from the same live-plus-catalog feed the
 * production homepage uses; while that feed is empty the row says so in
 * production's own words and links to the Google listing. What is
 * deliberately absent: case studies (publishedCaseStudies is an empty
 * array), client logos, counters. design/PROOF_SYSTEM.md: an honest gap
 * beats an invented row.
 */

const EXCERPTS: Array<{ source: string; title: string; quote: string; note?: string }> = [
  {
    source: "Client Bill of Rights",
    title: "Compliance-first",
    quote:
      "We Pledge to never recommend or deliver a service that would put you at risk for non-compliance.",
  },
  {
    source: "Client Bill of Rights",
    title: "Transparent pricing",
    quote:
      "We Pledge to deliver solutions on budget with straightforward, clear billing—without mistakes, hidden fees, or unexpected expenses.",
  },
  {
    source: "Trust Center",
    title: "Where the line is",
    quote:
      "These names describe frameworks and customer requirements Digerati Experts helps organizations address. They are not certifications DE holds.",
    note: "Written on the page where other providers put badges.",
  },
  {
    source: "Service Level Agreement",
    title: "Critical (Active Breach/System Down)",
    quote: "15 minutes",
    note: "The published response target for the Critical tier. Lower tiers are slower, and the SLA says so.",
  },
];

export function V4ProofChapter() {
  return (
    <Chapter
      id="v4-ch8"
      n="08"
      eyebrow="In writing"
      heading="What we have put in writing, and who signs it."
      lede="Trust is not a slogan on a homepage. It is a set of documents you can hold us to, and a person whose name is on them."
      testId="v4-proof"
    >
      <div className="mt-12 grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 lg:gap-16">
        {/* The person. Real photograph, already approved for production. */}
        <figure className="max-w-sm" data-testid="v4-founder">
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-de-raised">
            {/* Same photograph production serves as JPEG (142 KB); the WebP
                derivative is 44 KB and the JPEG stays as the fallback. The
                file is 3:4 already, so the box crops nothing. */}
            <picture>
              <source srcSet="/images/founder/joe-petro-studio-blazer-white.webp" type="image/webp" />
              <img
                src="/images/founder/joe-petro-studio-blazer-white.jpg"
                alt="Joseph Petro, Founder of Digerati Experts"
                width={768}
                height={1024}
                loading="lazy"
                decoding="async"
                className="block aspect-[3/4] w-full object-cover"
              />
            </picture>
          </div>
          <figcaption className="mt-4">
            <p className={`${T.h3} text-de-paper`}>Joseph Petro</p>
            <p className={`mt-0.5 ${T.label} text-de-accent-ink`}>Founder &amp; Chief Technology Strategist</p>
            <p className={`mt-3 max-w-[44ch] ${T.small} text-white/55`}>
              Chandler, Arizona. Directly involved in the assessments, the architecture and the
              milestones that matter — so you are not account number four thousand.
            </p>
          </figcaption>
        </figure>

        {/* The documents. Quoted, not paraphrased; each names its page. */}
        <div>
          <ol className="border-t border-white/15">
            {EXCERPTS.map((x, i) => (
              <li
                key={`${x.source}-${x.title}`}
                className="border-b border-white/10 py-6"
                data-testid={`v4-excerpt-${i + 1}`}
              >
                <p className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${T.label} text-white/55`}>
                  <span className="text-white/60">{x.source}</span>
                  <span className="h-px w-5 self-center bg-white/15" />
                  <span>{x.title}</span>
                </p>
                {/* A short figure is set at heading size; a sentence at quotation size. */}
                <blockquote
                  className={`mt-3 max-w-[58ch] text-de-paper ${x.quote.length < 20 ? T.h2 : `${T.h3} text-balance`}`}
                >
                  {x.quote.length < 20 ? x.quote : `“${x.quote}”`}
                </blockquote>
                {x.note && <p className={`mt-2 max-w-[58ch] ${T.small} text-white/60`}>{x.note}</p>}
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <QuietLink href="/about/client-bill-of-rights" testId="v4-link-bill-of-rights">
              Read all eight rights and pledges
            </QuietLink>
          </div>
        </div>
      </div>

      <V4Reviews />
    </Chapter>
  );
}
