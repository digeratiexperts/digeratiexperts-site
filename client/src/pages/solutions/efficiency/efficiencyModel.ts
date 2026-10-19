/**
 * Content and scoring for the /solutions/efficiency-before-ai widgets. Both
 * interactives are illustrative: no dollar figures, percentages or benchmarks,
 * only where the budget moves and what the visitor ticks (docs/CLAIMS-REGISTER.md).
 */

export type FoundationGap = { id: string; label: string };

export const FOUNDATION_GAPS: FoundationGap[] = [
  { id: "lockout", label: "Staff locked out because identities and MFA were never cleaned up" },
  { id: "slow", label: "Aging laptops and slow logins that cost time every morning" },
  { id: "backup", label: "Backups that exist but have never been restored to prove they work" },
  { id: "leavers", label: "Shared passwords and accounts nobody switched off when someone left" },
  { id: "internet", label: "One internet connection and no plan for when it drops" },
  { id: "onboarding", label: "New hires waiting on access while their first week slips away" },
];

export type FoundationResult = { level: string; message: string };

/** Verdict for how many foundation gaps the visitor ticked. */
export function scoreFoundation(checked: number): FoundationResult {
  if (checked <= 0) {
    return {
      level: "Holding",
      message: "Nothing on the list. Your foundation is holding, so AI has something solid to build on.",
    };
  }
  if (checked <= 2) {
    return {
      level: "Cracks showing",
      message: "A few cracks. Fix these first: they cost your team time now, and AI won't patch them.",
    };
  }
  return {
    level: "Foundation first",
    message:
      "Your team is working around the basics. Put the budget here before AI, or AI inherits every one of these.",
  };
}

export type BudgetLine = {
  id: string;
  /** Short label for the allocation bar. */
  short: string;
  title: string;
  text: string;
  /** Who carries the risk once this line is cut. */
  riskMovesTo: string;
};

export const BUDGET_LINES: BudgetLine[] = [
  {
    id: "hardware",
    short: "Hardware",
    title: "Hardware refresh pushed out",
    text: "Old devices fail more, patch less and slow everyone down. Delaying them to fund AI moves the cost to your team's day.",
    riskMovesTo: "your team's day",
  },
  {
    id: "training",
    short: "Training",
    title: "Security awareness training dropped",
    text: "People are still the first line against phishing and payment fraud. AI tools make convincing scams easier to write, not harder.",
    riskMovesTo: "your inbox",
  },
  {
    id: "recovery",
    short: "Recovery",
    title: "Backup and recovery testing skipped",
    text: "Recovery is the line that decides whether a bad day is an inconvenience or a closed office. It is not where the savings should come from.",
    riskMovesTo: "your next bad day",
  },
  {
    id: "support",
    short: "Support",
    title: "Support hours trimmed",
    text: "When a problem stops someone from working, the time to fix it is what your clients feel. Fewer support hours means longer stops.",
    riskMovesTo: "your clients' wait",
  },
];

/** "a", "a and b", "a, b and c". */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export type BudgetSummary = { cut: number; total: number; headline: string; detail: string };

/** Readout for the budget balancer, in the order the lines are listed. */
export function summarizeBudget(cutIds: readonly string[]): BudgetSummary {
  const cutLines = BUDGET_LINES.filter((line) => cutIds.includes(line.id));
  const total = BUDGET_LINES.length;
  if (cutLines.length === 0) {
    return {
      cut: 0,
      total,
      headline: "Every basic is funded.",
      detail: "Nothing has been cut to pay for AI. Move a line to see where the risk goes.",
    };
  }
  return {
    cut: cutLines.length,
    total,
    headline: `AI pilot funded by cutting ${cutLines.length} of ${total} basics.`,
    detail: `The risk didn't disappear. It moved to ${joinList(cutLines.map((line) => line.riskMovesTo))}.`,
  };
}
