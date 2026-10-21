// Concept homepage legibility + a11y audit (local dev server).
// Checks: axe, horizontal overflow, dark-theme text fill on white surfaces,
// and contrast of every rendered text node against its nearest opaque backdrop.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.AUDIT_URL || 'http://localhost:5180/concepts/home-chapters';
const output = path.join(process.cwd(), 'artifacts/visual-qa/home-chapters-legibility');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { url: base, widths: {} };
try {
  for (const theme of ['dark', 'light']) {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    // Trigger scroll-reveal layers, then return to the top.
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 700) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const probe = await page.evaluate(() => {
      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(',').map((v) => parseFloat(v));
        return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
      };
      const lum = ({ r, g, b }) => {
        const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const blend = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });
      const backdrop = (el) => {
        let a = el;
        const stack = [];
        while (a && stack.length < 12) {
          const c = parse(getComputedStyle(a).backgroundColor);
          if (c && c.a > 0) stack.unshift(c);
          if (c && c.a >= 0.99) break;
          a = a.parentElement;
        }
        let color = { r: 10, g: 10, b: 10, a: 1 };
        for (const c of stack) color = blend(c, color);
        return color;
      };
      const contrast = (fg, bg) => {
        const c = blend(fg, bg);
        const l1 = lum(c), l2 = lum(bg);
        const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
        return (hi + 0.05) / (lo + 0.05);
      };
      const textNodes = [];
      const walker = document.createTreeWalker(document.querySelector('.hc') || document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text.length < 2) continue;
        const el = node.parentElement;
        if (!el) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.2) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const fg = parse(s.color);
        if (!fg) continue;
        const fillRaw = s.webkitTextFillColor || s.getPropertyValue('-webkit-text-fill-color');
        const fill = fillRaw && fillRaw !== 'none' ? parse(fillRaw) : fg;
        const used = fill || fg;
        const bg = backdrop(el);
        const ratio = contrast(used, bg);
        const size = parseFloat(s.fontSize);
        const weight = parseInt(s.fontWeight, 10) || 400;
        const large = size >= 24 || (weight >= 700 && size >= 18.66);
        const required = large ? 3 : 4.5;
        const bgLight = lum(bg) > 0.6;
        const usedLight = lum(blend(used, bg)) > 0.6;
        // Photo-backed cards (industry rail, monitor diagram) paint a dark shade
        // gradient over their <img>; backgroundColor-based backdrop detection
        // cannot see those, so skip the known-safe classes here. The Ask DE
        // launcher lives on the always-dark bottom bar (rgba(10,10,10,0.95)).
        const photoOverlay = el.closest('.ind-card, .monitor-figure, .de-bottom-bar, .de-unified-bar');
        if (photoOverlay) continue;
        if (ratio < required) {
          textNodes.push({
            text: text.slice(0, 48),
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 60),
            color: s.color,
            fill: fillRaw,
            bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
            ratio: Math.round(ratio * 100) / 100,
            required,
            size: Math.round(size),
            weight,
            section: (el.closest('.hc-section') || {}).id || '',
          });
        }
        if (bgLight && usedLight) {
          textNodes.push({ kind: 'light-on-light', text: text.slice(0, 48), tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), color: s.color, fill: fillRaw, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`, section: (el.closest('.hc-section') || {}).id || '' });
        }
        if (textNodes.length > 120) break;
      }
      const doc = document.documentElement;
      return {
        overflow: doc.scrollWidth - doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        sections: document.querySelectorAll('.hc-section').length,
        cards: document.querySelectorAll('.hc.v8 .v8-card, .hc.v8 .claim, .hc.v8 .problem, .hc.v8 .svc-path').length,
        links: document.querySelectorAll('.hc a[href]').length,
        forms: document.querySelectorAll('.hc form').length,
        theme: document.querySelector('.hc')?.getAttribute('data-theme'),
        textNodes,
      };
    });

    await page.screenshot({ path: path.join(output, `concept-${theme}-${width}.png`), fullPage: true });
    report.widths[`${theme}-${width}`] = {
      axe: {
        violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 6).map((n) => ({ target: n.target, html: n.html.slice(0, 140), summary: n.failureSummary?.slice(0, 160) })) })),
        incomplete: axe.incomplete.map((v) => v.id),
      },
      ...probe,
      consoleErrors: consoleErrors.slice(0, 10),
    };
    await context.close();
  }
  }
} finally {
  await browser.close();
}

await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
for (const [w, r] of Object.entries(report.widths)) {
  console.log(`\n== ${w}px ==`);
  console.log(`overflow=${r.overflow} sections=${r.sections} cards=${r.cards} links=${r.links} forms=${r.forms} theme=${r.theme}`);
  console.log(`axe violations: ${r.axe.violations.length ? r.axe.violations.map((v) => `${v.id}(${v.impact},${v.nodes})`).join(', ') : 'none'}`);
  console.log(`contrast/light-on-light issues: ${r.textNodes.length}`);
  for (const t of r.textNodes.slice(0, 25)) console.log(`  - [${t.kind || 'contrast'}] ${t.section}/${t.tag}.${t.cls} "${t.text}" color=${t.color} fill=${t.fill} bg=${t.bg} ratio=${t.ratio ?? '-'}`);
  if (r.consoleErrors.length) console.log(`console errors: ${r.consoleErrors.join(' | ')}`);
}
