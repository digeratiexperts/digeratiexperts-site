#!/usr/bin/env node
/**
 * Homepage Version 5 acceptance: the definition of "done" for /version-5.
 *
 * Joe, 2026-09-30: "make a way to know you will be successful and not fail."
 * This script is that way. It runs against a served production build and
 * fails on anything a visitor would call not practical, not real, or not nice.
 * Each check names the mistake it guards against.
 *
 *   npm run build
 *   NODE_ENV=production DE_SMOKE_ALLOW_MEMORY_ONLY=1 JWT_SECRET=... MFA_ENCRYPTION_KEY=... SESSION_SECRET=... \
 *     PORT=4173 node dist/index.js &
 *   node scripts/qa/homepage-v5-acceptance.mjs --url http://localhost:4173/version-5 --out artifacts/visual-qa/homepage-v5
 *
 * Production mode matters: the dev server's /@fs/ module paths fail the image,
 * transfer and console checks for reasons unrelated to the page (ACCEPTANCE.md).
 *
 * Exit code 1 on any failure. Screenshots and REPORT.md land in --out.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] ?? "true"] : [])).filter((p) => p.length),
);
const URL_ = args.url ?? "http://localhost:4173/version-5";
const OUT = path.resolve(args.out ?? "artifacts/visual-qa/homepage-v5");
const ROOT = path.resolve(args.root ?? process.cwd());
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

/** Every figure on the page must appear verbatim in one of these files. */
const FACT_SOURCES = [
  "client/src/data/pricing.ts",
  "client/src/pages/legal/SLA.tsx",
  "shared/companyContact.ts",
  "client/src/pages/about/Guarantee.tsx",
];
const FIGURE_PATTERNS = [
  /\$\d[\d,]*(?:\.\d+)?/g,
  /\b\d+(?:\.\d+)?%/g,
  /\b\d+[\s-](?:minutes?|hours?|days?|business days?)\b/gi,
  /24\/7(?:\/365)?/g,
];
function figuresIn(text) {
  const out = new Set();
  for (const re of FIGURE_PATTERNS) for (const m of text.matchAll(re)) out.add(m[0].replace(/\s+/g, " ").toLowerCase());
  return out;
}
const allowedFigures = new Set();
for (const f of FACT_SOURCES) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  for (const fig of figuresIn(src)) allowedFigures.add(fig);
  // pricing.ts stores numbers, not formatted strings: derive the display forms.
  if (f.endsWith("pricing.ts")) {
    for (const m of src.matchAll(/(?:user|monthlyMinimum): (\d+)/g)) {
      allowedFigures.add(`$${Number(m[1]).toLocaleString("en-US")}`.toLowerCase());
    }
  }
}
allowedFigures.add(`${new Date().getFullYear()}`); // copyright year is not a claim

const EXPECTED_SECTIONS = ["What we do", "Who we work with", "How it works", "Pricing", "Response times", "Questions", "Contact"];
const IMAGE_ALLOW = /^\/(images\/founder\/|assets\/)/;
const MAX_WORDS = 1200;
const MAX_VIEWPORTS = { phone: 14, tablet: 11, desktop: 9 };
const MAX_BYTES = 1_500_000;

const results = [];
function check(id, viewport, ok, detail = "") {
  results.push({ id, viewport, ok: Boolean(ok), detail: String(detail).slice(0, 600) });
}

function lum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const chromePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1234/chrome-linux/chrome";
const browser = await chromium.launch(fs.existsSync(chromePath) ? { executablePath: chromePath } : {});
const origin = new URL(URL_).origin;

