/**
 * Short notice shown only on the Describe Your Situation composer.
 * This is not the DE Desk pre-chat notice.
 */

import { formatAdvisorSessionIdleTtl } from "./advisorSessionTtl";

/** Published retention period for DE Desk chat transcripts. */
export const CHAT_RETENTION = "1 year";

/** Depends on the AI provider API terms. Drop this clause if those terms change. */
export const SITUATION_MATCH_NO_TRAINING = "which is not allowed to use it to train its models";

/** Bumped for the idle-TTL and DE Desk retention wording. */
export const SITUATION_MATCH_NOTICE_VERSION = "situation-match-v4";

export const SITUATION_MATCH_PRIVACY_PATH = "/legal/privacy-policy";
export const SITUATION_MATCH_PRIVACY_LINK_TEXT = "Privacy Policy";

export const SITUATION_MATCH_AI_DISCLOSURE = [
  "An AI assistant for Digerati Experts (DE) reads your description to suggest services. We send it to our AI service provider, ",
  SITUATION_MATCH_NO_TRAINING,
  ". We keep what you type here for up to ",
  formatAdvisorSessionIdleTtl(),
  " of inactivity so DE Desk can pick up where you left off. If you continue in DE Desk, your description becomes part of that chat, which we keep for ",
  CHAT_RETENTION,
  ". Don't enter passwords, card numbers, or health information. See our ",
  SITUATION_MATCH_PRIVACY_LINK_TEXT,
  ".",
].join("");

export const HEALTH_INFO_WARNING =
  "Please don't include health or patient information. You can still continue.";

const HEALTH_INFO_RE = /\b(diagnos(?:is|es)|patients?|phi|medical records?|prescriptions?)\b/i;

export function looksLikeHealthInfo(text: string): boolean {
  return HEALTH_INFO_RE.test(text);
}
