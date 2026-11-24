import { isPromoPopupPath } from "@/lib/sitePopup";

export const GOAL_PICKER_FLAG = "VITE_GOAL_PICKER";
export const GOAL_PREVIEW_PARAM = "goal";
export const DESK_GOAL_STORAGE_KEY = "de_desk_goal_v1";
export const GOAL_MIN_DELAY_MS = 8_000;
export const GOAL_SCROLL_THRESHOLD = 0.4;

type FlagEnv = { DEV?: boolean; [key: string]: unknown };

export function goalPickerEnabled(env: FlagEnv): boolean {
  const raw = env[GOAL_PICKER_FLAG];
  return raw === "1" || raw === "true" || raw === true;
}

/** `?goal=1` opens the picker on demand; only when the flag is on or in a dev build. */
export function goalPreviewRequest(search: string, env: FlagEnv): "open" | "reset" | null {
  if (!goalPickerEnabled(env) && !env.DEV) return null;
  const value = new URLSearchParams(search).get(GOAL_PREVIEW_PARAM);
  if (value === "1") return "open";
  if (value === "reset") return "reset";
  return null;
}

export function isGoalPickerPath(pathname: string, hostname = "digeratiexperts.com"): boolean {
  return isPromoPopupPath(pathname, hostname);
}

export const GOAL_PICKER_INCENTIVE = {
  status: "pending" as const,
  line: "Pick one and we'll start with a free Security Snapshot for qualified businesses.",
  finePrint: "Fee waiver confirmed in writing by DE after review. Not available in CA, NY, MA or HI.",
};

export const GOAL_PICKS = [
  {
    id: "lock-down-security",
    label: "Lock Down Security & Compliance",
    subtitle: "assessments, monitoring, gap fixes",
    seedMessage: "My goal today is Lock Down Security & Compliance — assessments, monitoring, and gap fixes.",
  },
  {
    id: "fully-managed",
    label: "Fully Managed IT & Security",
    subtitle: "ProActive Ecosystem",
    seedMessage: "My goal today is Fully Managed IT & Security through the ProActive Ecosystem.",
  },
  {
    id: "co-managed",
    label: "Co-Managed IT & Dashboards",
    subtitle: "for internal IT teams",
    seedMessage: "My goal today is Co-Managed IT & Dashboards for our internal IT team.",
  },
  {
    id: "kits",
    label: "Preconfigured IT & Security Kits",
    subtitle: "",
    seedMessage: "My goal today is Preconfigured IT & Security Kits.",
  },
] as const;

export type GoalId = (typeof GOAL_PICKS)[number]["id"];
export type GoalPick = (typeof GOAL_PICKS)[number];
export type StoredDeskGoal = { id: GoalId; label: string };

export function isGoalId(value: unknown): value is GoalId {
  return GOAL_PICKS.some((pick) => pick.id === value);
}

export function goalById(id: string | undefined): GoalPick | undefined {
  return GOAL_PICKS.find((pick) => pick.id === id);
}

export function parseDeskGoal(raw: string | null): StoredDeskGoal | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredDeskGoal>;
    if (!isGoalId(value.id) || typeof value.label !== "string") return null;
    return { id: value.id, label: value.label };
  } catch {
    return null;
  }
}

export function readDeskGoal(storage: Pick<Storage, "getItem"> | undefined): StoredDeskGoal | null {
  try {
    return parseDeskGoal(storage?.getItem(DESK_GOAL_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeDeskGoal(storage: Pick<Storage, "setItem"> | undefined, goal: StoredDeskGoal): void {
  try {
    storage?.setItem(DESK_GOAL_STORAGE_KEY, JSON.stringify(goal));
  } catch {
    /* storage blocked */
  }
}

export function clearDeskGoal(storage: Pick<Storage, "removeItem"> | undefined): void {
  try {
    storage?.removeItem(DESK_GOAL_STORAGE_KEY);
  } catch {
    /* storage blocked */
  }
}

/** Attach the chosen goal to the existing DE Desk session page context. */
export function deskGoalPageContext(
  storage: Pick<Storage, "getItem"> | undefined,
): { serviceContext?: string; campaignSource?: string } {
  const goal = readDeskGoal(storage);
  if (!goal) return {};
  return {
    campaignSource: "goal-picker",
    serviceContext: `goal:${goal.id}`,
  };
}

export function scrollProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const max = scrollHeight - clientHeight;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, scrollTop / max));
}

export function readBrowserDeskGoalContext(): { serviceContext?: string; campaignSource?: string } {
  if (typeof window === "undefined") return {};
  try {
    return deskGoalPageContext(window.localStorage);
  } catch {
    return {};
  }
}
