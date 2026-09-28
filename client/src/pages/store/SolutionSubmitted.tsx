import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { Printer } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import NotFound from "@/pages/not-found";
import { useSEO } from "@/hooks/useSEO";
import { Door2Frame } from "@/components/store/door2/Door2Frame";
import {
  HelpRow,
  ReferenceMark,
  StepLabel,
  StoreAction,
  StoreChapter,
} from "@/components/store/door2/primitives";
import { ProposalSheet } from "@/components/store/door2/ProposalSheet";
import { BUSINESS_NEEDS_INDEX_PATH, getFamilyById } from "@/lib/businessNeeds";
import {
  clearSubmittedArchive,
  emptyDraft,
  readSubmittedArchive,
  type SolutionDraft,
  type SolutionDraftNeed,
  type SubmittedSolutionArchive,
} from "@/lib/solutionDraft";
import { solutionAdvisorSeed } from "@/lib/solutionGuidance";
import { portalMarketplaceLoginUrl } from "@/lib/portalUrls";
import { CTA } from "@/lib/ctaCopy";
import { maskEmail, maskPhone } from "@shared/publicContact";

/*
 * E · Hold the record (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §5.5).
 *
 * Proves the solution landed, says truthfully where it is, and leads to the
 * policy-chosen next step. The status endpoint returns five public fields and
 * nothing else; the summary and the masked contact come only from the archive
 * this device wrote on submit, never from a refetch. One column, no rail, no
 * bar, no magenta unless an assessment is required.
 */

type NextStep = "quote" | "consultation" | "assessment";

type SolutionStatus = {
  reference: string;
  status: string;
  submittedAt: string;
  durable: boolean;
  nextStep: NextStep | null;
};

type Lookup =
  | { state: "loading" }
  | { state: "ready"; status: SolutionStatus }
  | { state: "missing" }
  | { state: "unavailable" };

const STATUS_PATH = "/api/public/solutions/request/status/";

const HEADING_DURABLE = "Your solution is with DE.";
const HEADING_RECORDED = "Your solution is recorded.";
const STATUS_DURABLE = "Recorded with DE. Keep this reference.";
const STATUS_PENDING = "DE is confirming the record. Keep this reference and call if you do not hear from us.";
const RECORD_LINE = "This page and the reference are your record. Print or save it.";
const SUMMARY_ELSEWHERE = "The summary is on the device you used to send it.";
const UNAVAILABLE_LINE = "DE could not check this reference just now. Keep it, try again, or call.";
const NEXT_HEADING = "What happens next";
const SUMMARY_HEADING = "Your submitted solution";
const SHEET_TITLE = "Submitted solution";
const ASSESSMENT_BAND =
  "This package needs an assessment before final scope. DE contacts you to schedule the conversation first; the formal Cyber Security Risk Assessment is $2,500 when that document is scoped.";
/**
 * The magenta /book?ref= action renders only once the /book copy PR (source of
 * truth §16.6, "PR 0") is MERGED: today /book still says "free" beside an
 * assessment the Store frames at $2,500 when scoped. Flip when that lands.
 */
const BOOK_ALIGNED = false;
const START_ANOTHER = "Start another solution (your profile is kept)";
const MARKETPLACE = "Client? Open Client Marketplace";
const PRINT_SAVE = "Print / save";
const TRY_AGAIN = "Try again";

const QUOTE_STEPS: readonly [string, string, string] = [
  "DE reads the solution",
  "DE calls or emails to confirm scope",
  "You receive pricing to approve",
];
const CONSULTATION_FIRST = "DE recommends Standalone or Co-Managed and says why";
const ASSESSMENT_STEPS: readonly [string, string, string] = [
  "DE reads the solution",
  "DE contacts you to schedule the assessment conversation",
  "Scope, then pricing to approve",
];

/** The three next-step rows, chosen by the policy-derived next step. */
function nextStepRows(step: NextStep): readonly [string, string, string] {
  if (step === "assessment") return ASSESSMENT_STEPS;
  if (step === "consultation") return [CONSULTATION_FIRST, QUOTE_STEPS[1], QUOTE_STEPS[2]];
  return QUOTE_STEPS;
}

