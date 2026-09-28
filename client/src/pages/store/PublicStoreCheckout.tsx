import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { useSEO } from "@/hooks/useSEO";
import { useAnnouncer } from "@/components/AccessibleAnnouncer";
import { useMinWidth, useSolutionDraft } from "@/hooks/useSolutionDraft";
import { Door2Frame } from "@/components/store/door2/Door2Frame";
import { SolutionProfileForm } from "@/components/store/SolutionProfileForm";
import { HairGrid, HelpRow, LiveLine, StepLabel, StoreAction, StoreChapter, UndoRow } from "@/components/store/door2/primitives";
import { ChoiceTiles, type ChoiceOption } from "@/components/store/door2/ChoiceTiles";
import { PackageSheet } from "@/components/store/door2/PackageSheet";
import { CoverageBand } from "@/components/store/door2/Coverage";
import { HintRow, SuggestionLine } from "@/components/store/door2/Guidance";
import { NeedRow } from "@/components/store/door2/NeedRow";
import { ScenarioTile } from "@/components/store/door2/ScenarioTile";
import { JourneyRail } from "@/components/store/door2/JourneyRail";
import { ProposalSheet } from "@/components/store/door2/ProposalSheet";
import {
  SolutionBar,
  SolutionRail,
  type SolutionChromeProps,
  type SolutionPrimary,
  type SolutionStatusLine,
} from "@/components/store/door2/SolutionChrome";
import { composeScenario, solutionScenarios, type SolutionScenario } from "@/data/solutionScenarios";
import type { CuratedSolutionFamily } from "@/data/curatedSolutions";
import {
  BUSINESS_NEEDS_INDEX_PATH,
  familyPath,
  getFamilyById,
  getFamilyBySlug,
  SOLUTION_REQUEST_PATH,
  STORE_STEPS,
  type StoreStepId,
} from "@/lib/businessNeeds";
import {
  addDraftNeed,
  dismissHint,
  acceptHint,
  emptyDraft,
  isProfileComplete,
  parseDraft,
  patchEnvironment,
  patchFulfillment,
  patchSolutionDraft,
  profileGaps,
  profileSummary,
  readSolutionDraft,
  recommendedIntent,
  removeDraftNeed,
  resolvedPackages,
  toRequestNeeds,
  upsertNeed,
  writeSolutionDraft,
  draftStorageBlocked,
  type DeliveryPreference,
  type SolutionDraft,
  type SolutionEnvironment,
} from "@/lib/solutionDraft";
import {
  INSTALL_MODE_LABELS,
  installModeDetail,
  preferredInstallMode,
  PRICING_LABELS,
  RELATIONSHIP_LABELS,
  remoteSupportOptions,
  resolveInstallMode,
  sortInstallModes,
  SUPPORT_LABELS,
  type InstallMode,
  type RemoteSupportMode,
  type ShipmentMode,
} from "@/lib/solutionPackage";
import {
  coverageForFamilies,
  nextHints,
  RELATIONSHIP_SUGGESTION_HINT,
  solutionAdvisorSeed,
  suggestRelationship,
  type SolutionHint,
} from "@/lib/solutionGuidance";

/*
 * C · Assemble (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §5.3): the workspace.
 * The relationship is chosen once with every package visible, the remote-first
 * setup is already checked, DE's hints are accepted or dismissed, and the
 * draft is saved honestly. Served at /store/solution (and its older alias).
 */

const REQUEST_ENDPOINT = "/api/public/solutions/request";
const HANDLE_OUR_IT_PATH = "/solutions/proactive-ecosystem";

const HEADING = "Your Solution, assembled.";
const LEDE = "Sized from your profile. Change anything; nothing is final until DE confirms fit, scope, fulfillment and pricing.";
const PRIMARY_LABEL = "Continue to contact details";
const SAVE_LABEL = "Save progress";
const RELATIONSHIP_HEADING = "How do you want to work with DE?";
const RELATIONSHIP_SUB = "Choose once for the whole solution.";
const PACKAGES_HEADING = "What's in it";
const COVERAGE_HEADING = "Where this solution sits";
const HINTS_HEADING = "DE suggests next";
const DELIVERY_HEADING = "Delivery & Setup";
const DELIVERY_RULE = "DE's rule: remote first, shipped second, on-site only when nothing else will do.";
const ONSITE_LINE = "On-site work is scope-dependent and billed as Truck-Roll, Trip Charge and Tech Labor. DE confirms whether it is needed.";
const SUPPORT_HEADING = "After it is in, how much do you want DE around?";
const FIRST_CHOICE_TAG = "DE's first choice";
const SUGGESTED_TAG = "Suggested";
const EMPTY_LINE = "Nothing in Your Solution yet.";
const COMPARE_BADGE = "DE confirms which after you submit";
const PREVIEW_BADGE = "Preview · choose above";
const RESUME_WARNING = "Anyone with this link can open your draft. It never includes your contact details.";
const COPIED_LINE = "Copied. Anyone with this link can open your draft.";
const SAVED_DEVICE = "Saved on this device";
const NOT_SAVING = "Not saving on this device";
const LINK_SENT = (reference: string) => `That solution was already sent as ${reference}. This is a new one.`;
const LINK_STALE = "That link no longer opens a saved solution. Your solution on this device is open.";
const SAVED_DE = "Saved to DE";
const SAVE_UNAVAILABLE = "Saved on this device. Couldn't save to DE just now.";
const SAVE_UNAVAILABLE_BLOCKED = "Not saving on this device. Couldn't save to DE just now.";
const CONFLICT_QUESTION = "Use the saved copy from DE, or keep what is on this device?";

