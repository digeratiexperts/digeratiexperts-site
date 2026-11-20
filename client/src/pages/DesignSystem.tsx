import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusToken } from "@/components/evidence/StatusToken";
import { IconWell } from "@/components/visual/IconWell";
import manifest from "@/design-system/manifest.generated.json";

type Preview = "button" | "badge" | "status-token" | "icon-well";

const PREVIEW_BY_ID: Record<string, Preview> = {
  button: "button",
  badge: "badge",
  "status-token": "status-token",
  "icon-well": "icon-well",
};

function LivePreview({ kind }: { kind: Preview }): JSX.Element {
  switch (kind) {
    case "button":
      return (
        <div className="flex flex-wrap gap-3">
          <Button variant="brand" className="min-h-11">Brand</Button>
          <Button variant="outline" className="min-h-11 text-white">Outline</Button>
          <Button variant="default" className="min-h-11">Default</Button>
        </div>
      );
    case "badge":
      return (
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="outline" className="border-white/35 text-white">Outline</Badge>
        </div>
      );
    case "status-token":
      return (
        <div className="flex flex-wrap gap-2">
          <StatusToken status="verified" />
          <StatusToken status="attention" />
          <StatusToken status="informational" />
        </div>
      );
    case "icon-well":
      return (
        <div className="flex gap-3">
          <IconWell icon={Sparkles} size="sm" />
          <IconWell icon={Sparkles} size="md" />
        </div>
      );
  }
}

const STATUS_LABEL: Record<string, string> = {
  stable: "Stable",
  experimental: "Experimental",
  deprecated: "Deprecated",
};

const TIER_LABEL: Record<number, string> = {
  0: "Tier 0 · non-negotiable",
  1: "Tier 1 · brand identity",
  2: "Tier 2 · current default",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-white/10 py-12">
      <h2 id={`${id}-h`} className="font-heading text-2xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * /design-system: the living styleguide. Reference only (noindex, not in
 * navigation). Everything shown is read from the generated manifest, so it
 * cannot drift from index.css or the component registry.
 */
