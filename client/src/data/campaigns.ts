import { CANONICAL_CSRA_ONE_TIME } from "@shared/canonicalCsra";
import { formatPrice, formatUserPrice, pricing } from "./pricing";

/**
 * Paid-media and search landing pages.
 * Copy is sourced from existing DE offers (ProActive tiers, CSRA, standalone,
 * co-managed, industries). Do not invent clients, ratings, or outcomes here.
 */
export type CampaignSlug =
  | "cyber-risk-assessment"
  | "managed-it"
  | "ransomware-readiness"
  | "co-managed-it"
  | "healthcare-it"
  | "cyber-insurance"
  | "email-security"
  | "proactive-business";

export type CampaignStake = { title: string; body: string };
export type CampaignStep = { title: string; body: string };
export type CampaignFaq = { question: string; answer: string };

export interface CampaignPage {
  slug: CampaignSlug;
  /** Short label for /go index and ads */
  offerName: string;
  eyebrow: string;
  headline: string;
  lede: string;
  seoTitle: string;
  seoDescription: string;
  audience: string;
  stakes: CampaignStake[];
  includes: string[];
  process: CampaignStep[];
  fitFor: string[];
  fitNot: string[];
  faqs: CampaignFaq[];
  pricingNote: string;
  relatedAssetSlug?: string;
  relatedBriefSlug?: string;
  deeperHref: string;
  deeperLabel: string;
}

const csra = formatPrice(CANONICAL_CSRA_ONE_TIME);

