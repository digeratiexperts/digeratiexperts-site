/**
 * Deterministic groundedness and policy checks on visitor-facing replies.
 * Catches invented prices, SLA commitments, certification claims, ungrounded
 * metrics, street addresses, and bare "Digerati" (the company name is
 * "Digerati Experts" or "DE"). Safe repairs are applied in place; claims that
 * cannot be repaired fall back to a deterministic reply when the caller
 * provides one.
 */

export type GroundingViolation =
  | "ungrounded_price"
  | "ungrounded_sla"
  | "ungrounded_certification"
  | "ungrounded_metric"
  | "street_address"
  | "bare_brand";

export type AdvisorReplyContext = {
  knowledge?: string;
  userMessage?: string;
  fallbackReply?: string;
};

export type GroundingResult = {
  ok: boolean;
  reply: string;
  violations: GroundingViolation[];
  repaired: boolean;
  fellBack: boolean;
};

const STREET_RE =
  /\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Way|Court|Ct\.?|Circle|Cir\.?|Parkway|Pkwy\.?|Place|Pl\.?|Suite|Ste\.?|Highway|Hwy\.?)\b/gi;
const PO_BOX_RE = /\bP\.?\s*O\.?\s*Box\s+\d+\b/gi;
const STREET_CITY_ZIP_RE =
  /\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Way|Court|Ct\.?|Circle|Cir\.?|Parkway|Pkwy\.?|Place|Pl\.?|Suite|Ste\.?|Highway|Hwy\.?)\s*,\s*(Chandler|Phoenix|Scottsdale|Tempe|Mesa|Gilbert),\s*(AZ|Arizona)(?:\s+\d{5}(?:-\d{4})?)?/gi;
const ZIP_WITH_CITY_RE =
  /\b(Chandler|Phoenix|Scottsdale|Tempe|Mesa|Gilbert),\s*(AZ|Arizona)\s+\d{5}(?:-\d{4})?\b/gi;

const FRAMEWORKS = "ISO\\s*27001|SOC\\s*2|SOC2|HIPAA|PCI(?:\\s*DSS)?|CMMC(?:\\s*(?:2\\.0|L[1-5]))?|FedRAMP|HITRUST";

const CERT_CLAIM_RE = new RegExp(
  `\\b(?:${FRAMEWORKS})\\b[^.!?\\n]{0,60}\\b(?:certified|certification|accredited|we certify|DE certifies)\\b|\\b(?:certified|accredited)\\s+(?:for|in|under|against)?\\s*(?:${FRAMEWORKS})\\b|\\b(?:Digerati Experts|DE|we)\\s+(?:is|are|will be|can make you)\\s+(?:${FRAMEWORKS})[ -]?compliant\\b|\\b(?:you will be|we'll get you|we will get you|makes? you)\\s+(?:${FRAMEWORKS})[ -]?compliant\\b|\\b(?:${FRAMEWORKS})[ -]?certified\\b`,
  "i",
);

const SLA_CLAIM_RE =
  /\b(?:99(?:\.9{1,3})?|100)\s*%\s*(?:uptime|availability)\b|\b(?:we|DE|Digerati Experts)\s+(?:guarantee|guarantees|commit(?:s|ted)? to|promise[sd]?)\s+(?:a\s+)?(?:response|resolution|uptime|availability|SLA|four-hour|4-hour|one-hour|1-hour)|\b(?:\d+[- ](?:hour|minute)s?|four[- ]hour|one[- ]hour|fifteen[- ]minute|15[- ]minute)\s+(?:response|resolution|SLA|guarantee)\b|\bSLA\b[^.!?]{0,50}\b(?:hour|minute|uptime|guaranteed|response|resolution|99)/i;

const SLA_DENIED_RE =
  /\b(?:do not|don't|never|no|not|cannot|can't|without|do not invent|won't)\b[^.!?]{0,50}\b(?:guarantee|SLA|uptime commitment|published SLA)/i;

const METRIC_CLAIM_RE =
  /\b(?:Digerati Experts|DE|we|our team)\b[^.!?]{0,60}\b\d[\d,]+\s+(?:clients|customers|companies|organizations|businesses)\b|\b(?:protects|serves|serving)\s+\d[\d,]+\s+(?:clients|customers|companies|organizations|businesses)\b|\b\d[\d,]+\s+(?:clients|customers)\s+with\b|\b(?:99(?:\.9{1,3})?|100)\s*%\s*(?:uptime|availability)\b/i;

const DOLLAR_RE = /\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?/g;

const SAFE_FALLBACK =
  "I want to stay accurate. Tell me a bit more about what you need, and I'll stick to confirmed Digerati Experts facts.";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function canonicalDollars(text: string): Set<string> {
  const found = new Set<string>();
  const re = new RegExp(DOLLAR_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const value = Number(match[0].replace(/[^\d.]/g, ""));
    if (!Number.isFinite(value) || value === 0) continue;
    found.add(Number.isInteger(value) ? String(value) : value.toFixed(2));
  }
  return found;
}

function isDomainDigeratiAfter(after: string): boolean {
  return /^experts\.com(?:\/|$)/i.test(after) || /^-experts(?:\.com)?(?:\/|$)/i.test(after);
}

function hasBareDigerati(text: string): boolean {
  const re = /\bDigerati\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const after = text.slice(match.index + match[0].length);
    if (/^\s+Experts\b/i.test(after) || isDomainDigeratiAfter(after)) continue;
    return true;
  }
  return false;
}

