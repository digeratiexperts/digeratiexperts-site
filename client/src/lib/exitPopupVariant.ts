/**
 * Exit popup background split test (Joe, 2026-10-10: "A, split-tested vs
 * current"). "paper" is the warm paper popup as it was; "navy" is concept A,
 * the homepage hero's navy grid. Each browser keeps the version it first drew,
 * so one visitor never sees both. `?exit_variant=navy|paper` forces a version
 * for review without touching the stored one.
 */
export type ExitPopupVariant = "paper" | "navy";

export const EXIT_POPUP_VARIANTS: readonly ExitPopupVariant[] = ["paper", "navy"];
const STORAGE_KEY = "de_exit_popup_variant";

function isVariant(value: unknown): value is ExitPopupVariant {
  return value === "paper" || value === "navy";
}

/** Pure choice: a forced version wins, then a stored one, else a 50/50 draw. */
export function chooseExitPopupVariant(input: {
  forced?: string | null;
  stored?: string | null;
  random: number;
}): { variant: ExitPopupVariant; store: boolean } {
  if (isVariant(input.forced)) return { variant: input.forced, store: false };
  if (isVariant(input.stored)) return { variant: input.stored, store: false };
  return { variant: input.random < 0.5 ? "paper" : "navy", store: true };
}

export function getExitPopupVariant(): ExitPopupVariant {
  let forced: string | null = null;
  let stored: string | null = null;
  try {
    forced = new URLSearchParams(window.location.search).get("exit_variant");
  } catch {
    /* malformed URL */
  }
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage blocked: draw per page load */
  }
  const { variant, store } = chooseExitPopupVariant({ forced, stored, random: Math.random() });
  if (store) {
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch {
      /* ignore */
    }
  }
  return variant;
}
