import { DE_COMPANY } from "./knowledge";
import { OFF_TOPIC_FALLBACK, INCIDENT_FALLBACK, AI_UNAVAILABLE_FALLBACK } from "./prompt";
import type { AdvisorMode, ConversationProfile, ModelAdvisorOutput } from "./types";

export function normalizeReply(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isNearDuplicate(next: string, last?: string): boolean {
  if (!last) return false;
  const a = normalizeReply(next);
  const b = normalizeReply(last);
  if (!a || !b) return false;
  if (a === b) return true;
  const prefixLen = Math.min(72, a.length, b.length);
  return prefixLen >= 40 && a.slice(0, prefixLen) === b.slice(0, prefixLen);
}

function firstName(profile: ConversationProfile): string {
  return (profile.contactName || "").split(" ")[0] || "";
}

function address(profile: ConversationProfile, body: string): string {
  const first = firstName(profile);
  if (!first) return body;
  if (new RegExp(`\\b${first}\\b`, "i").test(body)) return body;
  const lead = body.match(
    /^(I'll put you down as a walk-in for now\.|You're right — that last reply was a canned fallback\.|Fair point — that wording was sloppy\.)\s*/,
  );
  if (lead) {
    return `${lead[1].replace(/\.$/, "")}, ${first}. ${body.slice(lead[0].length)}`;
  }
  return `${first} — ${body}`;
}

export type HeuristicInput = {
  mode: AdvisorMode;
  userMessage: string;
  originalIntent?: string;
  profile: ConversationProfile;
  lastAssistantReply?: string;
  fallbackVariant: number;
  justCollectedInformalCompany?: boolean;
  cannedComplaint?: boolean;
  askedForHuman?: boolean;
  /** Visitor already asked for a person and has the call, callback and message options. */
  humanRequested?: boolean;
};

function walkInPrefix(input: HeuristicInput): string {
  if (input.profile.deInternal) {
    return "You're with DE — I won't treat that as an outside company. ";
  }
  if (!input.justCollectedInformalCompany && !input.profile.companyInformal) return "";
  if (input.justCollectedInformalCompany) {
    return "I'll put you down as a walk-in for now. ";
  }
  return "";
}

function apologyPrefix(input: HeuristicInput): string {
  if (input.cannedComplaint) {
    return "You're right — that last reply was a canned fallback. ";
  }
  if (/\bwhat do you mean|that'?s weird\b/i.test(input.userMessage)) {
    return "Fair point — that wording was sloppy. ";
  }
  return "";
}

const IT_VARIANTS = [
  "What's actually broken — email, a device, the network, or signing in? If it's urgent, open Get Support in this window and we'll take a ticket.",
  "I can take this as a support request. Is it email, a computer, Wi-Fi or VPN, or an account you can't get into?",
  "Describe the symptom in one line and I'll route it to Get Support here — no sales pitch.",
];

const DISCOVERY_VARIANTS = [
  "Are you trying to get something working today, or looking at managed IT and security for the business?",
  "What's the main pressure — an outage, a security worry, or choosing a provider?",
  "Tell me the user count and the one problem you want solved first.",
];

const CYBER_VARIANTS = [
  "What's the worry — phishing, a suspicious login, ransomware, or tightening things before something happens?",
  "Is this an active incident, or do you want a clearer picture of your exposure?",
  "Who is affected and what did you notice first? I'll point you to the right desk path.",
];

const COMPLIANCE_VARIANTS = [
  "Which framework are you working toward — HIPAA, SOC 2, PCI, or CMMC — and is this an upcoming audit or general readiness?",
  "Are you gathering evidence for an audit, or deciding what controls you still need?",
  "What deadline are you under, and how many people are in scope?",
];

const PRICING_VARIANTS = [
  `ProActive is sized by users and outcomes — IT from $125/user/mo ($1,600/mo minimum), Office $165 ($2,400 min), Business $245 ($5,400 min), Enterprise $345 ($9,000 min). About how many users do you support?`,
  "The right package depends on team size, security needs, and compliance — not a one-line quote. How many people need support?",
  "I can walk the floors once I know headcount and whether you need IT only or IT plus stronger security. User count?",
];

function pick(lines: string[], variant: number, last?: string): string {
  for (let i = 0; i < lines.length; i++) {
    const candidate = lines[(variant + i) % lines.length];
    if (!isNearDuplicate(candidate, last)) return candidate;
  }
  return lines[variant % lines.length];
}

export function buildHeuristicReply(input: HeuristicInput): ModelAdvisorOutput {
  const prefix = `${apologyPrefix(input)}${walkInPrefix(input)}`;
  const intent = (input.originalIntent || input.userMessage || "").trim();
  const itShaped =
    input.mode === "it_support" ||
    /\bit help|something('s| is)? (broken|down|not working)|help desk\b/i.test(intent);

  if (input.mode === "off_topic") {
    const reply = prefix ? `${prefix}I stay on business IT, cybersecurity, and DE services. What's going on with your technology?` : OFF_TOPIC_FALLBACK;
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "request_assessment" }],
      analyticsEvents: ["off_topic_redirected"],
    };
  }

  if (input.mode === "security_incident") {
    return {
      reply: prefix ? `${prefix}${INCIDENT_FALLBACK}` : INCIDENT_FALLBACK,
      mode: input.mode,
      proposedActions: [{ type: "request_callback" }, { type: "contact_sales" }],
      analyticsEvents: ["qualified_question"],
    };
  }

  if (input.mode === "existing_client") {
    const reply = address(
      input.profile,
      `${prefix}Fastest path is Client Tools / the Client Portal for tickets: ${DE_COMPANY.portalLogin}. What do you need help with?`,
    );
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "open_portal" }, { type: "leave_message" }],
      analyticsEvents: ["support_routed"],
    };
  }

  if (input.humanRequested) {
    const reply = pick(
      [
        `Noted. Leave a message or request a callback below and the desk gets it with this chat. Anything urgent: ${DE_COMPANY.phoneDisplay}.`,
        `Got it. The message and callback buttons below send this to the desk with the chat. For anything urgent, call ${DE_COMPANY.phoneDisplay}.`,
      ],
      input.fallbackVariant,
      input.lastAssistantReply,
    );
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "request_callback" }, { type: "leave_message" }],
      analyticsEvents: ["support_routed"],
    };
  }

  if (input.askedForHuman) {
    const reply = address(
      input.profile,
      `${prefix}A human on the DE team: ${DE_COMPANY.phoneDisplay}. You can also book ${DE_COMPANY.bookingUrl} or keep going here.`,
    );
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "schedule_consultation" }, { type: "contact_sales" }],
      analyticsEvents: ["qualified_question"],
    };
  }

  if (input.mode === "pricing") {
    const reply = address(input.profile, `${prefix}${pick(PRICING_VARIANTS, input.fallbackVariant, input.lastAssistantReply)}`);
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "request_assessment" }, { type: "schedule_consultation" }],
      analyticsEvents: ["qualified_question", "service_recommended"],
      profilePatch: { recommendedServices: ["ProActive"] },
    };
  }

  if (input.mode === "assessment") {
    const reply = address(
      input.profile,
      `${prefix}A Cyber Risk Assessment is the usual first step when you want a clear picture before buying. How many users, and what's the main worry?`,
    );
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "request_assessment" }, { type: "schedule_consultation" }],
      analyticsEvents: ["assessment_offered"],
    };
  }

  if (itShaped) {
    const reply = address(input.profile, `${prefix}${pick(IT_VARIANTS, input.fallbackVariant, input.lastAssistantReply)}`);
    return {
      reply,
      mode: "it_support",
      proposedActions: [{ type: "leave_message" }],
      analyticsEvents: ["support_routed", "qualified_question"],
    };
  }

  if (input.mode === "cybersecurity") {
    const reply = address(input.profile, `${prefix}${pick(CYBER_VARIANTS, input.fallbackVariant, input.lastAssistantReply)}`);
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "leave_message" }, { type: "request_assessment" }],
      analyticsEvents: ["qualified_question"],
    };
  }

  if (input.mode === "compliance") {
    const reply = address(input.profile, `${prefix}${pick(COMPLIANCE_VARIANTS, input.fallbackVariant, input.lastAssistantReply)}`);
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "request_assessment" }],
      analyticsEvents: ["qualified_question"],
    };
  }

  if (input.mode === "cloud_m365") {
    const reply = address(
      input.profile,
      `${prefix}Microsoft 365 we treat as identity, email, and device control — not just licenses. What's failing, or what are you trying to tighten?`,
    );
    return {
      reply,
      mode: input.mode,
      proposedActions: [{ type: "leave_message" }],
      analyticsEvents: ["qualified_question"],
    };
  }

  const reply = address(
    input.profile,
    `${prefix}${pick(DISCOVERY_VARIANTS, input.fallbackVariant, input.lastAssistantReply)}`,
  );
  return {
    reply: reply || AI_UNAVAILABLE_FALLBACK,
    mode: input.mode,
    proposedActions: [{ type: "leave_message" }],
    analyticsEvents: ["qualified_question"],
  };
}

export function ensureFreshReply(reply: string, input: HeuristicInput): string {
  if (!isNearDuplicate(reply, input.lastAssistantReply)) return reply;
  const next = buildHeuristicReply({ ...input, fallbackVariant: input.fallbackVariant + 1 });
  return next.reply;
}
