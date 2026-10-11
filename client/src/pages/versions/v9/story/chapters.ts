/**
 * The Signal Thread: the homepage read as one story (Version 9 concept).
 *
 * One thread runs down the page. Each chapter below picks it up on the side
 * where the previous chapter left it, crosses (when its side changes) inside
 * its own top padding, carries a numbered node that names the step, and ends
 * at its bottom edge where the next chapter takes over. Behind the content a
 * faint line-art motif previews what the chapter explains.
 *
 * Order is page order. A chapter's entry side is the previous chapter's side,
 * so the joins line up without any chapter knowing its neighbours.
 *
 * Every label and motif restates what its section already says (six problems,
 * three paths, eight blocks, four steps, four models, Chandler HQ). Nothing
 * here is evidence, data or telemetry: it is decoration, aria-hidden.
 */
export type ThreadSide = "l" | "r";
export type Tone = "paper" | "dark";
export type MotifKey =
  | "core"
  | "exposure"
  | "gaps"
  | "paths"
  | "layers"
  | "method"
  | "ledger"
  | "place"
  | "owner"
  | "sectors"
  | "fit"
  | "intel"
  | "watch"
  | "target"
  | "questions"
  | "standards"
  | "converge"
  | "arrive";

export interface StoryChapter {
  key: MotifKey;
  /** Short name of the step, shown along the thread beside the node. */
  label: string;
  side: ThreadSide;
  tone: Tone;
  /** Optional kie.ai environment plate (ILLUSTRATIVE), file stem under PLATE_DIR. */
  plate?: string;
  /**
   * Carries the thread through without a node, label or number: for a section
   * that may render empty (the live threat feed has nothing to show when its
   * sources are down), so the numbering never skips a step.
   */
  passthrough?: boolean;
}

export const PLATE_DIR = "/images/visual-system/signal-thread";

export const STORY: readonly StoryChapter[] = [
  { key: "core", label: "Why we exist", side: "l", tone: "paper" },
  { key: "exposure", label: "The exposure", side: "r", tone: "dark", plate: "exposure" },
  { key: "gaps", label: "The gaps", side: "r", tone: "paper" },
  { key: "paths", label: "Three paths", side: "l", tone: "dark", plate: "paths" },
  { key: "layers", label: "Eight blocks", side: "r", tone: "paper" },
  { key: "method", label: "The method", side: "l", tone: "dark" },
  { key: "ledger", label: "The proof", side: "l", tone: "dark", plate: "proof" },
  { key: "place", label: "The place", side: "r", tone: "paper" },
  { key: "owner", label: "The people", side: "r", tone: "dark" },
  { key: "sectors", label: "Your sector", side: "l", tone: "dark" },
  { key: "fit", label: "Your fit", side: "r", tone: "dark", plate: "fit" },
  { key: "intel", label: "The intel", side: "r", tone: "dark", passthrough: true },
  { key: "watch", label: "The watch", side: "l", tone: "dark" },
  { key: "target", label: "The start", side: "l", tone: "paper" },
  { key: "questions", label: "Your questions", side: "r", tone: "paper" },
  { key: "standards", label: "The standards", side: "r", tone: "dark" },
  { key: "converge", label: "Next step", side: "l", tone: "paper" },
  { key: "arrive", label: "Chandler, AZ", side: "l", tone: "dark" },
];

/** Step number shown on the node: pass-through chapters are not counted. */
export function stepNumber(index: number): number {
  return STORY.slice(0, index + 1).filter((c) => !c.passthrough).length;
}

export function chapterIndex(key: MotifKey): number {
  return STORY.findIndex((c) => c.key === key);
}

/** Side the thread enters a chapter on: where the previous chapter left it (the first enters from the hero, on the left). */
export function entrySide(index: number): ThreadSide {
  return index <= 0 ? "l" : STORY[index - 1].side;
}

/** Rail position in px: just inside the page gutter, outside the 1400px canvas once the viewport is wider. */
export function railX(width: number, side: ThreadSide): number {
  const inset = Math.max(width < 640 ? 7 : 12, (width - 1400) / 2 + 14);
  return side === "l" ? inset : width - inset;
}
