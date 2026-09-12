import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, ClipboardCheck, Layers, Save, Trash2, Truck, Wrench } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { SolutionProfileForm } from "@/components/store/SolutionProfileForm";
import { Button } from "@/components/ui/button";
import { getFamilyById, requestPath } from "@/lib/businessNeeds";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import {
  emptyDraft,
  isProfileComplete,
  patchEnvironment,
  patchFulfillment,
  profileSummary,
  readSolutionDraft,
  recommendedIntent,
  removeDraftNeed,
  resolvedNeedDelivery,
  SOLUTION_DRAFT_EVENT,
  toRequestNeeds,
  writeSolutionDraft,
  type DeliveryPreference,
  type InstallationPreference,
  type RemoteSupportPreference,
  type SolutionDraft,
  type SolutionEnvironment,
  type SolutionFulfillmentPreference,
} from "@/lib/solutionDraft";
import { assessmentPolicyLabel, buildSolutionPackage, type InstallMode } from "@/lib/solutionPackage";
import { useSEO } from "@/hooks/useSEO";

const DELIVERY_OPTIONS: Array<[DeliveryPreference, string, string]> = [
  ["standalone", "Standalone", "Standard pricing. You or your existing IT provider own implementation and ongoing operation."],
  ["co_managed", "Co-Managed", "Preferred pricing where applicable. Your team and DE share defined responsibilities."],
  ["unsure", "Help me choose", "Save the need now and let DE recommend the operating relationship before final package submission."],
];

const INSTALL_OPTIONS: Array<[InstallationPreference, string]> = [
  ["self_install", "Self-install"],
  ["remote_assist", "Remote DE setup"],
  ["onsite", "Schedule a technician"],
  ["unsure", "Help me choose"],
];

const SUPPORT_OPTIONS: Array<[RemoteSupportPreference, string]> = [
  ["none", "No remote support"],
  ["as_needed", "Remote help as needed"],
  ["ongoing", "Ongoing shared support"],
  ["unsure", "Help me choose"],
];

