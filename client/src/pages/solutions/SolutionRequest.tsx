import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSEO } from "@/hooks/useSEO";
import {
  BUSINESS_NEEDS_INDEX_PATH,
  getFamilyById,
  getFamilyBySlug,
  parseDeliveryPreference,
  SOLUTION_WORKSPACE_PATH,
} from "@/lib/businessNeeds";
import { DOOR_2_ELIGIBILITY } from "@shared/checkoutEligibility";
import {
  addDraftNeed,
  emptyDraft,
  isProfileComplete,
  patchSolutionDraft,
  profileSummary,
  readSolutionDraft,
  recommendedIntent,
  toRequestNeeds,
  type SolutionDraft,
  type SolutionRequestIntent,
} from "@/lib/solutionDraft";
import { buildSolutionPackage } from "@/lib/solutionPackage";

type FormState = {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

function parseIntent(value: string | null): SolutionRequestIntent | null {
  if (value === "quote" || value === "assessment" || value === "consultation" || value === "request") return value;
  return null;
}

function relationshipLabel(value: string): string {
  if (value === "standalone") return "Standalone · standard pricing";
  if (value === "co_managed") return "Co-managed · preferred pricing";
  return "DE will recommend the operating relationship";
}

export default function SolutionRequest() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [draft, setDraft] = useState<SolutionDraft>(emptyDraft);
  const [form, setForm] = useState<FormState>({ organizationName: "", contactName: "", contactEmail: "", contactPhone: "" });
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ correlationId: string; message: string } | null>(null);

  useSEO({
    title: "Contact | Your Solution",
    description: "Provide the four contact fields needed for Digerati Experts to continue the solution you built.",
    canonical: "/solutions/request",
    noIndex: true,
  });

  useEffect(() => {
    const current = readSolutionDraft();
    const family = getFamilyBySlug(params.get("family") || "");
    const delivery = parseDeliveryPreference(params.get("delivery"));
    const queryIntent = parseIntent(params.get("intent"));
    let next = current;
    if (family) {
      next = addDraftNeed({ familyId: family.id, ...(delivery ? { delivery } : {}) });
    }
    if (delivery && !next.deliveryPreference) next = patchSolutionDraft({ deliveryPreference: delivery });
    if (queryIntent) next = patchSolutionDraft({ intent: queryIntent });
    setDraft(next);
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/solutions/request", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.request) return;
        setRequestId(data.request.id || null);
        setForm((current) => ({
          organizationName: data.request.organizationName || current.organizationName,
          contactName: data.request.contactName || current.contactName,
          contactEmail: data.request.contactEmail || current.contactEmail,
          contactPhone: data.request.contactPhone || current.contactPhone,
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const intent = parseIntent(params.get("intent")) ?? recommendedIntent(draft);
  const needs = toRequestNeeds(draft);
  const packageRows = needs.flatMap((need) => {
    const family = getFamilyById(need.familyId);
    if (!family || (need.deliveryModel !== "standalone" && need.deliveryModel !== "co_managed")) return [];
    return [{ family, packageView: buildSolutionPackage(family, need.deliveryModel, draft.environment) }];
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!isProfileComplete(draft.environment)) {
      setError("Finish the business profile before submitting this solution.");
      return;
    }
    if (needs.length === 0) {
      setError("Select at least one business need before submitting this solution.");
      return;
    }
    if (
      form.organizationName.trim().length < 2 ||
      form.contactName.trim().length < 2 ||
      !form.contactEmail.includes("@") ||
      form.contactPhone.replace(/\D/g, "").length < 7
    ) {
      setError("Company, name, email, and phone are required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/public/solutions/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestId,
          familyId: needs[0]?.familyId,
          offerId: needs[0]?.offerId,
          deliveryModel: needs[0]?.deliveryModel,
          deliveryPreference: draft.deliveryPreference || "unsure",
          selectedNeeds: needs,
          environment: draft.environment,
          fulfillment: draft.fulfillment,
          intent,
          organizationName: form.organizationName,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          idempotencyKey: `${form.contactEmail.trim().toLowerCase()}|${needs.map((need) => need.familyId).sort().join(",")}|${draft.deliveryPreference || "unsure"}|${intent}`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "We could not save your solution. Please try again.");
        return;
      }
      setResult({ correlationId: data.correlationId, message: data.message });
    } catch {
      setError("We could not save your solution. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-de-bg">
      <div className="relative z-10">
        <MegaMenu />
        <main className="de-nav-clear mx-auto max-w-4xl px-4 pb-40 sm:px-6 lg:px-8">
          <Link href={SOLUTION_WORKSPACE_PATH} className="mb-8 inline-flex h-11 items-center text-sm text-white/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Your Solution
          </Link>

          <header className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 4 · Contact</p>
            <h1 className="mt-3 text-4xl font-bold text-white" data-testid="heading-solution-request">Who should DE follow up with?</h1>
            <p className="mt-4 text-white/70">You already did the solution work. We only need four contact fields to continue.</p>
          </header>

          <section className="my-8 rounded-2xl border border-de-hairline bg-de-raised p-6" data-testid="request-selection">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-de-accent-ink">Solution summary</p>
            <p className="mt-3 text-sm text-white/55">Profile: {profileSummary(draft.environment)}</p>
            <p className="mt-1 text-sm text-white/55">Offer: {relationshipLabel(draft.deliveryPreference)}</p>
            <p className="mt-1 text-sm text-white/55">Installation: {draft.fulfillment.installation || "Not selected"} · Remote support: {draft.fulfillment.remoteSupport || "Not selected"}</p>

            {packageRows.length ? (
              <div className="mt-6 space-y-5">
                {packageRows.map(({ family, packageView }) => (
                  <article key={family.id} className="overflow-hidden rounded-xl border border-white/10">
                    <div className="bg-black/15 px-4 py-3">
                      <h2 className="font-semibold text-white">{packageView.offerName}</h2>
                      <p className="mt-1 text-xs text-white/55">{packageView.pricingLabel}</p>
                    </div>
                    <div>
                      {packageView.lineItems.map((line, index) => (
                        <div key={line.label} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-2.5 text-sm ${index ? "border-t border-white/10" : ""}`}>
                          <span className="text-white/70">{line.label}</span>
                          <span className="text-right text-white/40">{line.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/65">
                No complete package is selected. <Link href={BUSINESS_NEEDS_INDEX_PATH} className="text-de-accent-ink underline">Return to the Store</Link>.
              </p>
            )}
          </section>

          {result ? (
            <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6" data-testid="request-confirmation">
              <CheckCircle2 className="h-7 w-7 text-emerald-300" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold text-white">Solution submitted</h2>
              <p className="mt-3 text-white/75">{result.message}</p>
              <p className="mt-3 text-sm text-white/55">Reference: {result.correlationId}</p>
              <Button asChild variant="outline" className="mt-6 h-11 border-white/20 text-white hover:bg-white/10">
                <Link href={BUSINESS_NEEDS_INDEX_PATH}>Return to the Store</Link>
              </Button>
            </section>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate data-eligibility={DOOR_2_ELIGIBILITY}>
              <div className="space-y-2">
                <Label htmlFor="sr-org" className="text-white/80">Company name</Label>
                <Input id="sr-org" required value={form.organizationName} onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))} className="h-11 border-white/15 bg-de-raised text-white" autoComplete="organization" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sr-name" className="text-white/80">Name</Label>
                <Input id="sr-name" required value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} className="h-11 border-white/15 bg-de-raised text-white" autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sr-email" className="text-white/80">Email</Label>
                <Input id="sr-email" type="email" required value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} className="h-11 border-white/15 bg-de-raised text-white" autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sr-phone" className="text-white/80">Phone</Label>
                <Input id="sr-phone" type="tel" required value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} className="h-11 border-white/15 bg-de-raised text-white" autoComplete="tel" />
              </div>

              <div aria-live="polite" className="min-h-6 text-sm text-[#f5b4c8] sm:col-span-2" data-testid="request-error">{error}</div>

              <div className="sm:col-span-2">
                <Button type="submit" variant="brand" className="h-11 w-full sm:w-auto" disabled={submitting || packageRows.length === 0}>
                  {submitting ? "Submitting…" : intent === "assessment" ? "Submit & continue to assessment" : "Submit solution"}
                </Button>
                <p className="mt-3 text-xs text-white/55">No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment.</p>
              </div>
            </form>
          )}
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    </div>
  );
}
