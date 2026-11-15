/**
 * Situation match: the one catalog and matcher behind the homepage situation
 * picker, the /describe-your-situation page, and DE Desk's structured
 * situation-match mode (POST /api/public/advisor/situation-match).
 *
 * Everything a match may show is listed here. A match is made of ids only:
 *   - scenarioIds: the situation cards on the page (client/src/data/solutionScenarios.ts)
 *   - familyIds:   SITUATION_FAMILY_IDS (shared/anonymousSituation.ts)
 *   - pageServiceIds: the services named on the homepage (PAGE_SERVICES below)
 *   - intentIds:   pick the pre-written "read" sentences (INTENTS below)
 * The words a visitor sees are always these reviewed sentences, never model text,
 * so a match can never put a price, a guarantee, a certification or a client on the page.
 * Matched services are recommendations only. They never write entitlements.
 */
import { solutionScenarios, SCENARIO_GROUPS, type SolutionScenario, type ScenarioGroupId } from "../client/src/data/solutionScenarios";
import { SITUATION_FAMILY_IDS, type SituationFamilyId } from "./anonymousSituation";

export const SITUATION_MATCH_CATALOG_VERSION = "b3-1";
export const SITUATION_TEXT_MAX = 1000;
/** The Hub stores at most 8 KB of visitor words. The page caps input far below that. */
export const SITUATION_DRAFT_WORDS_MAX_BYTES = 8 * 1024;

export const PROFILE_DRAFT_CONSENT_VERSION = "v1";
export const PROFILE_DRAFT_CONSENT_TEXT =
  "We'll use what you type to draft an IT & Security Profile and keep it until you create a portal account or 30 days, whichever comes first. This is not a service agreement and does not mean those services are covered.";

export type PageServiceId =
  | "service-desk" | "co-managed" | "endpoints" | "identity" | "onboarding" | "security-levels" | "backup"
  | "vcio" | "compliance" | "budgeting" | "vendors" | "reviews" | "managed-network" | "anti-phishing"
  | "threat-detection" | "training" | "baseline";

export type PageService = {
  name: string;
  /** Homepage anchor the service appears under. */
  where: "#support" | "#faq" | "#usual" | "#levels";
  /** Deck card (0 problem, 1 fix, 2 plan) when the service lives on the deck. */
  card?: 0 | 1 | 2;
  at: string;
  line: string;
  familyId: SituationFamilyId;
  /** Catalog service ids (serviceCatalog.ts) this points to, checked against listKnownServiceIds() on the server. */
  catalogIds?: string[];
};

/** Named exactly as they appear on the homepage. */
export const PAGE_SERVICES: Record<PageServiceId, PageService> = {
  "service-desk": { name: "Service Desk", where: "#support", at: "Support", line: "Included support with every ProActive level.", familyId: "it_operations" },
  "co-managed": { name: "Co-Managed IT", where: "#faq", at: "Before the call", line: "Keep your internal IT and add DE for support, security expertise, and monitoring.", familyId: "it_operations" },
  endpoints: { name: "Endpoints & network", where: "#usual", card: 1, at: "One team owns it", line: "Patched and monitored before you notice.", familyId: "endpoint_devices" },
  identity: { name: "Identity & access", where: "#usual", card: 1, at: "One team owns it", line: "MFA, single sign-on, access by role.", familyId: "identity_access" },
  onboarding: { name: "On- and offboarding", where: "#usual", card: 1, at: "One team owns it", line: "Ready on day one. Locked out on the last.", familyId: "identity_access" },
  "security-levels": { name: "Security levels", where: "#usual", card: 1, at: "One team owns it", line: "Protection matched to each user\u2019s risk.", familyId: "cybersecurity_operations" },
  backup: { name: "Backup & recovery", where: "#usual", card: 1, at: "One team owns it", line: "Restores we test, not hope for.", familyId: "backup_continuity" },
  vcio: { name: "Fractional vCIO", where: "#usual", card: 2, at: "Someone plans ahead", line: "One advisor owning your IT roadmap.", familyId: "technology_strategy", catalogIds: ["vcio-services"] },
  compliance: { name: "Regulatory compliance", where: "#usual", card: 2, at: "Someone plans ahead", line: "Controls mapped to the rules you answer to.", familyId: "compliance_risk", catalogIds: ["compliance-services"] },
  budgeting: { name: "IT budgeting", where: "#usual", card: 2, at: "Someone plans ahead", line: "A real plan. No surprise invoices.", familyId: "technology_strategy", catalogIds: ["vcio-services"] },
  vendors: { name: "Vendor management", where: "#usual", card: 2, at: "Someone plans ahead", line: "We call the ISP. You don\u2019t.", familyId: "it_operations" },
  reviews: { name: "Quarterly reviews", where: "#usual", card: 2, at: "Someone plans ahead", line: "Policies, risks, and progress, in plain English.", familyId: "technology_strategy", catalogIds: ["vcio-services"] },
  "managed-network": { name: "Managed network", where: "#levels", at: "ProActive Office", line: "Part of ProActive Office.", familyId: "network_connectivity", catalogIds: ["network-managed"] },
  "anti-phishing": { name: "Email anti-phishing", where: "#levels", at: "ProActive Office", line: "Part of ProActive Office.", familyId: "email_collaboration" },
  "threat-detection": { name: "Threat detection", where: "#levels", at: "ProActive Business", line: "Part of ProActive Business.", familyId: "cybersecurity_operations" },
  training: { name: "Awareness training", where: "#levels", at: "ProActive Business", line: "Part of ProActive Business.", familyId: "security_awareness" },
  baseline: { name: "Documented baseline", where: "#levels", at: "ProActive IT", line: "Part of ProActive IT.", familyId: "documentation_standards" },
};
export const PAGE_SERVICE_IDS = Object.keys(PAGE_SERVICES) as PageServiceId[];

