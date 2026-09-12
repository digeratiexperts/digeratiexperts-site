import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Briefcase, FileText, GraduationCap, HardDrive, Headphones, KeyRound, Mail, Network, Phone, RefreshCw, Search, Server, Shield, ShieldAlert } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { PublicSolutionCart } from "@/components/store/PublicSolutionCart";
import { SolutionProfileForm } from "@/components/store/SolutionProfileForm";
import { useSEO } from "@/hooks/useSEO";
import { curatedSolutionFamilies, type CuratedSolutionFamily } from "@/data/curatedSolutions";
import { BUSINESS_GOALS, familyPath, type BusinessGoalId } from "@/lib/businessNeeds";
import { portalMarketplaceLoginUrl } from "@/lib/portalUrls";
import {
  emptyDraft,
  patchEnvironment,
  readSolutionDraft,
  SOLUTION_DRAFT_EVENT,
  toggleDraftNeed,
  writeSolutionDraft,
  type SolutionDraft,
  type SolutionEnvironment,
} from "@/lib/solutionDraft";
import { useToast } from "@/hooks/use-toast";

const FAMILY_ICONS: Record<CuratedSolutionFamily["id"], typeof Shield> = {
  it_operations: Headphones,
  endpoint_devices: Server,
  identity_access: KeyRound,
  email_collaboration: Mail,
  cybersecurity_operations: Shield,
  network_connectivity: Network,
  backup_continuity: RefreshCw,
  compliance_risk: FileText,
  security_awareness: GraduationCap,
  business_communications: Phone,
  hardware_lifecycle: HardDrive,
  documentation_standards: Briefcase,
  technology_strategy: ShieldAlert,
};

const FAMILY_ACCENTS: Record<CuratedSolutionFamily["id"], string> = {
  it_operations: "text-amber-300",
  endpoint_devices: "text-violet-300",
  identity_access: "text-purple-300",
  email_collaboration: "text-cyan-300",
  cybersecurity_operations: "text-sky-300",
  network_connectivity: "text-green-300",
  backup_continuity: "text-emerald-300",
  compliance_risk: "text-orange-300",
  security_awareness: "text-rose-300",
  business_communications: "text-red-300",
  hardware_lifecycle: "text-blue-300",
  documentation_standards: "text-indigo-300",
  technology_strategy: "text-pink-300",
};

