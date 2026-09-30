/* Bundles the gallery entry (TypeScript + the diagram stylesheet) into lab/,
   which is ignored. Usage: node scrollcraft/diagrams/build-gallery.mjs */
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lab = resolve(here, "lab");
mkdirSync(lab, { recursive: true });

await build({
  entryPoints: [resolve(here, "gallery-entry.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile: resolve(lab, "gallery.js"),
  logLevel: "info",
});
copyFileSync(resolve(here, "../../client/src/diagrams/diagrams.css"), resolve(lab, "gallery.css"));
console.log("gallery built into", lab);