function asNextStep(value: unknown): NextStep | null {
  return value === "quote" || value === "consultation" || value === "assessment" ? value : null;
}

/** Exactly the five public fields of the status view; anything else is dropped. */
function parseStatus(raw: unknown, reference: string): SolutionStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const solution = (raw as { solution?: unknown }).solution;
  if (!solution || typeof solution !== "object") return null;
  const view = solution as Record<string, unknown>;
  return {
    reference: typeof view.reference === "string" && view.reference ? view.reference : reference,
    status: typeof view.status === "string" ? view.status : "",
    submittedAt: typeof view.submittedAt === "string" ? view.submittedAt : "",
    durable: view.durable === true,
    nextStep: asNextStep(view.nextStep),
  };
}

/** A draft-shaped view of the archive, only for seeding Ask DE. Nothing is written back. */
function draftFromArchive(archive: SubmittedSolutionArchive | null): SolutionDraft {
  if (!archive) return emptyDraft();
  const packages = Array.isArray(archive.packages) ? archive.packages : [];
  const needs = packages.flatMap((entry): SolutionDraftNeed[] => {
    const family = getFamilyById(entry.familyId);
    return family ? [{ familyId: family.id }] : [];
  });
  return {
    ...emptyDraft(),
    environment: archive.environment ?? emptyDraft().environment,
    deliveryPreference: archive.relationship ?? "",
    needs,
  };
}

/** "DE will reach you at j***@acme.com or ···-4567." The archive holds masked values; masking again is a no-op guard. */
function contactLine(archive: SubmittedSolutionArchive): string | null {
  const email = maskEmail(archive.contact?.emailMasked ?? "");
  const phone = maskPhone(archive.contact?.phoneLast4 ?? "");
  const parts = [email, phone].filter(Boolean);
  if (parts.length === 0) return null;
  return `DE will reach you at ${parts.join(" or ")}.`;
}