export function findGroundingIssues(
  reply: string,
  knowledge = "",
  userMessage = "",
): GroundingViolation[] {
  const issues: GroundingViolation[] = [];
  if (STREET_CITY_ZIP_RE.test(reply) || STREET_RE.test(reply) || PO_BOX_RE.test(reply) || ZIP_WITH_CITY_RE.test(reply)) {
    issues.push("street_address");
  }
  STREET_CITY_ZIP_RE.lastIndex = 0;
  STREET_RE.lastIndex = 0;
  PO_BOX_RE.lastIndex = 0;
  ZIP_WITH_CITY_RE.lastIndex = 0;

  if (hasBareDigerati(reply)) issues.push("bare_brand");

  if (CERT_CLAIM_RE.test(reply)) issues.push("ungrounded_certification");

  if (SLA_CLAIM_RE.test(reply) && !SLA_DENIED_RE.test(reply)) {
    issues.push("ungrounded_sla");
  }

  if (METRIC_CLAIM_RE.test(reply)) issues.push("ungrounded_metric");

  const grounded = canonicalDollars(`${knowledge}\n${userMessage}`);
  const recited = canonicalDollars(reply);
  for (const amount of recited) {
    if (!grounded.has(amount)) {
      issues.push("ungrounded_price");
      break;
    }
  }

  return unique(issues);
}

export function repairBareDigerati(text: string): string {
  let next = text.replace(/\bDigerati\s+Expert\b(?!s)/gi, "Digerati Experts");
  next = next.replace(/\bDigerati\b(?!\s+Experts\b)(?!experts\.com)(?!-experts)/gi, "Digerati Experts");
  return next;
}

export function stripStreetAddresses(text: string): string {
  let next = text.replace(STREET_CITY_ZIP_RE, "Chandler, AZ");
  next = next.replace(STREET_RE, "Chandler, AZ");
  next = next.replace(PO_BOX_RE, "");
  next = next.replace(ZIP_WITH_CITY_RE, "$1, $2");
  return next
    .replace(/Chandler, AZ(?:\s*,\s*Chandler, AZ)+/gi, "Chandler, AZ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/ +\./g, ".")
    .replace(/\bat,\s+/gi, "at ")
    .trim();
}

function isRepairable(violations: GroundingViolation[]): boolean {
  return violations.every((issue) => issue === "bare_brand" || issue === "street_address");
}

export function verifyAdvisorReply(reply: string, ctx: AdvisorReplyContext = {}): GroundingResult {
  const knowledge = ctx.knowledge || "";
  const userMessage = ctx.userMessage || "";
  const initial = findGroundingIssues(reply, knowledge, userMessage);
  if (!initial.length) {
    return { ok: true, reply, violations: [], repaired: false, fellBack: false };
  }

  if (isRepairable(initial)) {
    let repaired = reply;
    if (initial.includes("bare_brand")) repaired = repairBareDigerati(repaired);
    if (initial.includes("street_address")) repaired = stripStreetAddresses(repaired);
    const remaining = findGroundingIssues(repaired, knowledge, userMessage);
    if (!remaining.length && repaired.trim()) {
      return { ok: true, reply: repaired, violations: initial, repaired: true, fellBack: false };
    }
  }

  const fallback = (ctx.fallbackReply || "").trim();
  const fallbackIssues = fallback ? findGroundingIssues(fallback, knowledge, userMessage) : initial;
  if (fallback && !fallbackIssues.length) {
    return { ok: false, reply: fallback, violations: initial, repaired: false, fellBack: true };
  }

  return { ok: false, reply: fallback || SAFE_FALLBACK, violations: initial, repaired: false, fellBack: true };
}

/** @deprecated Prefer verifyAdvisorReply; kept for existing call sites and node tests. */
export function verifyGroundedReply(params: {
  reply: string;
  knowledge?: string;
  userMessage?: string;
  fallbackReply?: string;
}): GroundingResult & { issues: GroundingViolation[] } {
  const result = verifyAdvisorReply(params.reply, params);
  return { ...result, issues: result.violations };
}
