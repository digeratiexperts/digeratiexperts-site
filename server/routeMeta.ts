import fs from "fs";
import routeMetaSnapshot from "../shared/routeMeta.json";
import { normalizeSpaPath } from "./spaKnownPaths";

/**
 * Per-route head tags in the HTML the server sends.
 *
 * index.html is one file for every route, so before JavaScript ran every page
 * had the homepage's title, description and social tags and no canonical.
 * shared/routeMeta.json records what each sitemap page sets for itself in the
 * browser (scripts/route-meta/snapshot.mjs; CI fails when it is stale), and
 * this writes those values into the shell. The client then sets the same
 * values again, so nothing changes once the page has loaded.
 */

export type RouteMeta = {
  title: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogImage?: string;
};

const SITE = "https://digeratiexperts.com";
const SNAPSHOT = routeMetaSnapshot as Record<string, RouteMeta>;

export function routeMetaFor(pathname: string, snapshot: Record<string, RouteMeta> = SNAPSHOT): RouteMeta | undefined {
  return snapshot[normalizeSpaPath(pathname)];
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Sets `<meta {attr}="{key}" content="…">`, adding it before </head> when the shell has none. */
function setMeta(html: string, attr: "name" | "property", key: string, value: string): string {
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(value)}">`;
  const existing = new RegExp(`<meta\\s+${attr}="${key.replace(/[.:]/g, "\\$&")}"[^>]*>`, "i");
  return existing.test(html) ? html.replace(existing, () => tag) : html.replace("</head>", () => `    ${tag}\n  </head>`);
}

export function applyRouteMeta(html: string, meta: RouteMeta | undefined): string {
  if (!meta?.title) return html;
  let out = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeText(meta.title)}</title>`);
  out = setMeta(out, "name", "title", meta.title);
  out = setMeta(out, "property", "og:title", meta.title);
  out = setMeta(out, "name", "twitter:title", meta.title);
  if (meta.description) {
    out = setMeta(out, "name", "description", meta.description);
    out = setMeta(out, "property", "og:description", meta.description);
    out = setMeta(out, "name", "twitter:description", meta.description);
  }
  if (meta.robots) out = setMeta(out, "name", "robots", meta.robots);
  if (meta.ogImage) {
    // Social crawlers need an absolute image URL; blog covers are recorded as site paths.
    const image = meta.ogImage.startsWith("/") ? `${SITE}${meta.ogImage}` : meta.ogImage;
    out = setMeta(out, "property", "og:image", image);
    out = setMeta(out, "name", "twitter:image", image);
  }
  if (meta.canonical) {
    const href = meta.canonical.startsWith("/") ? `${SITE}${meta.canonical}` : meta.canonical;
    out = setMeta(out, "property", "og:url", href);
    out = setMeta(out, "name", "twitter:url", href);
    // data-rh lets react-helmet-async (DefaultCanonical) adopt or replace this tag instead of adding a second canonical.
    if (!/<link\s+rel="canonical"/i.test(out)) {
      out = out.replace("</head>", () => `    <link rel="canonical" href="${escapeAttr(href)}" data-rh="true">\n  </head>`);
    }
  }
  return out;
}

let shellCache: { path: string; mtimeMs: number; html: string; lastModified: string } | undefined;

/** index.html, read once per build (re-read when its mtime changes). */
export function readIndexShell(indexPath: string): { html: string; lastModified: string } {
  const stat = fs.statSync(indexPath);
  if (!shellCache || shellCache.path !== indexPath || shellCache.mtimeMs !== stat.mtimeMs) {
    shellCache = { path: indexPath, mtimeMs: stat.mtimeMs, html: fs.readFileSync(indexPath, "utf8"), lastModified: stat.mtime.toUTCString() };
  }
  return shellCache;
}
