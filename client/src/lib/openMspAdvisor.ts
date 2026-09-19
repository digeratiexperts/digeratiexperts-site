/**
 * Open the sitewide DE Desk (advisor) with optional store-context seed.
 * Do not invent a second chatbot — this only deeplinks the existing advisor.
 */
export type OpenMspAdvisorDetail = {
  seedMessage?: string;
  context?: "store" | "home" | "other";
  /** Deep-link straight to a Desk tab instead of always opening on Ask DE chat. */
  tab?: "chat" | "ticket" | "resources";
};

/**
 * The Desk widget is code-split and mounts shortly after first paint. A request
 * made before its listener exists is parked here and replayed by the widget on
 * mount, so a fast first click on the launcher is never lost.
 */
const PENDING_KEY = "__deDeskPendingOpen";
type PendingWindow = Window & { [PENDING_KEY]?: OpenMspAdvisorDetail | null };

export function openMspAdvisor(detail: OpenMspAdvisorDetail = {}) {
  if (typeof window === "undefined") return;
  (window as PendingWindow)[PENDING_KEY] = detail;
  window.dispatchEvent(new CustomEvent("de-open-msp-advisor", { detail }));
}

/** Called by the widget once its listener is attached; returns and clears any parked request. */
export function takePendingMspAdvisorOpen(): OpenMspAdvisorDetail | null {
  if (typeof window === "undefined") return null;
  const w = window as PendingWindow;
  const pending = w[PENDING_KEY] ?? null;
  w[PENDING_KEY] = null;
  return pending;
}

/** Widget marks a request as consumed so a later remount does not replay it. */
export function clearPendingMspAdvisorOpen() {
  if (typeof window === "undefined") return;
  (window as PendingWindow)[PENDING_KEY] = null;
}

export const STORE_ADVISOR_SEED =
  "I'm shopping the IT store and want help building a solution. Ask me about company size, industry, Microsoft 365 vs Google, whether we have internal IT, and our main objective — then recommend real catalog services I can add.";
