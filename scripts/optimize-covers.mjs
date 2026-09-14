#!/usr/bin/env node
/**
 * B-4 — Blog cover WebP siblings (no AI).
 * Mirrors the store sharp recipe: q80, ≤1600 px long edge.
 * PNG remains the og:image / crawler source; UI prefers WebP via webImage.ts.
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "client/public/assets/covers/blog");
const MAX_EDGE = 1600;
const QUALITY = 80;

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("sharp is required. Install with: npm i -D sharp");
    process.exit(1);
  }

  const names = (await readdir(BLOG_DIR)).filter((n) => n.toLowerCase().endsWith(".png"));
  const report = [];

  for (const name of names) {
    const pngPath = path.join(BLOG_DIR, name);
    const webpPath = pngPath.replace(/\.png$/i, ".webp");
    const img = sharp(pngPath);
    const meta = await img.metadata();
    const width = meta.width ?? MAX_EDGE;
    const height = meta.height ?? MAX_EDGE;
    const long = Math.max(width, height);
    const pipeline =
      long > MAX_EDGE
        ? img.resize({
            width: width >= height ? MAX_EDGE : undefined,
            height: height > width ? MAX_EDGE : undefined,
            fit: "inside",
            withoutEnlargement: true,
          })
        : img;

    await pipeline.webp({ quality: QUALITY }).toFile(webpPath);
    const [pngStat, webpStat] = await Promise.all([stat(pngPath), stat(webpPath)]);
    report.push({
      png: name,
      webp: path.basename(webpPath),
      pngBytes: pngStat.size,
      webpBytes: webpStat.size,
      dims: `${width}x${height}`,
    });
    console.log(`ok ${name} → ${path.basename(webpPath)}`);
  }

  console.log(JSON.stringify({ count: report.length, report }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
