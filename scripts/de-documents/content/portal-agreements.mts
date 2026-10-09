// Client Portal agreements: the documents a client accepts at the portal's
// agreement gate (/portal/agreement-gate). Keys, versions and public paths
// must match shared/portalAgreements.ts; the route test hashes these files.
//
// The terms defer to each client's signed MSA and to the website Terms of Use
// (governing law, dispute resolution, liability) rather than restating them.
import { COMPANY } from "../../../shared/companyContact";
import { PORTAL_AGREEMENTS } from "../../../shared/portalAgreements";
import type { Doc } from "../system/families.mts";
import { SITE } from "./shared.mts";

const meta = (key: string) => {
  const a = PORTAL_AGREEMENTS.find((x) => x.key === key);
  if (!a) throw new Error(`No portal agreement ${key}`);
  const modified = new Date(`${a.lastModified}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  return { file: a.pdf.replace(/^\//, ""), edition: a.version, modified, title: a.title };
};

const SUPPORT = {
  label: "Questions about this document",
  detail: `Open a ticket in the portal, email ${COMPANY.supportEmail}, or ask your account representative before you sign.`,
  href: `mailto:${COMPANY.supportEmail}`,
  hrefLabel: COMPANY.supportEmail,
};

const terms = meta("portal-terms");
export const portalTerms: Doc = {
  slug: "client-portal-terms-and-rules-of-engagement",
  family: "policy",
  file: terms.file,
  docId: "DE-POL-PRT",
  edition: terms.edition,
  title: `${terms.title} | Digerati Experts`,
  kicker: "Client Portal · Company agreement",
  h1: "Client Portal Terms, Legal Disclaimers and Rules of Engagement",
  subtitle:
    "How Digerati Experts and your company work together through the Client Portal: who may act for the company, how a request becomes work, what the portal is and is not, and the legal terms that apply.",
  aside: {
    facts: [
      { label: "Last modified", value: terms.modified },
      { label: "Version", value: terms.edition },
      { label: "Signed by", value: "One authorized person, once, for the whole company." },
      { label: "Works with", value: "Your Master Services Agreement and any Statement of Work." },
    ],
  },
  keywords: "Digerati Experts, client portal, terms, rules of engagement, legal disclaimer",
  cta: SUPPORT,
  blocks: [
    {
      t: "section",
      title: "Parties and order of precedence",
      body: [
        { t: "p", text: `These terms are between **${COMPANY.legalName}** ("DE", "we", "us") and the company named on the portal account ("Client", "you"). They govern use of the Client Portal at portal.digeratiexperts.com and its related apps (the "Portal").` },
        {
          t: "list",
          style: "num",
          items: [
            "Your signed **Master Services Agreement (MSA)**, and any Statement of Work, Order Form or Service Level Agreement made under it, control the services DE delivers. If these terms conflict with them, the MSA and its documents win.",
            "If you have no signed MSA, the website **Terms of Use** at digeratiexperts.com/legal/terms-of-use apply alongside these terms.",
            "The **Client Portal Acceptable Use Policy** applies to every person who signs in. Each user accepts it for themselves.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Who may act for the company",
      body: [
        { t: "p", text: "The person who signs these terms confirms that they are authorized to bind the Client. The Client decides who has portal access and is responsible for what its users do in the Portal." },
        {
          t: "list",
          items: [
            "**Company IT contacts and org admins** may approve purchases, change people and access, accept quotes and sign for the company where the Portal offers it.",
            "**Managers** may approve requests for their teams within the approval rules your company sets.",
            "**Staff** may open tickets and requests for themselves and see their own records.",
            "Tell us promptly when someone joins, changes role or leaves. Until you do, DE may rely on instructions from any active account with the right role.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Rules of engagement",
      intro: "How work moves between your team and ours.",
      body: [
        {
          t: "list",
          style: "num",
          items: [
            "**The Portal is the system of record.** A ticket or request opened in the Portal, by email to support or by phone is logged and tracked here. Chats, texts or messages to an individual engineer are not a request until they are logged.",
            "**Emergencies are called in.** For an outage, a suspected security incident or anything urgent, call DE. Do not rely on a portal ticket alone to report an emergency.",
            "**Response and resolution targets** are the ones in your SLA or Statement of Work. The Portal shows status; it does not change those targets.",
            "**Approvals mean authorization.** Approving a quote, order, purchase, licence or change in the Portal authorizes DE to carry it out and to bill for it as your agreements allow.",
            "**Out-of-scope work is quoted first.** If a request falls outside your agreements, DE tells you and gets your approval before billable work begins, except where an emergency response is needed to protect your systems.",
            "**Security changes need a verified requester.** Password resets, MFA changes, new access and offboarding are carried out only for a requester DE can verify, and we may call back before acting.",
            "**Be specific and keep us informed.** Describe the problem, who is affected and how to reach you. Reply to questions on your tickets so work is not left waiting.",
            "**Respect on both sides.** DE staff will treat your people professionally, and we ask the same. DE may restrict an account used to harass or abuse staff.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Your information",
      body: [
        {
          t: "list",
          items: [
            "Information you put in the Portal stays yours. DE uses it to deliver and support your services, as described in your MSA, any Data Processing Addendum and our Privacy Policy.",
            "The Portal records activity (sign-ins, approvals, signatures, changes) for security and as a record of what was authorized. Those records may be used to resolve a dispute about what was requested or approved.",
            "Do not upload information you are not allowed to share with DE, or regulated data (such as health or payment card data) unless your agreements cover it.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Legal disclaimers",
      body: [
        {
          t: "list",
          style: "num",
          items: [
            "**Information, not advice.** Articles, reports, scores, recommendations and roadmaps in the Portal are provided to help you make decisions. They are not legal, tax, financial or compliance advice, and they do not certify that you meet any law, regulation or framework.",
            "**Sample and preview content.** Some Portal pages show sample content until a service is live for your company; they are labelled as samples. Sample content does not describe your environment.",
            "**Third-party services.** The Portal links to or shows data from third-party products (for example ticketing, billing, phone, backup and security tools). Those products are governed by their own terms; DE does not control their availability or accuracy.",
            "**Availability.** DE aims to keep the Portal available but does not guarantee it will be uninterrupted or error-free. Portal availability is not a service level unless your SLA says so. If the Portal is down, contact DE by phone or email.",
            "**As provided.** Except for what your MSA or SLA expressly commits to, the Portal is provided as is and as available, without warranties of any kind, to the fullest extent the law allows.",
            "**Liability.** Limitations of liability, indemnities, governing law and dispute resolution are those in your MSA. Without an MSA, the website Terms of Use govern them.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Changes, suspension and signatures",
      body: [
        {
          t: "list",
          items: [
            "DE may update these terms. When we do, the Portal asks an authorized person to review and sign the new version before the company continues to use it. The version and date are shown at the top of this document.",
            "DE may suspend an account that puts your company, DE or other clients at risk, and will tell your company IT contact why.",
            "Typing your name and selecting **Sign Agreements** in the Portal is an electronic signature with the same effect as a handwritten one. DE records the signer, time, version and a fingerprint of this document, and you can ask us for a copy.",
          ],
        },
      ],
    },
  ],
};

const aup = meta("portal-acceptable-use");
export const portalAcceptableUse: Doc = {
  slug: "client-portal-acceptable-use-policy",
  family: "policy",
  file: aup.file,
  docId: "DE-POL-AUP",
  edition: aup.edition,
  title: `${aup.title} | Digerati Experts`,
  kicker: "Client Portal · Personal agreement",
  h1: "Client Portal Acceptable Use Policy",
  subtitle: "What you may and may not do with your Client Portal account, and what we do to keep your company's information safe.",
  aside: {
    facts: [
      { label: "Last modified", value: aup.modified },
      { label: "Version", value: aup.edition },
      { label: "Signed by", value: "Every person with a portal account, for themselves." },
      { label: "Also applies", value: "The DE Acceptable Use Policy at digeratiexperts.com/legal/aup." },
    ],
  },
  keywords: "Digerati Experts, client portal, acceptable use policy",
  cta: SUPPORT,
  blocks: [
    {
      t: "section",
      title: "Your account is yours alone",
      body: [
        {
          t: "list",
          items: [
            "Do not share your password, MFA codes, passkeys or sign-in links, and do not let anyone else use your session.",
            "Keep multi-factor authentication turned on. DE may require it for your role.",
            "Sign out on shared or public computers, and lock your screen when you step away.",
            "Tell DE right away if you think someone else has used your account, or if you receive a sign-in alert you do not recognize.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Use the portal for your company's business",
      body: [
        {
          t: "list",
          items: [
            "Request support, approve work, view records and download documents for the company you belong to, within your role.",
            "Only approve or sign what you are authorized to approve or sign.",
            "Give accurate information in tickets, requests and forms.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Not allowed",
      body: [
        {
          t: "list",
          style: "num",
          items: [
            "Trying to see or change another person's or another company's information, or to get around access controls, roles or approvals.",
            "Probing, scanning, load-testing or attacking the Portal, or automating access to it (scripts, scrapers, bots) without DE's written permission.",
            "Uploading malware, or files you do not have the right to share.",
            "Using the Portal for anything unlawful, harassing, or unrelated to your company's relationship with DE.",
            "Sharing confidential information from the Portal, including DE pricing, reports and documentation, outside your company without permission.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "What we do",
      body: [
        {
          t: "list",
          items: [
            "We log sign-ins and actions to protect your company and to keep a record of what was requested and approved.",
            "We may lock an account that shows signs of compromise or misuse, and we will tell you or your company IT contact why.",
            "We never ask for your password by email, chat or phone.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Your agreement",
      body: [
        { t: "p", text: "By typing your name and selecting **Sign Agreements**, you confirm you have read this policy and agree to follow it. Breaking it may lead to your access being suspended or removed. DE may update this policy; the Portal will ask you to accept the new version." },
      ],
    },
  ],
};

const guide = meta("portal-guide");
export const portalGuide: Doc = {
  slug: "client-portal-guide",
  family: "policy",
  file: guide.file,
  docId: "DE-POL-GDE",
  edition: guide.edition,
  title: `${guide.title} | Digerati Experts`,
  kicker: "Client Portal · How to use it",
  h1: "Client Portal Guide",
  subtitle: "How to get help, track requests, find your documents and keep your account secure. What you see depends on your role.",
  aside: {
    facts: [
      { label: "Last modified", value: guide.modified },
      { label: "Version", value: guide.edition },
      { label: "Acknowledged by", value: "Every person with a portal account." },
      { label: "Take the tour", value: "Choose Take the portal tour in your account menu at any time." },
    ],
  },
  keywords: "Digerati Experts, client portal, guide, how to",
  cta: SUPPORT,
  blocks: [
    {
      t: "section",
      title: "Getting help",
      body: [
        {
          t: "table",
          head: ["You need", "Go to", "What happens"],
          rowHeader: true,
          rows: [
            ["Something is broken", "Support Tickets › New ticket", "A ticket is logged, you get a number and updates as we work it."],
            ["Something new: access, a device, a licence", "Self-Service or Service Requests", "The right form for the request; approvals are routed for you."],
            ["An outage or a security worry", "Call DE", "Call for anything urgent. Do not wait on a ticket."],
            ["A quick answer", "Knowledge Base or Chats / DE Desk", "How-to articles, or a conversation with our desk."],
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Finding your way around",
      body: [
        {
          t: "list",
          items: [
            "**Dashboard**: what needs you now, open tickets and recent activity.",
            "**Search or jump to** (Ctrl+K, or Cmd+K on a Mac): type a page or a task and press Enter.",
            "**Activity** (the bell): updates on your tickets, requests and approvals.",
            "**Account menu** (your initials): settings, light or dark theme, the portal tour and sign out.",
            "**Company, Contracts and Files**: your account record, signed agreements and documents DE has shared.",
            "**Billing and Invoices**: what you subscribe to and what is due, for people with billing access.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "If you approve or manage people",
      body: [
        {
          t: "list",
          items: [
            "**Approvals** lists requests waiting on you. Approving authorizes the work and any cost shown.",
            "**People & Org** is where company IT contacts keep departments, managers and roles current. Tell us the day someone leaves.",
            "**Licenses** shows your company's licence policy and who holds what.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Keeping your account secure",
      body: [
        {
          t: "list",
          style: "num",
          items: [
            "Turn on multi-factor authentication in **Settings**; a passkey is the strongest option.",
            "Never share your sign-in. DE will never ask for your password.",
            "Check **Activity** for sign-ins you do not recognize, and tell us straight away.",
          ],
        },
      ],
    },
    {
      t: "section",
      title: "Acknowledgement",
      body: [
        { t: "p", text: `By signing, you confirm you have read this guide. It is updated as the Portal changes; the latest version is always at ${SITE}${guide.file.replace(/^assets/, "/assets")}.` },
      ],
    },
  ],
};
