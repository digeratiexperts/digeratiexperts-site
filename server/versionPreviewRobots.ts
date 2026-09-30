import type { Express } from "express";

/**
 * Homepage version previews (`/versions`, `/version-1` … `/version-N`) are
 * reference copies of past and candidate homepages. They must never compete
 * with the canonical pages in search.
 *
 * `VersionFrame` already asks for `noindex` through `useSEO`, but that only
 * exists once React has hydrated. The HTML the server actually sends carries
 * the app shell's default `<meta name="robots" content="index, follow">`, so a
 * crawler that does not run JavaScript sees an indexable 200. This header is
 * the control that does not depend on hydration; the client-side `noindex`
 * stays as the second layer.
 *
 * Deliberately NOT a `robots.txt` Disallow. A Disallow stops a crawler
 * fetching the page at all, and a page it cannot fetch is a page whose
 * `noindex` it can never read — those URLs can still be indexed from links
 * alone, which trades one SEO problem for a quieter one. Same reasoning as the
 * `/v2` and `/scrollcraft` previews already served with this header.
 */
export const VERSION_PREVIEW_ROBOTS_TAG = "noindex, nofollow";

/**
 * `/versions`, `/version-4`, `/version-4/` and their case variants, and
 * nothing else. Marketing routes must not pick the header up.
 */
const VERSION_PREVIEW_PATH = /^\/versions?(?:-\d+)?\/?$/i;

export function isVersionPreviewPath(pathname: string): boolean {
  return VERSION_PREVIEW_PATH.test(pathname);
}

/**
 * Registers before the SPA catch-all so the header rides every response for
 * these paths, whichever handler ends up serving them.
 */
export function registerVersionPreviewRobots(app: Express): void {
  app.use((req, res, next) => {
    if (isVersionPreviewPath(req.path)) {
      res.setHeader("X-Robots-Tag", VERSION_PREVIEW_ROBOTS_TAG);
    }
    next();
  });
}
