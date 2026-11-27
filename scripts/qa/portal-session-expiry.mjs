// Local browser verification with EXAMPLE identity fixtures; no production calls.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const fixture = await mkdtemp(path.join(root, '.qa-session-'));
const output = path.join(root, 'artifacts/visual-qa/portal-session-expiry');
await mkdir(output, { recursive: true });
await writeFile(path.join(fixture, 'index.html'), '<html class="portal-scope" data-theme="black" data-contrast="none"><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
await writeFile(path.join(fixture, 'fixture.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalSessionExpiredDialog } from '../client/src/components/portal/shell/PortalSessionExpiredDialog';
import { installPortalSubmissions } from '../client/src/lib/portalSubmission';
import '../client/src/index.css';
import '../client/src/styles/portal.css';
installPortalSubmissions();
await fetch('/api/portal/me');
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><main><label>Draft<input aria-label="Draft" /></label><button onClick={() => void fetch('/api/portal/tickets', { method: 'POST' })}>Submit draft</button><PortalSessionExpiredDialog userId="example-a" /></main></QueryClientProvider>);
`);
const server = await createServer({ configFile: false, root, esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': path.join(root, 'client/src'), '@shared': path.join(root, 'shared') } }, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath: process.env.PORTAL_QA_CHROMIUM_PATH || undefined, headless: true });
  const observations = [];
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let identity = 'example-a';
    let scope = 'c'.repeat(64);
    let token = 'a'.repeat(64);
    let attempts = 0, accepted = 0;
    await page.route('**/api/portal/me', route => {
      assert.equal(route.request().headers()['x-de-csrf-request'], '1');
      return route.fulfill({
        status: identity === 'expired' ? 401 : 200,
        contentType: 'application/json',
        headers: identity === 'expired' ? {} : { 'X-DE-CSRF-Token': token, 'X-DE-CSRF-Context': scope },
        body: JSON.stringify(identity === 'expired' ? { error: 'Expired' } : { user: { id: identity } }),
      });
    });
    await page.route('**/api/portal/tickets', route => {
      attempts++;
      const valid = route.request().headers()['x-csrf-token'] === token;
      if (valid) accepted++;
      return route.fulfill({ status: valid ? 200 : 403, headers: valid ? {} : { 'X-DE-CSRF-Status': 'mismatch' }, json: {} });
    });
    await page.goto(`${origin}/${path.basename(fixture)}/index.html`);
    await page.getByLabel('Draft').fill('EXAMPLE unsaved ticket');
    const url = page.url();
    token = 'b'.repeat(64);
    await page.getByRole('button', { name: 'Submit draft' }).click();
    await page.getByRole('alertdialog').waitFor();
    const link = page.getByRole('link', { name: 'Sign in in a new tab' });
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.match(await link.getAttribute('href'), /^https:\/\/portal\.digeratiexperts\.com\/portal\/login\?/);
    identity = 'expired';
    await page.getByRole('button', { name: "I've signed in" }).click();
    await page.getByRole('alert').filter({ hasText: 'not restored yet' }).waitFor();
    identity = 'example-b';
    await page.getByRole('button', { name: "I've signed in" }).click();
    await page.getByRole('alert').filter({ hasText: 'same account' }).waitFor();
    assert.equal(await page.getByLabel('Draft').inputValue(), 'EXAMPLE unsaved ticket');
    assert.equal(page.url(), url);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: path.join(output, `reauth-${width}.png`) });
    identity = 'example-a';
    scope = 'd'.repeat(64);
    await page.getByRole('button', { name: "I've signed in" }).click();
    await page.getByRole('alert').filter({ hasText: 'same account and company' }).waitFor();
    await page.getByRole('button', { name: 'Back to draft' }).click();
    assert.equal(await page.getByLabel('Draft').inputValue(), 'EXAMPLE unsaved ticket');
    assert.deepEqual([attempts, accepted], [1, 0]);
    await page.getByRole('button', { name: 'Submit draft' }).click();
    await page.getByRole('alertdialog').waitFor();
    scope = 'c'.repeat(64);
    await page.getByRole('button', { name: "I've signed in" }).click();
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByLabel('Draft').inputValue(), 'EXAMPLE unsaved ticket');
    assert.deepEqual([attempts, accepted], [2, 0]);
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/portal/tickets') && response.ok()),
      page.getByRole('button', { name: 'Submit draft' }).click(),
    ]);
    assert.deepEqual([attempts, accepted], [3, 1]);
    assert.deepEqual(errors, []);
    observations.push({ width, expiredRejected: true, wrongAccountRejected: true, wrongCompanyRejected: true, accessibleDraft: true, sameAccountAccepted: true, explicitResubmission: true, draftPreserved: true, navigationPreserved: true, overflow: false, pageErrors: errors });
    await context.close();
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ classification: 'EXAMPLE local browser fixture; not production evidence', observations }, null, 2));
  console.log(JSON.stringify(observations));
} finally {
  await browser?.close();
  await server.close();
  await rm(fixture, { recursive: true, force: true });
}
