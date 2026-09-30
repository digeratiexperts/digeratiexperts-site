import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { useSEO } from "@/hooks/useSEO";
import { useAnnouncer } from "@/components/AccessibleAnnouncer";
import { useMinWidth, useSolutionDraft } from "@/hooks/useSolutionDraft";
import { Door2Frame } from "@/components/store/door2/Door2Frame";
import { HelpRow, StoreAction, StoreChapter } from "@/components/store/door2/primitives";
import { OfflinePanel, type OfflineKind } from "@/components/store/door2/OfflinePanel";
import { getFamilyBySlug, SOLUTION_WORKSPACE_PATH, STORE_STEPS, submittedPath } from "@/lib/businessNeeds";
import {
  addDraftNeed,
  archiveSubmittedDraft,
  ensureSubmitAttemptId,
  profileGaps,
  profileSummary,
  readSolutionDraft,
  recommendedIntent,
  resolvedPackages,
  summarizeForArchive,
  toRequestNeeds,
  type SolutionDraft,
  type SubmittedSolutionArchive,
} from "@/lib/solutionDraft";
import { ASSESSMENT_LABELS, installModeDetail, RELATIONSHIP_LABELS, resolveInstallMode, SUPPORT_LABELS } from "@/lib/solutionPackage";
import { coverageForFamilies, solutionAdvisorSeed } from "@/lib/solutionGuidance";
import { PUBLIC_CONTACT_MESSAGES, publicContactProblems, type PublicContactField, type PublicContactFields } from "@shared/publicContact";
import { COMPANY } from "@shared/companyContact";
import { DOOR_2_ELIGIBILITY } from "@shared/checkoutEligibility";

/*
 * D · Sign (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §5.4). The one paper
 * chapter in the flow: what the buyer is sending, in plain words, beside a
 * white card with four fields and nothing else. No payment, no rail, no bar.
 */

const REQUEST_ENDPOINT = "/api/public/solutions/request";
const CONTACT_STEP = STORE_STEPS[5];

const H1 = "Who should DE follow up with?";
const LEDE = "You already did the solution work. Four fields, then it's DE's turn.";
const SANCTIONED_LINE = "No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment.";
const NEXT_STEPS = [
  "A person at DE reads Your Solution.",
  "DE emails or calls to confirm fit, scope, delivery and pricing.",
  "Nothing is billed until you say yes.",
] as const;
const PRIMARY_SUBMIT = "Submit Solution";
const PRIMARY_RECOMMEND = "Submit & have DE recommend";
const PRIMARY_SENDING = "Sending…";
const OPEN_RELATIONSHIP = "Left with DE to recommend";
const REASON_NO_NEEDS = "Add at least one need first";
const BACK_LABEL = "Back to Your Solution";

type FieldSpec = {
  key: PublicContactField;
  id: string;
  label: string;
  autoComplete: string;
  type?: "email" | "tel";
  inputMode?: "email" | "tel";
};

const FIELDS: readonly FieldSpec[] = [
  { key: "organizationName", id: "sr-org", label: "Company name", autoComplete: "organization" },
  { key: "contactName", id: "sr-name", label: "Name", autoComplete: "name" },
  { key: "contactEmail", id: "sr-email", label: "Email", autoComplete: "email", type: "email", inputMode: "email" },
  { key: "contactPhone", id: "sr-phone", label: "Phone", autoComplete: "tel", type: "tel", inputMode: "tel" },
];

const EMPTY_FIELDS: PublicContactFields = { organizationName: "", contactName: "", contactEmail: "", contactPhone: "" };

type Problems = Partial<Record<PublicContactField, string>>;
type SummaryRow = { label: string; text: string };

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function trimFields(fields: PublicContactFields): PublicContactFields {
  return {
    organizationName: fields.organizationName.trim(),
    contactName: fields.contactName.trim(),
    contactEmail: fields.contactEmail.trim(),
    contactPhone: fields.contactPhone.trim(),
  };
}