export default function DesignSystem(): JSX.Element {
  useSEO({
    title: "Design system (reference)",
    description: "Tokens, components, guidance, version history and adoption for the Digerati Experts site.",
    canonical: "/",
    noIndex: true,
  });

  return (
    <main className="min-h-screen bg-[#050312] px-4 pt-16 pb-[calc(var(--de-fab-h)+var(--de-chrome-inset)+4rem)] text-white sm:px-6 lg:px-8" data-testid="design-system-page">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#F04C97]">
          Reference · not indexed
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Design system</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
          Tokens, adoption counts and the version list are generated from the code. Component guidance and the changelog are written by hand and reviewed. Machine-readable copy for coding agents:{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">design/design-system.json</code>
          . Authority rules: design/DESIGN-AUTHORITY.md.
        </p>
        <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {["tokens", "components", "versions", "changelog", "adoption"].map((id) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center capitalize text-[#F04C97] underline-offset-4 hover:underline">
              {id}
            </a>
          ))}
        </nav>

        <Section id="tokens" title="Tokens">
          <div className="space-y-8">
            {manifest.tokenGroups.map((group) => (
              <div key={group.id}>
                <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-white/60">{group.label}</h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.tokens.map((t) => (
                    <li key={t.name} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0a0a0a] p-3">
                      {group.id === "layout" ? null : (
                        <span
                          aria-hidden="true"
                          className="h-10 w-10 shrink-0 rounded-md border border-white/15"
                          style={
                            t.name.includes("paper-hairline")
                              ? // a dark hairline is invisible on the dark card, so sit it on its own paper field
                                { backgroundColor: "var(--de-paper)", backgroundImage: `linear-gradient(var(${t.name}), var(${t.name}))` }
                              : { background: `var(${t.name})` }
                          }
                        />
                      )}
                      <span className="min-w-0">
                        <code className="block truncate text-sm">{t.name}</code>
                        <span className="block truncate font-mono text-xs text-white/60">{t.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section id="components" title="Components">
          <ul className="space-y-6">
            {manifest.components.map((c) => {
              const preview = PREVIEW_BY_ID[c.id];
              return (
                <li key={c.id} id={`component-${c.id}`} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-5" data-testid={`component-${c.id}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    <span className="rounded border border-white/15 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/75">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">{TIER_LABEL[c.tier]}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/75">{c.purpose}</p>
                  <code className="mt-1 block text-xs text-white/55">{c.file}</code>
                  {preview ? (
                    <div className="mt-4 rounded-lg border border-white/10 bg-[#050312] p-4">
                      <LivePreview kind={preview} />
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
                    <div>
                      <h4 className="font-semibold text-emerald-300">Do</h4>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-white/75">{c.dos.map((d) => <li key={d}>{d}</li>)}</ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-amber-300">Don&apos;t</h4>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-white/75">{c.donts.map((d) => <li key={d}>{d}</li>)}</ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Accessibility</h4>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-white/75">{c.accessibility.map((d) => <li key={d}>{d}</li>)}</ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section id="versions" title="Homepage versions">
          <p className="max-w-2xl text-sm text-white/70">
            Every homepage the site has had or is considering. Snapshots (react) never change; build versions are work in progress. Full archive:{" "}
            <Link href="/versions" className="inline-flex min-h-11 items-center underline underline-offset-4">/versions</Link>.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Homepage versions</caption>
              <thead>
                <tr className="border-b border-white/15 font-mono text-xs uppercase tracking-[0.12em] text-white/60">
                  <th scope="col" className="py-2 pr-4">Version</th>
                  <th scope="col" className="hidden py-2 pr-4 sm:table-cell">Date</th>
                  <th scope="col" className="hidden py-2 pr-4 sm:table-cell">Kind</th>
                  <th scope="col" className="py-2">Title</th>
                </tr>
              </thead>
              <tbody>
                {manifest.versions.map((v) => (
                  <tr key={v.n} className="border-b border-white/10 align-top">
                    <th scope="row" className="py-2 pr-4 font-mono text-[#F04C97]">V{v.n}</th>
                    <td className="hidden py-2 pr-4 text-white/70 sm:table-cell">{v.date}</td>
                    <td className="hidden py-2 pr-4 text-white/70 sm:table-cell">{v.kind}</td>
                    <td className="py-2">
                      {v.kind === "planned" ? (
                        <span className="text-white/65">{v.title}</span>
                      ) : (
                        <a href={v.path} className="inline-flex min-h-11 items-center underline underline-offset-4">{v.title}</a>
                      )}
                      <span className="block font-mono text-[11px] text-white/55 sm:hidden">{v.date} · {v.kind}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="changelog" title="Changelog">
          <ol className="space-y-5">
            {manifest.changelog.map((e) => (
              <li key={`${e.date}-${e.title}`} className="grid gap-1 sm:grid-cols-[7rem_1fr]">
                <time dateTime={e.date} className="font-mono text-xs text-white/60">{e.date}</time>
                <div>
                  <h3 className="text-base font-semibold">
                    {e.title}
                    {"joeDecided" in e && e.joeDecided ? (
                      <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#F04C97]">Joe-decided</span>
                    ) : null}
                  </h3>
                  <p className="mt-1 text-sm text-white/70">{e.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="adoption" title="Adoption">
          <p className="max-w-2xl text-sm text-white/70">
            How many source files import each component, as of the last run of <code className="rounded bg-white/10 px-1.5 py-0.5">npm run design-system:build</code> (a snapshot, not recomputed on deploy). A registered
            component with no imports is a candidate to adopt or retire, not a failure.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <caption className="sr-only">Component adoption by file count</caption>
              <thead>
                <tr className="border-b border-white/15 font-mono text-xs uppercase tracking-[0.12em] text-white/60">
                  <th scope="col" className="py-2 pr-4">Component</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2 text-right">Files importing</th>
                </tr>
              </thead>
              <tbody>
                {[...manifest.components].sort((a, b) => b.adoption.files - a.adoption.files).map((c) => (
                  <tr key={c.id} className="border-b border-white/10">
                    <th scope="row" className="py-2 pr-4 font-medium">{c.name}</th>
                    <td className="py-2 pr-4 text-white/70">{STATUS_LABEL[c.status]}</td>
                    <td className="py-2 text-right font-mono">{c.adoption.files}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </main>
  );
}