/** Each situation card's starting services on the page (primary first). */
export const SCENARIO_PAGE_SERVICES: Record<string, PageServiceId[]> = {
  "phishing-close-call": ["training", "anti-phishing", "identity"],
  "ransomware-recovery": ["backup", "threat-detection", "endpoints"],
  "it-person-left": ["service-desk", "baseline", "endpoints"],
  "second-location": ["managed-network", "vendors", "endpoints"],
  "new-hires-fast": ["onboarding", "endpoints", "identity"],
  "hybrid-byod": ["endpoints", "identity", "security-levels"],
  "phone-contract-ending": ["vendors", "managed-network"],
  "insurance-questionnaire": ["compliance", "identity", "backup"],
  "auditor-evidence": ["compliance", "baseline", "vcio"],
  "internal-it-stretched": ["co-managed", "threat-detection", "endpoints"],
};

export type PickerGroup = { id: "all" | ScenarioGroupId; label: string };
export const PICKER_GROUPS: PickerGroup[] = [{ id: "all", label: "All situations" }, ...SCENARIO_GROUPS.map((g) => ({ id: g.id, label: g.heading }))];
export const SCENARIOS: SolutionScenario[] = solutionScenarios;
const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));
export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);
export function scenarioById(id: string): SolutionScenario | undefined {
  return SCENARIO_BY_ID.get(id);
}

