/**
 * The four-question AI exposure self-check on /go/ai-background-check.
 * Illustrative only: the page labels it "not an assessment", and the result
 * never claims a score beyond Low / Medium / High.
 */

export type Answer = "yes" | "no";

export interface ExposureQuestion {
  id: string;
  prompt: string;
  /** The answer that adds exposure. */
  risky: Answer;
}

export const EXPOSURE_QUESTIONS: readonly ExposureQuestion[] = [
  { id: "personal-accounts", prompt: "Do people use AI on personal accounts for work?", risky: "yes" },
  { id: "ai-in-apps", prompt: "Is AI switched on inside your email or documents?", risky: "yes" },
  { id: "leaver-cutoff", prompt: "Could you cut off a leaver's AI access today?", risky: "no" },
  { id: "regulated-data", prompt: "Do you handle patient, financial or defense data?", risky: "yes" },
];

export type ExposureLevel = "Low" | "Medium" | "High";

export interface ExposureResult {
  level: ExposureLevel;
  message: string;
}

/** Null until every question is answered. */
export function scoreExposure(answers: Partial<Record<string, Answer>>): ExposureResult | null {
  if (!EXPOSURE_QUESTIONS.every((q) => answers[q.id])) return null;
  const risky = EXPOSURE_QUESTIONS.filter((q) => answers[q.id] === q.risky).length;
  if (risky >= 3) {
    return {
      level: "High",
      message: "The Background Check can show where AI may reach company data that nobody has reviewed.",
    };
  }
  if (risky === 2) {
    return {
      level: "Medium",
      message: "A few gaps may be worth closing. The Background Check puts the top 3 fixes on one page.",
    };
  }
  return { level: "Low", message: "A good start. A quick check confirms nothing slipped through." };
}
