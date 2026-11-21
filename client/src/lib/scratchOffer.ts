import { isDoor2Path } from "@/lib/isDoor2Path";
import { isWarehousePath } from "@/lib/warehousePaths";
import { isQuizRoomPath } from "@/lib/quizRoom";
import { isStoreTrackingPath, normalizeSitePath, pathIsOrUnder, skipClarity } from "@shared/trackingExclusions";
import { normalizeClaimCode } from "@shared/scratchOffer";

export const SCRATCH_OFFER_FLAG = "VITE_SCRATCH_OFFER";
export const SCRATCH_PREVIEW_PARAM = "scratch";
export const SCRATCH_STORAGE_KEY = "de_scratch_offer_v1";
export const REVEAL_THRESHOLD = 0.55;
export const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const AUTO_SHOW_DELAY_MS = 15_000;

type FlagEnv = { DEV?: boolean; [key: string]: unknown };

export function scratchOfferEnabled(env: FlagEnv): boolean {
  const raw = env[SCRATCH_OFFER_FLAG];
  return raw === "1" || raw === "true" || raw === true;
}

/** `?scratch=1` opens the card on demand; only when the flag is on or in a dev build. */
export function scratchPreviewRequest(search: string, env: FlagEnv): "open" | "reset" | null {
  if (!scratchOfferEnabled(env) && !env.DEV) return null;
  const value = new URLSearchParams(search).get(SCRATCH_PREVIEW_PARAM);
  if (value === "1") return "open";
  if (value === "reset") return "reset";
  return null;
}

const EXTRA_EXCLUDED = ["/checkout", "/order", "/orders", "/legal", "/support"];

/** Pages where the card never appears: portal, checkout, order, DE Desk and form pages. */
export function isScratchOfferPath(pathname: string, hostname = "digeratiexperts.com"): boolean {
  const path = normalizeSitePath(pathname);
  if (skipClarity(hostname, path)) return false;
  if (isStoreTrackingPath(path) || isDoor2Path(path) || isWarehousePath(path) || isQuizRoomPath(path)) return false;
  return !EXTRA_EXCLUDED.some((route) => pathIsOrUnder(path, route));
}

export type ScratchStep = "scratch" | "revealed" | "details" | "code";

export type ScratchState = {
  step: ScratchStep;
  claimCode?: string;
  dismissedAt?: number;
  open?: boolean;
};

const STEPS: readonly ScratchStep[] = ["scratch", "revealed", "details", "code"];

export function parseScratchState(raw: string | null): ScratchState {
  if (!raw) return { step: "scratch" };
  try {
    const value = JSON.parse(raw) as Partial<ScratchState>;
    const claimCode = normalizeClaimCode(value.claimCode) ?? undefined;
    let step: ScratchStep = STEPS.includes(value.step as ScratchStep) ? (value.step as ScratchStep) : "scratch";
    if (step === "code" && !claimCode) step = "details";
    if (claimCode) step = "code";
    return {
      step,
      ...(claimCode ? { claimCode } : {}),
      ...(typeof value.dismissedAt === "number" ? { dismissedAt: value.dismissedAt } : {}),
      ...(value.open === true ? { open: true } : {}),
    };
  } catch {
    return { step: "scratch" };
  }
}

export function readScratchState(storage: Pick<Storage, "getItem"> | undefined): ScratchState {
  try {
    return parseScratchState(storage?.getItem(SCRATCH_STORAGE_KEY) ?? null);
  } catch {
    return { step: "scratch" };
  }
}

export function writeScratchState(storage: Pick<Storage, "setItem"> | undefined, state: ScratchState): void {
  try {
    storage?.setItem(SCRATCH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked */
  }
}

/** Open again after a refresh mid-flow; otherwise show once, and not again for two weeks after a close. */
export function autoShowDecision(state: ScratchState, now: number): "resume" | "show" | "skip" {
  if (state.open && state.step !== "scratch") return "resume";
  if (state.claimCode) return "skip";
  if (state.dismissedAt && now - state.dismissedAt < DISMISS_COOLDOWN_MS) return "skip";
  if (state.step !== "scratch") return "skip";
  return "show";
}

/** Share of a sampled RGBA buffer whose alpha has been scratched below half. */
export function clearedFraction(rgba: ArrayLike<number>): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  let cleared = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 128) cleared += 1;
  }
  return cleared / pixels;
}

export function sampleGridSize(width: number, height: number, cells = 1600): { cols: number; rows: number } {
  if (width <= 0 || height <= 0) return { cols: 1, rows: 1 };
  const ratio = width / height;
  const rows = Math.max(1, Math.round(Math.sqrt(cells / ratio)));
  const cols = Math.max(1, Math.round(rows * ratio));
  return { cols, rows };
}

export function bookingHrefForClaim(code: string): string {
  return `/book?claim=${encodeURIComponent(code)}`;
}
