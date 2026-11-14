/**
 * Deterministic DE Desk crisis check. Runs on the server before any model call.
 * A match stops the assistant and returns CRISIS_REPLY. This is not a diagnosis
 * and is not a substitute for emergency services.
 */

export const CRISIS_REPLY =
  "If you are in crisis, please use these resources now. In the U.S., call or text 988 to reach the 988 Suicide & Crisis Lifeline, or text HOME to 741741 (Crisis Text Line). If you are in immediate danger, call 911.";

/**
 * Phrase patterns that indicate self-harm or suicide crisis language.
 * Intentionally narrow so ordinary IT language (kill a process, want this gone)
 * does not trip the check.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm|cut)\s+(myself|my\s*self)\b/i,
  /\b(end|ending|take|taking)\s+(it\s+all|my\s+(own\s+)?life)\b(?!\s+insurance)/i,
  /\b(commit(ting)?|complete|attempt(ing)?)\s+suicide\b/i,
  /\bsuicid(al|e)\b(?!\s+squeeze)/i,
  /\bself[-\s]?harm(?:ing)?\b/i,
  /\b(i\s+(just\s+)?want\s+to\s+die|i\s+wanna\s+die|want\s+to\s+be\s+dead)\b/i,
  /\b(wish\s+i\s+(was|were)\s+dead|better\s+off\s+dead|don't\s+want\s+to\s+(be\s+alive|live))\b/i,
  /\b(can't|cannot|can\s+not)\s+(go\s+on|keep\s+(on\s+)?(going|living)|do\s+this\s+anymore)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\b(shoot|hang|hanging|cut|slit|overdose|od)\s+(myself|my\s*self|my\s+wrists)\b/i,
  /\b(jump(ing)?\s+(off|in\s+front|in\s+front\s+of))\b/i,
  /\b(i\s+)?(am\s+going\s+to|gonna|going\s+to)\s+(kill|end)\s+(myself|it\s+all|my\s+life)\b/i,
];

export function isCrisisMessage(text: string): boolean {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return false;
  return CRISIS_PATTERNS.some((re) => re.test(value));
}
