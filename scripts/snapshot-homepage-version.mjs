#!/usr/bin/env node
/**
 * Freeze the homepage composition as a numbered, reachable version.
 *
 *   node scripts/snapshot-homepage-version.mjs <n> [<git-ref>]
 *
 * Copies client/src/pages/DigeratiHomepage.tsx and every section it imports
 * (plus components those sections import from the paths listed in
 * LOCALISE) into client/src/pages/versions/v<n>/, from the working tree by
 * default or from a git ref when one is given (e.g. origin/main). Each file
 * gets a FROZEN header. The snapshot is then routed at /version-<n> by
 * client/src/App.tsx through client/src/pages/versions/registry.ts.
 *
 * Rules: a frozen version is never edited; start a new number instead.
 * Shared primitives (buttons, deck, data, hooks) stay live on purpose; the
 * composition and the copy are what a version preserves.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [nArg, ref] = process.argv.slice(2);
const n = Number(nArg);
if (!Number.isInteger(n) || n < 1) {
  console.error("usage: node scripts/snapshot-homepage-version.mjs <n> [<git-ref>]");
  process.exit(2);
}

const ROOT = path.resolve(import.meta.dirname, "..");
const HOMEPAGE = "client/src/pages/DigeratiHomepage.tsx";
const SECTIONS_DIR = "client/src/pages/sections";
// components a section may import that carry homepage-specific composition;
// they are copied into the version folder and the import is rewritten
const LOCALISE = {
  "@/components/EcosystemProgression": "client/src/components/EcosystemProgression.tsx",
};
const OUT = path.join(ROOT, "client/src/pages/versions", `v${n}`);

function read(rel) {
  if (ref) return execFileSync("git", ["show", `${ref}:${rel}`], { cwd: ROOT, encoding: "utf8" });
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
const stamp = new Date().toISOString().slice(0, 10);
const source = ref ? `git ref ${ref}` : "the working tree";
const header = (rel) =>
  `// FROZEN — homepage version ${n}, snapshot of ${rel} from ${source} on ${stamp}.\n` +
  `// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.\n`;

if (fs.existsSync(OUT)) {
  console.error(`refusing to overwrite ${path.relative(ROOT, OUT)}; a frozen version is never regenerated`);
  process.exit(1);
}
fs.mkdirSync(path.join(OUT, "sections"), { recursive: true });

let home = read(HOMEPAGE);
const sectionNames = [...home.matchAll(/from ["']\.\/sections\/([A-Za-z0-9_]+)["']/g)].map((m) => m[1]);
if (!sectionNames.length) {
  console.error("no ./sections imports found in the homepage file");
  process.exit(1);
}
// structured data belongs to the canonical homepage only
home = home
  .replace(/^import \{[^}]*JsonLd[^}]*\} from "@\/components\/JsonLd";\n/m, "")
  .replace(/^\s*<OrganizationJsonLd \/>\n/m, "")
  .replace(/^\s*<WebSiteJsonLd \/>\n/m, "");
fs.writeFileSync(path.join(OUT, "DigeratiHomepage.tsx"), header(HOMEPAGE) + home);

const localised = new Set();
for (const name of sectionNames) {
  const rel = `${SECTIONS_DIR}/${name}.tsx`;
  let src = read(rel);
  src = src.replace(/from ["']@\/pages\/sections\/([A-Za-z0-9_]+)["']/g, 'from "./$1"');
  for (const [spec, file] of Object.entries(LOCALISE)) {
    if (src.includes(`from "${spec}"`) || src.includes(`from '${spec}'`)) {
      const base = path.basename(file, ".tsx");
      src = src.replace(new RegExp(`from ["']${spec.replace(/[/@]/g, (c) => `\\${c}`)}["']`, "g"), `from "../${base}"`);
      if (!localised.has(file)) {
        fs.writeFileSync(path.join(OUT, `${base}.tsx`), header(file) + read(file));
        localised.add(file);
      }
    }
  }
  fs.writeFileSync(path.join(OUT, "sections", `${name}.tsx`), header(rel) + src);
}

console.log(`version ${n}: ${sectionNames.length} sections + ${localised.size} localised component(s) from ${source} → ${path.relative(ROOT, OUT)}`);
console.log("next: add the entry to client/src/pages/versions/registry.ts and the route in client/src/App.tsx");
