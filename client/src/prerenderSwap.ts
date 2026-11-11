/**
 * Swaps the server's prerendered snapshot (server/prerender.ts) for the live app.
 *
 * The snapshot is visible from first paint; the app renders into a hidden #root. Once
 * the app shows real content (an H1, and no route loading skeleton) the snapshot is
 * removed and #root is shown, in one frame. A timeout reveals the app anyway, so a page
 * without an H1 can never stay frozen on the snapshot.
 */
const MAX_WAIT_MS = 5000;

export function installPrerenderSwap(root: HTMLElement): void {
  const snapshot = document.getElementById("de-prerender");
  if (!snapshot) {
    root.hidden = false;
    return;
  }
  let swapped = false;
  let observer: MutationObserver | undefined;
  let timer: number | undefined;
  const reveal = () => {
    if (swapped) return;
    swapped = true;
    observer?.disconnect();
    if (timer !== undefined) window.clearTimeout(timer);
    snapshot.remove();
    root.hidden = false;
  };
  const ready = () => Boolean(root.querySelector("h1")) && !root.querySelector("[data-page-loading]");
  observer = new MutationObserver(() => {
    if (ready()) window.requestAnimationFrame(reveal);
  });
  observer.observe(root, { childList: true, subtree: true });
  timer = window.setTimeout(reveal, MAX_WAIT_MS);
}
