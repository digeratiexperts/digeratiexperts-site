import fs from "fs";
import path from "path";
import { normalizeSpaPath } from "./spaKnownPaths";

/**
 * Serves the build-time prerendered body (scripts/prerender/prerender.mjs) inside the
 * HTML shell, so a crawler that does not run JavaScript still gets the page's H1, copy,
 * links and structured content.
 *
 * Shape sent:   <div id="de-prerender">…snapshot…</div><div id="root" hidden></div>
 * The app renders into the hidden #root and client/src/prerenderSwap.ts removes the
 * snapshot and un-hides #root once the real page has rendered, so there is no flash of
 * the loading skeleton and no hydration-mismatch risk (the app is not hydrated; it
 * renders fresh exactly as before). Missing or unreadable snapshots fall back to the
 * plain shell, which is the pre-prerender behavior.
 */

type Entry = { file: string; styles?: string[] };
type Manifest = { routes: Record<string, Entry> };

const ROOT_DIV = '<div id="root"></div>';

let cache: { dir: string; mtimeMs: number; manifest: Manifest } | undefined;

function loadManifest(dir: string): Manifest | undefined {
  const file = path.join(dir, "manifest.json");
  try {
    const stat = fs.statSync(file);
    if (!cache || cache.dir !== dir || cache.mtimeMs !== stat.mtimeMs) {
      cache = { dir, mtimeMs: stat.mtimeMs, manifest: JSON.parse(fs.readFileSync(file, "utf8")) as Manifest };
    }
    return cache.manifest;
  } catch {
    return undefined;
  }
}

/** The snapshot body and the route's lazy-chunk stylesheets, or undefined when none exists. */
export function prerenderFor(dir: string, pathname: string): { html: string; styles: string[] } | undefined {
  // The prerender run itself must render the live app, never an older snapshot.
  if (process.env.DE_PRERENDER === "1") return undefined;
  const manifest = loadManifest(dir);
  const entry = manifest?.routes?.[normalizeSpaPath(pathname)];
  if (!entry || !/^[a-zA-Z0-9_-]+\.html$/.test(entry.file)) return undefined;
  try {
    const html = fs.readFileSync(path.join(dir, entry.file), "utf8");
    const styles = (entry.styles ?? []).filter((href) => /^\/assets\/[\w.-]+\.css$/.test(href));
    return { html, styles };
  } catch {
    return undefined;
  }
}

/** Puts a snapshot into the shell. Returns the shell unchanged when it has no empty root div. */
export function applyPrerender(shell: string, snap: { html: string; styles: string[] } | undefined): string {
  if (!snap || !shell.includes(ROOT_DIV)) return shell;
  let out = shell;
  // The route's own CSS chunk loads only with its JS chunk; link it up front so the
  // snapshot is styled before the app runs.
  const links = snap.styles
    .filter((href) => !out.includes(`href="${href}"`))
    .map((href) => `    <link rel="stylesheet" crossorigin href="${href}">`)
    .join("\n");
  if (links) out = out.replace("</head>", () => `${links}\n  </head>`);
  return out.replace(
    ROOT_DIV,
    () => `<div id="de-prerender" data-prerendered="true">${snap.html}</div><div id="root" hidden></div>`,
  );
}