/** Which field a server message is about, when it is about exactly one. */
function fieldNamedBy(text: string): PublicContactField | null {
  const exact = (Object.keys(PUBLIC_CONTACT_MESSAGES) as PublicContactField[]).find((key) => PUBLIC_CONTACT_MESSAGES[key] === text);
  if (exact) return exact;
  const named: PublicContactField[] = [];
  if (/\bemail\b/i.test(text)) named.push("contactEmail");
  if (/\bphone\b/i.test(text)) named.push("contactPhone");
  if (/\bcompany\b/i.test(text)) named.push("organizationName");
  else if (/\bname\b/i.test(text)) named.push("contactName");
  return named.length === 1 ? named[0] : null;
}

function asDurable(value: unknown): SubmittedSolutionArchive["durable"] {
  return value === "database" || value === "crm" ? value : "memory";
}

function asNextStep(value: unknown, draft: SolutionDraft): SubmittedSolutionArchive["nextStep"] {
  if (value === "quote" || value === "consultation" || value === "assessment") return value;
  const intent = recommendedIntent(draft);
  return intent === "assessment" || intent === "consultation" ? intent : "quote";
}

/** The summary in public words: every row the buyer sees on the left, reused for the email fallback. */
function summaryRows(draft: SolutionDraft): SummaryRow[] {
  const packages = resolvedPackages(draft);
  const relationship = draft.deliveryPreference;
  const open = relationship === "unsure" || relationship === "";
  const gaps = profileGaps(draft.environment);
  const rows: SummaryRow[] = [];

  rows.push({
    label: "Profile",
    text: gaps.length ? `${profileSummary(draft.environment)} · still needed: ${gaps.join(", ")}` : profileSummary(draft.environment),
  });
  rows.push({
    label: "Relationship",
    text: relationship === "" ? "Choose on Your Solution" : open ? OPEN_RELATIONSHIP : RELATIONSHIP_LABELS[relationship],
  });

  for (const { family, policyView } of packages) {
    const name = open ? `${family.label} · DE confirms Standalone or Co-Managed` : policyView.offerName;
    const install = installModeDetail(resolveInstallMode(draft.fulfillment.installation, policyView).mode, policyView.shipmentMode).label;
    const parts = [name, install];
    if (policyView.assessmentPolicy !== "not_required") parts.push(ASSESSMENT_LABELS[policyView.assessmentPolicy]);
    rows.push({ label: "Package", text: parts.join(" · ") });
  }

  const support = draft.fulfillment.remoteSupport;
  rows.push({ label: "Remote support", text: support ? SUPPORT_LABELS[support].label : OPEN_RELATIONSHIP });

  const blocks = coverageForFamilies(draft.needs.map((need) => need.familyId))
    .cells.filter((cell) => cell.state === "in_solution")
    .map((cell) => cell.label);
  if (blocks.length) rows.push({ label: "Works in", text: blocks.join(", ") });

  return rows;
}