const RELATIONSHIP_OPTIONS: ReadonlyArray<ChoiceOption<DeliveryPreference>> = [
  {
    value: "standalone",
    label: "Standalone",
    detail: "DE's packaged solution, set up remotely by DE unless you choose to do it yourself. You, or your IT provider, run it day to day. Standard price.",
    testId: "delivery-standalone",
  },
  {
    value: "co_managed",
    label: "Co-Managed",
    detail: "DE and your IT team share it. Preferred pricing where sharing lowers the work.",
    testId: "delivery-co_managed",
  },
  {
    value: "unsure",
    label: "Help me choose",
    detail: "Submit as-is and DE recommends. You still see both packages below.",
    testId: "delivery-unsure",
  },
];

type ServerRequest = {
  id?: unknown;
  selectedNeeds?: unknown;
  deliveryPreference?: unknown;
  environment?: unknown;
  fulfillment?: unknown;
  updatedAt?: unknown;
  suggestion?: unknown;
};

type UndoEntry = { familyId: CuratedSolutionFamily["id"]; source?: string; label: string };

function isInstallMode(value: string): value is InstallMode {
  return value === "remote_assist" || value === "self_install" || value === "onsite";
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** What a save carries and what a resume compares: needs, relationship, profile, setup. Never ids or timestamps. */
function contentKey(draft: SolutionDraft): string {
  return JSON.stringify({
    needs: [...draft.needs].sort((a, b) => a.familyId.localeCompare(b.familyId)),
    deliveryPreference: draft.deliveryPreference,
    environment: draft.environment,
    fulfillment: draft.fulfillment,
  });
}

/** A saved draft from DE, in the browser's own shape; the parser drops anything it does not know. */
function draftFromServer(request: ServerRequest): SolutionDraft {
  const needs = Array.isArray(request.selectedNeeds)
    ? request.selectedNeeds.map((need) => ({
        familyId: (need as { familyId?: unknown })?.familyId,
        source: (need as { source?: unknown })?.source,
      }))
    : [];
  return parseDraft({
    ...emptyDraft(),
    needs,
    deliveryPreference: request.deliveryPreference,
    environment: request.environment,
    fulfillment: request.fulfillment,
    serverDraftId: request.id,
    updatedAt: request.updatedAt,
    // DE's copy of the suggestion shown rides along, so a device that opens the link never overwrites it with null.
    suggestion: request.suggestion,
  });
}

/** Nothing to keep: no need and none of the six profile facts (§6.5's "empty"). */
function isEmptyDraft(draft: SolutionDraft): boolean {
  return draft.needs.length === 0 && profileGaps(draft.environment).length === 6;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scrolls a chapter under the fixed nav without moving focus; the chapter's own scroll offset (CSS) clears the nav. */
function scrollToChapter(id: string): void {
  document.getElementById(id)?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

type SaveState = "idle" | "saving" | "durable" | "unavailable";

/** A device clock this far behind DE's is not read as "older" (§6.5); inside it the buyer is asked. */
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/** The setup that just stopped being offered, in the short words of the live line (§5.3). */
const SHORT_MODE_WORDS: Record<InstallMode, string> = {
  remote_assist: "remote setup",
  self_install: "shipped or guided self-setup",
  onsite: "on-site",
};

/** The persistence sentence, exact by state. Rendered in the save row and again in the rail. */
function SaveLine({
  state,
  forkedFrom,
  copied,
  copyFailed,
  resumeUrl,
  onCopy,
  onRetry,
  testId,
}: {
  state: SaveState;
  forkedFrom: string | null;
  copied: boolean;
  copyFailed: boolean;
  resumeUrl: string | null;
  onCopy: () => void;
  onRetry: () => void;
  testId?: string;
}) {
  return (
    <div className="d2-small d2-ink min-w-0" data-testid={testId} data-state={state}>
      {state === "saving" ? (
        <span>Saving…</span>
      ) : state === "durable" ? (
        <>
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <span>{copied ? COPIED_LINE : `${SAVED_DE} ·`}</span>
            <button type="button" className="d2-action d2-action--quiet" onClick={onCopy}>
              Copy resume link
            </button>
          </span>
          {copyFailed && resumeUrl ? <p className="d2-mono d2-ink-strong mt-1 break-words">{resumeUrl}</p> : null}
          <p className="d2-ink-soft mt-1">{RESUME_WARNING}</p>
        </>
      ) : state === "unavailable" ? (
        <span className="inline-flex flex-wrap items-center gap-x-2">
          <span>{draftStorageBlocked() ? SAVE_UNAVAILABLE_BLOCKED : SAVE_UNAVAILABLE}</span>
          <button type="button" className="d2-action d2-action--quiet" onClick={onRetry}>
            Try again
          </button>
        </span>
      ) : (
        <span>{draftStorageBlocked() ? NOT_SAVING : SAVED_DEVICE}</span>
      )}
      {forkedFrom ? <p className="d2-ink-soft mt-1">{LINK_SENT(forkedFrom)}</p> : null}
    </div>
  );
}

export default function PublicSolutionWorkspace() {
  const draft = useSolutionDraft();
  const { announce } = useAnnouncer();
  const wide = useMinWidth(1024);

  const [profileExpandKey, setProfileExpandKey] = useState(0);
  const [undoRows, setUndoRows] = useState<UndoEntry[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [forkedFrom, setForkedFrom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [conflict, setConflict] = useState<SolutionDraft | null>(null);
  const [seededFromLink, setSeededFromLink] = useState<CuratedSolutionFamily | null>(null);

  // A `?family=` deep link to the contact step seeds an empty draft and lands here, with its Undo.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("seeded") ?? "";
    if (!slug) return;
    const family = getFamilyBySlug(slug);
    if (family && readSolutionDraft().needs.some((need) => need.familyId === family.id)) setSeededFromLink(family);
  }, []);

  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  /** The content DE last confirmed holding (a PUT 2xx, or the copy hydration read). Null until known. */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  /** Needs on the page at mount or hydrated from DE; only rows added after that rise (§9). */
  const presentFamilyIds = useRef<Set<string> | null>(null);
  const lastSupportSuggestion = useRef<RemoteSupportMode | null>(null);

  useSEO({
    title: "Your Solution | Store | Digerati Experts",
    description: "Your assembled Digerati Experts solution: needs, relationship, packages and Delivery & Setup, sized from your profile.",
    canonical: "/store/solution",
    noIndex: true,
  });

  /* ---------------------------------------------------------------------- */
  /* Derived state                                                           */
  /* ---------------------------------------------------------------------- */

  const environment = draft.environment;
  const sized = isProfileComplete(environment);
  const needCount = draft.needs.length;
  const familyIds = useMemo(() => draft.needs.map((need) => need.familyId), [draft.needs]);
  if (presentFamilyIds.current === null) presentFamilyIds.current = new Set(familyIds);
  const packages = useMemo(() => resolvedPackages(draft), [draft]);
  const relationship = draft.deliveryPreference;

  const installUnion = useMemo(
    () => sortInstallModes([...new Set(packages.flatMap((entry) => entry.policyView.installModes))]),
    [packages],
  );
  const unionKey = installUnion.join(",");

  /** The shipment a tile speaks for: the first selected package that ships and supports the mode; digital otherwise. */
  const tileShipment = useCallback(
    (mode: InstallMode): ShipmentMode =>
      packages.find((entry) => entry.policyView.shipmentMode !== "none" && entry.policyView.installModes.includes(mode))?.policyView
        .shipmentMode ?? "none",
    [packages],
  );

  const installValue: InstallMode | "" = isInstallMode(draft.fulfillment.installation) ? draft.fulfillment.installation : "";
  const installOptions = useMemo<ChoiceOption<InstallMode>[]>(
    () =>
      installUnion.map((mode, index) => {
        const detail = mode === "onsite" ? INSTALL_MODE_LABELS.onsite : installModeDetail(mode, tileShipment(mode));
        return {
          value: mode,
          label: detail.label,
          detail: detail.detail,
          tag: index === 0 ? FIRST_CHOICE_TAG : undefined,
          testId: `install-${mode}`,
        };
      }),
    [installUnion, tileShipment],
  );

  const support = useMemo(() => remoteSupportOptions(relationship), [relationship]);
  const supportOptions = useMemo<ChoiceOption<RemoteSupportMode>[]>(
    () =>
      support.options.map((mode) => ({
        value: mode,
        label: SUPPORT_LABELS[mode].label,
        detail: SUPPORT_LABELS[mode].detail,
        tag: mode === support.suggested ? SUGGESTED_TAG : undefined,
        testId: `support-${mode}`,
      })),
    [support],
  );

  const profileReady = sized;
  const needsReady = needCount > 0;
  const relationshipReady = relationship !== "";
  const packageReady = needsReady && relationshipReady;
  const deliveryReady = installValue !== "" && installUnion.includes(installValue);

  const readiness: Record<StoreStepId, boolean> = {
    profile: profileReady,
    need: needsReady,
    relationship: relationshipReady,
    package: packageReady,
    delivery: deliveryReady,
    contact: false,
  };
  const completeSteps = STORE_STEPS.filter((step) => readiness[step.id]).map((step) => step.id);
  const currentStep: StoreStepId = STORE_STEPS.find((step) => step.id !== "contact" && !readiness[step.id])?.id ?? "delivery";

  const suggestionDismissed = draft.dismissedHints.includes(RELATIONSHIP_SUGGESTION_HINT);
  const suggestion = !suggestionDismissed && relationship === "" ? suggestRelationship(environment) : null;
  const hints = useMemo(() => nextHints(draft, draft.dismissedHints), [draft]);
  const coverage = useMemo(() => coverageForFamilies(familyIds), [familyIds]);
  const intent = recommendedIntent(draft);
  const helpSeed = useMemo(() => solutionAdvisorSeed(draft), [draft]);

  const undoVisible = undoRows.filter((entry) => !familyIds.includes(entry.familyId));

  // "Saved to DE" is claimed only for the content DE confirmed; anything changed since reads as saved on this device.
  const currentKey = contentKey(draft);
  const saveState: SaveState = saving
    ? "saving"
    : saveFailed || draft.serverDurable === false
      ? "unavailable"
      : draft.serverDurable === true && draft.serverDraftId && savedKey === currentKey
        ? "durable"
        : "idle";
  const resumeUrl =
    draft.serverDraftId && typeof window !== "undefined" ? `${window.location.origin}/store/solution?draftId=${draft.serverDraftId}` : null;

  /* ---------------------------------------------------------------------- */
  /* Writes                                                                  */
  /* ---------------------------------------------------------------------- */

  const setEnvironmentField = useCallback(<K extends keyof SolutionEnvironment>(key: K, value: SolutionEnvironment[K]) => {
    const patch: Partial<SolutionEnvironment> = {};
    patch[key] = value;
    writeSolutionDraft(patchEnvironment(readSolutionDraft(), patch));
  }, []);

  const openProfile = useCallback(() => {
    setProfileExpandKey((key) => key + 1);
    scrollToChapter("profile");
  }, []);

  const addFamily = useCallback(
    (familyId: CuratedSolutionFamily["id"], source?: string) => {
      const family = getFamilyById(familyId);
      addDraftNeed(source ? { familyId, source } : { familyId });
      setPulseKey((key) => key + 1);
      if (family) announce(`${family.label} added to Your Solution`);
    },
    [announce],
  );

  const removeFamily = useCallback(
    (familyId: CuratedSolutionFamily["id"]) => {
      const need = readSolutionDraft().needs.find((entry) => entry.familyId === familyId);
      const family = getFamilyById(familyId);
      removeDraftNeed(familyId);
      // Any row that comes back after a remove (Undo, re-add) is an add again and rises.
      presentFamilyIds.current?.delete(familyId);
      if (!family) return;
      setUndoRows((rows) => [
        ...rows.filter((entry) => entry.familyId !== familyId),
        { familyId, source: need?.source, label: family.label },
      ]);
      announce(`${family.label} removed from Your Solution`);
    },
    [announce],
  );

  const undoRemove = useCallback(
    (entry: UndoEntry) => {
      addDraftNeed(entry.source ? { familyId: entry.familyId, source: entry.source } : { familyId: entry.familyId });
      setUndoRows((rows) => rows.filter((row) => row.familyId !== entry.familyId));
      setPulseKey((key) => key + 1);
      announce(`${entry.label} added back to Your Solution`);
    },
    [announce],
  );

  const startScenario = useCallback(
    (scenario: SolutionScenario) => {
      const current = readSolutionDraft();
      const compose = composeScenario(
        scenario,
        current.needs.map((need) => need.familyId),
      );
      if (compose.add.length === 0) return;
      const next = compose.add.reduce((acc, familyId) => upsertNeed(acc, { familyId, source: scenario.id }), current);
      writeSolutionDraft(next);
      setPulseKey((key) => key + 1);
      const labels = compose.add.map((id) => getFamilyById(id)?.label ?? id);
      announce(`Added ${labels.join(", ")} to Your Solution`);
    },
    [announce],
  );

  const chooseRelationship = useCallback(
    (value: DeliveryPreference) => {
      const shown = suggestion;
      patchSolutionDraft({
        deliveryPreference: value,
        ...(shown ? { suggestion: { value: shown.value, accepted: value === shown.value } } : {}),
      });
      const count = readSolutionDraft().needs.length;
      announce(
        value === "unsure"
          ? "Both packages shown for each need. DE confirms which after you submit."
          : `${plural(count, "package")} now shown as ${RELATIONSHIP_LABELS[value]}`,
      );
    },
    [announce, suggestion],
  );

  const declineSuggestion = useCallback(() => {
    const current = readSolutionDraft();
    if (!suggestion) return;
    writeSolutionDraft({
      ...current,
      dismissedHints: current.dismissedHints.includes(RELATIONSHIP_SUGGESTION_HINT)
        ? current.dismissedHints
        : [...current.dismissedHints, RELATIONSHIP_SUGGESTION_HINT],
      suggestion: { value: suggestion.value, accepted: false },
    });
  }, [suggestion]);

  const chooseInstallation = useCallback(
    (value: InstallMode) => {
      writeSolutionDraft(patchFulfillment(readSolutionDraft(), { installation: value }));
    },
    [],
  );

  const chooseSupport = useCallback((value: RemoteSupportMode) => {
    writeSolutionDraft(patchFulfillment(readSolutionDraft(), { remoteSupport: value }));
  }, []);

  const actOnHint = useCallback(
    (hint: SolutionHint) => {
      const action = hint.action;
      if (action.type === "add_family") {
        addFamily(action.familyId);
        acceptHint(hint.id);
      } else if (action.type === "set_relationship") {
        patchSolutionDraft({ deliveryPreference: action.value });
        acceptHint(hint.id);
        announce(`Relationship set to ${RELATIONSHIP_LABELS[action.value]}`);
      } else if (action.type === "set_setup") {
        writeSolutionDraft(patchFulfillment(readSolutionDraft(), { installation: action.value }));
        acceptHint(hint.id);
        announce(`Delivery & Setup set to ${INSTALL_MODE_LABELS[action.value].label}`);
      } else if (action.type === "edit_profile") {
        openProfile();
      }
    },
    [addFamily, announce, openProfile],
  );

  const dismissOneHint = useCallback((hint: SolutionHint) => {
    dismissHint(hint.id);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Defaults: remote first, and the support level the relationship suggests */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (packages.length === 0 || installUnion.length === 0) return;
    const current = draft.fulfillment.installation;
    const preferred = preferredInstallMode(installUnion);
    if (!preferred) return;
    const preferredLabel = installModeDetail(preferred, tileShipment(preferred)).label;
    if (current === "" || current === "unsure") {
      writeSolutionDraft(patchFulfillment(readSolutionDraft(), { installation: preferred }));
      // After the add that made the solution non-empty has been announced.
      window.setTimeout(() => {
        announce(`Delivery & Setup pre-set to ${preferredLabel}, DE's first choice. Change it under Delivery & Setup.`);
      }, 1500);
      return;
    }
    if (!installUnion.includes(current)) {
      writeSolutionDraft(patchFulfillment(readSolutionDraft(), { installation: preferred }));
      announce(`Setup reset to ${preferredLabel}: ${SHORT_MODE_WORDS[current]} is not offered for the packages left`);
    }
    // unionKey stands in for installUnion's identity; tileShipment follows packages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages.length, unionKey, draft.fulfillment.installation, announce]);

  useEffect(() => {
    if (packages.length === 0) return;
    const current = draft.fulfillment.remoteSupport;
    const suggested = support.suggested;
    const following = current === "" || current === lastSupportSuggestion.current;
    if (following && current !== suggested) {
      lastSupportSuggestion.current = suggested;
      writeSolutionDraft(patchFulfillment(readSolutionDraft(), { remoteSupport: suggested }));
      return;
    }
    if (current === suggested) lastSupportSuggestion.current = suggested;
  }, [packages.length, support.suggested, draft.fulfillment.remoteSupport]);

  /* ---------------------------------------------------------------------- */
  /* Save to DE                                                              */
  /* ---------------------------------------------------------------------- */

  const saveProgress = useCallback(async (): Promise<void> => {
    if (saveInFlight.current) {
      saveQueued.current = true;
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    setSaveFailed(false);
    announce("Saving…");
    const current = readSolutionDraft();
    const key = contentKey(current);
    try {
      const response = await fetch(REQUEST_ENDPOINT, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.serverDraftId ?? undefined,
          selectedNeeds: toRequestNeeds(current),
          // "" is an unmade choice and stays one; only the buyer or Use this writes a relationship.
          deliveryPreference: current.deliveryPreference,
          environment: current.environment,
          fulfillment: current.fulfillment,
          suggestion: current.suggestion,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as {
        request?: { id?: unknown };
        durable?: unknown;
        forked?: unknown;
        previousReference?: unknown;
      };
      const id = typeof data.request?.id === "string" ? data.request.id : current.serverDraftId;
      const durable = data.durable === true;
      setSavedKey(key);
      patchSolutionDraft({ serverDraftId: id, serverDurable: durable });
      if (data.forked === true && typeof data.previousReference === "string" && data.previousReference) {
        setForkedFrom(data.previousReference);
      }
      announce(durable ? SAVED_DE : SAVE_UNAVAILABLE);
    } catch {
      setSaveFailed(true);
      announce(SAVE_UNAVAILABLE);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
      if (saveQueued.current) {
        saveQueued.current = false;
        void saveProgress();
      }
    }
  }, [announce]);

  // Autosave, debounced, once DE already holds this draft and we know what it holds
  // (the hydration read below, or the last PUT). Keyed on content, never on ids or timestamps.
  useEffect(() => {
    if (!draft.serverDraftId || savedKey === null || savedKey === currentKey) return undefined;
    const timer = window.setTimeout(() => {
      void saveProgress();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [currentKey, draft.serverDraftId, savedKey, saveProgress]);

  const copyResumeLink = useCallback(async () => {
    if (!resumeUrl) return;
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopied(true);
      setCopyFailed(false);
      announce(COPIED_LINE);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      announce("The link could not be copied. It is shown beside the save control.");
    }
  }, [announce, resumeUrl]);

  /* ---------------------------------------------------------------------- */
  /* Hydration from DE (?draftId= resume link, or this browser's own draft)  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftId = (params.get("draftId") ?? "").trim().slice(0, 80);
    const url = draftId ? `${REQUEST_ENDPOINT}?draftId=${encodeURIComponent(draftId)}` : REQUEST_ENDPOINT;
    let cancelled = false;
    if (draftId) {
      setHydrating(true);
      announce("Opening your saved solution");
    }
    fetch(url, { credentials: "include" })
      .then((response) => {
        // A refused read (rate limited, server error) is handled like a failed one below.
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data: { request?: ServerRequest; durable?: unknown; previousReference?: unknown } | null) => {
        if (cancelled || !data?.request) return;
        const server = draftFromServer(data.request);
        const local = readSolutionDraft();
        if (!server.serverDraftId) return;
        const durable = data.durable === true;
        const previous = typeof data.previousReference === "string" ? data.previousReference : "";
        const adopt = (draft: SolutionDraft) => {
          const hydrated = { ...draft, serverDurable: durable };
          // Hydrated rows were never "added" here: mark them present before the write notifies listeners.
          hydrated.needs.forEach((need) => presentFamilyIds.current?.add(need.familyId));
          setSavedKey(contentKey(hydrated));
          writeSolutionDraft(hydrated);
        };
        if (draftId) {
          // Handled once: a reload is a plain workspace load, not a second announcement or another fresh draft.
          window.history.replaceState(null, "", window.location.pathname);
          if (server.serverDraftId !== draftId) {
            // The link no longer opens a draft: that solution was sent (DE answers with a fresh
            // draft and its reference) or the id is unknown. This device's solution stays; the
            // draft DE minted is not "saved" until the autosave below has carried this content.
            if (previous) setForkedFrom(previous);
            announce(previous ? LINK_SENT(previous) : LINK_STALE);
            if (!local.serverDraftId) patchSolutionDraft({ serverDraftId: server.serverDraftId, serverDurable: null });
            setSavedKey("");
            return;
          }
          if (isEmptyDraft(local)) {
            adopt(server);
            announce("Your saved solution is open");
          } else if (contentKey(local) !== contentKey(server)) {
            // §6.5: a differing local copy that is newer asks. DE's copy replaces it silently only
            // when clearly newer (beyond a clock tolerance); the silent branch is the destructive one.
            const gap = Date.parse(server.updatedAt) - Date.parse(local.updatedAt);
            const serverClearlyNewer = Number.isFinite(gap) && gap > CLOCK_TOLERANCE_MS;
            if (serverClearlyNewer) {
              adopt(server);
              announce("Your saved solution is open");
            } else {
              setConflict({ ...server, serverDurable: durable });
            }
          } else {
            setSavedKey(contentKey(server));
            patchSolutionDraft({ serverDraftId: server.serverDraftId, serverDurable: durable });
          }
          return;
        }
        if (server.serverDraftId === local.serverDraftId) {
          // DE's copy of this draft; a change made since (on another page, or before a reload) autosaves from here.
          setSavedKey(contentKey(server));
          return;
        }
        if (local.serverDraftId) {
          // DE answered with another draft (the session moved on, or that solution was sent): what DE
          // holds under this device's id is unknown, so the autosave carries this content and confirms.
          if (previous) setForkedFrom(previous);
          setSavedKey("");
          return;
        }
        if (server.needs.length > 0) {
          // DE holds a session draft this device never saved from (storage cleared or blocked since).
          // Nothing to keep adopts it; a differing local draft is the buyer's call; the same content adopts the id.
          if (isEmptyDraft(local)) {
            adopt(server);
            announce("Your saved solution is open");
          } else if (contentKey(local) !== contentKey(server)) {
            setConflict({ ...server, serverDurable: durable });
          } else {
            setSavedKey(contentKey(server));
            patchSolutionDraft({ serverDraftId: server.serverDraftId, serverDurable: durable });
          }
        }
      })
      .catch(() => {
        // The read failed (offline, rate limited): DE's copy is unknown, so a draft DE already
        // holds autosaves this content and the PUT's answer settles the sentence.
        if (!cancelled && readSolutionDraft().serverDraftId) setSavedKey("");
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once on mount: the URL and the announcer do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useServerCopy = useCallback(() => {
    if (!conflict) return;
    conflict.needs.forEach((need) => presentFamilyIds.current?.add(need.familyId));
    setSavedKey(contentKey(conflict));
    writeSolutionDraft(conflict);
    setConflict(null);
    announce("DE's copy is open");
  }, [announce, conflict]);

  const keepLocalCopy = useCallback(() => {
    if (!conflict) return;
    // DE holds the other copy; the autosave carries this device's over it.
    setSavedKey(contentKey(conflict));
    patchSolutionDraft({ serverDraftId: conflict.serverDraftId, serverDurable: conflict.serverDurable });
    setConflict(null);
    announce("Keeping this device's solution");
  }, [announce, conflict]);

  /* ---------------------------------------------------------------------- */
  /* Rail and bar                                                            */
  /* ---------------------------------------------------------------------- */

  const installLabel = deliveryReady && installValue ? installModeDetail(installValue, tileShipment(installValue)).label : "";
  const status: SolutionStatusLine[] = [
    {
      id: "profile",
      state: profileReady ? "ready" : "gap",
      text: profileReady ? `Sized for ${profileSummary(environment)}` : `Finish the profile: ${profileGaps(environment).join(", ")}`,
      href: "#profile",
    },
    {
      id: "need",
      state: needsReady ? "ready" : "gap",
      text: needsReady ? plural(needCount, "need") : "Add at least one need",
      href: "#needs",
    },
    {
      id: "relationship",
      state: relationshipReady ? "ready" : "gap",
      text: relationshipReady
        ? relationship === "unsure"
          ? "DE will recommend"
          : RELATIONSHIP_LABELS[relationship]
        : "Choose above, or let DE recommend",
      href: "#relationship",
    },
    {
      id: "package",
      state: packageReady ? "ready" : "pending",
      text: packageReady
        ? profileReady
          ? `${plural(needCount, "package")} sized`
          : `${plural(needCount, "package")}, not sized yet`
        : "Waiting on the relationship",
      href: "#packages",
    },
    {
      id: "delivery",
      state: deliveryReady ? "ready" : "gap",
      text: deliveryReady ? installLabel : "Confirm Delivery & Setup",
      href: "#delivery",
    },
    { id: "contact", state: "pending", text: "Next step" },
  ];

  const canContinue = needsReady && profileReady && relationshipReady;
  const firstGap = status.find((line) => line.state === "gap")?.text;
  const primary: SolutionPrimary = {
    label: PRIMARY_LABEL,
    href: SOLUTION_REQUEST_PATH,
    disabled: !canContinue,
    reason: canContinue ? undefined : firstGap,
    testId: "continue-to-contact",
  };

  const requiredFamilies = packages.filter((entry) => entry.policyView.assessmentPolicy === "required").map((entry) => entry.family.label);
  const nextStepLine =
    intent === "assessment"
      ? `After you submit: DE contacts you to schedule the assessment conversation (required for ${requiredFamilies.join(" and ")})`
      : intent === "consultation"
        ? "After you submit: DE recommends Standalone or Co-Managed, then quotes"
        : intent === "quote"
          ? "After you submit: DE confirms scope and sends pricing to approve"
          : undefined;

  const saveLine = (testId?: string) => (
    <SaveLine
      state={saveState}
      forkedFrom={forkedFrom}
      copied={copied}
      copyFailed={copyFailed}
      resumeUrl={resumeUrl}
      onCopy={() => void copyResumeLink()}
      onRetry={() => void saveProgress()}
      testId={testId}
    />
  );

  const chrome: SolutionChromeProps = {
    mode: "continue",
    draft,
    status,
    primary,
    help: { seed: helpSeed },
    saveState: saveLine(),
    nextStepLine,
    pulseKey,
    onEditProfile: openProfile,
  };

  const onsiteChosen = installValue === "onsite";

  // One line per package, collapsed to one line when every package resolves the same way.
  const resolutions = packages.map((entry) => {
    const resolved = resolveInstallMode(draft.fulfillment.installation, entry.policyView);
    const detail = installModeDetail(resolved.mode, entry.policyView.shipmentMode);
    return { entry, resolved, detail };
  });
  const identical =
    resolutions.length > 1 &&
    resolutions.every((item) => item.detail.label === resolutions[0].detail.label && !item.resolved.reason);
  const resolutionLines = identical
    ? [
        {
          key: "all",
          testId: "setup-all",
          text: `All ${plural(resolutions.length, "package")}: ${resolutions[0].detail.label}`,
          shipment: resolutions
            .filter((item) => item.entry.policyView.shipmentMode !== "none")
            .map((item) => item.entry.policyView.shipmentCopy)
            .filter((copy, index, all) => all.indexOf(copy) === index)
            .join(" "),
        },
      ]
    : resolutions.map((item) => ({
        key: item.entry.need.familyId,
        testId: `setup-${item.entry.need.familyId}`,
        text: `${item.entry.family.label}: ${item.detail.label}${item.resolved.reason ? ` · ${item.resolved.reason}` : ""}`,
        shipment: item.entry.policyView.shipmentMode !== "none" ? item.entry.policyView.shipmentCopy : "",
      }));

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <Door2Frame intensity={0.28} jelly>
        <MegaMenu />
        <main className="d2-main de-nav-clear pb-24">
          <div className="d2-layout d2-layout--wide">
            <div className="min-w-0">
              <header className="d2-chapter d2-chapter--first" data-testid="workspace-header">
                <StepLabel>Your Solution</StepLabel>
                <h1 className="d2-display d2-measure" data-testid="heading-workspace">
                  {HEADING}
                </h1>
                <p className="d2-lede d2-ink d2-measure mt-4">{LEDE}</p>
                <JourneyRail current={currentStep} complete={completeSteps} />
                {hydrating ? (
                  <LiveLine className="mt-6" testId="hydrating-line">
                    Opening your saved solution…
                  </LiveLine>
                ) : null}
              </header>

              {conflict ? (
                <div className="d2-chapter d2-no-print" role="group" aria-labelledby="draft-conflict-question" data-testid="draft-conflict">
                  <p id="draft-conflict-question" className="d2-body d2-ink-strong d2-measure">
                    {CONFLICT_QUESTION}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <StoreAction variant="secondary" onClick={useServerCopy} testId="draft-use-server">
                      Use DE's copy
                    </StoreAction>
                    <StoreAction variant="quiet" onClick={keepLocalCopy} testId="draft-keep-local">
                      Keep this device's
                    </StoreAction>
                  </div>
                </div>
              ) : null}

              {hydrating ? null : (
                <div className="d2-no-print">
                  {/* 01 Profile */}
                  <StoreChapter
                    id="profile"
                    n={STORE_STEPS[0].n}
                    eyebrow={STORE_STEPS[0].label}
                    srText={STORE_STEPS[0].sr}
                    heading="Your business profile"
                    testId="profile-chapter"
                  >
                    <div className="mt-6">
                      <SolutionProfileForm
                        environment={environment}
                        onChange={setEnvironmentField}
                        headingLevel={3}
                        collapsible
                        expandKey={profileExpandKey}
                      />
                    </div>
                  </StoreChapter>

                  {/* 02 Pain or need */}
                  <StoreChapter
                    id="needs"
                    n={STORE_STEPS[1].n}
                    eyebrow={STORE_STEPS[1].label}
                    srText={STORE_STEPS[1].sr}
                    heading="Pain or need"
                    testId="needs-chapter"
                  >
                    {seededFromLink ? (
                      <div className="mt-4">
                        <UndoRow
                          text={`Added ${seededFromLink.label} from your link`}
                          onUndo={() => {
                            removeFamily(seededFromLink.id);
                            setSeededFromLink(null);
                          }}
                          testId="seeded-undo"
                        />
                      </div>
                    ) : null}
                    {needsReady ? (
                      <>
                        <ul className="d2-rows mt-6" data-testid="need-rows">
                          {packages.map((entry) => (
                            <NeedRow
                              key={entry.need.familyId}
                              need={entry.need}
                              family={entry.family}
                              changeHref={familyPath(entry.family.id)}
                              onRemove={() => removeFamily(entry.family.id)}
                              entered={!presentFamilyIds.current?.has(entry.need.familyId)}
                            />
                          ))}
                        </ul>
                        {undoVisible.map((entry) => (
                          <UndoRow
                            key={entry.familyId}
                            text={`${entry.label} removed from Your Solution`}
                            onUndo={() => undoRemove(entry)}
                            testId={`undo-${entry.familyId}`}
                          />
                        ))}
                        <div className="mt-6">
                          <StoreAction variant="quiet" href={BUSINESS_NEEDS_INDEX_PATH} testId="add-another-need">
                            Add another need<span aria-hidden="true"> →</span>
                          </StoreAction>
                        </div>
                      </>
                    ) : (
                      <div data-testid="needs-empty">
                        <p className="d2-body d2-ink-strong mt-6">{EMPTY_LINE}</p>
                        <p className="d2-small d2-ink d2-measure mt-2">
                          Start from a situation below, or{" "}
                          <Link href={BUSINESS_NEEDS_INDEX_PATH} className="d2-link" data-testid="browse-all-needs">
                            browse all needs
                          </Link>
                          .
                        </p>
                        {undoVisible.map((entry) => (
                          <UndoRow
                            key={entry.familyId}
                            text={`${entry.label} removed from Your Solution`}
                            onUndo={() => undoRemove(entry)}
                            testId={`undo-${entry.familyId}`}
                          />
                        ))}
                        <HairGrid cols={2} as="ul" className="mt-8" aria-label="Start from a situation">
                          {solutionScenarios.map((scenario) => (
                            <ScenarioTile
                              key={scenario.id}
                              scenario={scenario}
                              compose={composeScenario(scenario, familyIds)}
                              onStart={startScenario}
                              onReview={() => undefined}
                            />
                          ))}
                        </HairGrid>
                      </div>
                    )}
                  </StoreChapter>

                  {needsReady ? (
                    <>
                      {/* 03 Relationship */}
                      <StoreChapter
                        id="relationship"
                        n={STORE_STEPS[2].n}
                        eyebrow={STORE_STEPS[2].label}
                        srText={STORE_STEPS[2].sr}
                        heading={RELATIONSHIP_HEADING}
                        lede={RELATIONSHIP_SUB}
                        testId="relationship-chapter"
                      >
                        <div className="mt-6">
                          <ChoiceTiles<DeliveryPreference>
                            name="relationship"
                            legend={RELATIONSHIP_HEADING}
                            value={relationship}
                            options={RELATIONSHIP_OPTIONS}
                            onChange={chooseRelationship}
                            columns={3}
                          />
                        </div>
                        {suggestion ? (
                          <div className="mt-4">
                            <SuggestionLine
                              suggestion={suggestion}
                              onUse={() => chooseRelationship(suggestion.value)}
                              onDecline={declineSuggestion}
                              testId="relationship-suggestion"
                            />
                          </div>
                        ) : null}
                      </StoreChapter>

                      {/* 04 Package */}
                      <StoreChapter
                        id="packages"
                        n={STORE_STEPS[3].n}
                        eyebrow={STORE_STEPS[3].label}
                        srText={STORE_STEPS[3].sr}
                        heading={PACKAGES_HEADING}
                        testId="packages-chapter"
                      >
                        <ul className="d2-sheet-list mt-6" data-testid="package-sheets">
                          {packages.map((entry) => {
                            const pair = "standalone" in entry.package ? entry.package : null;
                            const single = pair ? null : entry.package;
                            return (
                              <li key={entry.need.familyId} className="min-w-0">
                                {single ? (
                                  <PackageSheet
                                    familyLabel={entry.family.label}
                                    view={single}
                                    mode="single"
                                    sized={sized}
                                    swapKey={relationship}
                                    changeHref={familyPath(entry.family.id)}
                                    onRemove={() => removeFamily(entry.family.id)}
                                    testId={`package-${entry.need.familyId}`}
                                  />
                                ) : relationship === "unsure" && pair ? (
                                  <PackageSheet
                                    familyLabel={entry.family.label}
                                    view={pair}
                                    mode="compare"
                                    sized={sized}
                                    pricingLabel={PRICING_LABELS.unsure}
                                    badge={COMPARE_BADGE}
                                    swapKey={relationship}
                                    changeHref={familyPath(entry.family.id)}
                                    onRemove={() => removeFamily(entry.family.id)}
                                    testId={`package-${entry.need.familyId}`}
                                  />
                                ) : pair ? (
                                  <PackageSheet
                                    familyLabel={entry.family.label}
                                    view={pair.standalone}
                                    mode="preview"
                                    sized={sized}
                                    badge={PREVIEW_BADGE}
                                    swapKey={relationship}
                                    changeHref={familyPath(entry.family.id)}
                                    onRemove={() => removeFamily(entry.family.id)}
                                    testId={`package-${entry.need.familyId}`}
                                  />
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </StoreChapter>

                      <StoreChapter id="coverage" heading={COVERAGE_HEADING} testId="coverage-chapter">
                        {wide ? (
                          <div className="mt-6">
                            <CoverageBand coverage={coverage} onAdd={(id) => addFamily(id)} maxAdds={Math.max(0, 3 - hints.length)} />
                          </div>
                        ) : (
                          <details className="d2-disclosure mt-4" data-testid="coverage-disclosure">
                            <summary className="d2-small">Show the eight security blocks</summary>
                            <div className="mt-4">
                              <CoverageBand coverage={coverage} onAdd={(id) => addFamily(id)} maxAdds={Math.max(0, 3 - hints.length)} />
                            </div>
                          </details>
                        )}
                      </StoreChapter>

                      {hints.length > 0 ? (
                        <StoreChapter id="hints" heading={HINTS_HEADING} testId="hints-chapter">
                          <div className="mt-6" data-testid="hint-rows">
                            {hints.map((hint) => (
                              <HintRow key={hint.id} hint={hint} onAction={actOnHint} onDismiss={dismissOneHint} />
                            ))}
                          </div>
                        </StoreChapter>
                      ) : null}

                      {/* 05 Delivery & Setup */}
                      <StoreChapter
                        id="delivery"
                        n={STORE_STEPS[4].n}
                        eyebrow={STORE_STEPS[4].label}
                        srText={STORE_STEPS[4].sr}
                        heading={DELIVERY_HEADING}
                        lede={DELIVERY_RULE}
                        testId="delivery-chapter"
                      >
                        <div className="mt-6">
                          <ChoiceTiles<InstallMode>
                            name="installation"
                            legend={DELIVERY_HEADING}
                            value={installValue}
                            options={installOptions}
                            onChange={chooseInstallation}
                            columns={3}
                          />
                        </div>
                        <ul className="d2-rows d2-measure mt-6" data-testid="setup-resolution">
                          {resolutionLines.map((line) => (
                            <li key={line.key} data-testid={line.testId}>
                              <p className="d2-small d2-ink-strong">{line.text}</p>
                              {line.shipment ? <p className="d2-small d2-ink-soft mt-1">{line.shipment}</p> : null}
                            </li>
                          ))}
                        </ul>
                        {onsiteChosen ? (
                          <p className="d2-small d2-ink d2-measure mt-4" data-testid="onsite-line">
                            {ONSITE_LINE}
                          </p>
                        ) : null}

                        <h3 className="d2-h3 d2-measure mt-10">{SUPPORT_HEADING}</h3>
                        <div className="mt-4">
                          <ChoiceTiles<RemoteSupportMode>
                            name="remote-support"
                            legend={SUPPORT_HEADING}
                            value={draft.fulfillment.remoteSupport}
                            options={supportOptions}
                            onChange={chooseSupport}
                            columns={4}
                          />
                        </div>
                      </StoreChapter>
                    </>
                  ) : null}

                  {/* Save row */}
                  <StoreChapter id="save" testId="save-row">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <StoreAction variant="secondary" onClick={() => void saveProgress()} ariaBusy={saving} testId="save-progress">
                        {SAVE_LABEL}
                      </StoreAction>
                      <StoreAction variant="quiet" onClick={() => window.print()} testId="print-solution">
                        Print / save
                      </StoreAction>
                    </div>
                    <div className="mt-4">{saveLine("solution-rail-save")}</div>
                    <p className="d2-small d2-ink-soft mt-8" data-testid="handle-our-it-link">
                      Prefer DE to run all of IT?{" "}
                      <Link href={HANDLE_OUR_IT_PATH} className="d2-link">
                        See Handle Our IT.
                      </Link>
                    </p>
                    {wide ? null : <HelpRow seed={helpSeed} className="mt-8" />}
                  </StoreChapter>
                </div>
              )}

              <div className="d2-print-only" aria-hidden="true">
                <ProposalSheet source={{ draft }} title="Solution summary · draft" />
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
