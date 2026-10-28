import { beginPageVisit, disableAnalytics, isPortalContext } from "./analytics";

let documentPortalContext: boolean | undefined;

/** Never render a new privacy context in a document with the old SDKs. */
export function isAnalyticsDocumentContextCurrent(): boolean {
  return documentPortalContext === undefined || documentPortalContext ===
    isPortalContext(window.location.hostname, window.location.pathname);
}

export function installAnalyticsNavigationBoundary(w: Window = window) {
  if (documentPortalContext !== undefined) return;
  documentPortalContext = isPortalContext(w.location.hostname, w.location.pathname);
  let pathname = w.location.pathname;

  for (const method of ["pushState", "replaceState"] as const) {
    const original = w.history[method].bind(w.history);
    w.history[method] = (data, unused, url) => {
      const target = new URL(url == null ? w.location.href : String(url), w.location.href);
      // Preserve native cross-origin SecurityError behavior.
      if (target.origin === w.location.origin &&
          isPortalContext(target.hostname, target.pathname) !== documentPortalContext) {
        disableAnalytics();
        if (method === "replaceState") w.location.replace(target.href);
        else w.location.assign(target.href);
        return;
      }
      if (target.origin === w.location.origin && target.pathname !== pathname) {
        beginPageVisit();
      }
      original(data, unused, url);
      pathname = w.location.pathname;
    };
  }

  const restore = (event: Event) => {
    if (isPortalContext(w.location.hostname, w.location.pathname) !== documentPortalContext) {
      disableAnalytics();
      event.stopImmediatePropagation();
      w.location.reload();
      return;
    }
    if (w.location.pathname !== pathname) beginPageVisit();
    pathname = w.location.pathname;
  };
  // Installed before vendor scripts and React subscribers. Normal cross-context
  // history entries are already separate documents; also fail closed on an old
  // session's same-document entries or BFCache restoration.
  w.addEventListener("popstate", restore, true);
  w.addEventListener("pageshow", restore, true);
}
