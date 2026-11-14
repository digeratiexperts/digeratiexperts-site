import { PRIMARY_PHONE } from "@shared/companyContact";

/** Fixed reply when a visitor asks whether DE Desk is a human, bot, robot, or AI. */
export const AI_IDENTITY_REPLY =
  `You're talking to DE Desk, an AI assistant for Digerati Experts, not a person. If you'd like a person right away, you can call ${PRIMARY_PHONE.display}, request a callback, or leave a message here.`;

/**
 * True when the visitor is asking whether they are talking to a human, a bot,
 * a robot, or AI. Must be checked before canned-complaint routing: the word
 * "robot" alone is also a complaint trigger.
 */
export function isAskingAiIdentity(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  if (
    /\b(?:are|r)\s+(?:you|u)(?:\s+(?:even|actually|really|just|still))?(?:\s+an?)?\s+(?:an?\s+)?(?:a\.?i\.?|ai|artificial(?:\s+intelligence)?|llm|language\s+model|chat\s*gpt|chatgpt|bot|chatbot|robot|machine|human|person|real(?:\s+(?:person|human|one))?)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (
    /\b(?:am\s+i|are\s+we)\s+(?:talking|speaking|chatting|writing)\s+(?:to|with)\s+(?:an?\s+)?(?:bot|robot|human|person|ai|a\.?i\.?)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (
    /\bis\s+this\s+(?:an?\s+)?(?:bot|robot|human|person|ai|a\.?i\.?|artificial(?:\s+intelligence)?|real\s+(?:person|human))\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\bwho\s+are\s+you\b(?!\s+(?:working|with|talking|asking|using|representing|looking))/i.test(text)) return true;
  if (/\bare\s+you\s+real\b/i.test(text)) return true;
  if (/\bwhat\s+are\s+you\b(?!\s+(?:doing|working|seeing|offering|using|looking|trying))/i.test(text)) {
    return true;
  }
  return false;
}