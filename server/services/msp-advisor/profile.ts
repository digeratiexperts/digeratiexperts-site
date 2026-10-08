import type { ConversationProfile } from "./types";
import { emptyProfile } from "./types";

function uniqStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = (v || "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Extract structured facts from free text (heuristic). */
export function extractProfileFromText(message: string): Partial<ConversationProfile> {
  const patch: Partial<ConversationProfile> = {};
  const text = message;

  // Prefer explicit headcount; avoid treating "Microsoft 365 seats" as 365 users
  const cleanedForCount = text
    .replace(/\bmicrosoft\s*365\b/gi, "M365")
    .replace(/\boffice\s*365\b/gi, "O365");
  const emp =
    cleanedForCount.match(
      /\b(\d{1,4})\s*(?:m365|o365)?\s*(employees?|users?|seats?|people|staff|persons?)\b/i,
    ) ||
    cleanedForCount.match(/\b(\d{1,4})-?\s*person\b/i) ||
    cleanedForCount.match(/\b(employees?|users?|seats?)\s*[:=]?\s*(\d{1,4})\b/i);
  if (emp) {
    const n = parseInt(emp[1].match(/^\d/) ? emp[1] : emp[2], 10);
    if (!Number.isNaN(n) && n > 0 && n < 100000) patch.employeeCount = n;
  }

  const wordNums: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const sites =
    text.match(/\b(\d{1,3})\s*(locations?|sites?|offices?)\b/i) ||
    text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(locations?|sites?|offices?)\b/i);
  if (sites) {
    const raw = sites[1].toLowerCase();
    const n = wordNums[raw] ?? parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0) patch.siteCount = n;
  }

  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  if (email) patch.email = email[0];

  const phone = text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  if (phone) patch.phone = phone[0];

  const industry =
    text.match(/\b(healthcare|medical|dental|legal|law\s*firm|nonprofit|non-profit|manufacturing|construction|real\s*estate|finance|accounting|professional\s*services|retail)\b/i);
  if (industry) patch.industry = industry[1];

  const location =
    text.match(/\b(in|near|from)\s+(Chandler|Phoenix|Scottsdale|Tempe|Mesa|Gilbert|Arizona|AZ)\b/i) ||
    text.match(/\b(Chandler|Phoenix|Scottsdale|Tempe|Mesa|Gilbert),?\s*(AZ|Arizona)?\b/i);
  if (location) {
    patch.location = (location[2] || location[1] || "").replace(/^(in|near|from)\s+/i, "") || location[0];
  }

  const compliance = uniqStrings(
    (text.match(/\b(HIPAA|CMMC|PCI(?:\s*DSS)?|SOC\s*2|GLBA|GDPR|NIST)\b/gi) || []).map((c) =>
      c.toUpperCase().replace(/\s+/g, " "),
    ),
  );
  if (compliance.length) patch.complianceRequirements = compliance;

  if (/\b(no\s+it|it\s+(guy|person|admin)\s+(left|quit|gone)|no\s+internal\s+it|don'?t\s+have\s+(an?\s+)?it\s+team)\b/i.test(text)) {
    patch.internalIT = "none / recently lost";
  } else if (/\b(we\s+have\s+(an?\s+)?(internal\s+)?it\s*(team|person|guy)|in-?house\s+it)\b/i.test(text)) {
    patch.internalIT = "has internal IT";
  }

  if (/\b(existing\s+client|already\s+(a\s+)?(customer|client)|we\s+are\s+(a\s+)?client)\b/i.test(text)) {
    patch.prospectOrClient = "client";
  } else if (/\b(looking\s+for|evaluating|considering|need\s+(an?\s+)?msp|new\s+provider)\b/i.test(text)) {
    patch.prospectOrClient = "prospect";
  }

  if (/\b(microsoft\s*365|m365|office\s*365|azure|google\s*workspace)\b/i.test(text)) {
    const envBits: string[] = [];
    if (/\b(microsoft\s*365|m365|office\s*365)\b/i.test(text)) envBits.push("Microsoft 365");
    if (/\bazure\b/i.test(text)) envBits.push("Azure");
    if (/\bgoogle\s*workspace\b/i.test(text)) envBits.push("Google Workspace");
    patch.currentEnvironment = envBits.join(", ");
  }

  const company =
    text.match(/\b(?:company|business|org(?:anization)?)\s*(?:is|:)?\s*([A-Z][\w&.\- ]{1,40})/) ||
    text.match(/\bwe(?:'re| are)\s+([A-Z][\w&.\- ]{1,40})\b/);
  if (company?.[1] && !/^(Looking|Interested|Trying|Based|Located)/i.test(company[1])) {
    patch.companyName = company[1].trim();
  }

  const nameAtCompany = extractNameAndCompany(text);
  if (nameAtCompany.contactName) patch.contactName = nameAtCompany.contactName;
  if (nameAtCompany.companyName) patch.companyName = nameAtCompany.companyName;

  return patch;
}

const NAME_STOPWORDS = new Set([
  "hi",
  "hello",
  "hey",
  "thanks",
  "thank",
  "yes",
  "no",
  "ok",
  "okay",
  "please",
  "help",
  "sure",
  "yep",
  "yeah",
  "we",
  "i",
  "my",
  "the",
  "a",
  "an",
]);

/**
 * Words that follow "I'm …" without being a name — states, feelings, and
 * activities. "I'm concerned about cybersecurity" once produced the contact
 * name "Concerned" (Joe transcript, 2026-08-31); an intro capture whose first
 * word is one of these, ends in a gerund, or is followed by a linking word is
 * not a self-introduction.
 */
const NON_NAME_AFTER_IM = new Set([
  "concerned", "worried", "interested", "curious", "afraid", "scared",
  "sure", "not", "just", "here", "still", "currently", "really", "very",
  "so", "a", "an", "the", "all", "always", "also", "about", "at", "with",
  "good", "fine", "ok", "okay", "great", "well", "happy", "glad", "sorry",
  "ready", "unable", "new", "back", "done", "busy", "confused", "lost",
  "stuck", "frustrated", "unhappy", "upset", "angry", "annoyed", "unsure",
  "aware", "unaware", "certain", "positive", "serious", "kidding", "joking",
]);

const NAME_LINKING_TAIL = /^\s+(about|that|to|with|for|because|since|if|and|but|in|on|of|by|how|why|what|when|where)\b/i;

/** Common "I'm <gerund>" activities — explicit list, NOT a blanket /ing$/
 * test, so real names ending in -ing (Ming, Sterling, Irving, King,
 * Blessing, Fleming…) still extract (adversarial-review correction). */
const GERUND_AFTER_IM = new Set([
  "looking", "hoping", "going", "trying", "getting", "having", "checking",
  "wondering", "calling", "reaching", "writing", "emailing", "dealing",
  "experiencing", "seeing", "working", "running", "testing", "shopping",
  "browsing", "being", "asking", "thinking", "planning", "considering",
  "evaluating", "comparing", "researching", "starting", "setting", "moving",
  "switching", "needing", "wanting", "willing",
]);

export function extractContactNameFromText(message: string): string | undefined {
  const text = message.trim();
  const intro = text.match(
    /^(?:(?:hi|hello|hey|howdy|good\s+(?:morning|afternoon|evening))[,!.\s]+)?(?:(i(?:['’]?m| am))|my name is|this is|name(?:'s| is)|it['’]?s)\s+([A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z][A-Za-z'.\-]+){0,2})\b/i,
  );
  if (intro?.[2] && !/[?]/.test(intro[2])) {
    // Trim greedy multi-word captures at the first function word so
    // "I'm Sam and we got hacked" yields "Sam", not "Sam And We".
    const CAPTURE_STOP = /^(and|but|from|at|with|here|so|the|a|an|of|in|on|for|to|we|our|my|us)$/i;
    const words = intro[2].split(/\s+/);
    const stopIdx = words.findIndex((w) => CAPTURE_STOP.test(w));
    const captured = (stopIdx > 0 ? words.slice(0, stopIdx) : words).join(" ");
    // Only "I'm …" is ambiguous between a name and a state/activity;
    // "my name is / this is / name's" are explicit self-identification.
    const ambiguousIntro = Boolean(intro[1]);
    const firstWord = captured.split(/\s+/)[0].toLowerCase();
    // Linking-tail only applies to the UNtrimmed capture: if we already cut
    // at a function word ("Sam | and we got hacked"), that boundary was the
    // decision — don't re-read it as a state phrase.
    const afterCapture = stopIdx > 0 ? "" : text.slice(text.indexOf(intro[2]) + intro[2].length);
    const looksLikeState =
      ambiguousIntro &&
      (NON_NAME_AFTER_IM.has(firstWord) ||
        GERUND_AFTER_IM.has(firstWord) ||
        NAME_LINKING_TAIL.test(afterCapture));
    if (!looksLikeState) {
      return cleanPersonName(captured);
    }
    return undefined;
  }

  if (/[?]/.test(text) || text.length > 42) return undefined;
  if (!/^[A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z][A-Za-z'.\-]+){0,2}$/.test(text)) return undefined;
  if (NAME_STOPWORDS.has(text.toLowerCase())) return undefined;
  return cleanPersonName(text);
}

const INFORMAL_COMPANY =
  /^(your\s+(mom|mama|mother)|yo\s+mama|yours\s+truly|none|n\/a|n\.a\.|na|idk|skip|pass|nope|no|private|asdf+|test(ing)?|foo|bar|baz|-|\.|walk-?in|personal|myself|me|n\/a)$/i;

const DE_INTERNAL_COMPANY =
  /^(yours|your(s| company)?|you( guys| all)?|us|we|ours|our company|here|this( company| one| place| firm)?|the company|de( staff| employee)?|d\.e\.( staff| employee)?|digerati( experts)?( staff| employee)?|internal|staff|employee)$/i;

const DE_INTERNAL_PHRASE =
  /\b(i work (here|for (you|us|de|digerati( experts)?))|i(?:['’]?m| am) (with|at) (de|you|digerati)|i(?:['’]?m| am) (an? )?(de staff|de employee)|we(?:['’]?re| are) (de|digerati|you|yours|here))\b/i;

/** Visitor is pointing at Digerati Experts / this desk — not a literal outside company name. */
export function isDeInternalCompanyAnswer(name: string | undefined | null): boolean {
  if (!name) return false;
  const text = name.replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (DE_INTERNAL_COMPANY.test(text)) return true;
  if (DE_INTERNAL_PHRASE.test(text)) return true;
  return false;
}

/** Joke, declined, or nonsense company — accept as a walk-in, do not stall. */
export function isInformalCompanyName(name: string | undefined | null): boolean {
  if (!name) return false;
  const text = name.replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (isDeInternalCompanyAnswer(text)) return false;
  if (INFORMAL_COMPANY.test(text)) return true;
  if (/\byour\s+(mom|mama|mother)\b/i.test(text)) return true;
  if (/\b(rather not|prefer not|none of your|mind your own)\b/i.test(text)) return true;
  return false;
}

export function extractCompanyNameFromText(message: string, opts?: { allowBare?: boolean }): string | undefined {
  const text = message.trim();
  if (!text) return undefined;

  const explicit =
    text.match(/\b(?:(?:i(?:['’]?m| am)|we(?:'re| are))\s+(?:with|at|from)|company(?:\s+name)?(?:\s+is|:)|we work (?:at|for))\s+(.+)$/i) ||
    text.match(/\b(?:at|from|with)\s+([A-Z][\w&.\- ]{1,60})$/);
  if (explicit?.[1]) {
    const company = sanitizeCompanyName(explicit[1]);
    if (company) return company;
  }

  if (!opts?.allowBare) return undefined;
  if (/[?]/.test(text) || text.length > 80) return undefined;
  return sanitizeCompanyName(text);
}

function extractNameAndCompany(text: string): { contactName?: string; companyName?: string } {
  const match = text.match(
    /^(?:i(?:['’]?m| am)|my name is)\s+([A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z][A-Za-z'.\-]+)?)\s+(?:at|from|with)\s+(.+)$/i,
  );
  if (!match) return {};
  return {
    contactName: cleanPersonName(match[1]),
    companyName: sanitizeCompanyName(match[2]),
  };
}

/**
 * Answers to "what's your name?" that are not a name. "me" became "Thanks, Me."
 * (Joe transcript, 2026-10-07). A first word from this list rejects the whole
 * answer, so "none of your business" is not the name "None Of Your".
 */
const NOT_A_NAME = new Set([
  "me", "myself", "i", "you", "him", "her", "them", "it", "none", "no", "nope",
  "nah", "nobody", "noone", "anonymous", "anon", "unknown", "idk", "dunno",
  "skip", "pass", "test", "testing", "guest", "user", "visitor", "customer",
  "client", "private", "nothing", "whatever", "why", "who", "what", "na", "n/a",
  "secret", "null", "undefined", "asdf",
  // "It's about my invoice" answers "what's it about?", it is not the name "About".
  "about", "regarding", "re", "for", "the", "a", "an", "my", "our", "your",
  "just", "that", "this", "not", "here", "there", "fine", "good", "urgent",
  "important", "something", "nothing", "all", "still", "also",
]);

/** The visitor's answer is not a usable name ("me", "none", "why?"). */
export function isNotAName(raw: string): boolean {
  const first = raw.replace(/\s+/g, " ").trim().replace(/[.,!?]+$/, "").split(" ")[0]?.toLowerCase() || "";
  return !first || NOT_A_NAME.has(first);
}

function cleanPersonName(raw: string): string | undefined {
  const name = raw.replace(/\s+/g, " ").trim().replace(/[.,!]+$/, "");
  if (!name || NAME_STOPWORDS.has(name.toLowerCase()) || isNotAName(name)) return undefined;
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sanitizeCompanyName(raw: string): string | undefined {
  const company = raw.replace(/\s+/g, " ").trim().replace(/[.,!]+$/, "");
  if (!company || company.length < 2) return undefined;
  if (NAME_STOPWORDS.has(company.toLowerCase())) return undefined;
  if (/^(looking|interested|trying|based|located|help|hello)\b/i.test(company)) return undefined;
  return company.slice(0, 80);
}

export function isSubstantiveAdvisorQuestion(message: string): boolean {
  const text = message.trim();
  if (text.length >= 40) return true;
  if (/[?]/.test(text)) return true;
  return /\b(how|what|why|need|help|ransomware|phishing|ticket|price|cost|hipaa|m365|microsoft)\b/i.test(text);
}

export function mergeProfile(
  current: ConversationProfile,
  patch: Partial<ConversationProfile> | undefined,
): ConversationProfile {
  if (!patch) return current;
  const next: ConversationProfile = {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ),
    pains: uniqStrings([...(current.pains || []), ...((patch.pains as string[]) || [])]),
    priorities: uniqStrings([...(current.priorities || []), ...((patch.priorities as string[]) || [])]),
    recommendedServices: uniqStrings([
      ...(current.recommendedServices || []),
      ...((patch.recommendedServices as string[]) || []),
    ]),
    complianceRequirements: uniqStrings([
      ...(current.complianceRequirements || []),
      ...((patch.complianceRequirements as string[]) || []),
    ]),
  };

  // Never overwrite known scalar facts with empties; prefer first known employeeCount
  if (current.employeeCount && patch.employeeCount && current.employeeCount !== patch.employeeCount) {
    // Keep existing unless patch is more specific later — keep first for no re-ask churn
    next.employeeCount = current.employeeCount;
  }

  if (isDeInternalCompanyAnswer(next.companyName)) {
    next.companyName = "Digerati Experts";
    next.deInternal = true;
    next.companyInformal = false;
  }

  next.qualificationConfidence = scoreQualification(next);
  return next;
}

export function scoreQualification(profile: ConversationProfile): number {
  let score = 0;
  if (profile.employeeCount) score += 20;
  if (profile.industry) score += 10;
  if (profile.location) score += 5;
  if (profile.internalIT) score += 10;
  if (profile.complianceRequirements?.length) score += 15;
  if (profile.currentEnvironment) score += 10;
  if (profile.email) score += 15;
  if (profile.companyName) score += 10;
  if (profile.pains.length) score += 10;
  if (profile.phone) score += 5;
  return Math.min(100, score);
}

/** Facts already known — used so the model does not re-ask. */
export function knownFactsList(profile: ConversationProfile): string[] {
  const facts: string[] = [];
  if (profile.companyName) facts.push(`companyName=${profile.companyName}`);
  if (profile.deInternal) {
    facts.push(
      "deInternal=true (visitor indicated they work at Digerati Experts — staff/internal, not a client, not an outside company named yours/us/DE/here)",
    );
  }
  if (profile.companyInformal) facts.push("companyInformal=true (walk-in — do not moralize or dump a sales pitch)");
  if (profile.contactName) facts.push(`contactName=${profile.contactName}`);
  if (profile.email) facts.push(`email=${profile.email}`);
  if (profile.phone) facts.push(`phone=${profile.phone}`);
  if (profile.employeeCount) facts.push(`employeeCount=${profile.employeeCount}`);
  if (profile.siteCount) facts.push(`siteCount=${profile.siteCount}`);
  if (profile.industry) facts.push(`industry=${profile.industry}`);
  if (profile.location) facts.push(`location=${profile.location}`);
  if (profile.internalIT) facts.push(`internalIT=${profile.internalIT}`);
  if (profile.currentProvider) facts.push(`currentProvider=${profile.currentProvider}`);
  if (profile.complianceRequirements?.length) {
    facts.push(`compliance=${profile.complianceRequirements.join(",")}`);
  }
  if (profile.currentEnvironment) facts.push(`environment=${profile.currentEnvironment}`);
  if (profile.prospectOrClient && profile.prospectOrClient !== "unknown") {
    facts.push(`visitorType=${profile.prospectOrClient}`);
  }
  if (profile.timeline) facts.push(`timeline=${profile.timeline}`);
  if (profile.pains.length) facts.push(`pains=${profile.pains.join(";")}`);
  return facts;
}

export function buildLeadSummary(profile: ConversationProfile, messages: Array<{ role: string; content: string }>): string {
  const recent = messages.slice(-12).map((m) => `${m.role}: ${m.content}`).join("\n");
  return [
    "Website DE Desk lead summary",
    `Company: ${profile.companyName || "n/a"}`,
    `Contact: ${profile.contactName || "n/a"}`,
    `Email: ${profile.email || "n/a"}`,
    `Phone: ${profile.phone || "n/a"}`,
    `Employees/users: ${profile.employeeCount ?? "n/a"}`,
    `Sites: ${profile.siteCount ?? "n/a"}`,
    `Industry: ${profile.industry || "n/a"}`,
    `Location: ${profile.location || "n/a"}`,
    `Internal IT: ${profile.internalIT || "n/a"}`,
    `Current provider: ${profile.currentProvider || "n/a"}`,
    `Environment: ${profile.currentEnvironment || "n/a"}`,
    `Compliance: ${(profile.complianceRequirements || []).join(", ") || "n/a"}`,
    `Pains: ${profile.pains.join("; ") || "n/a"}`,
    `Priorities: ${profile.priorities.join("; ") || "n/a"}`,
    `Recommended services: ${profile.recommendedServices.join("; ") || "n/a"}`,
    `Desired outcome: ${profile.desiredOutcome || "n/a"}`,
    `Timeline: ${profile.timeline || "n/a"}`,
    `Visitor type: ${profile.prospectOrClient || "unknown"}`,
    "",
    "Recent conversation:",
    recent,
  ].join("\n");
}

export function createEmptyProfile(): ConversationProfile {
  return emptyProfile();
}