export default function SolutionSubmitted() {
  const params = useParams<{ reference?: string }>();
  const reference = (params.reference ?? "").trim().toUpperCase();

  useSEO({
    title: "Submitted | Your Solution | Digerati Experts",
    canonical: undefined,
    noIndex: true,
  });

  const archive = useMemo(() => {
    if (!reference) return null;
    const held = readSubmittedArchive();
    return held && held.reference.trim().toUpperCase() === reference ? held : null;
  }, [reference]);
  const draftLike = useMemo(() => draftFromArchive(archive), [archive]);

  const [lookup, setLookup] = useState<Lookup>({ state: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!reference) return;
    const controller = new AbortController();
    setLookup({ state: "loading" });
    fetch(`${STATUS_PATH}${encodeURIComponent(reference)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          setLookup({ state: "missing" });
          return;
        }
        if (!response.ok) {
          setLookup({ state: "unavailable" });
          return;
        }
        const status = parseStatus(await response.json(), reference);
        setLookup(status ? { state: "ready", status } : { state: "unavailable" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLookup({ state: "unavailable" });
      });
    return () => controller.abort();
  }, [reference, retryCount]);

  // The h1 sits in the status region and receives focus on arrival (§11); the scroll reset owns the position.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  if (!reference || lookup.state === "missing") return <NotFound />;

  const status = lookup.state === "ready" ? lookup.status : null;
  const loading = lookup.state === "loading";
  const known = status !== null || archive !== null;
  const durable = status ? status.durable : archive ? archive.durable !== "memory" : false;
  const nextStep: NextStep = status?.nextStep ?? asNextStep(archive?.nextStep) ?? "quote";
  const rows = nextStepRows(nextStep);
  const showBody = !loading && known;
  const unreachable = lookup.state === "unavailable" && archive === null;
  const contact = archive ? contactLine(archive) : null;

  return (
    <Door2Frame intensity={0}>
        <MegaMenu />
        <main className="d2-main de-nav-clear pb-24">
          <div className="max-w-3xl min-w-0">
            <header className="d2-chapter d2-chapter--first d2-no-print" data-testid="submitted-header">
              <StepLabel>SUBMITTED</StepLabel>
              <div role="status" data-testid="submitted-status-region">
                <h1 ref={headingRef} tabIndex={-1} className="d2-display" data-testid="heading-submitted">
                  {durable ? HEADING_DURABLE : HEADING_RECORDED}
                </h1>
                <span className="d2-hairline-draw" aria-hidden="true" />
              </div>
              <div className="mt-8">
                <ReferenceMark reference={reference} correlationId={archive?.correlationId} />
              </div>

              {showBody ? (
                <div className="mt-6 space-y-3">
                  {archive?.replayed ? (
                    <p className="d2-body d2-ink" data-testid="replayed-line">
                      We already have this request as {reference}. Nothing was sent twice.
                    </p>
                  ) : null}
                  <p className="d2-body d2-ink-strong" data-testid="submitted-status">
                    {durable ? STATUS_DURABLE : STATUS_PENDING}
                  </p>
                  <p className="d2-small d2-ink" data-testid="record-line">
                    {RECORD_LINE}
                  </p>
                  {contact ? (
                    <p className="d2-small d2-ink" data-testid="contact-line">
                      {contact}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {unreachable ? (
                <div className="mt-6 space-y-3">
                  <p className="d2-body d2-ink" data-testid="status-unavailable">
                    {UNAVAILABLE_LINE}
                  </p>
                  <StoreAction variant="quiet" onClick={() => setRetryCount((count) => count + 1)} testId="status-retry">
                    {TRY_AGAIN}
                  </StoreAction>
                </div>
              ) : null}
            </header>

            {showBody ? (
              <StoreChapter id="next" heading={NEXT_HEADING} className="d2-no-print" testId="next-steps">
                <ol className="d2-rows d2-measure mt-8">
                  {rows.map((text, index) => (
                    <li key={text} className="flex gap-4" data-testid={`next-step-${index + 1}`}>
                      <span className="d2-qty" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="d2-body d2-ink-strong min-w-0">{text}</span>
                    </li>
                  ))}
                </ol>
                {nextStep === "assessment" ? (
                  <div className="d2-chapter d2-chapter--paper rounded-2xl px-5 sm:px-8 mt-10" data-testid="assessment-band">
                    <p className="d2-body d2-measure">{ASSESSMENT_BAND}</p>
                    {BOOK_ALIGNED ? (
                      <div className="mt-6">
                        <StoreAction variant="primary" href={`/book?ref=${encodeURIComponent(reference)}`} testId="book-assessment">
                          {CTA.primary}
                        </StoreAction>
                      </div>
                    ) : (
                      <p className="d2-small d2-ink-soft mt-4">Call or ask DE below to start the conversation.</p>
                    )}
                  </div>
                ) : null}
              </StoreChapter>
            ) : null}

            {showBody ? (
              <StoreChapter id="record" heading={SUMMARY_HEADING} headingClassName="d2-h2 d2-no-print" testId="submitted-record">
                {archive ? (
                  <>
                    <div className="mt-8">
                      <ProposalSheet source={{ archive }} title={SHEET_TITLE} reference={reference} />
                    </div>
                    <div className="mt-4 d2-no-print">
                      <StoreAction variant="quiet" onClick={() => window.print()} testId="print-save">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        {PRINT_SAVE}
                      </StoreAction>
                    </div>
                  </>
                ) : (
                  <p className="d2-body d2-ink mt-6" data-testid="summary-elsewhere">
                    {SUMMARY_ELSEWHERE}
                  </p>
                )}
              </StoreChapter>
            ) : null}

            {!loading ? (
              <StoreChapter id="actions" className="d2-no-print" testId="submitted-actions">
                <div className="d2-actions">
                  <StoreAction
                    variant="secondary"
                    href={BUSINESS_NEEDS_INDEX_PATH}
                    onClick={clearSubmittedArchive}
                    testId="start-another"
                    className="d2-action--wrap"
                  >
                    {START_ANOTHER}
                  </StoreAction>
                  <StoreAction variant="quiet" href={portalMarketplaceLoginUrl()} external testId="client-marketplace">
                    {MARKETPLACE}
                  </StoreAction>
                </div>
                <HelpRow seed={solutionAdvisorSeed(draftLike, { reference })} askLabel={`Ask DE about ${reference}`} className="mt-6" />
              </StoreChapter>
            ) : null}
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
    </Door2Frame>
  );
}