try {
  // Server-level: the preview must be noindex before hydration.
  {
    const ctx = await browser.newContext();
    const res = await ctx.request.get(URL_);
    check("server: 200", "-", res.status() === 200, `status ${res.status()}`);
    check("server: X-Robots-Tag noindex", "-", (res.headers()["x-robots-tag"] ?? "").includes("noindex"), res.headers()["x-robots-tag"] ?? "(none)");
    await ctx.close();
  }

  for (const vp of VIEWPORTS) {
    for (const reduced of [false, true]) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: reduced ? "reduce" : "no-preference",
        isMobile: vp.width < 768,
        hasTouch: vp.width < 768,
      });
      const page = await ctx.newPage();
      const consoleErrors = [];
      let bytes = 0;
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const src = m.location()?.url ?? "";
        if (/api\/public\/reviews/.test(m.text())) return;
        if (src && !src.startsWith(origin) && !src.startsWith("about:")) return; // third-party resource, not this page's code
        consoleErrors.push(`${m.text()}${src ? ` (${src})` : ""}`);
      });
      page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
      page.on("response", async (r) => {
        try {
          const u = new URL(r.url());
          if (u.origin === origin && r.status() === 200) bytes += (await r.body()).length;
        } catch {}
      });
      await page.goto(URL_, { waitUntil: "networkidle" });
      await page.waitForSelector(".v5 h1", { timeout: 15000 });
      // The site-wide cookie banner is answered once by a real visitor; the frames show the page after that.
      await page.locator('button:has-text("Reject All")').first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
      const tag = reduced ? `${vp.name}-reduced` : vp.name;

      if (!reduced) {
        // ---- The ten-second test: what, for whom, one action, a phone, above the fold.
        const fold = await page.evaluate(() => {
          const H = window.innerHeight;
          const vis = (el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && r.top < H && r.bottom > 0 && cs.visibility !== "hidden" && cs.display !== "none";
          };
          const h1 = document.querySelector(".v5 h1");
          const ctas = [...document.querySelectorAll('.v5 [data-v5-cta="primary"]')];
          const tels = [...document.querySelectorAll('.v5 a[href^="tel:"]')].filter(vis);
          const textAbove = [...document.querySelectorAll(".v5 *")]
            .filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
            .map((el) => el.textContent)
            .join(" ");
          return {
            h1: h1?.textContent?.trim() ?? "",
            h1Visible: h1 ? vis(h1) : false,
            ctaVisible: ctas.some(vis),
            ctaHrefs: [...new Set(ctas.map((a) => a.getAttribute("href")))],
            ctaLabels: [...new Set(ctas.map((a) => a.textContent.trim()))],
            telVisible: tels.length > 0,
            saysArizona: /arizona/i.test(textAbove),
            saysWhat: /(managed it|cybersecurity|it support)/i.test(textAbove),
          };
        });
        check("fold: H1 visible", tag, fold.h1Visible, fold.h1);
        check("fold: H1 is one sentence (≤ 12 words)", tag, fold.h1.split(/\s+/).length <= 12, `${fold.h1.split(/\s+/).length} words`);
        check("fold: says what we do", tag, fold.saysWhat);
        check("fold: says Arizona", tag, fold.saysArizona);
        check("fold: primary action visible", tag, fold.ctaVisible);
        check("fold: one primary action everywhere (same target, same words)", tag, fold.ctaHrefs.length === 1 && fold.ctaLabels.length === 1, `${fold.ctaHrefs.join(", ")} / ${fold.ctaLabels.join(" | ")}`);
        check("fold: a phone number you can tap", tag, fold.telVisible);

        // ---- Real, not invented: every figure traces to a source file.
        const pageText = await page.evaluate(() => document.querySelector(".v5")?.innerText ?? "");
        const found = figuresIn(pageText);
        const unsourced = [...found].filter((f) => !allowedFigures.has(f));
        check("truth: every figure appears verbatim in a source file", tag, unsourced.length === 0, unsourced.length ? `unsourced: ${unsourced.join(", ")}` : `${found.size} figures, all sourced`);

        // ---- Practical: short, conventional, in order.
        const words = pageText.split(/\s+/).filter(Boolean).length;
        check(`practical: ≤ ${MAX_WORDS} words`, tag, words <= MAX_WORDS, `${words} words`);
        const labels = await page.$$eval(".v5 main section .v5-eyebrow", (els) => els.map((e) => e.textContent.trim()));
        let idx = 0;
        for (const h of labels) if (idx < EXPECTED_SECTIONS.length && h.toLowerCase().includes(EXPECTED_SECTIONS[idx].toLowerCase())) idx++;
        check("practical: sections in the conventional order", tag, idx === EXPECTED_SECTIONS.length, labels.join(" › "));
        const heightVp = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
        check(`practical: page ≤ ${MAX_VIEWPORTS[vp.name]} viewports tall`, tag, heightVp <= MAX_VIEWPORTS[vp.name], `${heightVp.toFixed(1)} viewports`);
        const media = await page.evaluate(() => document.querySelectorAll(".v5 video, .v5 iframe").length);
        check("practical: no video or iframe", tag, media === 0, `${media}`);

        // ---- Nice: it holds together on this screen.
        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        check("layout: no horizontal scroll", tag, overflow.sw <= overflow.iw, `scrollWidth ${overflow.sw} / innerWidth ${overflow.iw}`);
        const small = await page.$$eval(".v5 p, .v5 li, .v5 td, .v5 dd, .v5 summary, .v5 figcaption", (els) =>
          els
            .filter((e) => e.getClientRects().length && e.textContent.trim())
            .map((e) => ({ px: parseFloat(getComputedStyle(e).fontSize), t: e.textContent.trim().slice(0, 40) }))
            .filter((x) => x.px < 15),
        );
        check("type: body copy at least 15px", tag, small.length === 0, small.map((s) => `${s.px}px "${s.t}"`).slice(0, 5).join("; "));
        const targets = await page.$$eval(".v5 .v5-btn, .v5 .v5-nav a, .v5 .v5-menu summary, .v5 .v5-menu-panel a, .v5 .v5-chips a, .v5 .v5-faq summary, .v5 .v5-phone", (els) =>
          els
            .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden")
            .map((e) => ({ h: e.getBoundingClientRect().height, t: e.textContent.trim().slice(0, 30) }))
            .filter((x) => x.h < 44),
        );
        check("touch: buttons and menu items at least 44px tall", tag, targets.length === 0, targets.map((t) => `${t.h.toFixed(0)}px "${t.t}"`).slice(0, 5).join("; "));

        const contrastRows = await page.evaluate(() => {
          const parse = (s) => {
            const m = s.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(",").map((x) => parseFloat(x));
            return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
          };
          const bgOf = (el) => {
            let acc = null; // composite from the element upward
            let node = el;
            const layers = [];
            while (node && node !== document.documentElement) {
              const cs = getComputedStyle(node);
              if (cs.backgroundImage !== "none") return null;
              const c = parse(cs.backgroundColor);
              if (c && c.a > 0) layers.push(c);
              if (c && c.a >= 1) break;
              node = node.parentElement;
            }
            let base = [255, 255, 255];
            for (let i = layers.length - 1; i >= 0; i--) {
              const l = layers[i];
              base = base.map((ch, k) => Math.round(l.rgb[k] * l.a + ch * (1 - l.a)));
            }
            acc = base;
            return acc;
          };
          const rows = [];
          for (const el of document.querySelectorAll(".v5 *")) {
            if (el.closest('[data-testid="homepage-version-ribbon"]')) continue;
            if (!el.getClientRects().length) continue;
            if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
            const fg = parse(cs.color);
            const bg = bgOf(el);
            if (!fg || !bg) continue;
            rows.push({ fg: fg.rgb, bg, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, text: el.textContent.trim().slice(0, 40) });
          }
          return rows;
        });
        const lowContrast = contrastRows
          .map((r) => ({ ...r, ratio: contrast(r.fg, r.bg) }))
          .filter((r) => r.ratio < (r.size >= 24 || (r.size >= 18.66 && r.weight >= 700) ? 3 : 4.5));
        check("contrast: all text meets WCAG AA on its real background", tag, lowContrast.length === 0, lowContrast.map((r) => `${r.ratio.toFixed(2)}:1 "${r.text}"`).slice(0, 6).join("; "));

        // ---- Real links, real images.
        const hrefs = await page.$$eval(".v5 a[href]", (as) => as.map((a) => a.getAttribute("href")));
        const internal = [...new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")))];
        const broken = [];
        for (const h of internal) {
          const r = await ctx.request.get(origin + h.split("#")[0]);
          if (r.status() !== 200) broken.push(`${h} → ${r.status()}`);
        }
        check("links: every internal link answers 200", tag, broken.length === 0, broken.length ? broken.join("; ") : `${internal.length} links`);
        const external = hrefs.filter((h) => /^https?:/.test(h)).filter((h) => !h.startsWith("https://"));
        check("links: external links are https", tag, external.length === 0, external.join(", "));
        const imgs = await page.$$eval(".v5 img", (els) =>
          els.map((i) => {
            const raw = i.currentSrc || i.src;
            return {
              src: raw.startsWith("data:") ? raw.slice(0, 18) : new URL(raw, location.href).pathname,
              alt: i.getAttribute("alt"),
              decorative: i.getAttribute("aria-hidden") === "true" || i.getAttribute("role") === "presentation",
              ok: i.complete && i.naturalWidth > 0,
            };
          }),
        );
        // A brand mark small enough for Vite to inline arrives as a data: SVG; a decorative mark may carry an empty alt.
        const badImgs = imgs.filter((i) => !i.ok || (!i.alt && !i.decorative) || !(IMAGE_ALLOW.test(i.src) || i.src.startsWith("data:image/svg+xml")));
        check("images: real, loaded, described (founder photo and brand marks only)", tag, badImgs.length === 0, badImgs.map((i) => `${i.src} alt="${i.alt}" loaded=${i.ok}`).join("; ") || `${imgs.length} images`);

        // ---- The page is a document: native scroll, nothing animating.
        await page.mouse.move(vp.width / 2, vp.height / 2);
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(400);
        const scrolled = await page.evaluate(() => window.scrollY);
        check("scroll: native, no scroll-jacking", tag, scrolled >= 600, `scrollY ${scrolled} after an 800px wheel`);
        await page.evaluate(() => window.scrollTo(0, 0));
        check("perf: same-origin transfer under 1.5 MB", tag, bytes <= MAX_BYTES, `${(bytes / 1024).toFixed(0)} kB`);
      }

      const animating = await page.evaluate(() =>
        document.getAnimations().map((a) => {
          const el = a.effect?.target;
          const inPage = Boolean(el?.closest?.(".v5"));
          return `${inPage ? "page" : "site chrome"}: <${el?.tagName?.toLowerCase() ?? "?"}${el?.className ? " ." + String(el.className).split(" ").slice(0, 2).join(".") : ""}> ${a.animationName ?? a.constructor.name}`;
        }),
      );
      const pageAnimations = animating.filter((a) => a.startsWith("page:"));
      check("motion: nothing on the page animates" + (reduced ? " (reduced motion)" : ""), tag, pageAnimations.length === 0, animating.join("; ") || "0 animations");
      check("console: no errors", tag, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

      // ---- Frames for the human review.
      if (!reduced) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400); // let the site's scroll-progress bar retract before the frame
        await page.screenshot({ path: path.join(OUT, `${vp.name}-top.png`) });
        const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        for (const pct of [25, 50, 75, 100]) {
          await page.evaluate((y) => window.scrollTo(0, y), Math.round((total * pct) / 100));
          await page.waitForTimeout(150);
          await page.screenshot({ path: path.join(OUT, `${vp.name}-${pct}.png`) });
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(OUT, `${vp.name}-full.png`), fullPage: true });
      } else {
        await page.screenshot({ path: path.join(OUT, `${vp.name}-reduced-top.png`) });
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
const lines = [
  `# Homepage Version 5 acceptance`,
  ``,
  `URL: ${URL_}  ·  ${new Date().toISOString()}  ·  ${results.length - failed.length}/${results.length} checks passed`,
  ``,
  `| Result | Check | Screen | Detail |`,
  `| --- | --- | --- | --- |`,
  ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.id} | ${r.viewport} | ${r.detail.replace(/\|/g, "\\|")} |`),
];
fs.writeFileSync(path.join(OUT, "REPORT.md"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ url: URL_, at: new Date().toISOString(), results }, null, 2));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.viewport.padEnd(16)} ${r.id}${r.detail ? `  — ${r.detail}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed. Frames and REPORT.md in ${OUT}`);
process.exit(failed.length ? 1 : 0);
