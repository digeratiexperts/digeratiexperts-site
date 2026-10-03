import { PageTemplate } from "@/components/PageTemplate";
import { Badge } from "@/components/ui/badge";
import { Chapter, ChapterHeader, ClosingCta, Container, cardPaper } from "@/components/site/chapters";
import { CTA } from "@/lib/ctaCopy";
import { Calendar, Search, AlertCircle, Shield, Lock, Bug, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { useThreatFeed } from "@/hooks/useThreatFeed";
import {
  formatUpdateDisplayDate,
  getSecurityUpdatesSorted,
} from "@/data/securityUpdates";
import {
  formatThreatDate,
  THREAT_ATTRIBUTION,
  THREAT_CATEGORIES,
  type ThreatItem,
} from "@shared/threatFeed";

const complianceArchive = getSecurityUpdatesSorted().filter((item) => item.category === "Compliance Update");

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Active Exploitation":
    case "Ransomware":
      return <AlertCircle className="h-4 w-4" />;
    case "Critical Vulnerability":
    case "Malware Activity":
      return <Bug className="h-4 w-4" />;
    case "Microsoft Security":
    case "Compliance Update":
      return <Lock className="h-4 w-4" />;
    default:
      return <Shield className="h-4 w-4" />;
  }
};

function badgeClass(item: Pick<ThreatItem, "severity"> | { severity?: string }): string {
  if (item.severity === "critical") return "border-red-300 bg-red-50 text-red-800";
  if (item.severity === "high") return "border-[#A30E52] bg-transparent text-[#A30E52]";
  return "border-[var(--de-paper-hairline)] bg-transparent text-[#3A3448]";
}

const sourceLinkClass =
  "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-de-magenta-paper-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]";

export default function SecurityUpdates() {
  const { payload, loading } = useThreatFeed("all");
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(() => {
    const present = new Set(payload.items.map((item) => item.category));
    return ["All", ...THREAT_CATEGORIES.filter((category) => present.has(category))];
  }, [payload.items]);

  const filteredUpdates = payload.items.filter((update) => {
    const matchesCategory = activeCategory === "All" || update.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      update.title.toLowerCase().includes(q) ||
      update.excerpt.toLowerCase().includes(q) ||
      (update.cve || "").toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  useSEO({
    title: "Security Updates",
    description:
      "A scored stream of actively exploited vulnerabilities, CISA advisories, and Microsoft security updates from Digerati Experts.",
    canonical: "/resources/security-updates",
  });

  return (
    <PageTemplate
      title="Security Updates"
      eyebrow="Threat intelligence"
      subtitle="A scored stream of actively exploited vulnerabilities, CISA advisories, and Microsoft security updates — not a generic CVE ticker."
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Security Updates" }]}
      layout="chapters"
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="mb-10 flex items-start gap-4 border-b border-[var(--de-paper-hairline)] pb-8">
            <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
            <div>
              <h2 className="font-heading text-xl font-semibold text-[#1A1228]">Authoritative sources, scored for SMBs</h2>
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#3A3448]">{THREAT_ATTRIBUTION}</p>
            </div>
          </div>

          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="relative lg:w-80 lg:shrink-0">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[#6B6478]" aria-hidden="true" />
              <Input
                aria-label="Search security updates"
                placeholder="Search title, CVE, or excerpt…"
                className="h-11 border-[var(--de-paper-hairline)] bg-white pl-10 text-[#1A1228] placeholder:text-[#6B6478]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-security"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeCategory === category}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)] ${
                    activeCategory === category
                      ? "border-[#A30E52] bg-[#A30E52] text-white"
                      : "border-[var(--de-paper-hairline)] bg-white text-[#3A3448] hover:border-[#A30E52]/50 hover:text-[#1A1228]"
                  }`}
                  onClick={() => setActiveCategory(category)}
                  data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="py-12 text-center text-[#3A3448]" role="status">Loading the live threat stream…</p>
          ) : (
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredUpdates.map((update) => (
                <li key={update.id} className="flex">
                  <article
                    className={`${cardPaper} flex w-full flex-col overflow-hidden`}
                    data-testid={`security-update-${update.id}`}
                  >
                    <div className="h-1 bg-[#D3126A]" aria-hidden="true" />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Badge className={`${badgeClass(update)} border`}>
                          <span className="flex items-center gap-1">
                            {getCategoryIcon(update.category)}
                            {update.category}
                          </span>
                        </Badge>
                        <span className="flex items-center gap-1 whitespace-nowrap text-xs text-[#3A3448]">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {formatThreatDate(update.publishedAt, "short")}
                        </span>
                      </div>
                      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-de-magenta-paper-ink">
                        {update.kicker}
                      </p>
                      <h3 className="line-clamp-2 font-heading text-lg font-semibold leading-snug text-[#1A1228]">
                        {update.title}
                      </h3>
                      <p className="mt-3 line-clamp-3 flex-1 text-[0.95rem] leading-relaxed text-[#3A3448]">
                        {update.excerpt}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--de-paper-hairline)] pt-2">
                        <span className="truncate text-xs text-[#3A3448]">
                          {update.sourceName}
                          {update.cve ? ` · ${update.cve}` : ""}
                        </span>
                        <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className={sourceLinkClass}>
                          Source
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}

          {!loading && filteredUpdates.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-lg text-[#3A3448]">No security updates match your search criteria.</p>
            </div>
          )}
        </Container>
      </Chapter>

      {complianceArchive.length > 0 && (
        <Chapter tone="surface">
          <Container>
            <ChapterHeader
              tone="surface"
              eyebrow="Archive"
              title="Compliance archive"
              layout="stack"
              lede="Historical HHS OCR enforcement notes kept for industry context. These are dated source records, not live threat intelligence."
            />
            <ul className="grid grid-cols-1 gap-x-10 border-t border-[var(--de-hairline)] md:grid-cols-2 lg:grid-cols-3">
              {complianceArchive.map((update) => (
                <li
                  key={update.id}
                  className="border-b border-[var(--de-hairline)] py-6"
                  data-testid={`compliance-archive-${update.id}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Badge className="border border-de-hairline bg-transparent text-white/75">
                      <span className="flex items-center gap-1">
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        Compliance Update
                      </span>
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-white/70">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      {formatUpdateDisplayDate(update.date)}
                    </span>
                  </div>
                  <h3 className="font-heading text-lg font-semibold leading-snug text-white">{update.title}</h3>
                  <p className="mb-2 mt-2 line-clamp-3 text-[0.95rem] leading-relaxed text-white/70">{update.excerpt}</p>
                  <a
                    href={update.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-de-magenta-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                  >
                    {update.sourceName}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </Chapter>
      )}

      <ClosingCta
        tone={complianceArchive.length > 0 ? "paper" : "surface"}
        title="Need help prioritizing a patch?"
        lede="We can map these items against your stack and tell you what actually needs attention this week."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
