import type { AdvisorMode, PageContext } from "./types";

// An IT company treats a real emergency as an emergency: an ACTIVE event moves
// the visitor to the next level (call line + Get Support security-incident
// path), never a casual chat loop. (Joe, 2026-08-31.)
//
// Two tiers (adversarial-review correction, same day): STRONG terms are
// unambiguous active-compromise language and always escalate. WEAK terms
// ("emergency", "cyber attack/event/incident") also appear in ordinary
// pre-sales questions — "What's your emergency response SLA?", "How do we
// prevent a cyberattack?" — which must stay in the sales lanes, so WEAK only
// escalates when the message is NOT shaped like an offering/pricing/planning
// question and not a non-IT (medical/family) emergency.
const INCIDENT_STRONG =
  /\b(ransomware|ransom|breached|breach|hacked|being\s+hacked|compromised|account\s*takeover|data\s*theft|encrypt(ed|ing)?\s*(files|system)|active\s*incident|security\s*incident|locked\s*out\s*by\s*attacker|under\s+attack|being\s+attacked|attack\s+(in\s+progress|happening|right\s+now|underway)|incident\s+(in\s+progress|happening|right\s+now|underway)|(we('|’)?re|we\s+are|i('|’)?m|i\s+am)\s+(currently\s+)?(getting\s+)?(hacked|attacked)|everything('|’)?s?\s+(is\s+)?(down|encrypted|locked)|all\s+(our\s+)?(systems|servers|computers)\s+(are\s+)?(down|encrypted|locked))\b/i;

const INCIDENT_WEAK =
  /\b(cyber\s*-?\s*(event|attack|incident)|cyberattack|(security|cyber|it)\s+emergency|\bemergency\b)\b/i;

/** Question shapes about DE's offerings/preparedness — sales lane, not an event. */
const OFFERING_QUESTION =
  /\b(do\s+you\s+(offer|have|provide|include)|how\s+much|what('|’)?s?\s+(is\s+)?(your|the)|price|pricing|cost|charge|rate|sla|retainer|plan(ning)?|prepare(dness)?|prevent(ion|ing)?|avoid|in\s+case\s+of|contact\s+(list|number)|response\s+time|coverage|package|tier)\b/i;

const NON_IT_EMERGENCY = /\b(medical|family|personal|health|pet)\s+emergency\b/i;

function isIncidentMessage(text: string): boolean {
  if (INCIDENT_STRONG.test(text)) return true;
  if (!INCIDENT_WEAK.test(text)) return false;
  if (NON_IT_EMERGENCY.test(text)) return false;
  return !OFFERING_QUESTION.test(text);
}

const EXISTING_CLIENT =
  /\b(i'?m\s+(an?\s+)?(existing\s+)?client|we\s+are\s+(an?\s+)?(existing\s+)?client|already\s+(a\s+)?(customer|client)|already\s+use\s+you|our\s+account\s+manager|portal\s+login|open\s+a\s+ticket|existing\s+customer|current\s+(de\s+)?client)\b/i;

const OFF_TOPIC =
  /\b(recipe|football|nba|movie|celebrity|horoscope|dating|joke|poem|write\s+me\s+a\s+song|capital\s+of|who\s+won\s+the|weather\s+in(?!\s+(phoenix|chandler|arizona|scottsdale|tempe|mesa)))\b/i;

const COMPLIANCE =
  /\b(hipaa|cmmc|pci(\s*dss)?|soc\s*2|gdpr|glba|compliance|audit|baa|framework|nist|cis\s*controls)\b/i;

const PRICING =
  /\b(how\s+much|pricing|price|cost|quote|budget|per\s*user|site\s*min|package|tier|office\s+plan|business\s+plan|enterprise\s+plan)\b/i;

const CLOUD =
  /\b(microsoft\s*365|m365|office\s*365|azure|entra|intune|sharepoint|teams|exchange\s*online|onedrive|google\s*workspace)\b/i;

const CYBER =
  /\b(phish|phishing|malware|edr|mdr|firewall|vpn|zero\s*trust|mfa|2fa|endpoint|siem|soc|threat|vulnerability|pen\s*test|email\s*security|awareness)\b/i;

const IT_SUPPORT =
  /\b(it help|need (some )?it\b|need help with (my |our )?(it|computer|laptop|pc|printer|email|network|wifi|wi-fi|vpn|outlook)|something('s| is)? (broken|down|not working)|reset\s+(windows|password|pc)|printer|wifi|wi-fi|slow\s+computer|blue\s+screen|bsod|outlook\s+not|can'?t\s+login|vpn\s+won'?t|install\s+software|help\s+desk|troubleshoot)\b/i;

const ASSESSMENT =
  /\b(assessment|cyber\s*risk|security\s*review|gap\s*analysis|readiness|evaluate\s+(our|my)\s+(security|it))\b/i;

const MSP =
  /\b(msp|managed\s*(it|services)|do\s+i\s+need\s+(an?\s+)?msp|outsourc(e|ing)\s+it|internal\s+it\s+(left|quit|gone)|no\s+it\s+(guy|person|team)|vCIO|co-?managed)\b/i;

/**
 * Heuristic mode classifier. Labels are internal only — never shown to visitors.
 */
export function classifyMode(message: string, page?: PageContext): AdvisorMode {
  const text = message.trim();
  if (!text) return page?.pageType === "cybersecurity" ? "cybersecurity" : "msp_discovery";

  if (isIncidentMessage(text)) return "security_incident";
  if (EXISTING_CLIENT.test(text)) return "existing_client";

  // Off-topic only when clearly unrelated AND not mixed with IT/security language
  if (OFF_TOPIC.test(text) && !CYBER.test(text) && !IT_SUPPORT.test(text) && !MSP.test(text) && !COMPLIANCE.test(text) && !CLOUD.test(text) && !PRICING.test(text)) {
    return "off_topic";
  }

  // Compliance before assessment so "CMMC readiness" is compliance-led
  if (COMPLIANCE.test(text)) return "compliance";
  if (ASSESSMENT.test(text)) return "assessment";
  if (PRICING.test(text)) return "pricing";
  // Cyber before cloud so "M365 phishing" lands as cybersecurity
  if (CYBER.test(text)) return "cybersecurity";
  if (CLOUD.test(text)) return "cloud_m365";
  if (IT_SUPPORT.test(text)) return "it_support";
  if (MSP.test(text)) return "msp_discovery";

  // Page bias when message is ambiguous
  if (page?.pageType === "compliance") return "compliance";
  if (page?.pageType === "cybersecurity") return "cybersecurity";
  if (page?.pageType === "pricing" || page?.pageType === "store") return "pricing";
  if (page?.pageType === "support") return "existing_client";

  return "msp_discovery";
}

/** Visitor is reacting to the bot, not starting a new topic. */
export function isMetaDialogue(message: string): boolean {
  return /\b(what do you mean|that'?s weird|that is weird|canned|scripted|robot|keep saying|you keep|why do you|stop repeating|said that already|you already said|copy[- ]paste)\b/i.test(
    message,
  );
}

export function isCannedLanguageComplaint(message: string): boolean {
  return /\b(canned|scripted|robot|repeat|keep saying|copy[- ]paste|generic)\b/i.test(message);
}

export function askedForHuman(message: string): boolean {
  return /\b(call|phone|book|schedule|talk to (a )?(human|person|someone)|speak (to|with)|real person)\b/i.test(
    message,
  );
}

/**
 * The visitor wants a person, not an answer from the desk: Joe (DE's founder)
 * by name, the owner, a human, or a callback. "I need Joe" was put through the
 * name and company questions and then a generic pitch (Joe, 2026-10-07).
 * A bare "Joe" is not a request: it is how a visitor named Joe answers
 * "what's your name?". Stricter than askedForHuman, which also matches "phone"
 * and "book" in ordinary IT questions.
 */
const JOE = "(?:joe(?:\\s+petro)?|joseph(?:\\s+petro)?|joey|mr\\.?\\s*petro)";
/** A specific person or role. "Someone" only counts after talk/speak/reach:
 * "I need someone to fix our printer" is an IT request, not a handoff. */
const NAMED_PERSON =
  `(?:${JOE}|the\\s+(?:owner|boss|founder|manager)|a\\s+(?:real\\s+|live\\s+|actual\\s+)?(?:human|person|tech|technician|engineer)(?!\\s+(?:to|who|that)\\b)|a\\s+manager)`;
const ANY_PERSON = `(?:${NAMED_PERSON}|someone|somebody|anyone)`;
const WANTS_PERSON = new RegExp(
  [
    `\\b(?:talk|speak|chat)\\s+(?:to|with)\\s+${ANY_PERSON}`,
    `\\b(?:reach|contact|get\\s+(?:hold\\s+of|ahold\\s+of))\\s+${ANY_PERSON}`,
    `\\b(?:need|want|get\\s+me|ask\\s+for|looking\\s+for|connect\\s+me\\s+(?:to|with)|put\\s+me\\s+through\\s+to|transfer\\s+me\\s+to)\\s+${NAMED_PERSON}`,
    `\\bis\\s+${JOE}\\s+(?:there|in|around|available|on|free|working|back)\\b`,
    `\\bwhere(?:(?:'|’)?s|\\s+is)\\s+${JOE}\\b`,
    `\\b(?:real|live|actual)\\s+(?:person|human|agent)\\b`,
    `\\b(?:human|person)\\s+please\\b`,
    `\\b(?:call|ring)\\s+me(?:\\s+back)?\\b`,
  ].join("|"),
  "i",
);

export function wantsPerson(message: string): boolean {
  return WANTS_PERSON.test(message);
}

export function namesJoe(message: string): boolean {
  return new RegExp(`\\b${JOE}\\b`, "i").test(message);
}

export function isThinFollowUp(message: string): boolean {
  const text = message.trim();
  if (isMetaDialogue(text) || isCannedLanguageComplaint(text)) return true;
  if (text.length > 0 && text.length < 28 && !/[?]/.test(text) && !IT_SUPPORT.test(text) && !CYBER.test(text) && !MSP.test(text) && !COMPLIANCE.test(text) && !PRICING.test(text)) {
    return true;
  }
  return false;
}

export function isPromptInjectionAttempt(message: string): boolean {
  return /\b(ignore\s+(all\s+)?(previous|prior)\s+instructions|reveal\s+(your\s+)?(system|developer)\s+prompt|show\s+(me\s+)?(the\s+)?(system|hidden)\s+prompt|print\s+your\s+instructions|jailbreak|DAN\s+mode|exfiltrat|api[_-]?keys?|client_secret|JWT_SECRET|show\s+me\s+your\s+(api|keys|secrets))\b/i.test(
    message,
  );
}
