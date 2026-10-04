import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation } from "wouter";
import {
  Briefcase,
  FileText,
  GraduationCap,
  HardDrive,
  Headphones,
  KeyRound,
  Mail,
  Network,
  Phone,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  type LucideIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Layers,
  Lock,
  PhoneCall,
} from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { useAnnouncer } from "@/components/AccessibleAnnouncer";
import { Door2Frame } from "@/components/store/door2/Door2Frame";
import { SolutionProfileForm } from "@/components/store/SolutionProfileForm";
import { LiveLine, StepLabel, UndoRow } from "@/components/store/door2/primitives";
import { ScenarioTile } from "@/components/store/door2/ScenarioTile";
import { SuggestionLine } from "@/components/store/door2/Guidance";
import { SolutionBar, SolutionRail, type SolutionChromeProps } from "@/components/store/door2/SolutionChrome";
import { IconWell } from "@/components/visual/IconWell";
import { useSEO } from "@/hooks/useSEO";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useStoreReveal } from "@/hooks/useStoreGuidance";
import { useSolutionDraft } from "@/hooks/useSolutionDraft";
import { curatedSolutionFamilies, type CuratedSolutionFamily } from "@/data/curatedSolutions";
import { composeScenario, SCENARIO_GROUPS, solutionScenarios, type ScenarioGroupId, type SolutionScenario } from "@/data/solutionScenarios";
import { BUSINESS_GOALS, familyPath, getFamilyById, SOLUTION_WORKSPACE_PATH, STORE_STEPS, type BusinessGoalId } from "@/lib/businessNeeds";
import { suggestRelationship, type RelationshipSuggestion } from "@/lib/solutionGuidance";
import {
  addDraftNeed,
  dismissHint,
  isProfileComplete,
  patchEnvironment,
  patchSolutionDraft,
  readSolutionDraft,
  removeDraftNeed,
  toggleDraftNeed,
  writeSolutionDraft,
  type SolutionEnvironment,
} from "@/lib/solutionDraft";
import { portalMarketplaceLoginUrl } from "@/lib/portalUrls";
import { PRIMARY_PHONE } from "@shared/companyContact";

/*
 * /store — Enter (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §5.1).
 *
 * One object, Your Solution, assembles as the buyer answers plain questions.
 * This screen recognises the pressure (ten situations), sizes once (the
 * profile strip) and lets the buyer pick what hurts (thirteen families in
 * five goal groups). Every add is in place with a persistent Undo; nothing
 * toasts, nothing moves focus, and the one magenta action is the rail's or
 * bar's "Review Your Solution".
 *
 * Layout: the flagship (Joe, 2026-10-04, concept 4 of
 * artifacts/design-concepts/store-redesign-2026-10, apple.com/iphone grammar):
 * a frosted local nav, a black hero with the thirteen families as one lit
 * object, the situations as a gallery, the profile as a configurator, the
 * families as a lineup beside the rail, a "why DE" carousel and a close.
 */

type FamilyId = CuratedSolutionFamily["id"];

const RELATIONSHIP_HINT_ID = "relationship-suggestion";
const HANDLE_OUR_IT_PATH = "/solutions/proactive-ecosystem";
const SANCTIONED_CLOSE = "No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment.";

