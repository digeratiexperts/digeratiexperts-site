import { useState, useEffect, useMemo, forwardRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PageTemplate } from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
import {
  Chapter,
  ChapterHeader,
  ClosingCta,
  Container,
  FactStrip,
  HeroActions,
  cardPaper,
  type ChapterTone,
} from "@/components/site/chapters";
import {
  Shield, Users, DollarSign, Clock,
  ExternalLink, Copy, Check, RefreshCw,
  Lock, MapPin,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { CTA } from "@/lib/ctaCopy";
import {
  cyberAwarenessFacts,
  formatFactSource,
  type CyberAwarenessFact,
} from "@/data/cyberAwarenessFacts";

type FactCategory = "ransomware" | "identity" | "human" | "recovery" | "financial" | "arizona";

interface CyberFact {
  id: string;
  stat: string;
  label: string;
  text: string;
  source: string;
  sourceUrl: string;
  category: FactCategory;
}

const categoryInfo: Record<FactCategory, { icon: React.ReactNode; label: string }> = {
  ransomware: { icon: <Lock className="w-4 h-4" />, label: "Ransomware" },
  identity: { icon: <Shield className="w-4 h-4" />, label: "Identity & Access" },
  human: { icon: <Users className="w-4 h-4" />, label: "Human Element" },
  recovery: { icon: <Clock className="w-4 h-4" />, label: "Recovery" },
  financial: { icon: <DollarSign className="w-4 h-4" />, label: "Financial Impact" },
  arizona: { icon: <MapPin className="w-4 h-4" />, label: "Arizona" },
};

function categorizeFact(fact: CyberAwarenessFact): FactCategory {
  if (fact.scope === "arizona") return "arizona";
  if (fact.id.includes("ransomware") || fact.id.includes("smb-ransomware")) return "ransomware";
  if (fact.id.includes("mfa") || fact.id.includes("vuln")) return "identity";
  if (fact.id.includes("human")) return "human";
  if (fact.id.includes("breach") || fact.id.includes("bec") || fact.id.includes("cost") || fact.id.includes("ic3")) {
    return "financial";
  }
  return "financial";
}

function shortLabel(fact: CyberAwarenessFact): string {
  if (fact.scope === "arizona") return "Arizona";
  if (fact.id.includes("ransomware") && fact.id.includes("smb")) return "SMB Ransomware";
  if (fact.id.includes("ransomware")) return "Ransomware";
  if (fact.id.includes("mfa")) return "MFA";
  if (fact.id.includes("vuln")) return "Vulnerabilities";
  if (fact.id.includes("human")) return "Human Element";
  if (fact.id.includes("bec")) return "BEC";
  if (fact.id.includes("breach-cost") || fact.id.includes("ibm")) return "Breach Cost";
  if (fact.id.includes("breach-notify")) return "AZ Breach Law";
  return "Industry Fact";
}

const canonicalFacts: CyberFact[] = cyberAwarenessFacts.map((fact) => {
  const category = categorizeFact(fact);
  return {
    id: fact.id,
    stat: fact.metric,
    label: shortLabel(fact),
    text: fact.statement.endsWith(".") ? fact.statement : `${fact.statement}.`,
    source: formatFactSource(fact),
    sourceUrl: fact.sourceUrl || "#",
    category,
  };
});

/** Secondary sourced facts kept for the facts library (not homepage). */
const secondaryFacts: CyberFact[] = [
  {
    id: "ransomware-recovery",
    stat: "$1.53M",
    label: "Ransomware Recovery",
    text: "average cost to recover from ransomware (excluding ransom).",
    source: "Sophos State of Ransomware 2025",
    sourceUrl: "https://greymatter.com/wp-content/uploads/2025/06/sophos-state-of-ransomware-2025.pdf",
    category: "financial",
  },
  {
    id: "backup-restores",
    stat: "54%",
    label: "Backup Restores",
    text: "used backups to restore encrypted data.",
    source: "Sophos State of Ransomware 2025",
    sourceUrl: "https://greymatter.com/wp-content/uploads/2025/06/sophos-state-of-ransomware-2025.pdf",
    category: "recovery",
  },
  {
    id: "internet-crime",
    stat: "$16.6B",
    label: "Internet Crime",
    text: "reported losses to FBI IC3 in 2024 from 859,532 complaints.",
    source: "FBI IC3 Annual Report 2024",
    sourceUrl: "https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf",
    category: "financial",
  },
];

const allFacts: CyberFact[] = [...canonicalFacts, ...secondaryFacts];

const featuredFacts = allFacts.filter((f) =>
  [
    "az-ic3-losses-2024",
    "dbir-ransomware-2026",
    "ibm-us-breach-cost-2026",
    "microsoft-mfa-blocks-2025",
    "dbir-human-element-2026",
  ].includes(f.id),
);

interface FactCardProps {
  fact: CyberFact;
  featured?: boolean;
  tone?: ChapterTone;
  onCopy: (fact: CyberFact) => void;
  copiedId: string | null;
}

const FactCard = forwardRef<HTMLDivElement, FactCardProps>(function FactCard(
  { fact, featured = false, tone = "well", onCopy, copiedId },
  ref,
) {
  const reduce = useReducedMotion();
  const isCopied = copiedId === fact.id;
  const paper = tone === "paper";
  const rule = paper ? "border-[var(--de-paper-hairline)]" : "border-white/10";
  const mutedInk = paper ? "text-[#3A3448]" : "text-white/70";

  return (
    <motion.div
      ref={ref}
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
      className={`flex h-full flex-col transition-colors duration-200 ${
        paper ? `${cardPaper} hover:border-[#D3126A]/40` : "de-hud-card relative hover:border-[#D3126A]/40"
      } ${featured ? "p-6 md:p-10" : "p-6"}`}
      data-testid={`fact-card-${fact.id}`}
    >
      <p
        className={`mb-4 inline-flex items-center gap-1.5 self-start font-mono text-xs font-medium uppercase tracking-wider ${mutedInk}`}
      >
        {categoryInfo[fact.category].icon}
        {categoryInfo[fact.category].label}
      </p>

      <div className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 ${featured ? `mb-6 border-b ${rule} pb-6` : "mb-3"}`}>
        <span
          className={`font-black font-mono de-tabular-nums tracking-tight ${
            paper ? "text-de-magenta-paper-ink" : "text-de-accent-ink"
          } ${featured ? "text-5xl md:text-7xl" : "text-3xl md:text-4xl"}`}
        >
          {fact.stat}
        </span>
        <span
          className={`font-bold font-mono uppercase tracking-wider ${paper ? "text-black/65" : "text-white/65"} ${featured ? "text-base" : "text-xs"}`}
        >
          {fact.label}
        </span>
      </div>

      <p
        className={`flex-1 font-medium leading-relaxed ${paper ? "text-[#1A1228]" : "text-white/85"} ${
          featured ? "mb-6 font-heading text-lg md:text-xl" : "mb-4 text-[0.95rem]"
        }`}
      >
        {fact.text}
      </p>

      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${
          featured ? `rounded-xl border ${rule} ${paper ? "bg-[var(--de-paper)]" : "bg-black/30"} px-4 py-1` : `border-t ${rule} pt-2`
        }`}
      >
        <a
          href={fact.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex min-h-11 items-center gap-2 text-sm font-mono hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] ${
            paper ? "text-de-magenta-paper-ink" : "text-de-accent-ink"
          }`}
          data-testid={`fact-source-${fact.id}`}
        >
          <span className={paper ? "text-black/60" : "text-white/60"}>Source:</span>
          <span className="font-medium">{fact.source}</span>
          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopy(fact)}
          className={`min-h-11 ${
            paper ? "text-[#3A3448] hover:bg-black/5 hover:text-[#1A1228]" : "text-white/75 hover:bg-white/10 hover:text-white"
          } ${isCopied ? (paper ? "text-de-magenta-paper-ink" : "text-de-accent-ink") : ""}`}
          data-testid={`btn-copy-${fact.id}`}
        >
          {isCopied ? (
            <>
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Copy
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
});

const CyberFacts = () => {
  const { toast } = useToast();
  const [randomFact, setRandomFact] = useState<CyberFact | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FactCategory | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useSEO({
    title: 'Cybersecurity Facts with Sources | Digerati Experts',
    description: 'Sourced cybersecurity statistics on ransomware, identity, email fraud, recovery cost and Arizona losses. Each figure names its report and year and links to the publisher.',
    canonical: '/resources/cyber-facts',
  });

  useEffect(() => {
    const pick = featuredFacts[Math.floor(Math.random() * featuredFacts.length)];
    setRandomFact(pick);
  }, []);

  const handleCopy = (fact: CyberFact) => {
    navigator.clipboard.writeText(`${fact.stat} ${fact.text} (${fact.source})`);
    setCopiedId(fact.id);
    toast({
      title: "Fact Copied",
      description: "Statistic and source copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const refreshRandomFact = () => {
    const remaining = featuredFacts.filter(f => f.id !== randomFact?.id);
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    setRandomFact(pick);
  };

  const filteredFacts = useMemo(() => {
    if (selectedCategory === "all") return allFacts;
    return allFacts.filter(f => f.category === selectedCategory);
  }, [selectedCategory]);

  const filterBtn = (active: boolean) =>
    `inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)] ${
      active
        ? "border-[#A30E52] bg-[#A30E52] text-white"
        : "border-[var(--de-paper-hairline)] bg-white text-[#3A3448] hover:border-[#A30E52]/50 hover:text-[#1A1228]"
    }`;

  return (
    <PageTemplate
      title="Real Cybersecurity Facts"
      eyebrow="Sourced statistics"
      subtitle="Sourced statistics — identity, ransomware, email fraud, and recovery cost. Use them with the source link attached."
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Cyber Facts" }]}
      layout="chapters"
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      <div data-testid="heading-cyber-facts">
        <FactStrip
          label="How these facts are sourced"
          facts={[
            { icon: Shield, title: "SOURCED", text: "Every figure names its report and year" },
            { icon: ExternalLink, title: "LINKED", text: "Each card links to the publisher" },
            { icon: MapPin, title: "ARIZONA", text: "State losses and the 45-day notice law" },
          ]}
        />

        <Chapter tone="well" seam={false}>
          <Container>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-white md:text-4xl">
                  Today's Cyber Fact
                </h2>
                <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-white/60">
                  A different sourced fact each visit
                </p>
              </div>
              <Button
                variant="outline"
                onClick={refreshRandomFact}
                className="min-h-11 border-white/25 text-white/80 hover:bg-white/10 hover:text-white"
                data-testid="btn-refresh-fact"
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                New Fact
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {randomFact && (
                <FactCard key={randomFact.id} fact={randomFact} featured onCopy={handleCopy} copiedId={copiedId} />
              )}
            </AnimatePresence>

            <p className="mt-6 max-w-3xl border-l-2 border-[var(--de-hairline)] pl-4 text-sm leading-relaxed text-white/65">
              <strong className="text-white/85">Sharing it?</strong> Copy takes the figure and its source line together, so the number never travels without its report.
            </p>
          </Container>
        </Chapter>

        <Chapter tone="surface">
          <Container>
            <ChapterHeader
              tone="surface"
              eyebrow="Two to remember"
              title="Prevention and Recovery"
              layout="stack"
              lede="One fact about stopping an attack, one about what recovery costs."
            />
            <div className="grid gap-6 md:grid-cols-2">
              <FactCard fact={allFacts.find(f => f.id === "microsoft-mfa-blocks-2025")!} onCopy={handleCopy} copiedId={copiedId} />
              <FactCard fact={allFacts.find(f => f.id === "ransomware-recovery")!} onCopy={handleCopy} copiedId={copiedId} />
            </div>
          </Container>
        </Chapter>

        <Chapter tone="paper">
          <Container>
            <ChapterHeader
              tone="paper"
              eyebrow="Reference"
              title="Fact Library"
              layout="stack"
              lede={`${filteredFacts.length} sourced facts · filter by topic · copy any fact with its source`}
            />

            <div
              className="mb-8 flex flex-wrap gap-2"
              role="group"
              aria-label="Filter facts by category"
              data-testid="btn-filter-facts"
            >
              <button
                type="button"
                aria-pressed={selectedCategory === "all"}
                onClick={() => setSelectedCategory("all")}
                className={filterBtn(selectedCategory === "all")}
                data-testid="filter-all"
              >
                All Categories
              </button>
              {Object.entries(categoryInfo).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selectedCategory === key}
                  onClick={() => setSelectedCategory(key as FactCategory)}
                  className={filterBtn(selectedCategory === key)}
                  data-testid={`filter-${key}`}
                >
                  {info.icon}
                  {info.label}
                </button>
              ))}
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
              <AnimatePresence mode="popLayout">
                {filteredFacts.map(fact => (
                  <FactCard key={fact.id} fact={fact} tone="paper" onCopy={handleCopy} copiedId={copiedId} />
                ))}
              </AnimatePresence>
            </div>

            <p className="mt-8 max-w-3xl border-l-2 border-[var(--de-paper-hairline)] pl-4 text-sm leading-relaxed text-[#3A3448]">
              <strong className="text-[#1A1228]">Using these figures?</strong> Keep the source link beside the number. Most of these reports are republished every year, so check the year on each card.
            </p>
          </Container>
        </Chapter>

        <ClosingCta
          tone="well"
          title="Want these facts applied to your environment?"
          lede="A Cyber Risk Assessment maps sourced industry risk to what is actually running in your Arizona office."
          primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
        />
      </div>
    </PageTemplate>
  );
};

export default CyberFacts;
