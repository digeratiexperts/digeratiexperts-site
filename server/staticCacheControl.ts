/**
 * Cache-Control for files the production server serves from dist/public.
 *
 * Only Vite's content-hashed output may be cached forever: its name changes
 * whenever its content does. Vite writes that output flat into assets/;
 * client/public/assets/* (the resource PDFs and cover images) lands in
 * subfolders of assets/ under its own, unchanging names.
 *
 * Everything else keeps its name across deploys, so a long cache pins a
 * returning visitor to an old copy. Until 2026-10-02 those files fell through
 * to a one-year default: release.txt (the deploy marker written on the server),
 * site.webmanifest, .well-known/security.txt, the resource PDFs, and, marked
 * immutable, the self-hosted fonts and the pdf.js vendor files.
 */

const NO_STORE = "no-cache, no-store, must-revalidate";
const HASHED = "public, max-age=31536000, immutable";
const IMAGE = "public, max-age=2592000";
const REVALIDATE_DAILY = "public, max-age=86400, must-revalidate";

/** `relativePath` is relative to dist/public, with either slash. */
export function cacheControlFor(relativePath: string): string {
  const p = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (p === "release.txt" || p.endsWith(".html")) return NO_STORE;
  if (/^assets\/[^/]+$/.test(p)) return HASHED;
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(p)) return IMAGE;
  return REVALIDATE_DAILY;
}