/** One electric IconWell per family; the old thirteen hues are retired (§8). */
const FAMILY_ICONS: Record<FamilyId, LucideIcon> = {
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

/** Each goal's families share a finish, so a family reads the same in the hero, a situation card and the lineup. */
type GlyphTone = "electric" | "graphite" | "paper";
const GOAL_TONE: Record<BusinessGoalId, GlyphTone> = {
  productive: "electric",
  protect: "graphite",
  requirements: "paper",
  connect: "electric",
  modernize: "graphite",
};
const FAMILY_GOAL = new Map<string, (typeof BUSINESS_GOALS)[number]>(BUSINESS_GOALS.flatMap((goal) => goal.familyIds.map((id) => [id, goal] as const)));
const FAMILY_ORDER = BUSINESS_GOALS.flatMap((goal) => goal.familyIds);

const GROUP_LABEL: Record<ScenarioGroupId, string> = Object.fromEntries(SCENARIO_GROUPS.map((group) => [group.id, group.heading])) as Record<ScenarioGroupId, string>;

/** Why DE: the protected differentiators only (design/DESIGN-AUTHORITY.md Tier 1), each true of every family. */
const WHY_DE: ReadonlyArray<{ icon: LucideIcon; title: string; line: string; feature?: boolean }> = [
  { icon: Lock, title: "No payment here.", line: "DE confirms package fit, scope, fulfillment and pricing before you commit." },
  { icon: KeyRound, title: "Your Technology. Your Data. Your Keys.", line: "You own the environment, the accounts and the documentation.", feature: true },
  { icon: Layers, title: "Standalone or co-managed.", line: "Every family comes both ways: on its own, or beside your IT team." },
  { icon: ClipboardCheck, title: "Sized from what you have.", line: "Your profile sizes every package. Recommendations start from your counts." },
  { icon: FileText, title: "Everything gets written down.", line: "Documented environments, so nothing walks out the door with one person." },
  { icon: PhoneCall, title: "A person when you need one.", line: `Call ${PRIMARY_PHONE.display}. Happening right now? Say so first.` },
];

/**
 * How DE works with you, in the plan-card pattern (Joe, 2026-10-04). Copy is the workspace's own
 * relationship options and the family compare's lines; the choice itself is still made once, on the
 * workspace, so these cards explain and never select.
 */
const WAYS: ReadonlyArray<{ id: "standalone" | "co_managed" | "unsure"; title: string; line: string; price: string; points: string[] }> = [
  {
    id: "standalone",
    title: "Standalone",
    line: "DE's packaged solution. You, or your IT provider, run it day to day.",
    price: "Standard price",
    points: [
      "DE designs, builds and hands over each package",
      "Set up remotely by DE unless you choose to do it yourself",
      "Implementation or support only when you select it",
      "Every family comes this way",
    ],
  },
  {
    id: "co_managed",
    title: "Co-Managed",
    line: "DE and your IT team share it, by an agreed responsibility split.",
    price: "Preferred pricing",
    points: [
      "DE and your IT team share day-to-day operation",
      "An agreed responsibility split, written down",
      "Preferred pricing where sharing lowers the work, never a blanket price cut",
      "Every family comes this way",
    ],
  },
  {
    id: "unsure",
    title: "Help me choose",
    line: "Submit as-is and DE recommends. You still see both packages.",
    price: "DE confirms",
    points: [
      "Both packages sized from your profile, side by side",
      "DE recommends with the reason shown",
      "Choose once for the whole solution, on the next step",
      "No payment here",
    ],
  },
];

function Glyph({ familyId, tone, className = "" }: { familyId: FamilyId; tone?: GlyphTone | "magenta"; className?: string }) {
  const Icon = FAMILY_ICONS[familyId];
  const finish = tone ?? GOAL_TONE[FAMILY_GOAL.get(familyId)?.id ?? "productive"];
  return (
    <span className={`d2-glyph d2-glyph--${finish} ${className}`} aria-hidden="true">
      <Icon strokeWidth={1.5} />
    </span>
  );
}

function familyLabel(id: string): string {
  return getFamilyById(id)?.label ?? id;
}

function scenarioHint(scenario: SolutionScenario): RelationshipSuggestion | null {
  const hint = scenario.relationship;
  if (hint.suggest === "profile") return null;
  return { value: hint.suggest, reason: hint.reason };
}

/** Everything a buyer might type to find a family: its label, description and the public offer copy. */
const FAMILY_HAYSTACK: Record<FamilyId, string> = Object.fromEntries(
  curatedSolutionFamilies.map((family) => [
    family.id,
    [family.label, family.description, ...family.offers.flatMap((offer) => [offer.name, offer.summary, ...offer.outcomes, ...offer.includes])]
      .join(" ")
      .toLowerCase(),
  ]),
) as Record<FamilyId, string>;

type ScenarioMoment = {
  scenarioId: string;
  added: FamilyId[];
  suggestion: RelationshipSuggestion | null;
};

type FamilyUndo = {
  familyId: FamilyId;
  source?: string;
};

function FamilyCard({
  family,
  included,
  undo,
  onToggle,
  onUndo,
  revealIndex,
}: {
  family: CuratedSolutionFamily;
  included: boolean;
  undo: boolean;
  onToggle: () => void;
  onUndo: () => void;
  revealIndex: number;
}) {
  const lead = family.offers[0]?.outcomes[0];
  // The jelly settle keys on a transient attribute set on the tap, never on the steady aria-pressed state (§9).
  const [justSelected, setJustSelected] = useState(false);
  useEffect(() => {
    if (!justSelected) return;
    const timer = window.setTimeout(() => setJustSelected(false), 340);
    return () => window.clearTimeout(timer);
  }, [justSelected]);
  return (
    <li
      className="d2-fcard"
      data-testid={`family-card-${family.id}`}
      data-state={included ? "added" : "idle"}
      data-d2-reveal=""
      style={{ "--d2-delay": `${(revealIndex % 2) * 70}ms` } as CSSProperties}
    >
      <Glyph familyId={family.id} className="d2-fcard__glyph" />
      <p className="d2-fcard__goal">{FAMILY_GOAL.get(family.id)?.label}</p>
      <h3 className="d2-fcard__title">
        <Link href={familyPath(family.id)}>{family.label}</Link>
      </h3>
      <p className="d2-fcard__detail">{family.description}</p>
      {lead ? (
        <p className="d2-fcard__lead">
          <Check className="h-[18px] w-[18px]" aria-hidden="true" />
          {lead}
        </p>
      ) : null}
      <div className="d2-fcard__acts">
        <button
          type="button"
          className="d2-fcard__add"
          aria-pressed={included}
          onClick={() => {
            setJustSelected(true);
            onToggle();
          }}
          data-de-just-selected={justSelected ? "true" : undefined}
          data-testid={`family-toggle-${family.id}`}
        >
          {included ? "Added ✓" : "Add need"}
        </button>
        {/* The title is the link; this visual repeat stays out of the tab order and the accessibility tree. */}
        <Link href={familyPath(family.id)} className="d2-flag-more" tabIndex={-1} aria-hidden="true">
          Learn more
        </Link>
      </div>
      {undo ? (
        <div className="d2-fcard__undo">
          <UndoRow text={`${family.label} removed`} onUndo={onUndo} testId={`family-undo-${family.id}`} />
        </div>
      ) : null}
    </li>
  );
}

export default function BusinessNeedsIndex() {
  useSEO({
    title: "Solve a Business Need | Digerati Experts",
    description: "Tell Digerati Experts what you have once, pick what needs attention, and hold a sized solution you can send for a real quote.",
    canonical: "/store",
  });

  const draft = useSolutionDraft();
  const { announce } = useAnnouncer();
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();
  useStoreReveal();

  const [query, setQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState<BusinessGoalId | "all">("all");
  const [groupFilter, setGroupFilter] = useState<ScenarioGroupId | "all">("all");
  const galleryRef = useRef<HTMLUListElement>(null);
  const [scenarioMoment, setScenarioMoment] = useState<ScenarioMoment | null>(null);
  const [familyUndo, setFamilyUndo] = useState<FamilyUndo | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [expandKey, setExpandKey] = useState(0);
  const [storageOk, setStorageOk] = useState(true);
  const timers = useRef<number[]>([]);

  // The page keeps working from memory when storage is blocked; it just says so.
  useEffect(() => {
    try {
      const probe = "de-store-probe";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
    } catch {
      setStorageOk(false);
    }
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const familyIds = useMemo(() => draft.needs.map((need) => need.familyId), [draft.needs]);
  const includedIds = useMemo(() => new Set<string>(familyIds), [familyIds]);
  const dismissed = draft.dismissedHints.includes(RELATIONSHIP_HINT_ID);

  /* ---------------------------------------------------------------------- */
  /* Writes — every one in place, announced once, undoable                   */
  /* ---------------------------------------------------------------------- */

  const clearMoments = useCallback(() => {
    setScenarioMoment(null);
    setFamilyUndo(null);
  }, []);

  /** After any add: pulse the count once and open the strip if the profile is still incomplete. Focus never moves. */
  const afterAdd = useCallback(() => {
    setPulseKey((key) => key + 1);
    if (!isProfileComplete(readSolutionDraft().environment)) setExpandKey((key) => key + 1);
  }, []);

  const setProfile = useCallback(<K extends keyof SolutionEnvironment>(key: K, value: SolutionEnvironment[K]) => {
    writeSolutionDraft(patchEnvironment(readSolutionDraft(), { [key]: value }));
  }, []);

  const startScenario = useCallback(
    (scenario: SolutionScenario) => {
      const compose = composeScenario(
        scenario,
        readSolutionDraft().needs.map((need) => need.familyId),
      );
      if (compose.add.length === 0) return;
      clearTimers();
      clearMoments();
      // The composed cells light in sequence (60ms); reduced motion lights them at once.
      compose.add.forEach((familyId, index) => {
        const run = () => addDraftNeed({ familyId, source: scenario.id });
        if (reducedMotion || index === 0) run();
        else timers.current.push(window.setTimeout(run, index * 60));
      });
      setScenarioMoment({ scenarioId: scenario.id, added: compose.add, suggestion: scenarioHint(scenario) });
      afterAdd();
      announce(`Added ${compose.add.map(familyLabel).join(", ")} to Your Solution`);
    },
    [afterAdd, announce, clearMoments, clearTimers, reducedMotion],
  );

  const undoScenario = useCallback(() => {
    if (!scenarioMoment) return;
    clearTimers();
    scenarioMoment.added.forEach((familyId) => removeDraftNeed(familyId));
    announce(`Removed ${scenarioMoment.added.map(familyLabel).join(", ")} from Your Solution`);
    setScenarioMoment(null);
  }, [announce, clearTimers, scenarioMoment]);

  const toggleFamily = useCallback(
    (family: CuratedSolutionFamily) => {
      clearTimers();
      clearMoments();
      const before = readSolutionDraft().needs.find((need) => need.familyId === family.id);
      const next = toggleDraftNeed(family.id);
      const nowIncluded = next.needs.some((need) => need.familyId === family.id);
      if (nowIncluded) {
        afterAdd();
        announce(`${family.label} added to Your Solution`);
      } else {
        setFamilyUndo(before?.source ? { familyId: family.id, source: before.source } : { familyId: family.id });
        announce(`${family.label} removed from Your Solution`);
      }
    },
    [afterAdd, announce, clearMoments, clearTimers],
  );

  const undoRemove = useCallback(() => {
    if (!familyUndo) return;
    addDraftNeed(familyUndo.source ? { familyId: familyUndo.familyId, source: familyUndo.source } : { familyId: familyUndo.familyId });
    setFamilyUndo(null);
    afterAdd();
    announce(`${familyLabel(familyUndo.familyId)} added to Your Solution`);
  }, [afterAdd, announce, familyUndo]);

  /** A suggestion is never applied without this click. */
  const applySuggestion = useCallback((value: RelationshipSuggestion["value"]) => {
    patchSolutionDraft({ deliveryPreference: value, suggestion: { value, accepted: true } });
  }, []);

  const declineSuggestion = useCallback((value: RelationshipSuggestion["value"]) => {
    dismissHint(RELATIONSHIP_HINT_ID);
    patchSolutionDraft({ suggestion: { value, accepted: false } });
  }, []);

  const scrollToProfile = useCallback(() => {
    setExpandKey((key) => key + 1);
    // html carries scroll-padding-top for the fixed nav, so a plain scrollIntoView lands clear of it.
    document.getElementById("profile")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, [reducedMotion]);

  /* ---------------------------------------------------------------------- */
  /* Suggestions — shown with their reason; Use this / Not now              */
  /* ---------------------------------------------------------------------- */

  const suggestionUsed = (value: RelationshipSuggestion["value"]) =>
    draft.deliveryPreference === value && draft.suggestion?.accepted === true;
  const suggestionVisible = (suggestion: RelationshipSuggestion | null): suggestion is RelationshipSuggestion =>
    suggestion !== null && !dismissed && (draft.deliveryPreference === "" || suggestionUsed(suggestion.value));

  const profileSuggestion = suggestRelationship(draft.environment);
  const profileSuggestionSlot = suggestionVisible(profileSuggestion) ? (
    <SuggestionLine
      suggestion={profileSuggestion}
      used={suggestionUsed(profileSuggestion.value)}
      onUse={() => applySuggestion(profileSuggestion.value)}
      onDecline={() => declineSuggestion(profileSuggestion.value)}
    />
  ) : null;

  const scenarioSuggestion = scenarioMoment?.suggestion ?? null;
  const renderScenarioSuggestion = (testId: string) =>
    suggestionVisible(scenarioSuggestion) ? (
      <SuggestionLine
        suggestion={scenarioSuggestion}
        source="Suggested for this situation"
        used={suggestionUsed(scenarioSuggestion.value)}
        onUse={() => applySuggestion(scenarioSuggestion.value)}
        onDecline={() => declineSuggestion(scenarioSuggestion.value)}
        testId={testId}
      />
    ) : null;

  /* ---------------------------------------------------------------------- */
  /* Families — one goal at a time (or all), plus search                     */
  /* ---------------------------------------------------------------------- */

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const families = useMemo(
    () =>
      FAMILY_ORDER.filter((id) => goalFilter === "all" || FAMILY_GOAL.get(id)?.id === goalFilter)
        .map((id) => getFamilyById(id))
        .filter((family): family is CuratedSolutionFamily => family !== null && (!needle || FAMILY_HAYSTACK[family.id].includes(needle))),
    [goalFilter, needle],
  );
  const total = families.length;
  const narrowed = searching || goalFilter !== "all";
  const countText = !narrowed ? `${total} solutions shown` : total === 1 ? "1 solution matches" : `${total} solutions match`;

  // The count line is plain text; the page's one live region hears it after the buyer pauses typing.
  useEffect(() => {
    if (!searching) return undefined;
    const timer = window.setTimeout(() => announce(total === 0 ? `Nothing matches ${query.trim()}` : countText), 600);
    return () => window.clearTimeout(timer);
  }, [announce, countText, query, searching, total]);

  const showAll = () => {
    setQuery("");
    setGoalFilter("all");
  };

  const scenarios = groupFilter === "all" ? solutionScenarios : solutionScenarios.filter((scenario) => scenario.group === groupFilter);
  const page = (direction: 1 | -1) => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    gallery.scrollBy({ left: direction * Math.max(320, gallery.clientWidth * 0.8), behavior: reducedMotion ? "auto" : "smooth" });
  };

  /* ---------------------------------------------------------------------- */
  /* Chrome                                                                  */
  /* ---------------------------------------------------------------------- */

  const chrome: SolutionChromeProps = {
    mode: "review",
    draft,
    help: null,
    primary: {
      label: "Review Your Solution",
      href: SOLUTION_WORKSPACE_PATH,
      disabled: draft.needs.length === 0,
      reason: "Add at least one need",
    },
    suggestion: renderScenarioSuggestion("rail-suggestion"),
    pulseKey,
    emptyText: "Nothing added yet. Start from a situation or add a need.",
    onEditProfile: scrollToProfile,
    compactVariant: "primary",
  };

  const momentScenario = scenarioMoment ? solutionScenarios.find((scenario) => scenario.id === scenarioMoment.scenarioId) ?? null : null;
  const needCount = draft.needs.length;
  const sculpture = [...FAMILY_ORDER, null, null, null] as Array<FamilyId | null>;

  return (
    <Door2Frame intensity={0.44} jelly>
      <MegaMenu />
      <main id="main-content" tabIndex={-1} className="d2-flag de-nav-clear">
        <div className="d2-flag-lnav" role="region" aria-label="Store">
          <div className="d2-flag-wrap d2-flag-lnav__row">
            <p className="d2-flag-lnav__title">Store</p>
            <nav className="d2-flag-lnav__links" aria-label="Store sections">
              <a href="#situations">Situations</a>
              <a href="#profile">Size it</a>
              <a href="#families">Families</a>
              <a href="#ways">How it works</a>
              <a href="#why">Why DE</a>
            </nav>
            <Link href={SOLUTION_WORKSPACE_PATH} className="d2-flag-lnav__solution" data-testid="store-local-solution">
              Your Solution
              <span className="d2-flag-lnav__count" aria-label={needCount === 1 ? "1 need" : `${needCount} needs`}>
                {needCount}
              </span>
            </Link>
          </div>
        </div>

        <header className="d2-flag-hero" data-testid="store-enter">
          <div className="d2-flag-wrap d2-flag-hero__grid">
            <div className="min-w-0">
              <StepLabel>SOLVE A BUSINESS NEED</StepLabel>
              <h1 className="d2-flag-hero__title" data-testid="heading-business-needs">
                Start with your business. <span>Then solve what hurts.</span>
              </h1>
              <p className="d2-flag-hero__lede">
                <strong>Tell us what you have once.</strong> Pick what needs attention. DE sizes a solution you can send for a real quote.
              </p>
              <div className="d2-flag-hero__ctas">
                <a href="#situations" className="d2-action d2-action--primary">
                  Start from a situation
                </a>
                <a href="#profile" className="d2-flag-more">
                  Size it to your business
                </a>
              </div>
              <nav aria-label="Pathways" className="d2-flag-hero__paths d2-small" data-testid="pathways">
                No payment here. Want DE to run all of IT?{" "}
                <Link href={HANDLE_OUR_IT_PATH} className="d2-link" data-testid="link-handle-our-it">
                  Handle Our IT
                </Link>{" "}
                · Already a client?{" "}
                <a href={portalMarketplaceLoginUrl()} className="d2-link" data-testid="link-client-marketplace">
                  Client Marketplace
                </a>
              </nav>
              {!storageOk ? (
                <LiveLine className="mt-4" testId="storage-line">
                  Not saving on this device
                </LiveLine>
              ) : null}
            </div>
            <div className="d2-sculpt" aria-hidden="true">
              <div className="d2-sculpt__plane">
                {sculpture.map((id, index) =>
                  id ? (
                    <span key={id} className="d2-sculpt__cell" style={{ "--z": `${(index * 37) % 60}px`, "--dl": `${-(index * 0.7)}s` } as CSSProperties}>
                      <Glyph familyId={id} tone={index === 6 ? "magenta" : undefined} />
                    </span>
                  ) : (
                    <span key={`empty-${index}`} className="d2-sculpt__cell d2-sculpt__cell--empty" />
                  ),
                )}
              </div>
            </div>
          </div>
        </header>

        <section id="situations" className="d2-flag-sec d2-flag-sec--mist d2-light" aria-labelledby="situations-heading" data-testid="store-situations">
          <div className="d2-flag-wrap">
            <div className="d2-flag-head" data-d2-reveal="">
              <h2 id="situations-heading" className="d2-flag-head__title">
                <span className="sr-only">{STORE_STEPS[1].sr}: </span>
                Start from a situation. <span>Pick the one that sounds like you.</span>
              </h2>
              <p className="d2-flag-head__aside">It adds the needs that situation calls for, and you can undo.</p>
            </div>
            <div className="d2-flag-seg" role="group" aria-label="Situation groups">
              <button type="button" aria-pressed={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
                All situations
              </button>
              {SCENARIO_GROUPS.map((group) => (
                <button key={group.id} type="button" aria-pressed={groupFilter === group.id} onClick={() => setGroupFilter(group.id)}>
                  {group.heading}
                </button>
              ))}
            </div>
            <ul className="d2-gallery" ref={galleryRef} aria-label="Situations" tabIndex={0}>
              {scenarios.map((scenario, index) => (
                <ScenarioTile
                  key={scenario.id}
                  scenario={scenario}
                  compose={composeScenario(scenario, familyIds)}
                  onStart={startScenario}
                  onReview={() => navigate(SOLUTION_WORKSPACE_PATH)}
                  revealIndex={index}
                  variant="card"
                  groupLabel={GROUP_LABEL[scenario.group]}
                  tone={scenario.group === "now" ? "urgent" : index % 2 ? "white" : "black"}
                  art={scenario.familyIds.map((id) => (
                    <Glyph key={id} familyId={id} className="d2-gcard__glyph" />
                  ))}
                  footer={
                    scenario.group === "now" ? (
                      <>
                        Happening now?{" "}
                        <a href={PRIMARY_PHONE.telHref} aria-label={`Call ${PRIMARY_PHONE.display} (${PRIMARY_PHONE.label})`}>
                          Call {PRIMARY_PHONE.display}
                        </a>
                      </>
                    ) : undefined
                  }
                />
              ))}
            </ul>
            <div className="d2-flag-paddles">
              <button type="button" className="d2-flag-paddle" aria-label="Previous situations" onClick={() => page(-1)}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" className="d2-flag-paddle" aria-label="Next situations" onClick={() => page(1)}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {scenarioMoment ? (
              <div className="d2-flag-moment" data-testid="scenario-moment">
                <UndoRow text={`Added ${scenarioMoment.added.map(familyLabel).join(", ")}`} onUndo={undoScenario} testId="scenario-undo" />
                <ul className="d2-rows d2-small d2-ink-soft mt-2" data-testid="scenario-why">
                  {scenarioMoment.added.map((familyId) => (
                    <li key={familyId}>
                      <span className="d2-ink-strong">{familyLabel(familyId)}</span> · {momentScenario?.why[familyId] ?? ""}
                    </li>
                  ))}
                </ul>
                {renderScenarioSuggestion("scenario-suggestion")}
              </div>
            ) : null}
          </div>
        </section>

        <section id="profile" className="d2-flag-sec d2-light" aria-labelledby="profile-heading" data-testid="store-profile">
          <div className="d2-flag-wrap d2-flag-config">
            <div data-d2-reveal="">
              <p className="d2-flag-eyebrow">{STORE_STEPS[0].sr}</p>
              <h2 id="profile-heading" className="d2-flag-head__title">
                Size it once. <span>Every package follows.</span>
              </h2>
              <p className="d2-flag-config__lede">Four counts and two facts. Skip for now if you like; it is needed before you submit.</p>
            </div>
            <div className="d2-flag-config__form">
              <SolutionProfileForm
                environment={draft.environment}
                onChange={setProfile}
                heading="Your counts"
                headingLevel={3}
                description="Users, computers, mobile devices and sites, then who owns the devices and who does IT."
                expandKey={expandKey}
                collapsible={false}
                dials
                suggestionSlot={profileSuggestionSlot}
              />
            </div>
          </div>
        </section>

        <section id="families" className="d2-flag-sec d2-flag-sec--mist d2-light" aria-labelledby="families-heading" data-testid="business-needs-families">
          <div className="d2-flag-wrap">
            <div className="d2-flag-head" data-d2-reveal="">
              <h2 id="families-heading" className="d2-flag-head__title">
                Explore the families. <span>Thirteen ways to fix what hurts.</span>
              </h2>
              <p className="d2-flag-head__aside">Open one for the full package, or add it from here.</p>
            </div>
            <div className="d2-flag-tools">
              <div className="d2-flag-seg" role="group" aria-label="Business goals">
                <button type="button" aria-pressed={goalFilter === "all"} onClick={() => setGoalFilter("all")} data-testid="business-goal-all">
                  All
                </button>
                {BUSINESS_GOALS.map((goal) => (
                  <button key={goal.id} type="button" aria-pressed={goalFilter === goal.id} onClick={() => setGoalFilter(goal.id)} data-testid={`business-goal-${goal.id}`}>
                    {goal.label}
                  </button>
                ))}
              </div>
              <label className="d2-flag-search">
                <span className="sr-only">Search needs</span>
                <input
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search needs"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  data-testid="families-search"
                />
              </label>
            </div>
            <LiveLine className="mt-1" testId="families-count">
              {total === 0 ? (
                <>
                  Nothing matches{searching ? ` “${query.trim()}”` : ""}.{" "}
                  <button type="button" className="d2-action d2-action--quiet" onClick={showAll}>
                    Show all
                  </button>
                </>
              ) : (
                countText
              )}
            </LiveLine>
            <div className="d2-flag-shop">
              <ul className="d2-lineup">
                {families.map((family, index) => (
                  <FamilyCard
                    key={family.id}
                    family={family}
                    included={includedIds.has(family.id)}
                    undo={familyUndo?.familyId === family.id}
                    onToggle={() => toggleFamily(family)}
                    onUndo={undoRemove}
                    revealIndex={index}
                  />
                ))}
                <li className="d2-fcard d2-fcard--help" data-d2-reveal="">
                  <span className="d2-glyph d2-glyph--magenta d2-fcard__glyph" aria-hidden="true">
                    <PhoneCall strokeWidth={1.5} />
                  </span>
                  <h3 className="d2-fcard__title">Not sure which one?</h3>
                  <p className="d2-fcard__detail">Tell us what is going on and DE points you at the right families.</p>
                  <div className="d2-fcard__acts">
                    <a href={PRIMARY_PHONE.telHref} className="d2-fcard__add" aria-label={`Call ${PRIMARY_PHONE.display} (${PRIMARY_PHONE.label})`}>
                      Call {PRIMARY_PHONE.display}
                    </a>
                  </div>
                </li>
              </ul>
              <SolutionRail {...chrome} />
            </div>
            <p className="d2-small d2-ink-soft d2-measure mt-10" data-testid="store-close">
              {SANCTIONED_CLOSE}
            </p>
          </div>
        </section>

        <section id="ways" className="d2-flag-sec d2-flag-sec--dark" aria-labelledby="ways-heading">
          <div className="d2-flag-wrap">
            <div className="d2-flag-head" data-d2-reveal="">
              <h2 id="ways-heading" className="d2-flag-head__title">
                Choose how DE works with you. <span>Once, for the whole solution.</span>
              </h2>
              <p className="d2-flag-head__aside">Every family comes both ways. You pick on the next step, with every package in front of you.</p>
            </div>
            <ul className="d2-plans">
              {WAYS.map((way, index) => {
                const suggested = profileSuggestion?.value === way.id;
                return (
                  <li
                    key={way.id}
                    className={`d2-plan${suggested ? " d2-plan--suggested" : ""}`}
                    data-testid={`way-${way.id}`}
                    data-d2-reveal=""
                    style={{ "--d2-delay": `${index * 70}ms` } as CSSProperties}
                  >
                    {suggested ? <p className="d2-plan__ribbon">Suggested from your profile</p> : null}
                    <div className="d2-plan__head">
                      <h3 className="d2-plan__title">{way.title}</h3>
                      <p className="d2-plan__line">{way.line}</p>
                    </div>
                    <div className="d2-plan__price">
                      <p className="d2-plan__amount">{way.price}</p>
                      {suggested && profileSuggestion ? <p className="d2-plan__why">{profileSuggestion.reason}</p> : null}
                      <a href="#situations" className={`d2-plan__cta${suggested || (!profileSuggestion && index === 0) ? " d2-plan__cta--solid" : ""}`}>
                        Start from a situation
                      </a>
                    </div>
                    <div className="d2-plan__body">
                      <p className="d2-plan__kicker">What it means</p>
                      <ul className="d2-plan__points">
                        {way.points.map((point) => (
                          <li key={point}>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="why" className="d2-flag-sec" aria-labelledby="why-heading">
          <div className="d2-flag-wrap">
            <div className="d2-flag-head" data-d2-reveal="">
              <h2 id="why-heading" className="d2-flag-head__title">
                Why DE is the place to solve it. <span>No catalog games.</span>
              </h2>
            </div>
            <ul className="d2-why" aria-label="Why DE" tabIndex={0}>
              {WHY_DE.map((item, index) => (
                <li key={item.title} className={`d2-why__card${item.feature ? " d2-why__card--feature" : ""}`} data-d2-reveal="" style={{ "--d2-delay": `${(index % 3) * 70}ms` } as CSSProperties}>
                  <span className="d2-why__icon" aria-hidden="true">
                    <item.icon className="h-[22px] w-[22px]" />
                  </span>
                  <h3 className="d2-why__title">{item.title}</h3>
                  <p className="d2-why__line">{item.line}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="d2-flag-close d2-light" aria-labelledby="close-heading">
          <div className="d2-flag-wrap" data-d2-reveal="">
            <h2 id="close-heading" className="d2-flag-close__title">
              Not sure where to start?
            </h2>
            <p className="d2-flag-close__lede">Pick the situation closest to yours. It adds the right needs, and you can undo anything.</p>
            <div className="d2-flag-close__ctas">
              <a href="#situations" className="d2-flag-pill">
                Start from a situation
              </a>
              <a href={PRIMARY_PHONE.telHref} className="d2-flag-more" aria-label={`Talk to DE: call ${PRIMARY_PHONE.display} (${PRIMARY_PHONE.label})`}>
                Talk to DE · {PRIMARY_PHONE.display}
              </a>
            </div>
          </div>
        </section>
      </main>
      <SolutionBar {...chrome} />
      <DigeratiEnhancedFooterSection variant="store" />
    </Door2Frame>
  );
}
