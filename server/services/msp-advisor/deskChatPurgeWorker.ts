/**
 * Purges expired DE Desk transcripts when a retention period is configured.
 * Disabled by default: unset or invalid DESK_CHAT_RETENTION_DAYS is a no-op.
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
