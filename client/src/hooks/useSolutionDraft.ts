import { useEffect, useState } from "react";
import { emptyDraft, readSolutionDraft, SOLUTION_DRAFT_EVENT, type SolutionDraft } from "@/lib/solutionDraft";

/**
 * The one draft, live. Every Store screen and the Your Solution chrome read
 * from here so an add on one part of the page is visible everywhere at once,
 * including a second tab through the storage event.
 */
export function useSolutionDraft(): SolutionDraft {
  const [draft, setDraft] = useState<SolutionDraft>(() => (typeof window === "undefined" ? emptyDraft() : readSolutionDraft()));
  useEffect(() => {
    const refresh = () => setDraft(readSolutionDraft());
    refresh();
    window.addEventListener(SOLUTION_DRAFT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SOLUTION_DRAFT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return draft;
}

/** True at and above a CSS pixel width; the rail (≥ 1024) and the bar (< 1024) decide with this. */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState<boolean>(() => (typeof window === "undefined" ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Door 2 pages start at the top. Wouter keeps the old scroll position across pushes otherwise (Baseline A P0). */
export function useStoreScrollReset(): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
}