/* ---------- intents: phrases, weights, and the reviewed "read" sentence for each ---------- */
type Intent = { id: string; w: number; p: string[]; cards: Record<string, number>; svc: Partial<Record<PageServiceId, number>>; urgent?: boolean; read: string };
export const INTENTS: Intent[] = [
  { id: "phish", w: 3, p: ["phish", "phishing", "spoof", "spoofed", "clicked a link", "clicked", "fake email", "suspicious email", "scam email", "gift card", "pretending to be", "invoice fraud", "wire fraud", "compromised email", "email hacked"],
    cards: { "phishing-close-call": 3 }, svc: { training: 2, "anti-phishing": 2, identity: 1 }, urgent: true,
    read: "a bad email got through, and the next one needs to be easier to spot and harder to act on" },
  { id: "incident", w: 3, p: ["ransomware", "hacked", "breach", "breached", "virus", "malware", "encrypted", "locked out of", "attack", "compromised", "pop up", "popup", "ransom"],
    cards: { "ransomware-recovery": 3, "phishing-close-call": 1 }, svc: { backup: 2, "threat-detection": 2, endpoints: 1 }, urgent: true,
    read: "a security scare, where what matters first is containing it and knowing you can restore" },
  { id: "backup", w: 2, p: ["backup", "backups", "restore", "recover", "recovery", "disaster", "lost files", "deleted", "server died", "flood", "fire"],
    cards: { "ransomware-recovery": 2 }, svc: { backup: 3 },
    read: "nobody is sure the backups would actually bring you back" },
  { id: "it-left", w: 3, p: ["it guy", "it person", "it left", "only it", "our it person", "tech left", "admin left", "nephew", "no it", "nobody knows the password", "no one knows", "passwords walked", "retired", "moved away", "part time it"],
    cards: { "it-person-left": 3 }, svc: { "service-desk": 2, baseline: 2, vendors: 1 },
    read: "the knowledge of how things are set up lives with one person, or left with them" },
  { id: "onboard", w: 3, p: ["new hire", "new hires", "new employee", "new staff", "starts monday", "starting monday", "first day", "day one", "onboarding", "onboard", "hiring", "hires", "employees", "need laptops", "new laptop", "new laptops", "laptops for", "accounts set up", "set up accounts", "new people"],
    cards: { "new-hires-fast": 3 }, svc: { onboarding: 3, endpoints: 1, identity: 1 },
    read: "people are starting and need a working laptop and accounts on day one" },
  { id: "offboard", w: 3, p: ["quit", "fired", "let go", "last day", "leaving", "left the company", "terminated", "offboarding", "offboard", "still has access", "ex employee", "former employee", "resigned"],
    cards: { "new-hires-fast": 2, "it-person-left": 1 }, svc: { onboarding: 3, identity: 2 },
    read: "someone is leaving and their access has to close cleanly on their last day" },
  { id: "growth", w: 3, p: ["second office", "new office", "another office", "second location", "new location", "opening", "expanding", "expansion", "moving", "move offices", "relocating", "new building", "growing", "acquired", "merger"],
    cards: { "second-location": 3, "new-hires-fast": 1 }, svc: { "managed-network": 2, vendors: 2, endpoints: 1 },
    read: "the business is growing into a new space, and day one there has to just work" },
  { id: "remote", w: 3, p: ["work from home", "remote", "wfh", "hybrid", "personal device", "personal laptop", "own device", "own laptop", "byod", "home office", "phones for work", "their phones"],
    cards: { "hybrid-byod": 3 }, svc: { endpoints: 2, identity: 2, "security-levels": 1 },
    read: "company data now lives on laptops and phones nobody manages" },
  { id: "phones", w: 3, p: ["phone system", "phones", "voip", "phone contract", "pbx", "call", "calls", "port numbers", "phone number", "landline", "ringcentral"],
    cards: { "phone-contract-ending": 3 }, svc: { vendors: 2, "managed-network": 1 },
    read: "the phones need to move without anyone missing a call" },
  { id: "network", w: 2, p: ["wifi", "wi fi", "internet", "slow internet", "network", "router", "firewall", "keeps dropping", "outage", "isp", "printer", "printers", "copier"],
    cards: { "second-location": 1, "phone-contract-ending": 1 }, svc: { "managed-network": 2, vendors: 2, endpoints: 1 },
    read: "the network keeps letting people down, and nobody owns fixing it" },
  { id: "insurance", w: 3, p: ["insurance", "insurer", "cyber insurance", "questionnaire", "renewal form", "policy renewal", "underwriter", "premium"],
    cards: { "insurance-questionnaire": 3 }, svc: { compliance: 2, identity: 2, backup: 1 },
    read: "an insurer is asking questions that need true answers, with evidence behind them" },
  { id: "compliance", w: 3, p: ["hipaa", "audit", "auditor", "compliance", "compliant", "pci", "soc 2", "soc2", "ftc safeguards", "regulation", "regulator", "policies", "evidence", "security questionnaire", "vendor questionnaire", "client asked", "contract requires", "cmmc", "state bar", "patient data"],
    cards: { "auditor-evidence": 3, "insurance-questionnaire": 1 }, svc: { compliance: 3, baseline: 1, reviews: 1 },
    read: "someone needs proof (policies, controls, evidence) that doesn\u2019t exist on paper yet" },
  { id: "stretched", w: 3, p: ["stretched", "overwhelmed", "swamped", "our it team", "internal it", "in house it", "it department", "it manager", "tickets pile", "backlog", "cant keep up", "need help", "after hours", "extra hands", "co managed"],
    cards: { "internal-it-stretched": 3 }, svc: { "co-managed": 3, "threat-detection": 1, "service-desk": 1 },
    read: "you have IT people, and they need backup rather than replacing" },
  { id: "patching", w: 2, p: ["patch", "patches", "updates", "windows 10", "old computers", "slow computers", "outdated", "end of life", "antivirus"],
    cards: { "internal-it-stretched": 1, "ransomware-recovery": 1 }, svc: { endpoints: 3 },
    read: "the computers are behind on updates and nobody is watching them" },
  { id: "identity", w: 2, p: ["mfa", "2fa", "two factor", "password", "passwords", "login", "logins", "single sign on", "sso", "shared password", "access"],
    cards: { "insurance-questionnaire": 1, "it-person-left": 1 }, svc: { identity: 3, "security-levels": 1 },
    read: "logins and passwords are doing too much of the security work" },
  { id: "budget", w: 3, p: ["budget", "budgeting", "license renewals", "software renewals", "renewals every", "surprise invoices", "surprise invoice", "surprise bill", "costs", "spend", "too expensive", "subscriptions", "licenses", "licences", "plan for next year"],
    cards: {}, svc: { budgeting: 3, vcio: 2, vendors: 1 },
    read: "IT spending arrives as surprises instead of a plan" },
  { id: "strategy", w: 2, p: ["roadmap", "strategy", "plan", "planning", "advice", "advisor", "cio", "vcio", "big picture", "where to start", "dont know where to start", "no plan"],
    cards: { "auditor-evidence": 1 }, svc: { vcio: 3, reviews: 2, budgeting: 1 },
    read: "you want someone to own the IT plan, not just the next ticket" },
  { id: "vendors", w: 2, p: ["vendor", "vendors", "nobody owns", "finger pointing", "pointing fingers", "too many vendors", "who to call", "not our end", "not on our end"],
    cards: { "it-person-left": 1, "phone-contract-ending": 1 }, svc: { vendors: 3, "service-desk": 1 },
    read: "every vendor handles a piece, and nobody handles the whole" },
];
const INTENT_BY_ID = new Map(INTENTS.map((i) => [i.id, i]));
export const INTENT_IDS = INTENTS.map((i) => i.id);

