/**
 * The Digerati Box — what is in it, and where each thing really comes from.
 *
 * Every item here resolves to an artifact this repository already ships: a PDF
 * in the resource registry, an executive brief, a canonical pricing tier, or a
 * working tool route. Nothing in the box is written for the box.
 *
 * That is a Tier 0 requirement, not an editorial preference. The registry's own
 * note is explicit that client stories stay out until permission and measured
 * outcomes exist, so the box carries no case study, logo, testimonial, metric
 * or named client. It is packed with work, not with proof borrowed from people
 * who have not agreed to lend it.
 *
 * Compartments are declared by SLUG, and resolved against the live registry at
 * build time. A slug that stops existing fails the unit test rather than
 * shipping a dead tile — the failure mode this file exists to prevent is a box
 * that promises something the site cannot hand over.
 */

import { resources, type ResourceItem } from "./resourceRegistry";
import { EXECUTIVE_BRIEFS, type ExecutiveBrief } from "./executiveBriefs";

export type CompartmentId = "assessment" | "checklists" | "ecosystems" | "briefing" | "numbers";

export type BoxCompartment = {
  id: CompartmentId;
  /** Oxanium sequence label, per the type rules. */
  index: string;
  name: string;
  /** What this compartment is FOR, in the visitor's terms. */
  purpose: string;
  resourceSlugs: readonly string[];
};

/**
 * Ordered the way a buyer actually works through it: find out where you stand,
 * fix what is cheap to fix, understand what a full engagement looks like, read
 * the thinking behind it, then see the money.
 */
export const BOX_COMPARTMENTS: readonly BoxCompartment[] = [
  {
    id: "assessment",
    index: "01",
    name: "Where you actually stand",
    purpose:
      "A real Cyber Risk Assessment report, unredacted in structure, so you can see what we look at and how we grade it before you commit to anything.",
    resourceSlugs: ["cyber-risk-assessment-sample", "compliance-risk-reports-overview"],
  },
  {
    id: "checklists",
    index: "02",
    name: "What you can fix this week",
    purpose:
      "Two checklists you can run without us. If they make us unnecessary, that is a fine outcome — it is still a better conversation than a sales call.",
    resourceSlugs: ["security-readiness-checklist", "backup-bcdr-checklist"],
  },
  {
    id: "ecosystems",
    index: "03",
    name: "What a full engagement covers",
    purpose:
      "The service ladder in detail — four ProActive tiers, co-managed work alongside your own IT, the managed workplace, and voice.",
    resourceSlugs: [
      "proactive-ecosystem-overview",
      "proactive-it-ecosystem-datasheet",
      "proactive-office-ecosystem-datasheet",
      "proactive-business-ecosystem-datasheet",
      "proactive-enterprise-ecosystem-datasheet",
      "co-managed-it-datasheet",
      "managed-workplace-overview",
      "ucaas-voice-meetings-datasheet",
    ],
  },
  {
    id: "briefing",
    index: "04",
    name: "How we think about it",
    purpose:
      "Four executive briefs. No scare tactics, no vendor names — the reasoning we would use in your conference room.",
    resourceSlugs: [],
  },
  {
    id: "numbers",
    index: "05",
    name: "What it costs, before you ask",
    purpose:
      "Published rates and a quarterly business review, so the pricing conversation starts from the same page we start from.",
    resourceSlugs: ["sample-quarterly-business-review"],
  },
] as const;

/** Every resource slug the box promises, in compartment order. */
export const BOX_RESOURCE_SLUGS: readonly string[] = BOX_COMPARTMENTS.flatMap(
  (compartment) => compartment.resourceSlugs,
);

const bySlug = new Map(resources.map((item) => [item.slug, item]));

/** The resources a compartment holds, already resolved. Missing slugs are
 *  dropped rather than rendered empty; the unit test is what keeps the list
 *  honest, so a gap is caught in CI and not by a visitor. */
export function compartmentResources(compartment: BoxCompartment): ResourceItem[] {
  return compartment.resourceSlugs
    .map((slug) => bySlug.get(slug))
    .filter((item): item is ResourceItem => Boolean(item));
}

/** The briefs compartment 04 carries — all of them, in authored order. */
export function boxBriefs(): ExecutiveBrief[] {
  return EXECUTIVE_BRIEFS;
}

/** Total count for the manifest line. Briefs are counted with the PDFs because
 *  a reader does not care which data file a thing came from. */
export function boxItemCount(): number {
  return BOX_RESOURCE_SLUGS.filter((slug) => bySlug.has(slug)).length + EXECUTIVE_BRIEFS.length;
}

/**
 * A recipient's name, if the link carried one.
 *
 * This is the one piece of the page that comes from outside, so it is treated
 * as hostile: letters, digits, spaces and the punctuation a real company name
 * uses, nothing else, and short enough that it cannot become a headline of its
 * own. It is addressed TO someone, never a claim ABOUT them — the page says
 * "Packed for X", which is true whoever X is, and asserts nothing it has not
 * been told.
 */
export function recipientName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\p{L}\p{N} .,'&()-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 60) return null;
  return cleaned;
}
