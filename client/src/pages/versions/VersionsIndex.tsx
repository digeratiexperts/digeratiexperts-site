import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { HOMEPAGE_VERSIONS, type HomepageVersion } from "./registry";

function VersionLink({ v }: { v: HomepageVersion }): JSX.Element | null {
  if (v.kind === "planned") return null;
  const label = v.kind === "static" ? `Open ${v.path} (forwards to ${v.href})` : `Open ${v.path}`;
  const className =
    "inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[#F04C97] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]";
  // a static version lives outside the SPA, so it needs a full navigation
  if (v.kind === "static") {
    return (
      <a href={v.path} className={className} data-testid={`link-version-${v.n}`}>
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  }
  return (
    <Link href={v.path} className={className} data-testid={`link-version-${v.n}`}>
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

/**
 * /versions — the archive of every homepage the site has had or is
 * considering. Reference only: noindex, not linked from navigation.
 */
export default function VersionsIndex(): JSX.Element {
  useSEO({
    title: "Homepage versions (reference)",
    description: "Every version of the Digerati Experts homepage, kept reachable for reference.",
    canonical: "/",
    noIndex: true,
  });

  return (
    <main className="min-h-screen bg-[#050312] px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#F04C97]">
          Reference archive · not indexed
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Homepage versions</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
          Every homepage the site has had or is considering, frozen at its number so nothing is lost when
          the next one lands. A version is never edited; the next idea gets the next number. Rule and
          procedure: <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">client/src/pages/versions/README.md</code>.
        </p>

        <ol className="mt-10 divide-y divide-white/10 border-y border-white/10" data-testid="homepage-versions-list">
          {HOMEPAGE_VERSIONS.map((v) => (
            <li key={v.n} className="grid grid-cols-[3.5rem_1fr] gap-x-4 py-6" data-testid={`version-${v.n}`}>
              <span className="pt-1 font-mono text-sm font-bold tracking-[0.18em] text-[#F04C97]" aria-hidden="true">
                V{v.n}
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold">{v.title}</h2>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">
                  {v.status}
                  {v.date ? ` · ${v.date}` : ""}
                  {v.source ? ` · ${v.source}` : ""}
                </p>
                <p className="mt-3 text-base leading-relaxed text-white/70">{v.summary}</p>
                <div className="mt-3">
                  {v.kind === "planned" ? (
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/65">
                      {v.path} · reserved
                    </span>
                  ) : (
                    <VersionLink v={v} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-sm text-white/55">
          The live homepage is always <Link href="/" className="text-white underline underline-offset-4">/</Link>. Version
          pages carry a ribbon so a screenshot can never be mistaken for production.
        </p>
        <p className="mt-4 text-sm text-white/55">
          Reviews, the diagram gallery and the plans behind these versions are at{" "}
          <a href="/scrollcraft/" className="text-white underline underline-offset-4" data-testid="link-scrollcraft-lab">
            /scrollcraft/
          </a>
          .
        </p>
      </div>
    </main>
  );
}