export type SituationMatch = {
  scenarioIds: string[];
  familyIds: SituationFamilyId[];
  pageServiceIds: PageServiceId[];
  /** Catalog service ids. The client never trusts these for anything but display; the server re-checks them. */
  serviceIds: string[];
  intentIds: string[];
  /** Built only from INTENTS[].read. */
  summary: string;
  urgent: boolean;
  confident: boolean;
  source: "local" | "de-desk" | "card";
};

const STOP = /^(the|a|an|and|or|to|of|in|on|for|we|our|us|is|are|was|it|its|i|my|me|at|be|with|that|this|have|has|had|just|so|do|dont|but|they|them|their|what|how|all|from|get|got|can|cant|need|not|no|any|some|there|been|will|would|should|could|very|really|about|out|up|new)$/;
function norm(t: string): string {
  return " " + String(t || "").toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() + " ";
}
function stem(w: string): string {
  return w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w;
}
/** True when the edit distance between a and b is at most 1. */
function ed1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return d + (la - i) + (lb - j) <= 1;
}
function tokens(n: string): string[] {
  return n.trim().split(" ").filter((w) => w && !STOP.test(w));
}

/** Two reviewed reads, composed so they never stack as "It sounds like... It sounds like...". */
export function composeRead(intentIds: string[]): string {
  const reads = intentIds.map((id) => INTENT_BY_ID.get(id)?.read).filter((r): r is string => Boolean(r)).slice(0, 2);
  if (!reads.length) return "";
  const a = "It sounds like " + reads[0] + ".";
  return reads[1] ? a + " Also, " + reads[1] + "." : a;
}

function familiesFor(scenarioIds: string[], pageServiceIds: PageServiceId[]): SituationFamilyId[] {
  const out: SituationFamilyId[] = [];
  const add = (f: SituationFamilyId) => { if (!out.includes(f)) out.push(f); };
  scenarioIds.forEach((id) => scenarioById(id)?.familyIds.forEach((f) => add(f as SituationFamilyId)));
  pageServiceIds.forEach((id) => add(PAGE_SERVICES[id].familyId));
  return out.slice(0, 6);
}
function catalogIdsFor(pageServiceIds: PageServiceId[]): string[] {
  const out: string[] = [];
  pageServiceIds.forEach((id) => (PAGE_SERVICES[id].catalogIds || []).forEach((c) => { if (!out.includes(c)) out.push(c); }));
  return out;
}

/**
 * Score intents against the visitor's words. Runs in the browser (instant, offline) and on the
 * server when the model is unavailable or the text looks like a prompt-injection attempt.
 */