export default function BusinessNeedsIndex() {
  const prefersReducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [goal, setGoal] = useState<BusinessGoalId | "all">("all");
  const [draft, setDraft] = useState<SolutionDraft>(emptyDraft);
  const { toast } = useToast();

  useEffect(() => {
    const refresh = () => setDraft(readSolutionDraft());
    refresh();
    window.addEventListener(SOLUTION_DRAFT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SOLUTION_DRAFT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useSEO({
    title: "IT Solutions Store | Digerati Experts",
    description: "Build a Digerati Experts solution from your business profile and business need.",
    canonical: "/store",
  });

  const families = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const goalFamilyIds =
      goal === "all" ? null : new Set(BUSINESS_GOALS.find((entry) => entry.id === goal)?.familyIds ?? []);
    return curatedSolutionFamilies.filter((family) => {
      if (goalFamilyIds && !goalFamilyIds.has(family.id)) return false;
      if (!needle) return true;
      return [family.label, family.description, ...family.offers.flatMap((offer) => [offer.name, offer.summary, ...offer.outcomes, ...offer.includes])]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, goal]);

  const setProfile = <K extends keyof SolutionEnvironment>(key: K, value: SolutionEnvironment[K]) => {
    const next = writeSolutionDraft(patchEnvironment(readSolutionDraft(), { [key]: value }));
    setDraft(next);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
      <StorePageAtmosphere />
      <div className="relative z-10">
        <MegaMenu />
        <main className="de-nav-clear pb-24">
          <div className="mx-auto max-w-[var(--de-canvas)] px-4 sm:px-6 lg:px-8">
            <header className="max-w-3xl pb-10 pt-8 md:pt-14">
              <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-de-accent-ink">Business Solution Builder</p>
                <h1 className="mt-5 text-[clamp(2.25rem,5.4vw,4.25rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white" data-testid="heading-business-needs">
                  Start with your business. Then solve what <span className="text-de-accent-ink">hurts.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
                  Set your users, devices, and sites once. Then DE can size every preconfigured solution consistently while you browse—without forcing you into a managed-services contract or exposing a vendor catalog.
                </p>
                <p className="mt-8 text-sm text-white/55">
                  Existing client or DE staff?{" "}
                  <a
                    href={portalMarketplaceLoginUrl()}
                    className="font-medium text-de-accent-ink underline-offset-4 hover:underline"
                    data-testid="link-client-marketplace"
                  >
                    Open Client Marketplace
                  </a>
                </p>
              </motion.div>
            </header>

            <SolutionProfileForm environment={draft.environment} onChange={setProfile} />

            <ol className="my-12 grid gap-8 border-y border-white/10 py-8 sm:grid-cols-2 lg:grid-cols-4 sm:gap-10 sm:py-10" aria-label="How the Solution Builder works">
              {[
                ["01", "Pain or need", "Tell us what is not working, risky, expensive, or holding the business back."],
                ["02", "Solution", "Choose a standalone or co-managed DE offer—or ask DE to help decide."],
                ["03", "Package & delivery", "See included line items, sizing, shipping, install options, and support."],
                ["04", "Contact", "Only name, company, email, and phone when you are ready to continue."],
              ].map(([number, title, body]) => (
                <li key={number}>
                  <p className="font-mono text-[11px] tracking-[0.16em] text-de-accent-ink">{number}</p>
                  <h2 className="mt-3 text-lg font-semibold text-white">{title}</h2>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/50">{body}</p>
                </li>
              ))}
            </ol>

            <section aria-labelledby="curated-solutions-heading">
              <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 1 · Pain or need</p>
                  <h2 id="curated-solutions-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                    {goal === "all"
                      ? "What needs attention?"
                      : BUSINESS_GOALS.find((entry) => entry.id === goal)?.label}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    Start with a plain-English business goal or browse all thirteen solution families.
                  </p>
                </div>
                <label className="relative block w-full lg:w-80">
                  <span className="sr-only">Search solutions</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pains or solutions" className="h-11 border-white/10 bg-transparent pl-11 text-white placeholder:text-white/35" />
                </label>
              </div>
              <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Start from a business goal">
                <button
                  type="button"
                  className={`h-10 rounded-full px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] ${
                    goal === "all"
                      ? "border border-de-accent bg-transparent text-white"
                      : "border border-white/12 text-white/65 hover:border-white/25 hover:text-white"
                  }`}
                  aria-pressed={goal === "all"}
                  onClick={() => setGoal("all")}
                >
                  Browse all solutions
                </button>
                {BUSINESS_GOALS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`h-10 rounded-full px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] ${
                      goal === entry.id
                        ? "border border-de-accent bg-transparent text-white"
                        : "border border-white/12 text-white/65 hover:border-white/25 hover:text-white"
                    }`}
                    aria-pressed={goal === entry.id}
                    onClick={() => setGoal(entry.id)}
                    data-testid={`business-goal-${entry.id}`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              {families.length ? (
                <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" data-testid="business-needs-families">
                  {families.map((family) => {
                    const Icon = FAMILY_ICONS[family.id];
                    const included = draft.needs.some((need) => need.familyId === family.id);
                    const leadOutcome = family.offers[0]?.outcomes[0];
                    return (
                      <li key={family.id}>
                        <article
                          className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-[#F7F5F2] text-[#1A1228] transition-transform duration-300 hover:-translate-y-1 ${
                            included ? "ring-1 ring-de-accent" : "ring-1 ring-black/10"
                          }`}
                          data-testid={`family-card-${family.id}`}
                        >
                          <Link href={familyPath(family.id)} className="relative overflow-hidden bg-[#0c0c10] px-5 pb-6 pt-5">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(29,111,242,0.28),transparent_58%)]" aria-hidden="true" />
                            <div className="relative">
                              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/30">
                                <Icon className={`h-5 w-5 ${FAMILY_ACCENTS[family.id]}`} aria-hidden="true" />
                              </span>
                              <h3 className="mt-5 text-xl font-semibold leading-snug tracking-tight text-white">{family.label}</h3>
                            </div>
                          </Link>
                          <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                            <p className="text-[15px] leading-relaxed text-[#4A4556]">{family.description}</p>
                            {leadOutcome ? (
                              <p className="mt-4 text-sm leading-relaxed text-[#1A1228]">
                                <span className="text-de-accent">/</span> {leadOutcome}
                              </p>
                            ) : null}
                            <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                              <Link
                                href={familyPath(family.id)}
                                className="inline-flex h-11 items-center text-sm font-semibold text-[#1A1228] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                              >
                                Explore
                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              </Link>
                              <Button
                                size="sm"
                                className="h-11 min-w-[6.5rem] bg-de-accent px-4 text-sm font-semibold text-white hover:bg-de-accent/90"
                                aria-pressed={included}
                                onClick={() => {
                                  const next = toggleDraftNeed(family.id);
                                  const nowIncluded = next.needs.some((need) => need.familyId === family.id);
                                  toast({
                                    title: nowIncluded ? "Pain / need added" : "Pain / need removed",
                                    description: nowIncluded ? `${family.label} is in Your Solution.` : `${family.label} was removed.`,
                                  });
                                }}
                              >
                                {included ? "Included" : "Add need"}
                              </Button>
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-2xl border border-white/10 px-6 py-14 text-center" role="status">
                  <Search className="mx-auto h-8 w-8 text-white/30" aria-hidden="true" /><h3 className="mt-4 text-xl font-semibold text-white">No matching solution</h3><Button variant="outline" className="mt-5 border-white/20 text-white" onClick={() => setQuery("")}>Clear search</Button>
                </div>
              )}
            </section>
          </div>
        </main>
        <PublicSolutionCart />
        <DigeratiEnhancedFooterSection />
      </div>
    </div>
  );
}
