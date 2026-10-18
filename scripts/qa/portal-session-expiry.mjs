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
import '../client/src/index.css';
import '../client/src/styles/portal.css';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><main><label>Draft<input aria-label="Draft" /></label><button onClick={() => window.dispatchEvent(new CustomEvent('de-portal-session-expired'))}>Expire session</button><PortalSessionExpiredDialog userId="example-a" /></main></QueryClientProvider>);
`);
const server = await createServer({ configFile: false, root, esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': path.join(root, 'client/src'), '@shared': path.join(root, 'shared') } }, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath: process.env.PORTAL_QA_CHROMIUM_PATH || undefined, headless: true });
  const observations = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let identity = 'expired';
    await page.route('**/api/portal/me', route => route.fulfill({ status: identity === 'expired' ? 401 : 200, contentType: 'application/json', body: JSON.stringify(identity === 'expired' ? { error: 'Expired' } : { user: { id: identity } }) }));
    await page.goto(`${origin}/${path.basename(fixture)}/index.html`);
    await page.getByLabel('Draft').fill('EXAMPLE unsaved ticket');
    const url = page.url();
    await page.getByRole('button', { name: 'Expire session' }).click();
    await page.getByRole('alertdialog').waitFor();
    const link = page.getByRole('link', { name: 'Sign in in a new tab' });
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.match(await link.getAttribute('href'), /^https:\/\/portal\.digeratiexperts\.com\/portal\/login\?/);
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
    await page.getByRole('button', { name: "I've signed in" }).click();
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByLabel('Draft').inputValue(), 'EXAMPLE unsaved ticket');
    assert.deepEqual(errors, []);
    observations.push({ width, expiredRejected: true, wrongAccountRejected: true, sameAccountAccepted: true, draftPreserved: true, navigationPreserved: true, overflow: false, pageErrors: errors });
    await context.close();
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ classification: 'EXAMPLE local browser fixture; not production evidence', observations }, null, 2));
  console.log(JSON.stringify(observations));
} finally {
  await browser?.close();
  await server.close();
  await rm(fixture, { recursive: true, force: true });
}