export function localMatch(text: string): SituationMatch {
  const n = norm(text), stems = tokens(n).map(stem);
  const hits: Array<{ it: Intent; s: number }> = [];
  const cardS: Record<string, number> = {}, svcS: Record<string, number> = {};
  let urgent = false;
  for (const it of INTENTS) {
    let best = 0;
    for (const ph of it.p) {
      const pn = norm(ph);
      if (pn.trim().includes(" ")) { if (n.includes(pn)) best = Math.max(best, 1.25); continue; }
      const w = pn.trim(), sw = stem(w);
      if (n.includes(" " + w + " ") || stems.includes(sw)) { best = Math.max(best, 1); continue; }
      if (w.length >= 5 && stems.some((t) => t.length >= 4 && ed1(t, sw))) best = Math.max(best, 0.7);
    }
    if (!best) continue;
    const s = best * it.w;
    hits.push({ it, s });
    if (it.urgent) urgent = true;
    for (const c in it.cards) cardS[c] = (cardS[c] || 0) + s * it.cards[c];
    for (const v in it.svc) svcS[v] = (svcS[v] || 0) + s * (it.svc[v as PageServiceId] || 0);
  }
  hits.sort((a, b) => b.s - a.s);
  let cards = Object.keys(cardS).sort((a, b) => cardS[b] - cardS[a]);
  const top = cards.length ? cardS[cards[0]] : 0;
  cards = cards.filter((c) => cardS[c] >= top * 0.34).slice(0, 3);
  cards.slice(0, 1).forEach((c) => (SCENARIO_PAGE_SERVICES[c] || []).forEach((v, k) => { svcS[v] = (svcS[v] || 0) + 1.5 - k * 0.3; }));
  const pageServiceIds = Object.keys(svcS).sort((a, b) => svcS[b] - svcS[a]).slice(0, 4) as PageServiceId[];
  const intentIds = hits.slice(0, 2).map((h) => h.it.id);
  if (intentIds.length === 2 && hits[1].s < hits[0].s * 0.5) intentIds.length = 1;
  return sanitizeMatch({
    scenarioIds: cards,
    pageServiceIds,
    intentIds,
    familyIds: familiesFor(cards, pageServiceIds),
    serviceIds: catalogIdsFor(pageServiceIds),
    summary: composeRead(intentIds),
    urgent,
    confident: hits.length > 0,
    source: "local",
  });
}

/** What picking a card on the homepage means, as a match. */
export function matchFromScenario(id: string): SituationMatch | null {
  const s = scenarioById(id);
  if (!s) return null;
  const pageServiceIds = (SCENARIO_PAGE_SERVICES[id] || []).slice();
  return {
    scenarioIds: [id],
    pageServiceIds,
    intentIds: [],
    familyIds: s.familyIds.slice() as SituationFamilyId[],
    serviceIds: catalogIdsFor(pageServiceIds),
    summary: s.pressure,
    urgent: s.group === "now",
    confident: true,
    source: "card",
  };
}

/** Claims the page must never make, whatever produced the text. */
export const BANNED_CLAIMS = /(\$|\bprice[sd]?\b|\bpricing\b|\bguarantee|\bcertified|\bcertification|\b24\/7\b|\bclients? like\b|\bdiscount|\bfree\b|\bDigerati\b(?!\s+Experts))/i;

