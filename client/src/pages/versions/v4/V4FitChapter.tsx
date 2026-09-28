import { Chapter, QuietLink } from "./V4Primitives";

/**
 * 09 — Fit.
 *
 * Who this is for, then how the relationship can run.
 *
 * The industries line names the sectors DE publishes a page for
 * (client/src/pages/industries, routed in App.tsx) — the audience rule: a
 * clinic or a firm should see itself named before it reads about models.
 *
 * The three operating models sit on a spectrum from "you run it" to "we run
 * it", because that is the dimension they actually differ on. Each stop
 * carries the fit line the production site publishes for it
 * (client/src/pages/solutions/StandaloneServices.tsx and CoManagedIT.tsx,
 * "Best fit" row); the ProActive stop carries the tier progression in the
 * words of /solutions/proactive-ecosystem and the entry-tier minimum from
 * the pricing page. Enough to orient; the pricing page stays where it is.
 * The scope note is the published one from client/src/data/pricing.ts.
 */

const INDUSTRIES = [
  "Healthcare",
  "Accounting & finance",
  "Law firms",
  "Real estate",
  "Nonprofits",
  "Animal hospitals",
];

const STOPS: Array<{ name: string; canon: string; fit: string; who: string }> = [
  {
    name: "Standalone",
    canon: "You run it",
    fit: "You want the solution without changing IT providers.",
    who: "A preconfigured DE package for one business need. Your business or existing IT provider owns ongoing operation.",
  },
  {
    name: "Co-Managed",
    canon: "Shared, in writing",
    fit: "You have IT capability and want DE involved.",
    who: "Your team stays in the picture. DE owns an explicitly defined scope, and who owns each part is documented rather than implied.",
  },
  {
    name: "ProActive",
    canon: "We run it",
    fit: "You want DE to act as the IT department.",
    who: "The umbrella operating model, progressing IT → Office → Business → Enterprise. Each tier is a fit for a different environment, not a merchandising rank. Entry tiers start at five people.",
  },
];

export function V4FitChapter() {
  return (
    <Chapter
      id="v4-ch9"
      n="09"
      eyebrow="Fit"
      heading="Three ways to work with us. One standard underneath."
      lede="The models differ in who runs what. The security foundation, the assessment and the documents in the chapter above do not change between them."
      testId="v4-fit"
    >
      {/* Who, before how. Named sectors, each with a page of its own. */}
      <p
        className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/60"
        data-testid="v4-industries"
      >
        <span className="text-white/50">Arizona businesses in</span>
        {INDUSTRIES.map((name, i) => (
          <span key={name} className="inline-flex items-baseline gap-x-3">
            {i > 0 && <span aria-hidden="true" className="text-white/30">·</span>}
            <span className="text-[#F7F5F2]">{name}</span>
          </span>
        ))}
        <span className="text-white/50">and beyond</span>
      </p>

      {/* The spectrum. A rail with three stops; vertical on phones. */}
      <div className="mt-12">
        {/* Each stop sits on the left edge of its own column — the edge the
            model's name starts on — and the rail runs from the first stop to
            the last. The column eyebrows carry the "you run it / we run it"
            reading, so the rail needs no labels of its own. */}
        <div aria-hidden="true" className="hidden sm:block">
          <div className="relative h-3">
            <div
              className="absolute left-0 top-1/2 h-px bg-white/20"
              style={{ right: "calc((100% - 4rem) / 3)" }}
            />
            <div className="relative grid grid-cols-3 gap-x-8">
              <span className="h-3 w-3 rounded-full border border-white/50 bg-[#050312]" />
              <span className="h-3 w-3 rounded-full border border-white/50 bg-[#050312]" />
              <span className="h-3 w-3 rounded-full bg-[#D3126A]" />
            </div>
          </div>
        </div>

        <ol className="mt-6 grid gap-8 border-l border-white/20 pl-6 sm:mt-8 sm:grid-cols-3 sm:gap-x-8 sm:border-l-0 sm:pl-0">
          {STOPS.map((s, i) => (
            <li key={s.name} className="relative min-w-0" data-testid={`v4-fit-${i + 1}`}>
              <span
                aria-hidden="true"
                className={`absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full sm:hidden ${
                  i === 2 ? "bg-[#D3126A]" : "border border-white/50 bg-[#050312]"
                }`}
              />
              <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/55">{s.canon}</p>
              <h3 className="mt-2 font-['Space_Grotesk',sans-serif] text-[clamp(1.3rem,2.4vw,1.7rem)] font-bold leading-tight text-[#F7F5F2]">
                {s.name}
              </h3>
              <p className="mt-3 text-[15px] font-semibold leading-snug text-[#F7F5F2]/90">{s.fit}</p>
              <p className="mt-2 max-w-[40ch] text-[13.5px] leading-relaxed text-white/55">{s.who}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="max-w-[60ch] text-[13px] leading-relaxed text-white/60">
            Final pricing depends on users, endpoints, locations, infrastructure, backup
            requirements, and security/compliance scope. Estimates are not quotes — your
            Cyber Risk Assessment confirms final scope.
          </p>
          {/* /solutions is the ProActive overview; the page that compares all
              three models side by side is the Standalone page, so that is
              where "compare" goes. */}
          <QuietLink href="/solutions/standalone-services" testId="v4-link-solutions">
            Compare Standalone, Co-Managed and ProActive
          </QuietLink>
        </div>
      </div>
    </Chapter>
  );
}
