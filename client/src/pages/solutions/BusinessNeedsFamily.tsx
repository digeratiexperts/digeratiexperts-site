import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import NotFound from "@/pages/not-found";
import { useSEO } from "@/hooks/useSEO";
import { useAnnouncer } from "@/components/AccessibleAnnouncer";
import { useMinWidth, useSolutionDraft } from "@/hooks/useSolutionDraft";
import { Door2Frame } from "@/components/store/door2/Door2Frame";
import { ProfileLine, SolutionProfileForm } from "@/components/store/SolutionProfileForm";
import { HelpRow, StepLabel, StoreAction, StoreChapter, UndoRow } from "@/components/store/door2/primitives";
import { RelationshipCompare } from "@/components/store/door2/RelationshipCompare";
import { CoverageChips } from "@/components/store/door2/Coverage";
import { SolutionBar, SolutionRail, type SolutionChromeProps, type SolutionPrimary } from "@/components/store/door2/SolutionChrome";
import {
  BUSINESS_NEEDS_INDEX_PATH,
  familyPath,
  getFamilyBySlug,
  SOLUTION_WORKSPACE_PATH,
  STORE_STEPS,
  type CuratedSolutionFamily,
} from "@/lib/businessNeeds";
import {
  addDraftNeed,
  isProfileComplete,
  patchEnvironment,
  readSolutionDraft,
  removeDraftNeed,
  writeSolutionDraft,
  type SolutionEnvironment,
} from "@/lib/solutionDraft";
import { buildSolutionPackage, installModeDetail, sortInstallModes } from "@/lib/solutionPackage";
import { solutionAdvisorSeed, suggestRelationship } from "@/lib/solutionGuidance";

/*
 * B · Compare (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §5.2). One family under
 * both relationships, sized from the one profile, before any commercial
 * choice. The page never asks for the relationship: that control lives once
 * on the workspace. Add is never gated.
 */

const HANDLE_OUR_IT_PATH = "/solutions/proactive-ecosystem";
const RELATIONSHIP_SUGGESTION_HINT = "relationship-suggestion";
const MAX_OUTCOMES = 3;

const PRIMARY_ADD = "Add & review package";
const PRIMARY_ADDED = "Added ✓ · Review Your Solution";
const SECONDARY_ADD = "Add and keep browsing";
const SECONDARY_REMOVE = "Remove from Your Solution";

const COMPARE_HEADING = "Two ways to have it. Same package, different hands on it.";
const NO_SUGGESTION_LINE = "Not sure? Help me choose is a real option on the next step.";
const DELIVERY_HEADING = "Delivery & Setup for this package";
const DELIVERY_RULE = "DE's rule: remote first, shipped second, on-site only when nothing else will do.";
const FIRST_CHOICE_TAG = "DE's first choice";
const COVERAGE_HEADING = "Where this sits in DE's eight security blocks";
const HONESTY_LINE =
  "Standalone never means DE runs your IT. It means DE builds this and you, or your IT provider, run it day to day.";

/** The standalone offer's outcomes first, then anything co-managed adds; unique; at most three. */
function familyOutcomes(family: CuratedSolutionFamily): string[] {
  const standalone = family.offers.find((offer) => offer.deliveryModel === "standalone");
  const coManaged = family.offers.find((offer) => offer.deliveryModel === "co_managed");
  const seen = new Set<string>();
  const outcomes: string[] = [];
  for (const item of [...(standalone?.outcomes ?? []), ...(coManaged?.outcomes ?? [])]) {
    if (seen.has(item)) continue;
    seen.add(item);
    outcomes.push(item);
    if (outcomes.length === MAX_OUTCOMES) break;
  }
  return outcomes;
}

