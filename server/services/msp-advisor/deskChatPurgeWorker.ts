/**
 * Purges expired DE Desk transcripts when DESK_CHAT_PURGE_ENABLED is on.
 * The switch is off by default. DESK_CHAT_RETENTION_DAYS defaults to 365.
 * Production must enable the job with 365. Sessions under legal hold or
 * linked to a ticket are skipped. If a hold or ticket lookup fails, that
 * session is left in place.
 */
import { purgeExpiredDeskChats } from "./persist";

const TICK_MS = 6 * 60 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startDeskChatPurgeWorker(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void purgeExpiredDeskChats()
      .catch((error) => console.error("[de-desk-purge] tick failed:", error?.message || error))
      .finally(() => {
        running = false;
      });
  };
  tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
}