export default function PublicStoreCheckout() {
  const [draft, setDraft] = useState<SolutionDraft>(emptyDraft);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState<string>("");

  useSEO({
    title: "Your Solution | Digerati Experts",
    description: "Build and save one composed Digerati Experts solution from profile through package delivery.",
    canonical: "/store/solution",
    noIndex: true,
  });

  useEffect(() => {
    const refresh = () => setDraft(readSolutionDraft());
    refresh();
    window.addEventListener(SOLUTION_DRAFT_EVENT, refresh);
    return () => window.removeEventListener(SOLUTION_DRAFT_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/solutions/request", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.request?.id) setRequestId(data.request.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () =>
      draft.needs.flatMap((item) => {
        const family = getFamilyById(item.familyId);
        const delivery = resolvedNeedDelivery(item, draft.deliveryPreference);
        return family ? [{ item, family, delivery }] : [];
      }),
    [draft.needs, draft.deliveryPreference],
  );

  const packages = useMemo(
    () =>
      rows.flatMap(({ family, delivery }) =>
        delivery === "standalone" || delivery === "co_managed"
          ? [{ family, delivery, packageView: buildSolutionPackage(family, delivery, draft.environment) }]
          : [],
      ),
    [rows, draft.environment],
  );

  const availableInstallModes = useMemo(
    () => new Set<InstallMode>(packages.flatMap((entry) => entry.packageView.installModes)),
    [packages],
  );

  const intent = recommendedIntent(draft);
  const profileReady = isProfileComplete(draft.environment);
  const offerReady =
    draft.needs.length > 0 &&
    (draft.deliveryPreference === "standalone" || draft.deliveryPreference === "co_managed") &&
    packages.length === draft.needs.length;
  const fulfillmentReady = !!draft.fulfillment.installation && !!draft.fulfillment.remoteSupport;
  const readyForContact = profileReady && offerReady && fulfillmentReady;

  const setEnv = <K extends keyof SolutionEnvironment>(key: K, value: SolutionEnvironment[K]) => {
    setDraft(writeSolutionDraft(patchEnvironment(readSolutionDraft(), { [key]: value })));
  };

  const setFulfillment = <K extends keyof SolutionFulfillmentPreference>(
    key: K,
    value: SolutionFulfillmentPreference[K],
  ) => {
    setDraft(writeSolutionDraft(patchFulfillment(readSolutionDraft(), { [key]: value })));
  };

  const applyDelivery = (value: DeliveryPreference) => {
    const current = readSolutionDraft();
    const next: SolutionDraft = {
      ...current,
      deliveryPreference: value,
      needs: current.needs.map((need) => ({ ...need, delivery: value })),
    };
    setDraft(writeSolutionDraft(next));
  };

  const saveProgress = async () => {
    const current = readSolutionDraft();
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/public/solutions/request", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestId,
          deliveryPreference: current.deliveryPreference || "unsure",
          selectedNeeds: toRequestNeeds(current),
          environment: current.environment,
          fulfillment: current.fulfillment,
          intent: recommendedIntent(current),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save progress.");
      if (data?.request?.id) setRequestId(data.request.id);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save progress.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-clip bg-[#0a0a0a]">
      <StorePageAtmosphere />
      <div className="relative z-10">
        <MegaMenu />
        <main className="de-nav-clear mx-auto max-w-6xl px-4 pb-28 sm:px-6 lg:px-8">
          <Link href="/store" className="mb-8 inline-flex min-h-11 items-center text-sm text-white/55 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to pains & needs
          </Link>

          <header className="mb-9 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-de-accent-ink">Your Solution</p>
            <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white">Build one complete solution</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              Profile → pain or need → offer → package → delivery → contact. Every layer uses the same saved draft.
            </p>
          </header>

          {/* minmax(0,1fr) at the BASE breakpoint too: an auto track sizes to
              min-content, and StatusLine's nowrap detail line inflated it to
              ~482px at 390px viewports, clipping the whole workspace column
              (error-sweep finding, 2026-08-31). */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="space-y-8">
              <SolutionProfileForm environment={draft.environment} onChange={setEnv} heading="Business profile" description="These counts size package quantities throughout the Store. Change them here at any time." />

              <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-7" aria-labelledby="needs-heading">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 1 · Pain or need</p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <h2 id="needs-heading" className="text-2xl font-semibold text-white">What are we solving?</h2>
                    <p className="mt-2 text-sm text-white/55">All selected needs become one composed solution request.</p>
                  </div>
                  <Link href="/store" className="shrink-0 text-sm font-medium text-de-accent-ink hover:underline">Add need</Link>
                </div>
                <div className="mt-5 space-y-3">
                  {rows.length ? rows.map(({ item, family }) => (
                    <div key={item.familyId} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                      <div>
                        <h3 className="font-semibold text-white">{family.label}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-white/55">{family.description}</p>
                      </div>
                      <button type="button" onClick={() => removeDraftNeed(item.familyId)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/45 hover:bg-white/5 hover:text-white" aria-label={`Remove ${family.label}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-white/15 px-5 py-9 text-center">
                      <ClipboardCheck className="mx-auto h-7 w-7 text-white/30" />
                      <p className="mt-3 text-white/60">Add at least one pain or business need.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-7" aria-labelledby="offer-heading">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 2 · Solution offer</p>
                <h2 id="offer-heading" className="mt-2 text-2xl font-semibold text-white">How do you want to buy it?</h2>
                <p className="mt-2 text-sm text-white/55">This choice applies to the composed solution so responsibilities and pricing do not conflict between packages.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Solution offer type">
                  {DELIVERY_OPTIONS.map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={draft.deliveryPreference === value}
                      className={`min-h-[7.5rem] rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] ${draft.deliveryPreference === value ? "border-de-accent bg-de-accent/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                      onClick={() => applyDelivery(value)}
                    >
                      <span className="block font-semibold text-white">{label}</span>
                      <span className="mt-2 block text-xs leading-relaxed text-white/50">{description}</span>
                    </button>
                  ))}
                </div>
                {draft.deliveryPreference === "unsure" ? (
                  <p className="mt-4 text-sm text-amber-200/80">Help me choose is saved, but a final package cannot be submitted until DE or the buyer selects Standalone or Co-Managed.</p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-7" aria-labelledby="package-heading">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 3 · Package</p>
                <h2 id="package-heading" className="mt-2 text-2xl font-semibold text-white">What is included?</h2>
                <p className="mt-2 text-sm text-white/55">Line-item quantities derive from the business profile instead of being entered again on every package.</p>
                <div className="mt-6 space-y-5">
                  {packages.length ? packages.map(({ family, packageView }) => (
                    <article key={family.id} className="overflow-hidden rounded-xl border border-white/10">
                      <div className="flex flex-col gap-3 bg-black/20 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-white">{packageView.offerName}</h3>
                          <p className="mt-1 text-xs text-white/45">{packageView.relationshipLabel} · {packageView.pricingLabel}</p>
                        </div>
                        <span className="text-xs text-de-accent-ink">{assessmentPolicyLabel(packageView.assessmentPolicy)}</span>
                      </div>
                      <div>
                        {packageView.lineItems.map((line, index) => (
                          <div key={line.label} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-sm ${index ? "border-t border-white/10" : ""}`}>
                            <span className="text-white/75">{line.label}</span>
                            <span className="text-right text-white/45">{line.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/10 bg-black/10 px-4 py-4 text-xs leading-relaxed text-white/50">
                        <p><Truck className="mr-2 inline h-3.5 w-3.5 text-de-accent-ink" />{packageView.shipmentCopy}</p>
                        <p className="mt-2"><Wrench className="mr-2 inline h-3.5 w-3.5 text-de-accent-ink" />{packageView.technicianCopy}</p>
                      </div>
                    </article>
                  )) : (
                    <div className="rounded-xl border border-dashed border-white/15 px-5 py-9 text-center text-white/55">
                      Choose Standalone or Co-Managed above to generate package line items and fulfillment rules.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-7" aria-labelledby="delivery-heading">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 4 · Delivery & setup</p>
                <h2 id="delivery-heading" className="mt-2 text-2xl font-semibold text-white">How should this be implemented?</h2>
                <p className="mt-2 text-sm text-white/55">Not every package needs shipping or a technician. Unsupported choices are disabled automatically.</p>

                <fieldset className="mt-6">
                  <legend className="text-sm font-medium text-white/80">Installation</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {INSTALL_OPTIONS.map(([value, label]) => {
                      const concrete = value === "self_install" || value === "remote_assist" || value === "onsite" ? value : null;
                      const disabled = !!concrete && packages.length > 0 && !availableInstallModes.has(concrete);
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={disabled}
                          aria-pressed={draft.fulfillment.installation === value}
                          className={`min-h-11 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] disabled:cursor-not-allowed disabled:opacity-30 ${draft.fulfillment.installation === value ? "border-de-accent bg-de-accent/10 text-white" : "border-white/10 bg-black/20 text-white/65 hover:bg-white/5"}`}
                          onClick={() => setFulfillment("installation", value)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="mt-5">
                  <legend className="text-sm font-medium text-white/80">Remote support</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {SUPPORT_OPTIONS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={draft.fulfillment.remoteSupport === value}
                        className={`min-h-11 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] ${draft.fulfillment.remoteSupport === value ? "border-de-accent bg-de-accent/10 text-white" : "border-white/10 bg-black/20 text-white/65 hover:bg-white/5"}`}
                        onClick={() => setFulfillment("remoteSupport", value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111111] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-label="Save solution progress">
                <div>
                  <h2 className="font-semibold text-white">Save your progress</h2>
                  <p className="mt-1 text-sm text-white/50">The draft autosaves locally. This button also saves it to the current DE browser session.</p>
                  {savedAt ? <p className="mt-2 text-xs text-emerald-300"><Check className="mr-1 inline h-3.5 w-3.5" />Saved at {savedAt}</p> : null}
                  {saveError ? <p className="mt-2 text-xs text-red-300">{saveError}</p> : null}
                </div>
                <Button type="button" variant="outline" className="h-11 border-white/20 text-white hover:bg-white/10" onClick={saveProgress} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save progress"}
                </Button>
              </section>
            </div>

            {/* Sticky at lg, but capped to the viewport slot under the fixed header
                (top-28 = 7rem, plus 1rem breathing room) and scrollable inside,
                so the Continue / Ask DE controls at the bottom of the rail are
                reachable at 900px-tall desktops instead of only at page end. */}
            <aside className="h-fit rounded-2xl border border-white/10 bg-[#121212] p-6 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:overscroll-contain">
              <Layers className="h-8 w-8 text-de-accent-ink" />
              <h2 className="mt-4 text-xl font-semibold text-white">Solution status</h2>
              <div className="mt-5 space-y-3 text-sm">
                <StatusLine ready={profileReady} label="Profile" detail={profileSummary(draft.environment)} />
                <StatusLine ready={draft.needs.length > 0} label="Pain / need" detail={`${draft.needs.length} selected`} />
                <StatusLine ready={offerReady} label="Offer" detail={draft.deliveryPreference === "unsure" ? "Needs DE recommendation" : draft.deliveryPreference || "Not selected"} />
                <StatusLine ready={packages.length === draft.needs.length && packages.length > 0} label="Package" detail={`${packages.length} package${packages.length === 1 ? "" : "s"}`} />
                <StatusLine ready={fulfillmentReady} label="Delivery" detail={fulfillmentReady ? "Selected" : "Choose setup + support"} />
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-xs uppercase tracking-wide text-white/55">Next</p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {draft.deliveryPreference === "unsure"
                    ? "Ask DE to recommend Standalone or Co-Managed before final package submission."
                    : intent === "assessment"
                      ? "This solution contains work that requires an assessment before final scope. Contact details come next; the assessment is routed after submission."
                      : "Contact details come last. DE will confirm scope, fulfillment, and package pricing before commitment."}
                </p>
                {readyForContact ? (
                  <Button asChild className="mt-5 h-11 w-full bg-[#D3126A] text-white hover:bg-[#b90f5d]">
                    <Link href={requestPath({ intent })}>Continue to contact details</Link>
                  </Button>
                ) : (
                  <Button className="mt-5 h-11 w-full" disabled>Finish the steps above</Button>
                )}
                <Button type="button" variant="outline" className="mt-3 h-11 w-full border-white/20 text-white hover:bg-white/10" onClick={() => openMspAdvisor({ context: "other", seedMessage: "I am building a Digerati Experts solution and want help choosing the offer, package, implementation, or support model." })}>
                  Ask DE
                </Button>
              </div>
            </aside>
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    </div>
  );
}

function StatusLine({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-white">{label}</span>
        <span className={`text-xs ${ready ? "text-emerald-300" : "text-white/55"}`}>{ready ? "Ready" : "Needed"}</span>
      </div>
      <p className="mt-1 truncate text-xs text-white/55">{detail}</p>
    </div>
  );
}
