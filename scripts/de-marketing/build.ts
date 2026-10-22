/**
 * Builds every session's marketing kit from docs/marketing/sessions/<slug>.yaml.
 *
 * Usage:  npx tsx scripts/de-marketing/build.ts            write kits, emails, posts, preview
 *         npx tsx scripts/de-marketing/build.ts --cards    also re-render the social card PNGs
 *         npx tsx scripts/de-marketing/build.ts --check    fail if anything is stale or fails lint
 *         npx tsx scripts/de-marketing/build.ts --standalone <file>
 *                                                          one self-contained preview (cards inlined)
 *
 * What it writes and the rules it enforces: render.ts. Voice: docs/marketing/VOICE.md.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { lint, loadKits, renderAll, ROOT } from "./render";

const args = process.argv.slice(2);
const check = args.includes("--check");
const kits = loadKits();

const problems = kits.flatMap(lint);
if (problems.length) {
  console.error(`Copy lint failed (docs/marketing/VOICE.md, docs/CLAIMS-REGISTER.md):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

const files = renderAll(kits);
let stale = 0;
for (const [rel, content] of files) {
  const abs = resolve(ROOT, rel);
  const current = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  if (current === content) continue;
  if (check) {
    console.error(`stale: ${rel}`);
    stale++;
  } else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`wrote ${rel}`);
  }
}
if (check) {
  if (stale) {
    console.error("Run: npx tsx scripts/de-marketing/build.ts");
    process.exit(1);
  }
  console.log(`${files.size} files fresh, lint clean`);
}

if (args.includes("--cards")) {
  const { renderCards } = await import("./cards");
  for (const f of await renderCards(kits)) console.log(`wrote ${f.slice(ROOT.length + 1)}`);
}

const sa = args.indexOf("--standalone");
if (sa >= 0) {
  const target = resolve(args[sa + 1]);
  const base = resolve(ROOT, "docs/marketing/sessions");
  const html = (files.get("docs/marketing/sessions/preview.html") ?? "").replace(
    /(src|href)="(out\/[^"]+\.png)"/g,
    (_, attr: string, p: string) => `${attr}="data:image/png;base64,${readFileSync(resolve(base, p)).toString("base64")}"`,
  );
  writeFileSync(target, html);
  console.log(`wrote ${target}`);
}
