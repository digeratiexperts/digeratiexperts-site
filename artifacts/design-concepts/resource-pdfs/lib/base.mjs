// Shared plumbing for the resource-PDF concepts: fonts, logo, escaping, page shell.
// Concepts differ in art direction only; content comes from ../content/*.json.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const REPO = path.resolve(ROOT, "../../..");

const fontUrl = (f) => pathToFileURL(path.join(ROOT, "fonts", f)).href;

// Static instances (not variable fonts): Chromium embeds variable fonts as
// Type 3, which prints poorly and fails accessibility checkers. See fonts/README.md.
export const FONT_FACES = `
@font-face{font-family:"Inter";src:url("${fontUrl("inter-400.ttf")}") format("truetype");font-weight:400;font-style:normal}
@font-face{font-family:"Inter";src:url("${fontUrl("inter-500.ttf")}") format("truetype");font-weight:500;font-style:normal}
@font-face{font-family:"Inter";src:url("${fontUrl("inter-600.ttf")}") format("truetype");font-weight:600;font-style:normal}
@font-face{font-family:"Inter";src:url("${fontUrl("inter-700.ttf")}") format("truetype");font-weight:700;font-style:normal}
@font-face{font-family:"Inter";src:url("${fontUrl("inter-italic-400.ttf")}") format("truetype");font-weight:400;font-style:italic}
@font-face{font-family:"Newsreader Display";src:url("${fontUrl("newsreader-400-o72.ttf")}") format("truetype");font-weight:400;font-style:normal}
@font-face{font-family:"Newsreader";src:url("${fontUrl("newsreader-400-o16.ttf")}") format("truetype");font-weight:400;font-style:normal}
@font-face{font-family:"Newsreader";src:url("${fontUrl("newsreader-500-o24.ttf")}") format("truetype");font-weight:500;font-style:normal}
@font-face{font-family:"Newsreader";src:url("${fontUrl("newsreader-italic-400-o16.ttf")}") format("truetype");font-weight:400;font-style:italic}
@font-face{font-family:"Space Grotesk";src:url("${fontUrl("space-grotesk-400.ttf")}") format("truetype");font-weight:400;font-style:normal}
@font-face{font-family:"Space Grotesk";src:url("${fontUrl("space-grotesk-500.ttf")}") format("truetype");font-weight:500;font-style:normal}
@font-face{font-family:"Space Grotesk";src:url("${fontUrl("space-grotesk-600.ttf")}") format("truetype");font-weight:600;font-style:normal}
@font-face{font-family:"Space Grotesk";src:url("${fontUrl("space-grotesk-700.ttf")}") format("truetype");font-weight:700;font-style:normal}
@font-face{font-family:"Plex Mono";src:url("${fontUrl("plex-mono-400.ttf")}") format("truetype");font-weight:400;font-style:normal}
@font-face{font-family:"Plex Mono";src:url("${fontUrl("plex-mono-500.ttf")}") format("truetype");font-weight:500;font-style:normal}
@font-face{font-family:"Plex Mono";src:url("${fontUrl("plex-mono-600.ttf")}") format("truetype");font-weight:600;font-style:normal}
`;

/** Brand lockups from brand/ (source of truth). Strip the root <title> so the
 *  PDF tag tree gets one alt text from our wrapper, not two. */
function logo(file) {
  return readFileSync(path.join(REPO, "brand", file), "utf8")
    .replace(/<\?xml[^>]*>/, "")
    .replace(/<title>.*?<\/title>/, "")
    .replace(/role="img"/, "")
    .replace(/aria-label="[^"]*"/, 'aria-hidden="true" focusable="false"');
}
export const LOGO = {
  light: logo("digerati-logo.svg"),
  reverse: logo("digerati-logo-reverse.svg"),
  mono: logo("digerati-logo-mono-black.svg"),
};
export const logoFigure = (svg, cls = "logo") =>
  `<span class="${cls}" role="img" aria-label="Digerati Experts">${svg}</span>`;

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function loadContent(name) {
  return JSON.parse(readFileSync(path.join(ROOT, "content", `${name}.json`), "utf8"));
}

/** Document shell. `css` is the concept stylesheet, `body` its pages. */
export function documentShell({ c, css, body, conceptLabel }) {
  return `<!doctype html>
<html lang="${c.lang}">
<head>
<meta charset="utf-8">
<title>${esc(c.titleFull)} Datasheet | Digerati Experts</title>
<meta name="author" content="Digerati Experts">
<meta name="description" content="${esc(c.subtitle)}">
<meta name="generator" content="DE document system concept: ${esc(conceptLabel)}">
<style>
${FONT_FACES}
@page{size:Letter;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;height:11in;position:relative;overflow:hidden;break-after:page;margin:0 !important}
.page:last-child{break-after:auto}
.logo svg{display:block;height:100%;width:auto}
a{color:inherit}
ul,ol{list-style:none}
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