export const CAMPAIGNS: CampaignPage[] = [
  {
    slug: "cyber-risk-assessment",
    offerName: "Cyber Risk Assessment",
    eyebrow: "Start here",
    headline: "See the risk in your environment before you buy another tool",
    lede:
      "Digerati Experts starts with how your business actually runs — identity, endpoints, email, backups, and who owns what — then recommends a fit. The first conversation is a focused working session, not a catalog pitch.",
    seoTitle: "Cyber Risk Assessment for Arizona Businesses",
    seoDescription:
      "Book a Cyber Risk Assessment conversation with Digerati Experts. We review identity, endpoints, email, and backups before recommending ProActive, standalone, or co-managed work.",
    audience:
      "Owners, operators, and IT leads in Arizona who need a clear next step — not a generic security stack.",
    stakes: [
      {
        title: "Gaps show up during an incident",
        body: "Most businesses discover missing MFA, unmanaged devices, or untested backups during an outage, a phishing event, or a painful insurance questionnaire — not in a planning meeting.",
      },
      {
        title: "Tools without ownership still fail",
        body: "Buying another product does not tell you who reviews alerts, who can restore, or what happens if an admin account is taken over.",
      },
      {
        title: "The wrong package wastes a year",
        body: "Two companies with the same headcount can need different operating depth. Assessment-led recommendations exist so you do not buy ProActive Enterprise — or a single add-on — by guesswork.",
      },
    ],
    includes: [
      "A 30-minute working conversation about your environment and constraints",
      "A first-pass read of identity, endpoints, email, backups, and operating reality",
      "A written recommendation path: ProActive Ecosystem, standalone scope, or co-managed",
      `When a formal documented CSRA is the right next step, that engagement is ${csra} one-time — not credited toward a later ProActive agreement`,
    ],
    process: [
      {
        title: "Book the conversation",
        body: "Use the scheduling page. No package is required to start. You can also call.",
      },
      {
        title: "Map what actually matters",
        body: "We look at access, devices, email, recovery, and who is accountable — not a generic checklist sold as a score.",
      },
      {
        title: "Choose a path with ownership named",
        body: "You leave with a recommended operating model and a clear statement of what Digerati Experts would own versus what you keep.",
      },
    ],
    fitFor: [
      "Arizona small and growing businesses comparing managed IT and security options",
      "Teams preparing for cyber insurance, a client questionnaire, or a provider switch",
      "Internal IT leads who want an outside read before buying more tools",
    ],
    fitNot: [
      "Organizations looking for a free SOC 2 or HIPAA certification from an MSP",
      "Buyers who want a hardware catalog without an operating recommendation",
    ],
    faqs: [
      {
        question: "Is the first conversation the same as the $2,500 CSRA?",
        answer: `No. The booking page is a no-obligation working session. The documented Cybersecurity Risk Assessment is a scoped product at ${csra} when that deliverable is the right next step. DE does not auto-credit that fee toward a later ProActive agreement.`,
      },
      {
        question: "Do I have to buy a ProActive package afterward?",
        answer:
          "No. The assessment can recommend standalone coverage, co-managed support, a focused project, or a ProActive tier. The point is the fit — not a forced upgrade.",
      },
      {
        question: "What if we already have an MSP?",
        answer:
          "Say so. Co-managed and standalone paths exist specifically so we do not replace a team or a provider you intend to keep.",
      },
    ],
    pricingNote: `Conversation first. Formal CSRA ${csra} when that document is scoped. ProActive packages are quoted after environment fit is clear.`,
    relatedAssetSlug: "cyber-risk-assessment-sample",
    relatedBriefSlug: "cyber-risk-operating-brief",
    deeperHref: "/resources/briefs/cyber-risk-operating-brief",
    deeperLabel: "Read the operating brief",
  },
  {
    slug: "managed-it",
    offerName: "Managed IT",
    eyebrow: "ProActive Ecosystem",
    headline: "Cybersecurity-first managed IT — one operating model, four depths",
    lede:
      "ProActive is how Digerati Experts runs day-to-day IT and security together. IT, Office, Business, and Enterprise are different operating depths — not marketing names for the same package.",
    seoTitle: "Managed IT and Cybersecurity for Arizona | ProActive Ecosystem",
    seoDescription:
      "ProActive IT, Office, Business, and Enterprise from Digerati Experts. Assessment-led managed IT with published per-user floors and monthly minimums.",
    audience:
      "Businesses that want one accountable partner for support, identity, endpoints, and security — not break-fix plus a bolt-on antivirus.",
    stakes: [
      {
        title: "Break-fix gets expensive after the incident",
        body: "Reactive support prices the hour you are already down. ProActive is built to own issues, document the environment, and reduce repeat failure.",
      },
      {
        title: "Security bolted on later is still an afterthought",
        body: "Identity, email, endpoints, and backups have to sit in the same operating model as the helpdesk — or alerts and tickets never meet.",
      },
      {
        title: "Lock-in is a procurement problem",
        body: "Client ownership — your technology, your data, your keys — is a DE differentiator. Documentation and access should be transferable.",
      },
    ],
    includes: [
      `${pricing.it.label}: ${formatUserPrice("it")}, ${formatPrice(pricing.it.monthlyMinimum)}/mo minimum — service desk, endpoint foundation, identity guidance, documented baseline`,
      `${pricing.office.label}: ${formatUserPrice("office")}, ${formatPrice(pricing.office.monthlyMinimum)}/mo minimum — adds managed network, stronger identity, email anti-phishing, endpoint backup, annual review`,
      `${pricing.business.label}: ${formatUserPrice("business")}, ${formatPrice(pricing.business.monthlyMinimum)}/mo minimum — adds threat detection, awareness training, BCDR posture, compliance reporting support`,
      `${pricing.enterprise.label}: ${formatUserPrice("enterprise")}, ${formatPrice(pricing.enterprise.monthlyMinimum)}/mo minimum — adds unified posture reporting, advanced compliance reporting, custom BCDR support, quarterly reviews`,
    ],
    process: [
      {
        title: "Assessment before a stack",
        body: "We do not quote a tier from headcount alone. Environment complexity, locations, and recovery needs change the fit.",
      },
      {
        title: "One tier, not a pile of packages",
        body: "ProActive tiers are mutually exclusive operating models. We do not stack Office and Business on the same agreement.",
      },
      {
        title: "Documented ownership",
        body: "You keep credentials, tenants, and a written picture of what is in place — so you are not trapped in undocumented access.",
      },
    ],
    fitFor: [
      "Arizona offices that have outgrown a technician-on-call model",
      "Leadership that wants security and IT in one conversation",
      "Teams comparing published floors before a longer RFP",
    ],
    fitNot: [
      "Organizations that only need a single product and already own the rest of the stack — see Standalone Services",
      "Internal IT departments that want to keep daily ownership — see Co-Managed IT",
    ],
    faqs: [
      {
        question: "Are those prices final?",
        answer:
          "They are published starting rates and monthly minimums. Final pricing depends on users, endpoints, locations, infrastructure, backup, and compliance — confirmed after the Cyber Risk Assessment.",
      },
      {
        question: "Is backup included at every tier?",
        answer:
          "Endpoint backup is part of ProActive Office and above. Fuller BCDR posture is part of ProActive Business and Enterprise. IT is the entry baseline and does not include backup.",
      },
    ],
    pricingNote:
      "Published floors from the canonical ProActive catalog. Scope is confirmed after assessment.",
    relatedAssetSlug: "proactive-ecosystem-overview",
    relatedBriefSlug: "proactive-operating-brief",
    deeperHref: "/proactive-ecosystem-pricing",
    deeperLabel: "See Plans & Pricing",
  },
  {
    slug: "ransomware-readiness",
    offerName: "Ransomware readiness",
    eyebrow: "Recoverability",
    headline: "Having backups is not the same as being recoverable",
    lede:
      "Digerati Experts treats ransomware defense as a layered operating model: identity, endpoints, email, backups that can actually restore, and a response path people can follow under pressure.",
    seoTitle: "Ransomware Readiness and Backup for Arizona Businesses",
    seoDescription:
      "Assess whether ransomware would encrypt your backups and whether Arizona operations can restore. Digerati Experts connects backup, identity, and response.",
    audience:
      "Operators who have backups configured but cannot honestly answer restore time, offsite copies, or who gets called at 2 a.m.",
    stakes: [
      {
        title: "Ransomware targets recovery systems",
        body: "If admin credentials are weak or the network is flat, backup consoles and file shares are in reach. Sync folders are not a disaster-recovery plan.",
      },
      {
        title: "MFA alone does not stop the event",
        body: "MFA is one identity layer. Compromised sessions, unmanaged devices, and untested restores still produce downtime.",
      },
      {
        title: "The first 24 hours decide the cost",
        body: "Without named contacts, isolation steps, and a restore order, even good backups turn into confusion.",
      },
    ],
    includes: [
      "A readiness conversation covering identity, endpoints, email, and backup exposure",
      "A clear distinction between file sync, endpoint backup, and business continuity",
      "A path to ProActive Office (endpoint backup) or Business/Enterprise (BCDR posture) when that depth is warranted",
      "Standalone backup/BCDR scope when you are not ready for a full ecosystem",
    ],
    process: [
      {
        title: "Tell us what you think you can restore",
        body: "We start from your current backup products and whether anyone has restored lately — not from a fear headline.",
      },
      {
        title: "Find the actual failure points",
        body: "Identity, network reachability, and untested copies usually matter more than buying a second backup brand.",
      },
      {
        title: "Document the next 30/60/90 days",
        body: "If a formal CSRA is scoped, the sample report format shows how findings become a sequenced plan.",
      },
    ],
    fitFor: [
      "Businesses that cannot state RPO/RTO in language leadership understands",
      "Teams renewing cyber insurance and being asked about backups and MFA",
      "Offices that have never run a restore test",
    ],
    fitNot: [
      "Anyone expecting DE to guarantee an insurance payout or legal outcome",
    ],
    faqs: [
      {
        question: "Do you sell backup as a standalone service?",
        answer:
          "Yes. Standalone Services can cover a defined backup or BCDR role after scope is documented. It does not automatically mean Digerati Experts owns every IT issue in the environment.",
      },
      {
        question: "Is this a ransomware statistic page?",
        answer:
          "No. We do not publish unsourced percentages. The work is whether your environment can isolate, restore, and operate.",
      },
    ],
    pricingNote:
      "Backup inclusion depends on ProActive depth or a standalone scope. Assessment first.",
    relatedAssetSlug: "backup-bcdr-checklist",
    relatedBriefSlug: "ransomware-readiness-brief",
    deeperHref: "/solutions/backup-disaster-recovery",
    deeperLabel: "Read Backup & DR",
  },
  {
    slug: "co-managed-it",
    offerName: "Co-Managed IT",
    eyebrow: "Internal IT kept",
    headline: "Keep your team. Extend helpdesk, security, and coverage.",
    lede:
      "Co-Managed IT is a separate path — not a ProActive tier. Digerati Experts works beside internal IT: shared ownership, named responsibilities, no silent takeover of your stack. It starts with a required Cyber Risk Assessment.",
    seoTitle: "Co-Managed IT for Teams That Already Have IT Staff",
    seoDescription:
      "Co-Managed IT from Digerati Experts extends internal teams with helpdesk, security, and kits — without replacing the staff you already have.",
    audience:
      "Companies with an IT lead or small internal team who need overflow, monitoring, or a security layer — not a full outsource.",
    stakes: [
      {
        title: "Hiring another generalist is slow",
        body: "Another employee does not automatically add after-hours monitoring, documented recovery, or a second set of eyes on identity.",
      },
      {
        title: "A full MSP can collide with your team",
        body: "If daily ownership should stay internal, a ProActive Ecosystem package is the wrong product. Co-managed exists so that conflict is designed out.",
      },
      {
        title: "Undefined RACI creates ticket wars",
        body: "The engagement only works when who owns patching, who owns the helpdesk, and who owns incident triage is written down.",
      },
    ],
    includes: [
      "Collaboration mode: shared ticketing with DE-owned monitoring, patching, or incident triage where scoped",
      "Kits mode: pre-provisioned devices your internal team deploys",
      "Ability to add specific layers — endpoint, email, identity, helpdesk assist — without stacking a second ProActive package",
      "A documented split of responsibilities before work starts",
    ],
    process: [
      {
        title: "Name what your team will keep",
        body: "We start from your current ownership, not from a standard MSP runbook.",
      },
      {
        title: "Scope the extension",
        body: "Helpdesk overflow, security operations, backup, or device kits — only what you asked us to hold.",
      },
      {
        title: "Operate with a written RACI",
        body: "Tickets and escalations follow the document, not hallway assumptions.",
      },
    ],
    fitFor: [
      "Internal IT that is stretched on tickets or after-hours coverage",
      "Security-conscious teams that want a partner without giving up admin keys",
    ],
    fitNot: [
      "Businesses with no internal IT who need full operating ownership — that is ProActive",
    ],
    faqs: [
      {
        question: "Is Co-Managed a cheaper ProActive Business?",
        answer:
          "No. It is a different buying path. ProActive is an ecosystem operating model. Co-Managed is an extension of the team you already employ.",
      },
    ],
    pricingNote:
      "Co-Managed is scoped and quoted. Client Marketplace items are available for existing clients without replacing the current stack.",
    relatedAssetSlug: "co-managed-it-datasheet",
    deeperHref: "/solutions/co-managed-it",
    deeperLabel: "See Co-Managed IT",
  },
  {
    slug: "healthcare-it",
    offerName: "Healthcare IT",
    eyebrow: "Arizona practices",
    headline: "Protect patient data without becoming a HIPAA expert",
    lede:
      "Digerati Experts manages security, backups, access controls, documentation, and ongoing IT behind Arizona practices so owners can focus on patients. Framework names describe customer requirements — DE does not certify your organization.",
    seoTitle: "Healthcare IT and HIPAA Security for Arizona Practices",
    seoDescription:
      "HIPAA-aligned managed IT for Arizona practices from Digerati Experts. Assessment-led access, backup, and documentation support — not a certification badge.",
    audience:
      "Clinics, dental, veterinary-adjacent, and small medical groups that need PHI handled as an operating problem, not a poster in the break room.",
    stakes: [
      {
        title: "Access sprawl is a patient-data problem",
        body: "Shared logins, leftover vendor accounts, and unmanaged laptops are how records leak — not only “hackers.”",
      },
      {
        title: "Backups have to restore clinical systems",
        body: "Imaging, practice management, and email are the business. Untested copies are not a continuity plan.",
      },
      {
        title: "Questionnaires arrive faster than tooling",
        body: "Payers and partners ask for evidence. DE helps organize technical controls and documentation — legal interpretations stay with qualified counsel.",
      },
    ],
    includes: [
      "An assessment-led read of identity, endpoints, email, and backups in the practice",
      "A recommendation for ProActive depth or a standalone role (backup, awareness, reporting)",
      "Documentation support that helps with insurance and partner questionnaires",
      "Explicit limits: DE does not sign you off as HIPAA-certified",
    ],
    process: [
      {
        title: "Describe the practice, not the product list",
        body: "Locations, imaging, remote providers, and who administers Microsoft 365 matter more than a brand name.",
      },
      {
        title: "Fix the controls that hurt patients first",
        body: "Access, email, and restore usually outrank a new dashboard.",
      },
      {
        title: "Keep ownership with the practice",
        body: "Credentials and documentation stay yours.",
      },
    ],
    fitFor: [
      "Arizona practices that need IT and security handled behind the front desk",
      "Groups preparing for an insurance or partner review",
    ],
    fitNot: [
      "Organizations seeking a HIPAA certification issued by Digerati Experts",
    ],
    faqs: [
      {
        question: "Do you certify us for HIPAA?",
        answer:
          "No. Framework names describe customer requirements. DE helps implement and document technical controls. Certification and legal opinions are not an MSP product.",
      },
    ],
    pricingNote:
      "Practice environments vary. Published ProActive floors apply after fit is confirmed. Assessment first.",
    relatedAssetSlug: "compliance-risk-reports-overview",
    deeperHref: "/industries/healthcare",
    deeperLabel: "Healthcare industry page",
  },
  {
    slug: "cyber-insurance",
    offerName: "Cyber insurance readiness",
    eyebrow: "Evidence, not a badge",
    headline: "Prepare the controls insurers already ask about",
    lede:
      "Digerati Experts helps businesses identify gaps, document controls, and build a roadmap before renewal pressure hits. DE does not guarantee coverage, claim outcomes, or legal interpretations.",
    seoTitle: "Cyber Insurance Readiness for Small Businesses",
    seoDescription:
      "Prepare MFA, backups, awareness, and evidence for cyber insurance reviews with Digerati Experts. Assessment-led — not a coverage guarantee.",
    audience:
      "Finance and operations leads filling carrier questionnaires who need technical facts, not marketing language.",
    stakes: [
      {
        title: "Applications now ask how you operate",
        body: "MFA, EDR, email authentication, backup testing, and awareness training show up as questions — not optional extras.",
      },
      {
        title: "A missing control at renewal is expensive",
        body: "Finding the gap after the application is already in underwriting leaves no time to remediate or document a compensating process.",
      },
      {
        title: "An MSP cannot promise the policy",
        body: "Carriers decide coverage. Counsel interprets the contract. DE can implement and organize the IT and security work those conversations depend on.",
      },
    ],
    includes: [
      `Cybersecurity Risk Assessment at ${csra} when a documented baseline is the right artifact`,
      "Mapping of identity, endpoint, email, backup, and awareness gaps that questionnaires typically touch",
      "A roadmap: implement, document a compensating process, or phase the work",
      "Optional standalone policy templates and awareness products from the store when they fit — not as a substitute for an operating model",
    ],
    process: [
      {
        title: "Bring the questionnaire if you have it",
        body: "We work from the questions you were actually asked.",
      },
      {
        title: "Separate missing controls from missing evidence",
        body: "Sometimes the control exists and nobody can find the screenshot. Sometimes it does not exist.",
      },
      {
        title: "Sequence the work",
        body: "Identity and backup usually move before a new reporting package.",
      },
    ],
    fitFor: [
      "Businesses facing a new application or a tighter renewal",
      "Teams that want evidence-supporting reporting without claiming a DE-held SOC 2 badge",
    ],
    fitNot: [
      "Anyone asking DE to guarantee a policy, a claim payment, or a legal opinion",
    ],
    faqs: [
      {
        question: "Will this get us approved?",
        answer:
          "We cannot say that. Insurance decisions belong to carriers and policy terms. We can help you implement and document the technical side.",
      },
    ],
    pricingNote: `Formal CSRA ${csra} when scoped. ProActive Business and Enterprise include increasing compliance/risk reporting depth.`,
    relatedAssetSlug: "compliance-risk-reports-overview",
    relatedBriefSlug: "cyber-insurance-brief",
    deeperHref: "/resources/blog/cyber-insurance-requirements-small-businesses",
    deeperLabel: "Read the insurance article",
  },
  {
    slug: "email-security",
    offerName: "Email security",
    eyebrow: "Identity + mail",
    headline: "Phishing protection is more than a spam filter",
    lede:
      "Email connects to identity, money movement, and remote access. Digerati Experts treats it as part of the security model — authentication, mailbox control, and what happens after one account is phished.",
    seoTitle: "Email Security and Phishing Defense for Arizona Businesses",
    seoDescription:
      "Email security beyond spam filtering from Digerati Experts — MFA, authentication, and operating response after a mailbox is compromised.",
    audience:
      "Offices that already have a filter and still see invoice fraud, lookalike domains, or mailbox rules they did not create.",
    stakes: [
      {
        title: "Spam filtering is not account takeover defense",
        body: "A delivered message plus a reused password still opens banking, files, and admin portals.",
      },
      {
        title: "Finance approval lives in the inbox",
        body: "Wire-change and vendor-impersonation fraud is a process failure as much as a technical one.",
      },
      {
        title: "Mailbox rules persist after the click",
        body: "Forwarding and hidden rules keep stealing mail after the user “reset the password.”",
      },
    ],
    includes: [
      "A read of MFA, admin access, and email authentication (including a scoped DMARC check when that product is the right first step)",
      "How email sits inside ProActive Office and above (advanced anti-phishing) versus a standalone role",
      "Awareness training as a layer — not as the entire program",
      "A recommendation that names what you already own versus what is missing",
    ],
    process: [
      {
        title: "Look at a real mailbox incident if you have one",
        body: "Rules, forwarding, and who had global admin tell the story faster than a brochure.",
      },
      {
        title: "Fix identity before buying another filter",
        body: "If admin MFA and mailbox audit are weak, a new gateway will not hold.",
      },
      {
        title: "Document the approval path",
        body: "Technical controls fail when anyone can change bank details from a single compromised inbox.",
      },
    ],
    fitFor: [
      "Arizona offices running Microsoft 365 that have never reviewed mailbox audit or authentication",
      "Teams hit by invoice fraud or a lookalike domain",
    ],
    fitNot: [
      "Buyers who only want a consumer spam app with no identity work",
    ],
    faqs: [
      {
        question: "Can we buy email security alone?",
        answer:
          "Standalone and Client Marketplace options exist. They do not replace a full ProActive engagement unless that is the documented scope.",
      },
    ],
    pricingNote:
      "Email anti-phishing depth increases from ProActive Office upward. Standalone and store items are scoped separately.",
    relatedAssetSlug: "proactive-office-ecosystem-datasheet",
    deeperHref: "/resources/blog/email-security-more-than-spam-filtering",
    deeperLabel: "Read the email security article",
  },
  {
    slug: "proactive-business",
    offerName: "ProActive Business",
    eyebrow: `${pricing.business.label}`,
    headline: "When Office would need heavy modification, this is the operating depth",
    lede:
      "ProActive Business is cybersecurity-first managed IT for environments where downtime, data loss, or a security incident would actually hurt. It is a different depth than Office — not a trophy name.",
    seoTitle: "ProActive Business Managed IT and Security",
    seoDescription:
      "ProActive Business from Digerati Experts: threat detection, awareness, BCDR posture, and compliance reporting support. Published floor $245/user/mo with a $5,400/mo minimum.",
    audience:
      "Established small and mid-sized businesses that have outgrown a small-office package and need operations plus recovery.",
    stakes: [
      {
        title: "Office is the wrong retrofit",
        body: "If you need security operations, awareness, and BCDR posture, bolting those onto Office is how scope fights start. Business exists so those layers are native.",
      },
      {
        title: "Leadership needs a review cadence",
        body: "Semi-annual technology and security reviews are part of this tier — not an optional slide deck you never receive.",
      },
    ],
    includes: [
      `Published floor ${formatUserPrice("business")} with a ${formatPrice(pricing.business.monthlyMinimum)}/mo minimum`,
      "Everything meaningful in Office, plus security operations / threat detection",
      "Security awareness training",
      "Backup and disaster recovery posture",
      "Compliance / risk reporting support",
      "Semi-annual technology + security reviews",
    ],
    process: [
      {
        title: "Confirm Business is the fit",
        body: "Assessment decides whether Office, Business, Enterprise, or a standalone role is honest.",
      },
      {
        title: "Do not stack another ProActive tier",
        body: "Packages are mutually exclusive. Add-ons are scoped; a second ecosystem package is not.",
      },
    ],
    fitFor: [
      "Businesses whose downtime or a mailbox compromise would halt revenue",
      "Teams that need reporting support without claiming DE holds SOC 2 Type II",
    ],
    fitNot: [
      "Very small, simple environments that only need the IT or Office baseline",
    ],
    faqs: [
      {
        question: "Can we start on Office and upgrade later?",
        answer:
          "Yes. There is a documented upgrade path. We do not sell two ProActive packages at once.",
      },
    ],
    pricingNote: `${formatUserPrice("business")}, ${formatPrice(pricing.business.monthlyMinimum)}/mo minimum. Confirmed after assessment.`,
    relatedAssetSlug: "proactive-business-ecosystem-datasheet",
    relatedBriefSlug: "proactive-operating-brief",
    deeperHref: "/solutions/proactive-business-ecosystem",
    deeperLabel: "ProActive Business details",
  },
];

export const campaignBySlug = (slug: string): CampaignPage | undefined =>
  CAMPAIGNS.find((campaign) => campaign.slug === slug);

export const CAMPAIGN_SLUGS = CAMPAIGNS.map((campaign) => campaign.slug);
