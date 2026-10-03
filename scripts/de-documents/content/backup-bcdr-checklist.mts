import type { Doc } from "../system/families.mts";
import { BOOK, EDITION, NO_NAMES, RECOVERY_TIMELINE, RECOVERY_TIMELINE_ALT } from "./shared.mts";

export const backupChecklist: Doc = {
  slug: "backup-bcdr-checklist",
  family: "checklist",
  file: "assets/resources/checklists/backup-bcdr-checklist.pdf",
  docId: "DE-CL-BCDR",
  edition: EDITION,
  title: "Backup & Business Continuity Checklist | Digerati Experts",
  kicker: "Checklist",
  h1: "Backup & Business Continuity",
  subtitle: "Confirm whether your business can recover from ransomware, deletion, outage or device loss.",
  keywords: "Digerati Experts, backup, BCDR, business continuity, disaster recovery, RTO, RPO, checklist",
  cta: {
    label: "Request a Backup & BCDR review",
    detail:
      "If restore testing, cloud backup or recovery ownership is unclear, request a Backup & Business Continuity review before assuming the business is protected.",
    ...BOOK,
  },
  scopeNote: `Educational checklist. It does not assess or certify any environment. ${NO_NAMES}`,
  opener: {
    t: "editorial",
    masthead: true,
    title: "Backup & Business Continuity Checklist",
    stand: "Confirm whether your business can recover from ransomware, deletion, outage or device loss.",
    sections: [
      {
        rail: "Purpose",
        h: "Backups are not the same as recoverability",
        paras: [
          "This checklist helps determine whether a business can actually recover from ransomware, accidental deletion, system failure, cloud account compromise or a site-level outage.",
        ],
      },
      {
        rail: "How to use it",
        h: "Nine checks, one honest answer each",
        steps: [
          "Work through the checks with whoever runs your backups and your key systems.",
          "Mark **Yes**, **No** or **Unknown** for each. Treat Unknown as an area to review, not a pass.",
          "Write the owner, and any evidence such as the date of the last restore test, on the notes line.",
          "Use the result with the next step on the last page.",
        ],
      },
      {
        rail: "Terms",
        h: "The two targets that matter",
        figure: { svg: RECOVERY_TIMELINE, alt: RECOVERY_TIMELINE_ALT, caption: "RPO and RTO on one timeline." },
        terms: [
          ["RTO", "Recovery Time Objective: how long the business can tolerate downtime."],
          ["RPO", "Recovery Point Objective: how much data the business can afford to lose."],
          ["BCDR", "Business Continuity and Disaster Recovery: the strategy for keeping the business operating during disruption."],
        ],
      },
    ],
  },
  blocks: [
    {
      t: "section",
      title: "Backup & BCDR review",
      body: [{
        t: "checks",
        groups: [
          {
            title: "What is protected",
            items: [
              { area: "Critical data", q: "Do you know which systems and files must be recovered first?" },
              { area: "Endpoint backup", q: "Are user devices backed up where business data exists locally?" },
              { area: "Cloud data", q: "Are Microsoft 365, Google Workspace or other cloud data sources backed up separately?" },
              { area: "Servers and systems", q: "Are business-critical systems backed up with documented retention?" },
            ],
          },
          {
            title: "Whether it can be recovered",
            items: [
              { area: "Recovery testing", q: "Has a restore been tested in the last 90 days?" },
              { area: "Ransomware readiness", q: "Are backups protected from deletion or encryption by compromised accounts?" },
            ],
          },
          {
            title: "How fast, and how much",
            items: [
              { area: "Recovery time (RTO)", q: "Do you know how long the business can be down before real damage occurs?" },
              { area: "Recovery point (RPO)", q: "Do you know how much data loss is acceptable?" },
            ],
          },
          {
            title: "Who owns recovery",
            items: [{ area: "Documentation", q: "Is the recovery process documented and assigned to responsible parties?" }],
          },
        ],
      }],
    },
    { t: "section", title: "Notes and follow-ups", body: [{ t: "notes", label: "Owners, evidence, dates", height: 120 }] },
  ],
};