export default function BusinessNeedsFamily() {
  const params = useParams<{ family?: string }>();
  const family = getFamilyBySlug(params.family || "");
  const [, navigate] = useLocation();
  const draft = useSolutionDraft();
  const { announce } = useAnnouncer();
  const wide = useMinWidth(1024);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileExpandKey, setProfileExpandKey] = useState(0);
  const [undoPending, setUndoPending] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  useSEO(
    family
      ? {
          title: `${family.label} | Store | Digerati Experts`,
          description: family.description,
          canonical: familyPath(family.id),
        }
      : {
          title: "Page not found",
          description: "That solution family is not published.",
          noIndex: true,
        },
  );

  const environment = draft.environment;
  const sized = isProfileComplete(environment);
  const included = family ? draft.needs.some((need) => need.familyId === family.id) : false;
  const suggestionDismissed = draft.dismissedHints.includes(RELATIONSHIP_SUGGESTION_HINT);
  const suggestion = suggestionDismissed ? null : suggestRelationship(environment);

  const standaloneView = useMemo(
    () => (family ? buildSolutionPackage(family, "standalone", environment) : null),
    [family, environment],
  );
  const outcomes = useMemo(() => (family ? familyOutcomes(family) : []), [family]);
  const helpSeed = useMemo(
    () => solutionAdvisorSeed(draft, family ? { familyLabel: family.label } : {}),
    [draft, family],
  );

  const setEnvironmentField = useCallback(
    <K extends keyof SolutionEnvironment>(key: K, value: SolutionEnvironment[K]) => {
      const patch: Partial<SolutionEnvironment> = {};
      patch[key] = value;
      writeSolutionDraft(patchEnvironment(readSolutionDraft(), patch));
    },
    [],
  );

  const openProfile = useCallback(() => {
    setProfileOpen(true);
    setProfileExpandKey((key) => key + 1);
  }, []);

  if (!family || !standaloneView) {
    return <NotFound />;
  }

  const addNeed = () => {
    addDraftNeed({ familyId: family.id });
    setUndoPending(false);
    setPulseKey((key) => key + 1);
  };

  const addAndReview = () => {
    addNeed();
    navigate(SOLUTION_WORKSPACE_PATH);
  };

  const addAndStay = () => {
    addNeed();
    announce(`${family.label} added to Your Solution`);
  };

  const removeNeed = () => {
    removeDraftNeed(family.id);
    setUndoPending(true);
    announce(`${family.label} removed from Your Solution`);
  };

  const undoRemove = () => {
    addNeed();
    announce(`${family.label} added back to Your Solution`);
  };

  const primary: SolutionPrimary = included
    ? { label: PRIMARY_ADDED, href: SOLUTION_WORKSPACE_PATH }
    : { label: PRIMARY_ADD, onClick: addAndReview };

  const chrome: SolutionChromeProps = {
    mode: "review",
    draft,
    primary,
    help: { seed: helpSeed, askLabel: "Ask DE about this need" },
    pulseKey,
    onEditProfile: openProfile,
    compactVariant: "secondary",
    mountWhenEmpty: true,
    compactLabel: included ? "Review" : "Add & review",
  };

  const installModes = sortInstallModes(standaloneView.installModes);

  return (
    <Door2Frame intensity={0.28} jelly>
        <MegaMenu />
        <main id="main-content" tabIndex={-1} className="d2-main de-nav-clear pb-24">
          <div className="d2-layout">
            <div className="min-w-0">
              <header className="d2-chapter d2-chapter--first" data-testid="family-header">
                <StoreAction variant="quiet" href={BUSINESS_NEEDS_INDEX_PATH} testId="back-to-store">
                  <span aria-hidden="true">← </span>All needs
                </StoreAction>

                <div className="mt-6">
                  <StepLabel n="02" srText={STORE_STEPS[1].sr}>
                    Pain or need · {family.label}
                  </StepLabel>
                  <h1 className="d2-h2 d2-measure" data-testid="heading-family">
                    {family.label}
                  </h1>
                  <p className="d2-lede d2-ink d2-measure mt-4">{family.description}</p>
                  <div className="mt-4 lg:hidden">
                    <StoreAction variant="quiet" href="#compare" external testId="jump-compare">
                      Compare<span aria-hidden="true"> ↓</span>
                    </StoreAction>
                  </div>
                </div>

                {outcomes.length > 0 ? (
                  <ul className="d2-rows d2-measure mt-8" data-testid="family-outcomes">
                    {outcomes.map((outcome) => (
                      <li key={outcome} className="d2-body d2-ink-strong">
                        {outcome}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-8" data-testid="family-profile">
                  {profileOpen ? (
                    <SolutionProfileForm
                      environment={environment}
                      onChange={setEnvironmentField}
                      headingLevel={2}
                      collapsible
                      expandKey={profileExpandKey}
                    />
                  ) : (
                    <ProfileLine environment={environment} onEdit={openProfile} />
                  )}
                </div>
              </header>

              <StoreChapter id="compare" heading={COMPARE_HEADING} testId="compare-chapter">
                <div className="mt-8">
                  <RelationshipCompare
                    family={family}
                    environment={environment}
                    sized={sized}
                    suggestion={suggestion}
                    current={draft.deliveryPreference}
                  />
                </div>
                {suggestion ? null : (
                  <p className="d2-small d2-ink-soft d2-measure mt-6" data-testid="no-suggestion-line">
                    {NO_SUGGESTION_LINE}
                  </p>
                )}
              </StoreChapter>

              <StoreChapter
                id="delivery"
                n="05"
                eyebrow="Delivery & Setup"
                srText={STORE_STEPS[4].sr}
                heading={DELIVERY_HEADING}
                testId="delivery-chapter"
              >
                <p className="d2-body d2-ink d2-measure mt-4">{DELIVERY_RULE}</p>
                <ol className="d2-rows d2-measure mt-6" data-testid="delivery-modes">
                  {installModes.map((mode, index) => {
                    const detail = installModeDetail(mode, standaloneView.shipmentMode);
                    return (
                      <li key={mode} className="flex gap-4" data-testid={`delivery-mode-${index + 1}`}>
                        <span className="d2-mono d2-ink-soft pt-1" aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="d2-body d2-ink-strong font-semibold inline-flex flex-wrap items-baseline gap-3">
                            <span>{detail.label}</span>
                            {index === 0 ? <span className="d2-micro d2-accent-ink">{FIRST_CHOICE_TAG}</span> : null}
                          </p>
                          <p className="d2-small d2-ink mt-1">{detail.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="d2-small d2-ink d2-measure mt-6" data-testid="shipment-line">
                  {standaloneView.shipmentCopy}
                </p>
                <p className="d2-small d2-ink d2-measure mt-2" data-testid="technician-line">
                  {standaloneView.technicianCopy}
                </p>
              </StoreChapter>

              <StoreChapter id="coverage" heading={COVERAGE_HEADING} testId="coverage-chapter">
                <div className="mt-6">
                  <CoverageChips familyId={family.id} />
                </div>
              </StoreChapter>

              <div className="d2-chapter d2-next" data-testid="family-actions">
                <p className="d2-next__label d2-label">Next step</p>
                <div className="flex flex-wrap items-center gap-3">
                  {included ? (
                    <StoreAction variant="primary" href={SOLUTION_WORKSPACE_PATH} testId="continue-building" lead>
                      {PRIMARY_ADDED}
                    </StoreAction>
                  ) : (
                    <StoreAction variant="primary" onClick={addAndReview} testId="continue-building" lead>
                      {PRIMARY_ADD}
                    </StoreAction>
                  )}
                  {included ? (
                    <StoreAction variant="secondary" onClick={removeNeed} testId="remove-need">
                      {SECONDARY_REMOVE}
                    </StoreAction>
                  ) : (
                    <StoreAction variant="secondary" onClick={addAndStay} testId="add-keep-browsing">
                      {SECONDARY_ADD}
                    </StoreAction>
                  )}
                </div>
                {undoPending && !included ? (
                  <div className="mt-4">
                    <UndoRow text={`${family.label} removed from Your Solution`} onUndo={undoRemove} testId="undo-remove" />
                  </div>
                ) : null}
                <p className="d2-small d2-ink d2-measure mt-6" data-testid="honesty-line">
                  {HONESTY_LINE}
                </p>
                <p className="d2-small d2-ink-soft mt-4" data-testid="handle-our-it-link">
                  Prefer DE to run all of IT?{" "}
                  <Link href={HANDLE_OUR_IT_PATH} className="d2-link">
                    See Handle Our IT.
                  </Link>
                </p>
                {wide ? null : <HelpRow seed={helpSeed} askLabel="Ask DE about this need" className="mt-8" />}
              </div>
            </div>

            <SolutionRail {...chrome} />
          </div>
        </main>
        <SolutionBar {...chrome} />
        <DigeratiEnhancedFooterSection variant="store" />
    </Door2Frame>
  );
}
