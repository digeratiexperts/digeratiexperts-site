/**
 * Branded "Your Solution" packet for Door 2 Print/Download.
 * Client sends a fully-resolved presentation payload — no catalog math here.
 */
import {
  coverBlock,
  DE_PDF,
  dePdfBaseStyles,
  esc,
  phoenixDate,
} from "./dePdfBrand";
import { renderHtmlToPdf } from "./renderHtmlToPdf";

export type SolutionPacketLine = {
  label: string;
  quantity: string;
};

export type SolutionPacketPackage = {
  familyLabel: string;
  offerName: string;
  pricingLabel: string;
  assessmentLabel: string;
  setupLabel: string;
  lineItems: SolutionPacketLine[];
};

export type SolutionPacketInput = {
  /** Cover title — usually "Your Solution". */
  title?: string;
  /** Eyebrow under the logo. */
  eyebrow?: string;
  /** Draft vs submitted status chip in the meta strip. */
  statusLabel?: string;
  reference?: string;
  profile: string;
  relationship: string;
  support: string;
  packages: SolutionPacketPackage[];
  dateLabel?: string;
};

export function buildSolutionPacketHtml(input: SolutionPacketInput): string {
  const title = (input.title || "Your Solution").trim() || "Your Solution";
  const eyebrow = (input.eyebrow || "Assembled solution packet").trim();
  const dateLabel = input.dateLabel || phoenixDate();
  const status = (input.statusLabel || "Draft").trim();
  const packages = Array.isArray(input.packages) ? input.packages.slice(0, 24) : [];

  const packageBlocks = packages
    .map((pkg) => {
      const lines = (pkg.lineItems || [])
        .filter((l) => l && l.label)
        .slice(0, 40)
        .map(
          (l) => `<div class="line">
            <span class="line-label">${esc(l.label)}</span>
            <span class="line-qty">${esc(l.quantity || "")}</span>
          </div>`,
        )
        .join("");
      return `<article class="pkg">
        <div class="pkg-head">
          <p class="pkg-family">${esc(pkg.familyLabel)}</p>
          <h3 class="pkg-title">${esc(pkg.offerName)}</h3>
          <div class="pkg-meta">
            <span>${esc(pkg.pricingLabel)}</span>
            <span>${esc(pkg.assessmentLabel)}</span>
            <span>Delivery &amp; Setup: ${esc(pkg.setupLabel)}</span>
          </div>
        </div>
        ${lines || `<p class="empty" style="padding:10px 14px">No line items listed.</p>`}
      </article>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(title)} · ${esc(DE_PDF.brandName)}</title>
<style>${dePdfBaseStyles()}</style>
</head><body>
  ${coverBlock({
    eyebrow,
    title,
    subtitleParts: [status, input.reference ? `Ref ${input.reference}` : "", dateLabel],
  })}
  <div class="meta-strip">
    ${esc(DE_PDF.brandName)} solution summary
    ${input.reference ? ` \u2022 Reference <strong>${esc(input.reference)}</strong>` : ""}
    \u2022 Status <strong>${esc(status)}</strong>
    \u2022 ${esc(DE_PDF.website)}
  </div>
  <div class="wrap">
    <h2>Solution summary</h2>
    <table class="facts"><tr>
      <td><div class="k">Profile</div><div class="v">${esc(input.profile || "—")}</div></td>
      <td><div class="k">Relationship</div><div class="v">${esc(input.relationship || "—")}</div></td>
      <td><div class="k">Remote support after setup</div><div class="v">${esc(input.support || "—")}</div></td>
    </tr></table>

    <h2>Packages</h2>
    ${packageBlocks || `<p class="empty">No package is in this solution yet.</p>`}

    <div class="closing">
      This packet restates the solution you assembled on ${esc(DE_PDF.website)}.
      It is not a signed commercial offer. A Digerati Experts consultant confirms
      scope, pricing, and next steps after review.
    </div>
  </div>
</body></html>`;
}

export async function renderSolutionPacketPdf(input: SolutionPacketInput): Promise<Buffer> {
  return renderHtmlToPdf(buildSolutionPacketHtml(input));
}

/** Soft validation — reject obviously abusive payloads before rendering. */
export function parseSolutionPacketBody(body: unknown): SolutionPacketInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid payload" };
  const b = body as Record<string, unknown>;
  const profile = typeof b.profile === "string" ? b.profile.slice(0, 240) : "";
  const relationship = typeof b.relationship === "string" ? b.relationship.slice(0, 240) : "";
  const support = typeof b.support === "string" ? b.support.slice(0, 240) : "";
  if (!profile && !relationship) return { error: "Profile or relationship is required" };

  const rawPackages = Array.isArray(b.packages) ? b.packages : [];
  if (rawPackages.length > 24) return { error: "Too many packages" };

  const packages: SolutionPacketPackage[] = [];
  for (const raw of rawPackages) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const lineItemsRaw = Array.isArray(p.lineItems) ? p.lineItems : [];
    if (lineItemsRaw.length > 40) return { error: "Too many line items" };
    packages.push({
      familyLabel: String(p.familyLabel || "").slice(0, 120),
      offerName: String(p.offerName || "").slice(0, 160),
      pricingLabel: String(p.pricingLabel || "").slice(0, 120),
      assessmentLabel: String(p.assessmentLabel || "").slice(0, 120),
      setupLabel: String(p.setupLabel || "").slice(0, 160),
      lineItems: lineItemsRaw
        .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
        .map((l) => ({
          label: String(l.label || "").slice(0, 200),
          quantity: String(l.quantity || "").slice(0, 80),
        }))
        .filter((l) => l.label),
    });
  }

  return {
    title: typeof b.title === "string" ? b.title.slice(0, 80) : undefined,
    eyebrow: typeof b.eyebrow === "string" ? b.eyebrow.slice(0, 80) : undefined,
    statusLabel: typeof b.statusLabel === "string" ? b.statusLabel.slice(0, 40) : undefined,
    reference: typeof b.reference === "string" ? b.reference.slice(0, 40) : undefined,
    profile,
    relationship,
    support,
    packages,
    dateLabel: typeof b.dateLabel === "string" ? b.dateLabel.slice(0, 60) : undefined,
  };
}
