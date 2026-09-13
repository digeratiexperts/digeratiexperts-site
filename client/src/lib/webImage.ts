/**
 * Public-asset PNGs that have a generated WebP sibling (2026-09-13, sharp q80):
 * blog covers under /assets/covers/blog (16.5 MB → 0.6 MB). The UI loads the
 * WebP; og:image / structured data keep the PNG for social crawlers.
 */
const WEBP_READY_PREFIXES = ["/assets/covers/blog/"];

export function toWebImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.endsWith(".png") && WEBP_READY_PREFIXES.some((p) => url.startsWith(p))) {
    return url.slice(0, -4) + ".webp";
  }
  return url;
}
