import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { useAnnouncer } from "@/components/AccessibleAnnouncer";
import { Door2Frame } from "@/components/store/door2/Door2Frame";
import { SolutionProfileForm } from "@/components/store/SolutionProfileForm";
import { GridCell, HairGrid, LiveLine, StepLabel, StoreChapter, UndoRow } from "@/components/store/door2/primitives";
import { ScenarioTile } from "@/components/store/door2/ScenarioTile";
import { SuggestionLine } from "@/components/store/door2/Guidance";
import { SolutionBar, SolutionRail, type SolutionChromeProps } from "@/components/store/door2/SolutionChrome";
import { IconWell } from "@/components/visual/IconWell";
import { useSEO } from "@/hooks/useSEO";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMinWidth, useSolutionDraft } from "@/hooks/useSolutionDraft";
import { curatedSolutionFamilies, type CuratedSolutionFamily } from "@/data/curatedSolutions";
import { composeScenario, solutionScenarios, type SolutionScenario } from "@/data/solutionScenarios";
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

/** The three situations where someone may be mid-incident carry the phone in flow (§5.1 region 5). */
const INCIDENT_SCENARIOS = new Set(["phishing-close-call", "ransomware-recovery", "it-person-left"]);

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

function FamilyCell({
  family,
  included,
  undo,
  onToggle,
  onUndo,
}: {
  family: CuratedSolutionFamily;
  included: boolean;
  undo: boolean;
  onToggle: () => void;
  onUndo: () => void;
}) {
  const Icon = FAMILY_ICONS[family.id];
  const lead = family.offers[0]?.outcomes[0];
  // The jelly settle keys on a transient attribute set on the tap, never on the steady aria-pressed state (§9).
  const [justSelected, setJustSelected] = useState(false);
  useEffect(() => {
    if (!justSelected) return;
    const timer = window.setTimeout(() => setJustSelected(false), 340);
    return () => window.clearTimeout(timer);
  }, [justSelected]);
  return (
    <GridCell
      as="li"
      testId={`family-card-${family.id}`}
      state={included ? "added" : "idle"}
      label={<IconWell icon={Icon} size="sm" />}
      title={family.label}
      href={familyPath(family.id)}
      detail={family.description}
      clampDetail
      className="d2-cell--row"
    >
      {lead ? <p className="d2-cell__lead d2-small d2-ink d2-clamp-2 w-full">{lead}</p> : null}
      <button
        type="button"
        className="d2-toggle"
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
      {undo ? (
        <div className="w-full">
          <UndoRow text={`${family.label} removed`} onUndo={onUndo} testId={`family-undo-${family.id}`} />
        </div>
      ) : null}
    </GridCell>
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
  const twoColumns = useMinWidth(640);
  const groupsOpenByWidth = useMinWidth(768);

  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<BusinessGoalId>>(() => new Set());
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
  /* Families — five goal groups, search, disclosures under 768             */
  /* ---------------------------------------------------------------------- */

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const groups = useMemo(
    () =>
      BUSINESS_GOALS.map((goal) => ({
        goal,
        families: goal.familyIds
          .map((id) => getFamilyById(id))
          .filter((family): family is CuratedSolutionFamily => family !== null && (!needle || FAMILY_HAYSTACK[family.id].includes(needle))),
      })),
    [needle],
  );
  const total = groups.reduce((sum, group) => sum + group.families.length, 0);
  const countText = !searching ? `${total} solutions shown` : total === 1 ? "1 solution matches" : `${total} solutions match`;

  // The count line is plain text; the page's one live region hears it after the buyer pauses typing.
  useEffect(() => {
    if (!searching) return undefined;
    const timer = window.setTimeout(() => announce(total === 0 ? `Nothing matches ${query.trim()}` : countText), 600);
    return () => window.clearTimeout(timer);
  }, [announce, countText, query, searching, total]);

  const disclosureIds = useMemo(() => BUSINESS_GOALS.slice(1).map((goal) => goal.id), []);
  const allShown = !searching && (groupsOpenByWidth || openGroups.size === disclosureIds.length);

  const showAll = () => {
    setQuery("");
    setOpenGroups(new Set(disclosureIds));
  };
  const toggleAll = () => {
    if (searching || groupsOpenByWidth) {
      showAll();
      return;
    }
    setOpenGroups(allShown ? new Set() : new Set(disclosureIds));
  };
  const setGroupOpen = (id: BusinessGoalId, open: boolean) => {
    setOpenGroups((current) => {
      if (current.has(id) === open) return current;
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
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

  const momentIndex = scenarioMoment ? solutionScenarios.findIndex((scenario) => scenario.id === scenarioMoment.scenarioId) : -1;
  const momentScenario = momentIndex >= 0 ? solutionScenarios[momentIndex] : null;
  // The Undo row spans the grid, so it sits under the row that holds the tapped tile and nothing shifts.
  const undoAfterIndex =
    momentIndex < 0 ? -1 : Math.min(solutionScenarios.length - 1, twoColumns ? Math.floor(momentIndex / 2) * 2 + 1 : momentIndex);

  return (
    <Door2Frame intensity={0.44} jelly>
      <MegaMenu />
          <main className="d2-main de-nav-clear">
            <header className="d2-chapter d2-chapter--first" data-testid="store-enter">
              <StepLabel>SOLVE A BUSINESS NEED</StepLabel>
              <h1 className="d2-display d2-measure" data-testid="heading-business-needs">
                Start with your business. Then solve what hurts.
              </h1>
              <p className="d2-lede d2-ink d2-measure mt-5">
                Tell us what you have once. Pick what needs attention. DE sizes a solution you can send for a real quote. No payment here.
              </p>
              <nav aria-label="Pathways" className="d2-pathways" data-testid="pathways">
                <div className="d2-pathways__row">
                  <p className="d2-pathways__item">
                    <span className="d2-pathways__mark d2-label" aria-hidden="true">A</span>
                    <Link href={HANDLE_OUR_IT_PATH} data-testid="link-handle-our-it">Handle Our IT</Link>
                    <span className="d2-pathways__kind d2-small">One accountable team for the technology.</span>
                  </p>
                  <p className="d2-pathways__item">
                    <span className="d2-pathways__mark d2-label" aria-hidden="true">B</span>
                    <span aria-current="page">Solve a Business Need · You are here</span>
                    <span className="d2-pathways__kind d2-small">Something specific is in the way. A package with a start and an end.</span>
                  </p>
                  <p className="d2-pathways__item">
                    <span className="d2-pathways__mark d2-label" aria-hidden="true">C</span>
                    <a href={portalMarketplaceLoginUrl()} data-testid="link-client-marketplace">Client Marketplace</a>
                    <span className="d2-pathways__kind d2-small">Already a client? Continue in the Client Marketplace.</span>
                  </p>
                </div>
                <p className="d2-pathways__sentence d2-small">
                  Want DE to run all of IT?{" "}
                  <Link href={HANDLE_OUR_IT_PATH} className="d2-link">Handle Our IT</Link> · Already a client?{" "}
                  <a href={portalMarketplaceLoginUrl()} className="d2-link">Client Marketplace</a>
                </p>
              </nav>
              {!storageOk ? (
                <LiveLine className="mt-6" testId="storage-line">
                  Not saving on this device
                </LiveLine>
              ) : null}
            </header>

            <div className="d2-layout">
              <div className="min-w-0">
                <StoreChapter id="profile" n="01" eyebrow="Profile" srText={STORE_STEPS[0].sr} testId="store-profile">
                  <SolutionProfileForm
                    environment={draft.environment}
                    onChange={setProfile}
                    headingLevel={2}
                    description="Four counts and two facts. Then every package sizes itself. Skip for now if you like; it is needed before you submit."
                    expandKey={expandKey}
                    suggestionSlot={profileSuggestionSlot}
                  />
                </StoreChapter>

                <StoreChapter
                  id="situations"
                  n="02"
                  eyebrow="Pain or need"
                  srText={STORE_STEPS[1].sr}
                  heading="Start from a situation"
                  lede="Pick the one that sounds like you. It adds the needs that situation calls for, and you can undo."
                  testId="store-situations"
                >
                  <HairGrid cols={2} as="ul" className="mt-8">
                    {solutionScenarios.map((scenario, index) => (
                      <Fragment key={scenario.id}>
                        <ScenarioTile
                          scenario={scenario}
                          compose={composeScenario(scenario, familyIds)}
                          onStart={startScenario}
                          onReview={() => navigate(SOLUTION_WORKSPACE_PATH)}
                          footer={
                            INCIDENT_SCENARIOS.has(scenario.id) ? (
                              <>
                                Happening right now?{" "}
                                <a href={PRIMARY_PHONE.telHref} className="d2-link" aria-label={`Call ${PRIMARY_PHONE.display} (${PRIMARY_PHONE.label})`}>
                                  Call {PRIMARY_PHONE.display}
                                </a>
                              </>
                            ) : undefined
                          }
                        />
                        {scenarioMoment && index === undoAfterIndex ? (
                          <li className="min-w-0 d2-grid__span" data-testid="scenario-moment">
                            <UndoRow text={`Added ${scenarioMoment.added.map(familyLabel).join(", ")}`} onUndo={undoScenario} testId="scenario-undo" />
                            <ul className="d2-rows d2-small d2-ink-soft mt-2" data-testid="scenario-why">
                              {scenarioMoment.added.map((familyId) => (
                                <li key={familyId}>
                                  <span className="d2-ink-strong">{familyLabel(familyId)}</span> · {momentScenario?.why[familyId] ?? ""}
                                </li>
                              ))}
                            </ul>
                            {renderScenarioSuggestion("scenario-suggestion")}
                          </li>
                        ) : null}
                      </Fragment>
                    ))}
                  </HairGrid>
                </StoreChapter>


                <StoreChapter
                  id="families"
                  n="02"
                  eyebrow="Pain or need"
                  srText={STORE_STEPS[1].sr}
                  heading="Or pick a family"
                  lede="Thirteen families, grouped by what you are trying to do. Open one for the full package, or add it from here."
                  testId="business-needs-families"
                >
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Business goals">
                      <button type="button" className="d2-toggle" aria-pressed={allShown} onClick={toggleAll} data-testid="business-goal-all">
                        All
                      </button>
                      {BUSINESS_GOALS.map((goal) => (
                        <a
                          key={goal.id}
                          href={`#goal-${goal.id}`}
                          className="d2-toggle"
                          onClick={() => setGroupOpen(goal.id, true)}
                          data-testid={`business-goal-${goal.id}`}
                        >
                          {goal.label}
                        </a>
                      ))}
                    </div>
                    <label className="d2-field d2-search">
                      <span className="sr-only">Search needs</span>
                      <input
                        className="d2-input"
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

                  <LiveLine className="mt-4" testId="families-count">
                    {searching && total === 0 ? (
                      <>
                        Nothing matches “{query.trim()}”.{" "}
                        <button type="button" className="d2-action d2-action--quiet" onClick={() => setQuery("")}>
                          Clear search
                        </button>{" "}
                        ·{" "}
                        <button type="button" className="d2-action d2-action--quiet" onClick={showAll}>
                          Show all
                        </button>
                      </>
                    ) : (
                      countText
                    )}
                  </LiveLine>

                  {groups.map(({ goal, families }, index) => {
                    if (families.length === 0) return null;
                    const headingId = `goal-${goal.id}`;
                    const cells = (
                      <HairGrid cols={4} as="ul" className="d2-grid--rows mt-4">
                        {families.map((family) => (
                          <FamilyCell
                            key={family.id}
                            family={family}
                            included={includedIds.has(family.id)}
                            undo={familyUndo?.familyId === family.id}
                            onToggle={() => toggleFamily(family)}
                            onUndo={undoRemove}
                          />
                        ))}
                      </HairGrid>
                    );
                    const disclosed = index > 0 && !groupsOpenByWidth && !searching;
                    if (disclosed) {
                      return (
                        <details
                          key={goal.id}
                          className="d2-group"
                          open={openGroups.has(goal.id)}
                          onToggle={(event) => setGroupOpen(goal.id, event.currentTarget.open)}
                          data-testid={`goal-group-${goal.id}`}
                        >
                          <summary>
                            <h3 id={headingId} className="d2-h3">
                              {goal.label}
                            </h3>
                          </summary>
                          {cells}
                        </details>
                      );
                    }
                    return (
                      <section key={goal.id} className="d2-group" aria-labelledby={headingId} data-testid={`goal-group-${goal.id}`}>
                        <h3 id={headingId} className="d2-h3">
                          {goal.label}
                        </h3>
                        {cells}
                      </section>
                    );
                  })}
                </StoreChapter>

                <p className="d2-chapter d2-small d2-ink-soft d2-measure" data-testid="store-close">
                  {SANCTIONED_CLOSE}
                </p>
              </div>

              <SolutionRail {...chrome} />
            </div>
          </main>
      <SolutionBar {...chrome} />
      <DigeratiEnhancedFooterSection variant="store" />
    </Door2Frame>
  );
}
