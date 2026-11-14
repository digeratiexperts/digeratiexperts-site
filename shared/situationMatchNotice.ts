/**
 * Short notice shown only on the Describe Your Situation composer.
 * This is not the DE Desk pre-chat notice.
 */

/** Published retention period for the describe-box notice. */
export const CHAT_RETENTION = "1 year";

/** Depends on the AI provider API terms. Drop this clause if those terms change. */
export const SITUATION_MATCH_NO_TRAINING = "which is not allowed to use it to train its models";

/** Bumped for the 1-year retention wording. */
export const SITUATION_MATCH_NOTICE_VERSION = "situation-match-v3";

export const SITUATION_MATCH_PRIVACY_PATH = "/legal/privacy-policy";
export const SITUATION_MATCH_PRIVACY_LINK_TEXT = "Privacy Policy";

export const SITUATION_MATCH_AI_DISCLOSURE = [
  "An AI assistant for Digerati Experts (DE) reads your description to suggest services. We send it to our AI service provider, ",
  SITUATION_MATCH_NO_TRAINING,
  ", and keep it in your session for ",
  CHAT_RETENTION,
  " so DE Desk can pick up where you left off. It is not saved to an IT & Security Profile unless you later choose to save a draft. Please don't include passwords, card numbers, or health or patient information. See our ",
  SITUATION_MATCH_PRIVACY_LINK_TEXT,
  ".",
].join("");

export const HEALTH_INFO_WARNING =
  "Please don't include health or patient information. You can still continue.";

const HEALTH_INFO_RE = /\b(diagnos(?:is|es)|patients?|phi|medical records?|prescriptions?)\b/i;

export function looksLikeHealthInfo(text: string): boolean {
  return HEALTH_INFO_RE.test(text);
}