const FAMILY_SET: ReadonlySet<string> = new Set(SITUATION_FAMILY_IDS);
function only<T extends string>(ids: unknown, allowed: ReadonlySet<string>, max: number): T[] {
  if (!Array.isArray(ids)) return [];
  const out: T[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !allowed.has(id) || out.includes(id as T)) continue;
    out.push(id as T);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Id allow-lists for every field, applied to every adapter's output.
 * `knownServiceIds` is the server's listKnownServiceIds(); the browser passes nothing and keeps
 * whatever the server already checked.
 */
export function sanitizeMatch(r: Partial<SituationMatch> & { source: SituationMatch["source"] }, knownServiceIds?: readonly string[]): SituationMatch {
  const scenarioIds = only<string>(r.scenarioIds, new Set(SCENARIO_IDS), 3);
  const pageServiceIds = only<PageServiceId>(r.pageServiceIds, new Set(PAGE_SERVICE_IDS), 5);
  const intentIds = only<string>(r.intentIds, new Set(INTENT_IDS), 2);
  const familyIds = only<SituationFamilyId>(r.familyIds, FAMILY_SET, 6);
  const serviceIds = knownServiceIds
    ? only<string>(r.serviceIds, new Set(knownServiceIds), 6)
    : only<string>(r.serviceIds, new Set((r.serviceIds || []).filter((s) => typeof s === "string" && /^[a-z0-9-]{1,48}$/.test(s))), 6);
  const summary = typeof r.summary === "string" && !BANNED_CLAIMS.test(r.summary) ? r.summary : "";
  return {
    scenarioIds,
    pageServiceIds,
    intentIds,
    familyIds,
    serviceIds,
    summary,
    urgent: Boolean(r.urgent),
    confident: Boolean(r.confident) && (scenarioIds.length > 0 || pageServiceIds.length > 0),
    source: r.source,
  };
}

/** Build a match from model-chosen ids. Every word on screen still comes from this file. */
export function matchFromIds(
  ids: { scenarioIds?: unknown; intentIds?: unknown; familyIds?: unknown; serviceIds?: unknown },
  knownServiceIds: readonly string[],
): SituationMatch {
  const scenarioIds = only<string>(ids.scenarioIds, new Set(SCENARIO_IDS), 3);
  const intentIds = only<string>(ids.intentIds, new Set(INTENT_IDS), 2);
  const svcS: Record<string, number> = {};
  intentIds.forEach((id, k) => {
    const it = INTENT_BY_ID.get(id);
    if (it) for (const v in it.svc) svcS[v] = (svcS[v] || 0) + (it.svc[v as PageServiceId] || 0) * (k ? 0.6 : 1);
  });
  scenarioIds.slice(0, 1).forEach((c) => (SCENARIO_PAGE_SERVICES[c] || []).forEach((v, k) => { svcS[v] = (svcS[v] || 0) + 1.5 - k * 0.3; }));
  const pageServiceIds = Object.keys(svcS).sort((a, b) => svcS[b] - svcS[a]).slice(0, 4) as PageServiceId[];
  const modelFamilies = only<SituationFamilyId>(ids.familyIds, FAMILY_SET, 6);
  const familyIds = familiesFor(scenarioIds, pageServiceIds);
  modelFamilies.forEach((f) => { if (!familyIds.includes(f) && familyIds.length < 6) familyIds.push(f); });
  const serviceIds = catalogIdsFor(pageServiceIds);
  only<string>(ids.serviceIds, new Set(knownServiceIds), 6).forEach((s) => { if (!serviceIds.includes(s)) serviceIds.push(s); });
  return sanitizeMatch(
    {
      scenarioIds,
      intentIds,
      pageServiceIds,
      familyIds,
      serviceIds,
      summary: composeRead(intentIds),
      urgent: intentIds.some((id) => INTENT_BY_ID.get(id)?.urgent),
      confident: scenarioIds.length > 0 || pageServiceIds.length > 0,
      source: "de-desk",
    },
    knownServiceIds,
  );
}

/** The IT plan a visitor can copy, and the it_plan JSON a profile draft carries. Reviewed words only. */
export function itPlan(r: SituationMatch) {
  return {
    catalogVersion: SITUATION_MATCH_CATALOG_VERSION,
    read: r.summary,
    closestSituations: r.scenarioIds.map((id) => ({ id, title: scenarioById(id)?.title || id })),
    wouldLookAt: r.pageServiceIds.map((id) => ({ id, name: PAGE_SERVICES[id].name })),
    familyIds: r.familyIds,
    serviceIds: r.serviceIds,
    recommendationOnly: true as const,
    nextSteps: ["Fit Call", "Assessment", "Your price, confirmed"],
  };
}

export const FIT_CALL_URL = "https://meet.digerati-experts.com/";

export function planText(r: SituationMatch, text: string): string {
  const lines = ["Our IT situation, in brief", ""];
  lines.push("What\u2019s going on: " + text);
  if (r.summary) lines.push("Read: " + r.summary);
  if (r.scenarioIds.length) lines.push("Closest situation" + (r.scenarioIds.length > 1 ? "s" : "") + ": " + r.scenarioIds.map((c) => scenarioById(c)?.title).join("; "));
  lines.push("What Digerati Experts would look at: " + r.pageServiceIds.map((v) => PAGE_SERVICES[v].name).join(", "));
  lines.push("", "Next step: a 30-minute Fit Call with Digerati Experts, then an assessment of what we run today. Pricing is published per ProActive level and confirmed after the assessment.");
  lines.push("Book: " + FIT_CALL_URL);
  return lines.join("\n");
}