function buildMailto(rows: SummaryRow[], fields: PublicContactFields): string {
  const lines = ["Solution request for Digerati Experts", "", ...rows.map((row) => `${row.label}: ${row.text}`)];
  const contact = trimFields(fields);
  const contactLines = FIELDS.filter((field) => contact[field.key]).map((field) => `${field.label}: ${contact[field.key]}`);
  if (contactLines.length) lines.push("", ...contactLines);
  return `mailto:${COMPANY.email}?subject=${encodeURIComponent("Solution request")}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export default function SolutionRequest() {
  useSEO({
    title: "Contact | Your Solution | Digerati Experts",
    description: "Four contact fields so Digerati Experts can confirm the solution you built. No payment is taken here.",
    canonical: "/solutions/request",
    noIndex: true,
  });

  const search = useSearch();
  const [, navigate] = useLocation();
  const draft = useSolutionDraft();
  const { announce } = useAnnouncer();
  const wide = useMinWidth(1024);

  const [fields, setFields] = useState<PublicContactFields>(EMPTY_FIELDS);
  const [problems, setProblems] = useState<Problems>({});
  const [formError, setFormError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState<OfflineKind | null>(null);
  const [serverBlock, setServerBlock] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  useEffect(() => {
    setServerBlock(null);
  }, [draft.updatedAt]);
  const inputs = useRef<Partial<Record<PublicContactField, HTMLInputElement | null>>>({});
  const lastKey = useRef<string | null>(null);

  /* A `?family=` link seeds an EMPTY draft only, then lands on the workspace so the buyer sees the package before signing. */
  useEffect(() => {
    const slug = new URLSearchParams(search).get("family") || "";
    if (!slug) return;
    const family = getFamilyBySlug(slug);
    if (!family) return;
    if (readSolutionDraft().needs.length > 0) return;
    addDraftNeed({ familyId: family.id });
    announce(`${family.label} added to Your Solution`);
    navigate(`${SOLUTION_WORKSPACE_PATH}?seeded=${encodeURIComponent(slug)}`, { replace: true });
  }, [search, announce, navigate]);

  /* Remember the session's draft id so the submit lands on DE's copy. A draft never carries contact fields (§7). */
  useEffect(() => {
    let cancelled = false;
    void fetch(REQUEST_ENDPOINT, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { request?: Record<string, unknown> } | null) => {
        if (cancelled || !data?.request) return;
        const record = data.request;
        if (typeof record.id === "string" && record.id) setRequestId(record.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const packages = resolvedPackages(draft);
  const relationship = draft.deliveryPreference;
  const gaps = profileGaps(draft.environment);
  const rows = summaryRows(draft);
  const assessmentFamilies = packages.filter((entry) => entry.policyView.assessmentPolicy === "required").map((entry) => entry.family.label);
  const showAssessmentLine = recommendedIntent(draft) === "assessment" && assessmentFamilies.length > 0;
  const blockedReason =
    packages.length === 0
      ? REASON_NO_NEEDS
      : gaps.length
        ? `Finish Your Solution: ${gaps.join(", ")}`
        : relationship === ""
          ? "Finish Your Solution: relationship"
          : serverBlock;
  const blocked = blockedReason !== null;
  const primaryLabel = sending ? PRIMARY_SENDING : relationship === "unsure" ? PRIMARY_RECOMMEND : PRIMARY_SUBMIT;
  const packageCount = packages.length;
  const disclosureLabel = `What you're sending (${packageCount} ${packageCount === 1 ? "package" : "packages"})`;

  const onFieldChange = (key: PublicContactField) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFields((current) => ({ ...current, [key]: value }));
    setProblems((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const placeProblems = (next: Problems) => {
    setProblems(next);
    const labels = FIELDS.filter((field) => next[field.key]).map((field) => field.label);
    if (labels.length) announce(`Check ${labels.length === 1 ? "one field" : `${labels.length} fields`}: ${labels.join(", ")}.`);
  };

  // Focus lands on the first invalid field once the form is enabled again (a server 400 arrives while it is still inert).
  useEffect(() => {
    if (sending) return;
    const first = FIELDS.find((field) => problems[field.key]);
    if (first) inputs.current[first.key]?.focus();
  }, [problems, sending]);

  const send = async (key: string) => {
    const contact = trimFields(fields);
    const needs = toRequestNeeds(draft);
    const lead = needs[0];
    setSending(true);
    // The OfflinePanel stays mounted through a retry (its Try again shows "Sending…"); it clears on an answer.
    setFormError("");
    try {
      const response = await fetch(REQUEST_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.serverDraftId ?? requestId,
          familyId: lead?.familyId,
          offerId: lead?.offerId,
          deliveryModel: lead?.deliveryModel,
          // "" reaches the server as "" so RELATIONSHIP_REQUIRED is its answer, never a silent Help me choose.
          deliveryPreference: relationship,
          selectedNeeds: needs,
          environment: draft.environment,
          fulfillment: draft.fulfillment,
          suggestion: draft.suggestion,
          organizationName: contact.organizationName,
          contactName: contact.contactName,
          contactEmail: contact.contactEmail,
          contactPhone: contact.contactPhone,
          idempotencyKey: key,
          company_website: honeypot,
        }),
      });
      const data: Record<string, unknown> = await response.json().catch(() => ({}));

      if (response.ok) {
        const reference = typeof data.reference === "string" ? data.reference : "";
        if (!reference) {
          setOffline("durable");
          return;
        }
        const archive = summarizeForArchive(draft, contact, {
          reference,
          correlationId: typeof data.correlationId === "string" ? data.correlationId : "",
          durable: asDurable(data.durable),
          nextStep: asNextStep(data.nextStep, draft),
          replayed: data.replayed === true,
        });
        archiveSubmittedDraft(archive);
        navigate(submittedPath(reference));
        return;
      }

      const message = typeof data.error === "string" ? data.error : "";
      if (response.status === 429) {
        setOffline("rate");
        return;
      }
      if (response.status >= 500) {
        setOffline("durable");
        return;
      }
      setOffline(null);
      if (response.status === 400) {
        const code = typeof data.code === "string" ? data.code : "";
        if (code === "NEEDS_REQUIRED" || code === "PROFILE_INCOMPLETE" || code === "RELATIONSHIP_REQUIRED") {
          setServerBlock(
            code === "NEEDS_REQUIRED"
              ? REASON_NO_NEEDS
              : code === "PROFILE_INCOMPLETE"
                ? `Finish Your Solution: ${profileGaps(readSolutionDraft().environment).join(", ") || "profile"}`
                : "Finish Your Solution: relationship",
          );
          return;
        }
        const local = publicContactProblems(contact);
        if (Object.keys(local).length) {
          placeProblems(local);
          return;
        }
        const field = message ? fieldNamedBy(message) : null;
        if (field) {
          placeProblems({ [field]: message });
          return;
        }
        setFormError(message || "DE couldn't take this yet. Check the four fields and try again.");
        return;
      }
      setFormError(message || "DE couldn't take this yet. Try again in a moment.");
    } catch {
      setOffline("network");
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || blocked) return;
    const contact = trimFields(fields);
    const local = publicContactProblems(contact);
    if (Object.keys(local).length) {
      placeProblems(local);
      return;
    }
    setProblems({});
    // One key per solution and address: a retry replays, a solution built after "Start another" never does (§7).
    const key = `${ensureSubmitAttemptId()}|${contact.contactEmail.toLowerCase()}`;
    lastKey.current = key;
    void send(key);
  };

  const onRetry = () => {
    if (sending) return;
    void send(lastKey.current ?? `${ensureSubmitAttemptId()}|${fields.contactEmail.trim().toLowerCase()}`);
  };

  const selectionList = (
    <ul className="d2-rows d2-small mt-4" data-testid="request-selection">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`} className="grid gap-1 sm:grid-cols-12 sm:gap-4">
          <span className="d2-label d2-ink-soft sm:col-span-3 pt-1">{row.label}</span>
          <span className="d2-ink-strong min-w-0 break-words sm:col-span-9">{row.text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <Door2Frame intensity={0}>
        <MegaMenu />
        <main className="d2-main de-nav-clear pb-24">
          <StoreChapter tone="paper" first id="contact" n={CONTACT_STEP.n} eyebrow={CONTACT_STEP.label} srText={CONTACT_STEP.sr} className="rounded-2xl px-5 sm:px-8">
            <h1 className="d2-h2 d2-measure" data-testid="heading-solution-request">
              {H1}
            </h1>
            <p className="d2-lede d2-ink d2-measure mt-4">{LEDE}</p>

            <div className="grid gap-8 mt-8 lg:grid-cols-12 lg:gap-12">
              {/* The card first in DOM: at 390 the buyer signs before reading the summary again. */}
              <div className="min-w-0 lg:col-span-5 lg:order-2">
                <div className="d2-card">
                  <form noValidate onSubmit={onSubmit} data-eligibility={DOOR_2_ELIGIBILITY} data-testid="request-form">
                    <fieldset disabled={sending || blocked} className="min-w-0 space-y-5">
                      {FIELDS.map((field) => {
                        const problem = problems[field.key];
                        const errorId = `${field.id}-error`;
                        return (
                          <div key={field.id} className="d2-field">
                            <label htmlFor={field.id} className="d2-field__label">
                              {field.label}
                            </label>
                            <input
                              id={field.id}
                              name={field.key}
                              className="d2-input"
                              type={field.type ?? "text"}
                              inputMode={field.inputMode}
                              autoComplete={field.autoComplete}
                              value={fields[field.key]}
                              onChange={onFieldChange(field.key)}
                              aria-invalid={problem ? true : undefined}
                              aria-describedby={problem ? errorId : undefined}
                              ref={(node) => {
                                inputs.current[field.key] = node;
                              }}
                              data-testid={`input-${field.id}`}
                            />
                            {problem ? (
                              <p id={errorId} className="d2-field__error" data-testid={`${field.id}-error`}>
                                {problem}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </fieldset>

                    <div className="sr-only" aria-hidden="true">
                      <label>
                        Website
                        <input name="company_website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
                      </label>
                    </div>

                    <p className="d2-small d2-ink mt-6">{SANCTIONED_LINE}</p>

                    <h2 className="d2-label d2-ink-soft mt-6">What happens next</h2>
                    <ol className="d2-rows d2-small mt-3">
                      {NEXT_STEPS.map((step, index) => (
                        <li key={step} className="flex gap-3">
                          <span className="d2-qty" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="d2-ink min-w-0">{step}</span>
                        </li>
                      ))}
                    </ol>

                    {showAssessmentLine ? (
                      <p className="d2-small d2-ink mt-6" data-testid="assessment-line">
                        An assessment comes next for {joinNames(assessmentFamilies)}. DE contacts you to schedule it after you submit.
                      </p>
                    ) : null}

                    {formError ? (
                      <p role="alert" className="d2-field__error mt-6" data-testid="request-error">
                        {formError}
                      </p>
                    ) : null}

                    <div className="mt-6">
                      {offline ? (
                        <OfflinePanel kind={offline} onRetry={onRetry} mailto={buildMailto(rows, fields)} retrying={sending} />
                      ) : (
                        <>
                          <StoreAction type="submit" variant="primary" block disabled={blocked} reason={blockedReason ?? undefined} ariaBusy={sending} testId="submit-solution">
                            {primaryLabel}
                          </StoreAction>
                          {blocked ? (
                            <div className="mt-2">
                              <StoreAction variant="quiet" href={SOLUTION_WORKSPACE_PATH} testId="back-to-solution">
                                {BACK_LABEL}
                              </StoreAction>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </form>

                  <HelpRow seed={solutionAdvisorSeed(draft)} className="mt-6" />

                  {blocked ? null : (
                    <div className="mt-4">
                      <StoreAction variant="quiet" href={SOLUTION_WORKSPACE_PATH} testId="back-to-solution">
                        <span aria-hidden="true">← </span>
                        {BACK_LABEL}
                      </StoreAction>
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 lg:col-span-7 lg:order-1">
                {wide ? (
                  <section aria-labelledby="request-selection-heading" data-testid="request-summary">
                    <h2 id="request-selection-heading" className="d2-h3">
                      What you're sending
                    </h2>
                    {selectionList}
                  </section>
                ) : (
                  <details className="d2-disclosure" open={summaryOpen} onToggle={(event) => setSummaryOpen(event.currentTarget.open)} data-testid="request-summary">
                    <summary>
                      <h2 className="d2-h3">{disclosureLabel}</h2>
                    </summary>
                    {selectionList}
                  </details>
                )}
              </div>
            </div>
          </StoreChapter>
        </main>
        <DigeratiEnhancedFooterSection variant="store" />
    </Door2Frame>
  );
}
