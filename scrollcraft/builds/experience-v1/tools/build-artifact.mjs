/**
 * Single-file build of the experience for review as a claude.ai artifact.
 *
 * The served build keeps the vendored ES module; an artifact is one HTML file
 * with no sibling files, so this bundles scene.js + three.js into one classic
 * script with esbuild, inlines the engine, the glue, the stylesheet, the three
 * fonts and the five stills as data URIs, and strips the document wrapper (the
 * artifact host supplies doctype/html/head/body).
 *
 *   node scrollcraft/builds/experience-v1/tools/build-artifact.mjs <out.html>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const B = path.resolve("scrollcraft/builds/experience-v1");
const out = process.argv[2] || path.join(B, "lab", "de-experience-v1.artifact.html");
const read = (p) => readFileSync(path.join(B, p), "utf8");
const dataUri = (p, mime) => `data:${mime};base64,${readFileSync(path.join(B, p)).toString("base64")}`;

const bundle = execFileSync("npx", ["esbuild", path.join(B, "scene.js"), "--bundle", "--format=iife", "--global-name=SceneModule", "--minify", "--log-level=error"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

let html = read("index.html");
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];

// replacement strings go through a function: minified code is full of "$&"
// and "$1", which String.replace would otherwise expand into the match
const lit = (s) => () => s;
let headOut = head
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, "")
  .replace(/<link rel="stylesheet" href="scrollcraft.css">/, lit(`<style>${read("scrollcraft.css")}</style>`))
  .replace(/<meta name="viewport"[^>]*>\s*/, "")
  .replace(/<meta charset="utf-8">\s*/, "");
for (const f of ["space-grotesk-latin", "inter-latin", "oxanium-latin"]) {
  headOut = headOut.replace(`assets/fonts/${f}.woff2`, lit(dataUri(`assets/fonts/${f}.woff2`, "font/woff2")));
}
body = body.replace("assets/logo.webp", lit(dataUri("assets/logo.webp", "image/webp")));
for (let i = 1; i <= 3; i++) {
  for (const p of ["s", "m"]) {
    const f = `assets/stills/${p}0${i}.webp`;
    body = body.split(f).join(dataUri(f, "image/webp"));
  }
}
body = body
  .replace('<script src="scrollcraft.js"></script>', lit(`<script>${read("scrollcraft.js")}</script>`))
  .replace('<script src="experience.js"></script>',
    lit(`<script>window.__xArtifact=1;</script>\n<script>${bundle}\nwindow.__sceneModule=SceneModule;</script>\n<script>${read("experience.js")}</script>`));
if (/<\/script>/.test(bundle) || /<\/script>/.test(read("scene.js"))) throw new Error("a script contains </script>; escape it before inlining");

// the engine mounts on document.body; inside the artifact host that is still the page body
writeFileSync(out, `${headOut.trim()}\n${body.trim()}\n`);
console.log(`${out}  ${(readFileSync(out).length / 1024).toFixed(0)} KB (bundle ${(bundle.length / 1024).toFixed(0)} KB)`);
