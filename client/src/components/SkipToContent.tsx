import type { MouseEvent } from "react";

/**
 * "Skip to main content" that actually skips the chrome.
 *
 * The old link was `href="#main-content"` pointing at the router wrapper, which
 * contains the MegaMenu — so activating it moved focus to the top of the header
 * and skipped nothing (keyboard audit, 2026-09-13). Every page now carries a
 * real `<main>` (PageTemplate, homepage, portal, store…), so the link targets
 * the first `<main>` in the document, makes it programmatically focusable, and
 * moves focus there. The hash href stays as a no-JS fallback.
 */
export const MAIN_CONTENT_FALLBACK_ID = "main-content";

export function focusMainContent(doc: Document = document): HTMLElement | null {
  const target =
    doc.querySelector<HTMLElement>("main") ??
    doc.getElementById(MAIN_CONTENT_FALLBACK_ID);
  if (!target) return null;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  // A `display: contents` main (the homepage) has no box and cannot take focus;
  // land on its first heading instead so the next Tab continues inside main.
  let landed: HTMLElement = target;
  if (doc.activeElement !== target) {
    const heading = target.querySelector<HTMLElement>("h1, h2, [tabindex]");
    if (!heading) return null;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    landed = heading;
  }
  landed.scrollIntoView({ block: "start" });
  return landed;
}

export function SkipToContent() {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (focusMainContent()) event.preventDefault();
  };
  return (
    <a href={`#${MAIN_CONTENT_FALLBACK_ID}`} className="skip-link" onClick={onClick} data-testid="skip-to-content">
      Skip to main content
    </a>
  );
}
