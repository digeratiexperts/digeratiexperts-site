// Real production bundle, local public-page fixture. No live submissions or APIs.
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const output = path.join(root, 'artifacts/visual-qa/recovered-public-audit');
await mkdir(output, { recursive: true });
const routes = [
  '/go', '/about/press', '/about/compliance', '/solutions/standalone-services',
  '/resources/datasheets', '/resources/datasheets/proactive-ecosystem-overview',
  '/resources/checklists/backup-bcdr-checklist', '/resources/reports/cyber-risk-assessment-sample',
  '/resources/briefs/cyber-insurance-brief', '/resources/blog',
  '/resources/blog/can-ransomware-encrypt-your-backups',
  '/resources/blog/arizona-smb-cybersecurity-checklist',
  '/resources/blog/cyber-insurance-requirements-small-businesses',
  '/resources/blog/hipaa-cmmc-nist-cyber-insurance-managed-it-discipline',
  '/resources/blog/chatgpt-copilot-gemini-claude-business-data-security',
];
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };
const browser = await chromium.launch({ headless: true });
const observations = [];
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [], writes = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== 'de-audit.local') return route.abort();
      if (url.pathname.startsWith('/api/')) {
        if (request.method() !== 'GET') writes.push(url.pathname);
        return route.fulfill({ contentType: 'application/json', body: '{}' });
      }
      const relative = !path.extname(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const target = path.resolve(root, 'dist/public', relative);
      assert(target.startsWith(path.resolve(root, 'dist/public') + path.sep));
      try { return await route.fulfill({ body: await readFile(target), contentType: types[path.extname(target)] || 'application/octet-stream' }); }
      catch { return route.fulfill({ status: 404, body: 'Local fixture asset unavailable' }); }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    for (const route of routes) {
      await page.goto('http://de-audit.local' + route, { waitUntil: 'domcontentloaded' });
      await page.locator('h1').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const main = page.locator('main, article').first();
      const text = await main.innerText();
      const announcement = page.getByTestId('announce-start-assessment');
      if (await announcement.count()) {
        const copy = await announcement.evaluate(el => el.parentElement.textContent || '');
        assert(!/free\s+(cybersecurity|cyber risk)\s+assessment/i.test(copy), 'Shared announcement must not promise a free scoped assessment');
      }
      assert(!/For media buyers|How to advertise these|Draft public resource|Official NAP \(use exactly\)|surprise cost surprises|rest of Door 2|used across Door 2|\?\./i.test(text), route);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}: overflow at ${width}`);
      const cta = page.getByTestId('button-blog-assessment');
      if (await cta.count()) {
        await cta.scrollIntoViewIfNeeded();
        const geometry = await cta.evaluate(el => {
          const rect = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
          return { left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
        });
        const fits = geometry.left >= geometry.parentLeft - 1 && geometry.right <= geometry.parentRight + 1 && geometry.scrollWidth <= geometry.clientWidth + 1;
        if (!fits) {
          await page.screenshot({ path: path.join(output, `failure-${width}.png`) });
          await writeFile(path.join(output, `failure-${width}.json`), JSON.stringify({ route, geometry }));
        }
        assert(fits, `${route}: clipped assessment action at ${width}`);
        assert(await cta.getAttribute('href'), `${route}: missing continuation`);
      }
      const name = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-/, '');
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: false });
      observations.push({ route, width, overflow: false, blogActionFits: Boolean(await cta.count()), pageErrors: [...errors] });
      assert.deepEqual(errors, [], route);
    }
    // Any background telemetry is intercepted locally and never sent to DE.
    observations.push({ width, interceptedLocalWrites: [...new Set(writes)] });
    await context.close();
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ scope: 'EXAMPLE local production-bundle rendering; no live backend or submission verified', observations }, null, 2));
  console.log(JSON.stringify(observations));
} finally { await browser.close(); }
