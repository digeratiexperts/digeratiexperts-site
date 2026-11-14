/**
 * DE Desk topic scope: stay on Digerati Experts work, and politely turn
 * down clearly unrelated or companion-style chat.
 *
 * Crisis checks run first. When #1024 lands, isCrisisMessage must be
 * evaluated before isOffTopicCompanionRequest so a crisis turn is never
 * treated as off-topic chat.
 */

export const DESK_TOPIC_SCOPE_RULE =
  "Stay on Digerati Experts (DE) work: sales, services, IT and security questions about the person's business, support, tickets, ordering, and the store. If they ask for unrelated open-ended or companion-style chat (personal conversation, roleplay, general trivia, homework, or creative writing), politely decline in one or two short sentences and steer back to how DE can help. Do not continue that chat. Do not lecture.";

export const DESK_TOPIC_REDIRECT_REPLY =
  "I'm DE Desk, here for Digerati Experts sales, services, and IT or security questions about your business, plus support, tickets, ordering, and the store. If that's what you need, tell me what's going on and I'll help.";

export const DESK_TOPIC_REDIRECT_FOLLOWUP =
  "I'm still here for Digerati Experts IT and security help whenever you're ready.";

const CREATIVE_OR_HOMEWORK =
  /\b(write\s+(me\s+)?(an?\s+)?(poem|poems|song|story|essay|screenplay|fanfic|fan\s*fiction|short\s+story|rhyme)|do\s+(my|the|this)\s+homework|homework\s+essay|creative\s+writing)\b/i;

const ROLEPLAY =
  /\b(role[\s-]?play|let'?s\s+pretend|pretend\s+(you('re|are)|to\s+be|we('re|\s+are))|act\s+as\s+my\s+(boyfriend|girlfriend|wife|husband|date|friend|companion)|be\s+my\s+(boyfriend|girlfriend|wife|husband|date|friend|companion|pen\s*pal))\b/i;

const COMPANION =
  /\b((i'?m\s+bored,?\s+(can\s+you\s+)?(just\s+)?(chat|talk)\s+with\s+me|keep\s+me\s+company|i'?m\s+(feeling\s+)?lonely|i\s+need\s+a\s+friend|emotional\s+support\s+chat|be\s+my\s+(companion|therapist)|let'?s\s+just\s+chat|(just\s+)?(chat|talk)\s+with\s+me)\b)/i;

const TRIVIA =
  /\b(recipe|recipes|football|super\s*bowl|\bnba\b|\bmlb\b|\bnhl\b|soccer|movie|movies|celebrity|celebrities|horoscope|\bdating\b|tell\s+me\s+a\s+joke|know\s+any\s+jokes|knock\s+knock|capital\s+of|who\s+won\s+the|weather\s+in|fun\s+fact|\btrivia\b|\briddle\b)\b/i;

/** Business IT, security, support, ordering, and DE services — never block these. */
const IN_SCOPE =
  /\b(it\s+help|managed\s+it|\bmsp\b|cyber|security|phish|malware|ransom|firewall|vpn|mfa|2fa|endpoint|\bsiem\b|\bsoc\b|vulnerab|printer|wifi|wi-fi|outlook|microsoft\s*365|\bm365\b|office\s*365|azure|entra|intune|sharepoint|\bteams\b|exchange|onedrive|laptop|computer|\bpcs?\b|\bbsod\b|password|ticket|support|invoice|billing|portal|store|order|checkout|quote|pricing|how\s+much|hipaa|cmmc|pci|soc\s*2|gdpr|compliance|audit|assessment|digerati experts|help desk|troubleshoot|network|server|backup|workstation|onboarding|offboarding|windows)\b/i;

export function isOffTopicCompanionRequest(text: string): boolean {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return false;
  if (CREATIVE_OR_HOMEWORK.test(value) || ROLEPLAY.test(value)) return true;
  if (IN_SCOPE.test(value)) return false;
  return COMPANION.test(value) || TRIVIA.test(value);
}

export function deskTopicRedirectReply(previousAssistantReply?: string | null): string {
  if (
    previousAssistantReply === DESK_TOPIC_REDIRECT_REPLY ||
    previousAssistantReply === DESK_TOPIC_REDIRECT_FOLLOWUP
  ) {
    return DESK_TOPIC_REDIRECT_FOLLOWUP;
  }
  return DESK_TOPIC_REDIRECT_REPLY;
}
