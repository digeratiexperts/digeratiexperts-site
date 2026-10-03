import {
  profileSummary,
  resolvedPackages,
  type SolutionDraft,
  type SubmittedSolutionArchive,
} from "@/lib/solutionDraft";
import {
  ASSESSMENT_LABELS,
  installModeDetail,
  PRICING_LABELS,
  RELATIONSHIP_LABELS,
  resolveInstallMode,
  SUPPORT_LABELS,
  type SolutionLineItem,
} from "@/lib/solutionPackage";
import { SheetRows } from "./PackageSheet";

type ProposalPackage = {
  familyId: string;
  familyLabel: string;
  offerName: string;
  pricingLabel: string;
  assessmentLabel: string;
  lineItems: SolutionLineItem[];
  setupLabel: string;
};

export type ProposalSource = { archive: SubmittedSolutionArchive } | { draft: SolutionDraft };

/** Resolved presentation view — shared by the on-screen sheet and the PDF packet. */
export function packagesFrom(source: ProposalSource): {
  packages: ProposalPackage[];
  relationship: string;
  profile: string;
  support: string;
  sized: boolean;
} {
  if ("archive" in source) {
    const a = source.archive;
    return {
      sized: true,
      profile: profileSummary(a.environment),
      relationship: RELATIONSHIP_LABELS[a.relationship] ?? RELATIONSHIP_LABELS[""],
      support: SUPPORT_LABELS[a.remoteSupport]?.label ?? SUPPORT_LABELS[""].label,
      packages: a.packages.map((entry) => ({
        familyId: entry.familyId,
        familyLabel: entry.familyLabel,
        offerName: entry.offerName,
        pricingLabel: entry.pricingLabel,
        assessmentLabel: ASSESSMENT_LABELS[entry.assessmentPolicy],
        lineItems: entry.lineItems,
        setupLabel: installModeDetail(entry.installation, entry.shipmentMode).label,
      })),
    };
  }
  const d = source.draft;
  const open = !d.deliveryPreference || d.deliveryPreference === "unsure";
  return {
    sized: profileSummary(d.environment).indexOf("not set") === -1,
    profile: profileSummary(d.environment),
    relationship: RELATIONSHIP_LABELS[d.deliveryPreference] ?? RELATIONSHIP_LABELS[""],
    support: SUPPORT_LABELS[d.fulfillment.remoteSupport]?.label ?? SUPPORT_LABELS[""].label,
    packages: resolvedPackages(d).map(({ need, family, policyView }) => ({
      familyId: need.familyId,
      familyLabel: family.label,
      offerName: open ? `${family.label} · DE confirms Standalone or Co-Managed` : policyView.offerName,
      pricingLabel: open ? PRICING_LABELS.unsure : policyView.pricingLabel,
      assessmentLabel: ASSESSMENT_LABELS[policyView.assessmentPolicy],
      lineItems: policyView.lineItems,
      setupLabel: installModeDetail(resolveInstallMode(d.fulfillment.installation, policyView).mode, policyView.shipmentMode).label,
    })),
  };
}

/** Payload for POST /api/public/solutions/packet-pdf — labels only, no prices. */
export function buildSolutionPacketPayload(
  source: ProposalSource,
  opts: { title?: string; statusLabel?: string; reference?: string } = {},
): {
  title: string;
  statusLabel: string;
  reference?: string;
  profile: string;
  relationship: string;
  support: string;
  packages: Array<{
    familyLabel: string;
    offerName: string;
    pricingLabel: string;
    assessmentLabel: string;
    setupLabel: string;
    lineItems: Array<{ label: string; quantity: string }>;
  }>;
} {
  const view = packagesFrom(source);
  return {
    title: opts.title || "Your Solution",
    statusLabel: opts.statusLabel || ("archive" in source ? "Submitted" : "Draft"),
    reference: opts.reference,
    profile: view.profile,
    relationship: view.relationship,
    support: view.support,
    packages: view.packages.map((entry) => ({
      familyLabel: entry.familyLabel,
      offerName: entry.offerName,
      pricingLabel: entry.pricingLabel,
      assessmentLabel: entry.assessmentLabel,
      setupLabel: entry.setupLabel,
      lineItems: entry.lineItems.map((line) => ({
        label: line.label,
        quantity: view.sized ? line.quantity : "Sized after profile",
      })),
    })),
  };
}

/**
 * The held record, on paper: what the buyer is sending or has sent, in public
 * words, with every package sized as it was shown. Used on the contact step,
 * the confirmation and in print. No prices, no enums, no internal ids.
 */
export function ProposalSheet({ source, title = "Solution summary", reference }: { source: ProposalSource; title?: string; reference?: string }) {
  const { packages, relationship, profile, support, sized } = packagesFrom(source);
  return (
    <div className="d2-chapter d2-chapter--paper rounded-2xl px-5 sm:px-8" data-testid="proposal-sheet">
      <p className="d2-label d2-ink-soft">{title}{reference ? ` · ${reference}` : ""}</p>
      <ul className="d2-rows d2-small d2-ink mt-4">
        <li>
          <span className="d2-label d2-ink-soft mr-2">Profile</span> {profile}
        </li>
        <li>
          <span className="d2-label d2-ink-soft mr-2">Relationship</span> {relationship}
        </li>
        <li>
          <span className="d2-label d2-ink-soft mr-2">Remote support after setup</span> {support}
        </li>
      </ul>
      <div className="mt-6 space-y-8">
        {packages.map((entry) => (
          <article key={entry.familyId} className="d2-sheet">
            <div className="d2-sheet__head">
              <div className="min-w-0">
                <p className="d2-label d2-ink-soft mb-1">{entry.familyLabel}</p>
                <h3 className="d2-h3">{entry.offerName}</h3>
                <p className="d2-sheet__meta d2-small mt-1">
                  <span>{entry.pricingLabel}</span>
                  <span>{entry.assessmentLabel}</span>
                  <span>Delivery & Setup: {entry.setupLabel}</span>
                </p>
              </div>
            </div>
            <SheetRows lineItems={entry.lineItems} sized={sized} />
          </article>
        ))}
      </div>
      {packages.length === 0 ? <p className="d2-small d2-ink-soft mt-4">No package is in this solution yet.</p> : null}
    </div>
  );
}
